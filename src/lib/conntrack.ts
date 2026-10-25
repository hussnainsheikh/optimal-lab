// Stateless and stateful firewalls. A stateless filter judges each packet alone against its
// rules, so letting replies back in means opening every high port to everyone. A stateful one
// keeps a connection-tracking table: the first packet of a connection is checked against the
// rules, and replies that match a tracked entry are let in; a packet that belongs to no
// connection (a stray ACK) is INVALID. The table also has costs: entries expire after an idle
// timeout (5 days in Linux, 350 s in a NAT gateway), silently breaking quiet connections, and a
// flood of new connections can fill it so real ones are dropped. Timeouts are the documented
// defaults; query timings and traffic are generated.

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SERVER = "10.0.1.20";
export type Proto = "tcp" | "udp";
export type Pkt = { id: string; label: string; dir: "in" | "out"; proto: Proto; src: string; sport: number; dst: string; dport: number; flags?: string; wanted: boolean };

export const PACKETS: Pkt[] = [
  { id: "syn", label: "A customer opens HTTPS", dir: "in", proto: "tcp", src: "203.0.113.50", sport: 51514, dst: SERVER, dport: 443, flags: "SYN", wanted: true },
  { id: "synack", label: "The server answers", dir: "out", proto: "tcp", src: SERVER, sport: 443, dst: "203.0.113.50", dport: 51514, flags: "SYN ACK", wanted: true },
  { id: "dnsq", label: "The server looks up a name", dir: "out", proto: "udp", src: SERVER, sport: 41234, dst: "10.0.0.2", dport: 53, wanted: true },
  { id: "dnsr", label: "The DNS answer comes back", dir: "in", proto: "udp", src: "10.0.0.2", sport: 53, dst: SERVER, dport: 41234, wanted: true },
  { id: "redis", label: "A scanner tries Redis", dir: "in", proto: "tcp", src: "198.51.100.7", sport: 443, dst: SERVER, dport: 6379, flags: "SYN", wanted: false },
  { id: "ack", label: "A stray ACK to port 443", dir: "in", proto: "tcp", src: "198.51.100.7", sport: 40000, dst: SERVER, dport: 443, flags: "ACK", wanted: false },
];

export type Mode = "stateless" | "stateless-open" | "stateful";
export const MODE_LABEL: Record<Mode, string> = { stateless: "Stateless: allow 443 in", "stateless-open": "Stateless: + allow 1024–65535 in", stateful: "Stateful: 443 in + replies" };

export function rules(m: Mode): string[] {
  if (m === "stateful") return ["in  tcp dport 443 ct state NEW → accept", "in  ct state ESTABLISHED,RELATED → accept", "in  ct state INVALID → drop", "out ct state NEW,ESTABLISHED → accept", "in  default → drop"];
  const base = ["in  tcp dport 443 → accept"];
  if (m === "stateless-open") base.push("in  tcp,udp dport 1024-65535 → accept   # so replies can come back");
  return [...base, "out any → accept", "in  default → drop"];
}

export type Entry = { proto: Proto; orig: string; reply: string; state: string; timeout: number };
export type Verdict = { pkt: Pkt; accept: boolean; why: string; table: Entry[] };

const tuple = (p: { proto: Proto; src: string; sport: number; dst: string; dport: number }) => `${p.proto} ${p.src}:${p.sport} → ${p.dst}:${p.dport}`;

