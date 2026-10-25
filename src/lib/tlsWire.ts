// The TLS handshake on the wire: how many bytes and round trips it costs before the first byte of
// the response. The server's first flight (ServerHello, EncryptedExtensions, Certificate,
// CertificateVerify, Finished) is sized message by message from the certificate chain, the key
// type, OCSP stapling and certificate compression (RFC 8879). Over TCP that flight must fit in the
// initial congestion window (10 segments since RFC 6928, 4 before) or it waits a round trip; over
// QUIC, before the client's address is checked the server may send only 3 × what it received
// (RFC 9000 §8.1), and the client's Initial is padded to 1,200 bytes, so 3,600 bytes. TLS 1.2
// needs two round trips, TLS 1.3 one, and a resumed TLS 1.3 session can send the request in the
// first flight (0-RTT). Certificate sizes, the compression ratio and signing times are typical
// values, not measurements of one site.

export type Version = "1.2" | "1.3";
export type Transport = "tcp" | "quic";
export type Key = "rsa2048" | "rsa4096" | "ecdsa";
export type Opts = { version: Version; transport: Transport; key: Key; longChain: boolean; stapling: boolean; compression: boolean; resumed: boolean; rtt: number; cwnd: 4 | 10 };

export const KEY_LABEL: Record<Key, string> = { rsa2048: "RSA 2048", rsa4096: "RSA 4096", ecdsa: "ECDSA P-256" };
const LEAF: Record<Key, number> = { rsa2048: 1350, rsa4096: 1610, ecdsa: 1010 }; // DER bytes, with SANs and SCTs
const INTERMEDIATE: Record<Key, number> = { rsa2048: 1300, rsa4096: 1300, ecdsa: 1040 };
const CROSS_SIGNED_ROOT = 1380;
const SIG: Record<Key, number> = { rsa2048: 256, rsa4096: 512, ecdsa: 71 };
const SIGN_MS: Record<Key, number> = { rsa2048: 1.2, rsa4096: 8, ecdsa: 0.1 }; // server CPU per handshake
const OCSP = 900; // a stapled response signed by a delegated responder
export const COMPRESSION = 0.72; // brotli on a typical chain
export const MSS = 1460;
export const CLIENT_INITIAL = 1200;

export type Message = { name: string; bytes: number; from: "client" | "server"; visible: boolean; note: string };

export function serverFlight(o: Opts): Message[] {
  const tls13 = o.version === "1.3";
  const out: Message[] = [];
  out.push({ name: "ServerHello", bytes: tls13 ? 122 : 90, from: "server", visible: true, note: tls13 ? "chosen cipher and the server's key share" : "chosen cipher and a random" });
  if (tls13) out.push({ name: "EncryptedExtensions", bytes: 22, from: "server", visible: false, note: "ALPN: h2" });
  if (o.resumed) {
    if (!tls13) out.push({ name: "ChangeCipherSpec + Finished", bytes: 6 + 40, from: "server", visible: false, note: "abbreviated handshake from a session ticket" });
    else out.push({ name: "Finished", bytes: 36, from: "server", visible: false, note: "no certificate: the pre-shared key proves who it is" });
    return out;
  }
  const certs = [LEAF[o.key] + (o.stapling ? OCSP : 0), INTERMEDIATE[o.key], ...(o.longChain ? [CROSS_SIGNED_ROOT] : [])];
  let chain = 4 + (tls13 ? 1 : 0) + 3 + certs.reduce((s, c) => s + 3 + c + (tls13 ? 2 : 0), 0);
  if (o.compression && tls13) chain = Math.round(chain * COMPRESSION) + 8;
  out.push({ name: o.compression && tls13 ? "CompressedCertificate" : "Certificate", bytes: chain, from: "server", visible: !tls13, note: `${certs.length} certificates${o.stapling ? " + stapled OCSP" : ""}${o.compression && tls13 ? ", brotli" : ""}` });
  if (tls13) {
    out.push({ name: "CertificateVerify", bytes: 8 + SIG[o.key], from: "server", visible: false, note: `${KEY_LABEL[o.key]} signature` });
    out.push({ name: "Finished", bytes: 36, from: "server", visible: false, note: "MAC over the whole handshake" });
  } else {
    out.push({ name: "ServerKeyExchange", bytes: 4 + 4 + 32 + 4 + SIG[o.key], from: "server", visible: true, note: `X25519 share, signed with ${KEY_LABEL[o.key]}` });
    out.push({ name: "ServerHelloDone", bytes: 4, from: "server", visible: true, note: "" });
  }
  return out;
}

export function clientHello(o: Opts): Message {
  const base = 517; // a typical browser ClientHello with key shares, SNI and ALPN
  return { name: "ClientHello", bytes: o.transport === "quic" ? CLIENT_INITIAL : base + (o.resumed ? 160 : 0), from: "client", visible: true, note: `SNI shop.example.com, ALPN ${o.transport === "quic" ? "h3" : "h2, http/1.1"}, X25519 key share${o.resumed ? ", session ticket" : ""}` };
}

export type Cost = {
  flight: number; // bytes on the wire in the server's first flight, with record or packet overhead
  limit: number;
  waits: number; // extra round trips because the flight didn't fit
  transportRtts: number;
  tlsRtts: number;
  requestRtts: number;
  total: number; // round trips to the first byte of the response
  ms: number;
  signMs: number;
};

export function cost(o: Opts): Cost {
  const msgs = serverFlight(o);
  const payload = msgs.reduce((s, m) => s + m.bytes, 0);
  const records = o.version === "1.3" ? 5 + 5 + 17 : 5 * msgs.length; // TLS 1.3: ServerHello record + one encrypted record
  let flight: number;
  if (o.transport === "quic") {
    const packets = Math.ceil(payload / 1150);
    flight = payload + packets * 50; // QUIC header, CRYPTO frame, AEAD tag
  } else flight = payload + records + Math.ceil((payload + records) / MSS) * 40; // TCP/IP headers per segment
  const cwnd = (o.transport === "quic" ? 10 : o.cwnd) * MSS;
  const limit = o.transport === "quic" ? Math.min(3 * CLIENT_INITIAL, cwnd) : cwnd;
  let waits = 0;
  if (o.transport === "quic") waits = flight > limit ? 1 : 0; // the client's ACK validates its address
  else for (let sent = limit, w = limit; sent < flight; w *= 2, sent += w) waits++;
  const transportRtts = o.transport === "tcp" ? 1 : 0; // QUIC carries the ClientHello in its first packet
  const tlsRtts = o.version === "1.2" && !o.resumed ? 2 : 1;
  const zeroRtt = o.resumed && o.version === "1.3";
  const requestRtts = zeroRtt ? 0 : 1;
  const total = transportRtts + (zeroRtt ? 1 : tlsRtts) + waits + requestRtts;
  const signMs = o.resumed ? 0 : SIGN_MS[o.key];
  return { flight, limit, waits, transportRtts, tlsRtts: zeroRtt ? 0 : tlsRtts, requestRtts, total, ms: total * o.rtt + signMs, signMs };
}
