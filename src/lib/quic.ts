// HTTP/3 and QUIC. Part one counts round trips to the first byte: HTTP/2 over TCP + TLS 1.3 on a
// first visit (which learns about HTTP/3 from an Alt-Svc header), HTTP/3 afterwards or straight
// away from an HTTPS DNS record (RFC 9460), and 0-RTT on a resumed connection. Part two builds the
// real header bytes of a TCP segment and of a QUIC short-header packet (RFC 9000) and marks what an
// on-path box can read: TCP shows ports, sequence numbers, flags and window; QUIC shows UDP ports,
// one partly protected flags byte and the connection ID. Part three moves a download to a new
// network: TCP's connection is bound to the old address, so it reconnects and starts over or
// resumes with a Range request; QUIC validates the new path and carries on under the same
// connection, with a fresh connection ID so the two paths can't be linked. Bandwidths, file size
// and timings are illustrative.

export type Visit = "first" | "repeat" | "httpsRecord" | "zeroRtt";
export const VISIT_LABEL: Record<Visit, string> = { first: "First visit (Alt-Svc)", repeat: "Next visit", httpsRecord: "HTTPS DNS record", zeroRtt: "Resumed, 0-RTT" };

export function firstByte(v: Visit): { proto: string; setup: number; total: number; how: string } {
  switch (v) {
    case "first":
      return { proto: "HTTP/2 over TCP", setup: 2, total: 3, how: "TCP, then TLS 1.3, then the request. The response carries alt-svc: h3=\":443\"; ma=86400." };
    case "repeat":
      return { proto: "HTTP/3 over QUIC", setup: 1, total: 2, how: "The browser remembered Alt-Svc. QUIC's first packet carries the TLS ClientHello, so transport and encryption share one round trip." };
    case "httpsRecord":
      return { proto: "HTTP/3 over QUIC", setup: 1, total: 2, how: "The DNS lookup also returned an HTTPS record with alpn=h3, so even the first visit uses QUIC." };
    case "zeroRtt":
      return { proto: "HTTP/3, 0-RTT", setup: 0, total: 1, how: "With a saved ticket, the GET rides in the first flight. 0-RTT data can be replayed, so only safe requests like GET go there." };
  }
}

export type Field = { name: string; hex: string; visible: boolean; value: string };

const hex = (n: number, bytes: number) =>
  Array.from({ length: bytes }, (_, i) => ((n >>> ((bytes - 1 - i) * 8)) & 0xff).toString(16).padStart(2, "0")).join(" ");