export function judge(m: Mode): Verdict[] {
  const table: Entry[] = [];
  const out: Verdict[] = [];
  for (const p of PACKETS) {
    let accept: boolean;
    let why: string;
    if (m === "stateful") {
      const reverse = tuple({ proto: p.proto, src: p.dst, sport: p.dport, dst: p.src, dport: p.sport });
      const hit = table.find((e) => e.orig === reverse || e.orig === tuple(p));
      if (hit) {
        accept = true;
        hit.state = p.proto === "udp" ? "ASSURED" : p.flags?.includes("SYN") ? "SYN_RECV" : "ESTABLISHED";
        hit.timeout = p.proto === "udp" ? 180 : 432_000;
        why = `matches tracked ${p.proto} entry: ESTABLISHED`;
      } else if (p.proto === "tcp" && !p.flags?.includes("SYN")) {
        accept = false;
        why = "no tracked connection and not a SYN: INVALID";
      } else if (p.dir === "out" || (p.proto === "tcp" && p.dport === 443)) {
        accept = true;
        why = p.dir === "out" ? "outbound NEW is allowed" : "NEW to port 443 is allowed";
        table.push({ proto: p.proto, orig: tuple(p), reply: tuple({ proto: p.proto, src: p.dst, sport: p.dport, dst: p.src, dport: p.sport }), state: p.proto === "udp" ? "UNREPLIED" : "SYN_SENT", timeout: p.proto === "udp" ? 30 : 120 });
      } else {
        accept = false;
        why = "NEW to a closed port: default drop";
      }
    } else if (p.dir === "out") {
      accept = true;
      why = "outbound: allowed";
    } else if (p.proto === "tcp" && p.dport === 443) {
      accept = true;
      why = "port 443: allowed";
    } else if (m === "stateless-open" && p.dport >= 1024) {
      accept = true;
      why = `port ${p.dport} is in 1024–65535: allowed, whoever sent it`;
    } else {
      accept = false;
      why = `port ${p.dport}: default drop`;
    }
    out.push({ pkt: p, accept, why, table: table.map((e) => ({ ...e })) });
  }
  return out;
}

// ── Idle connections ─────────────────────────────────────────────────────────

export const IDLE_TIMEOUTS = [
  { id: 432000, label: "Linux default, 5 days" },
  { id: 600, label: "Cloud firewall, 10 min" },
  { id: 350, label: "NAT gateway, 350 s" },
  { id: 240, label: "Load balancer, 4 min" },
];
export const KEEPALIVES = [
  { id: 0, label: "Off" },
  { id: 7200, label: "Linux default, 2 h" },
  { id: 60, label: "Every 60 s" },
];
export const HANG_S = 924.6; // TCP gives up after 15 retransmissions (tcp_retries2)
export const HOURS = 8;

let gaps: number[] | null = null;
// Seconds between queries on one pooled database connection over a working day.
export function queryGaps(): number[] {
  if (gaps) return gaps;
  const r = rng(12);
  const out: number[] = [];
  let t = 0;
  while (t < HOURS * 3600) {
    const g = Math.exp(Math.log(240) + 1.1 * Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()));
    out.push(g);
    t += g;
  }
  gaps = out;
  return out;
}

export function idleDay(timeout: number, keepalive: number, reset: boolean) {
  const gs = queryGaps();
  let broken = 0;
  let hung = 0;
  const marks: { t: number; ok: boolean }[] = [];
  let t = 0;
  for (const g of gs) {
    t += g;
    // with keepalive probes more often than the timeout, the entry never goes idle long enough
    const quiet = keepalive > 0 && keepalive < g ? keepalive : g;
    const ok = quiet <= timeout;
    if (!ok) {
      broken++;
      hung += reset ? 0 : HANG_S;
    }
    marks.push({ t, ok });
  }
  return { queries: gs.length, broken, hung, marks };
}

// ── Filling the table ────────────────────────────────────────────────────────

export const LEGIT_PER_S = 300;
export const LEGIT_LIFE = 125; // seconds tracked: the connection plus TIME_WAIT
export const HALF_OPEN = 60; // seconds a SYN that never completes stays tracked (SYN_RECV)

export function flood(attackPerS: number, max: number, notrack: boolean) {
  const attack = notrack ? 0 : attackPerS * HALF_OPEN;
  const legit = LEGIT_PER_S * LEGIT_LIFE;
  const wanted = attack + legit;
  const accepted = wanted <= max ? 1 : max / wanted; // new entries only fit as old ones expire
  return { attackEntries: attack, legitEntries: legit, used: Math.min(max, wanted), accepted, fullAt: Math.max(0, (max - legit) / HALF_OPEN) };
}