function noise(seed: number, n: number): string {
  let a = seed >>> 0;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    a = (Math.imul(a ^ (a >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0;
    out.push((a & 0xff).toString(16).padStart(2, "0"));
  }
  return out.join(" ");
}

export const SRC_PORT = 51514;
export const DCID = [0x8f, 0x3a, 0x51, 0xc2, 0x07, 0x9e, 0x44, 0xb1];
export const DCID2 = [0x1d, 0x6e, 0xa9, 0x30, 0xf5, 0x82, 0x0c, 0x77];
const cidHex = (c: number[]) => c.map((b) => b.toString(16).padStart(2, "0")).join(" ");

export function tcpSegment(): Field[] {
  const flags = 0x5018; // data offset 5 words, ACK + PSH
  return [
    { name: "source port", hex: hex(SRC_PORT, 2), visible: true, value: String(SRC_PORT) },
    { name: "destination port", hex: hex(443, 2), visible: true, value: "443" },
    { name: "sequence number", hex: hex(0x8a3f12c4, 4), visible: true, value: String(0x8a3f12c4) },
    { name: "acknowledgment", hex: hex(0x5d20e781, 4), visible: true, value: String(0x5d20e781) },
    { name: "offset + flags", hex: hex(flags, 2), visible: true, value: "ACK PSH" },
    { name: "window", hex: hex(501, 2), visible: true, value: "501 (×128 scale)" },
    { name: "checksum", hex: hex(0x7c3a, 2), visible: true, value: "0x7c3a" },
    { name: "urgent pointer", hex: hex(0, 2), visible: true, value: "0" },
    { name: "TLS record header", hex: "17 03 03 00 4d", visible: true, value: "application data, 77 bytes" },
    { name: "encrypted HTTP/2 frames", hex: noise(7, 77), visible: false, value: "77 bytes" },
  ];
}

export function quicPacket(migrated: boolean): Field[] {
  const payload = 77 + 16; // frames + AEAD tag
  return [
    { name: "UDP source port", hex: hex(migrated ? 40122 : SRC_PORT, 2), visible: true, value: String(migrated ? 40122 : SRC_PORT) },
    { name: "UDP destination port", hex: hex(443, 2), visible: true, value: "443" },
    { name: "UDP length", hex: hex(8 + 1 + 8 + 2 + payload, 2), visible: true, value: String(8 + 1 + 8 + 2 + payload) },
    { name: "UDP checksum", hex: hex(0x51e0, 2), visible: true, value: "0x51e0" },
    { name: "flags", hex: "4?", visible: true, value: "short header; low bits protected" },
    { name: "destination connection ID", hex: cidHex(migrated ? DCID2 : DCID), visible: true, value: migrated ? "new ID after the move" : "chosen by the server" },
    { name: "packet number", hex: noise(3, 2), visible: false, value: "protected" },
    { name: "encrypted frames + tag", hex: noise(11, payload), visible: false, value: `${payload} bytes` },
  ];
}

export const bytesOf = (f: Field[]) => f.reduce((s, x) => s + x.hex.split(" ").length, 0);
export const visibleBytes = (f: Field[]) => f.filter((x) => x.visible).reduce((s, x) => s + x.hex.split(" ").length, 0);

// ── Part three: change networks mid-download ─────────────────────────────────

export type Move = "walk" | "nat";
export type Strategy = "restart" | "range" | "quic";
export const STRATEGY_LABEL: Record<Strategy, string> = { restart: "TCP, start over", range: "TCP, resume with Range", quic: "QUIC, migrate" };
export const FILE_MB = 40;
export const SWITCH_AT = 3; // seconds
export const PATHS = { wifi: { mbps: 50, rtt: 0.02 }, cell: { mbps: 30, rtt: 0.06 } };
const INIT_CWND = 14_600; // bytes

// Seconds and bytes to ramp from the initial window to the path's bandwidth-delay product.
function slowStart(mbps: number, rtt: number) {
  const bdp = (mbps * 1e6 * rtt) / 8;
  const k = Math.max(0, Math.ceil(Math.log2(bdp / INIT_CWND)));
  return { seconds: k * rtt, bytes: INIT_CWND * (2 ** k - 1) };
}

export type Run = { points: [number, number][]; done: number; wastedMb: number; stall: number; events: string[] };

export function migrate(move: Move, s: Strategy): Run {
  const before = PATHS.wifi;
  const after = move === "walk" ? PATHS.cell : PATHS.wifi;
  const total = FILE_MB * 1e6;
  const rateA = (before.mbps * 1e6) / 8;
  const rateB = (after.mbps * 1e6) / 8;
  const got = Math.min(total, rateA * SWITCH_AT);
  const inFlight = rateA * before.rtt; // sent but not yet delivered when the path broke
  const pts: [number, number][] = [[0, 0], [SWITCH_AT, got / 1e6]];
  const events: string[] = [];
  let t = SWITCH_AT;
  let have = got;
  let wasted = inFlight;
  if (s === "quic") {
    events.push(move === "walk" ? "packets leave from the 5G address with a new connection ID" : "the NAT gives the flow a new port; the connection ID still matches");
    t += after.rtt; // PATH_CHALLENGE / PATH_RESPONSE
    events.push("server validates the new path (1 round trip) and keeps the same connection");
    if (move === "walk") {
      const ss = slowStart(after.mbps, after.rtt);
      t += ss.seconds;
      have += ss.bytes;
      events.push("congestion window restarts on the new path");
    } else events.push("same path, so the congestion window is kept");
    have = Math.min(total, have);
  } else {
    // the old connection is gone: TCP is identified by its addresses and ports
    t += move === "walk" ? 0.2 : after.rtt; // OS reports the network change, or the server answers the new port with a reset
    events.push(move === "walk" ? "the OS reports the network change; the TCP connection is bound to the Wi-Fi address" : "the server doesn't know the new port and answers with a reset");
    t += 2 * after.rtt; // TCP + TLS 1.3
    events.push("new TCP and TLS handshakes (2 round trips)");
    t += after.rtt; // the request
    if (s === "restart") {
      wasted += have;
      have = 0;
      events.push("GET again from byte 0: everything downloaded so far is thrown away");
    } else events.push(`GET with Range: bytes=${Math.round(have)}- picks up where it stopped`);
    pts.push([t, have / 1e6]);
    const ss = slowStart(after.mbps, after.rtt);
    t += ss.seconds;
    have = Math.min(total, have + ss.bytes);
    events.push("new connection starts in slow start");
  }
  pts.push([t, have / 1e6]);
  const stall = t - SWITCH_AT;
  t += (total - have) / rateB;
  pts.push([t, total / 1e6]);
  return { points: pts, done: t, wastedMb: wasted / 1e6, stall, events };
}

// ── Part four: when UDP is blocked ───────────────────────────────────────────

export type Fallback = "race" | "timeout" | "quicOnly";
export const FALLBACK_LABEL: Record<Fallback, string> = { race: "Race QUIC and TCP", timeout: "QUIC first, TCP after 1 s", quicOnly: "QUIC only" };

export function fallback(blocked: boolean, f: Fallback, rtt: number): { ms: number | null; proto: string } {
  const tcp = 3 * rtt; // TCP, TLS, request
  const quic = 2 * rtt;
  if (!blocked) return { ms: quic, proto: "HTTP/3" };
  if (f === "race") return { ms: tcp, proto: "HTTP/2 (TCP won the race)" };
  if (f === "timeout") return { ms: 1000 + tcp, proto: "HTTP/2 after giving up on QUIC" };
  return { ms: null, proto: "no connection" };
}
