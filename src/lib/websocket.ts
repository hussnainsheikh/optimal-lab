// WebSockets (RFC 6455). The opening handshake is an HTTP/1.1 GET with Upgrade: websocket; the
// server proves it understood by hashing the client's Sec-WebSocket-Key with a fixed GUID
// (SHA-1, then base64) into Sec-WebSocket-Accept. After the 101 response the connection carries
// frames: a 2-byte header (FIN, opcode, MASK bit, 7-bit length) extended to 16 or 64 bits for
// longer payloads, a 4-byte masking key on every client frame, and the payload XORed with it.
// Frames are encoded here byte for byte. The last part runs an hour of a chat connection
// through a proxy that closes connections idle longer than its timeout, with and without
// pings. Message timings are generated.

export const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function sha1(bytes: Uint8Array): Uint8Array {
  const ml = bytes.length * 8;
  const withPad = new Uint8Array((((bytes.length + 8) >> 6) + 1) * 64);
  withPad.set(bytes);
  withPad[bytes.length] = 0x80;
  const dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 4, ml >>> 0);
  dv.setUint32(withPad.length - 8, Math.floor(ml / 2 ** 32));
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      const f = i < 20 ? (b & c) | (~b & d) : i < 40 ? b ^ c ^ d : i < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const odv = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => odv.setUint32(i * 4, h));
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function base64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=") + (i + 2 < bytes.length ? B64[n & 63] : "=");
  }
  return out;
}

export const sha1Hex = (s: string) => Array.from(sha1(new TextEncoder().encode(s)), (x) => x.toString(16).padStart(2, "0")).join("");

export function accept(key: string): string {
  return base64(sha1(new TextEncoder().encode(key + GUID)));
}

// A 16-byte random key, base64 encoded, from a seed so the page is reproducible.
export function makeKey(seed: number): string {
  let a = seed >>> 0;
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    a = (Math.imul(a ^ (a >>> 15), 0x2c1b3c6d) + 0x297a2d39) >>> 0;
    bytes[i] = a & 0xff;
  }
  return base64(bytes);
}

export function upgradeRequest(key: string): string {
  return ["GET /chat HTTP/1.1", "Host: chat.example.com", "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Key: ${key}`, "Sec-WebSocket-Version: 13", "Origin: https://chat.example.com", "", ""].join("\r\n");
}

export function upgradeResponse(key: string): string {
  return ["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Accept: ${accept(key)}`, "", ""].join("\r\n");
}

export type Opcode = 1 | 2 | 8 | 9 | 10;
export const OPCODE_NAME: Record<Opcode, string> = { 1: "text", 2: "binary", 8: "close", 9: "ping", 10: "pong" };

export type Part = { name: string; bytes: number[]; note: string };

export function frame(payload: Uint8Array, opcode: Opcode, maskKey: number[] | null): Part[] {
  const parts: Part[] = [];
  const len = payload.length;
  parts.push({ name: "FIN + opcode", bytes: [0x80 | opcode], note: `FIN=1, opcode ${opcode} (${OPCODE_NAME[opcode]})` });
  const maskBit = maskKey ? 0x80 : 0;
  if (len < 126) parts.push({ name: "MASK + length", bytes: [maskBit | len], note: `mask=${maskKey ? 1 : 0}, length ${len}` });
  else if (len < 65536) {
    parts.push({ name: "MASK + 126", bytes: [maskBit | 126], note: `mask=${maskKey ? 1 : 0}, 126 = 16-bit length follows` });
    parts.push({ name: "length (16 bits)", bytes: [len >> 8, len & 0xff], note: String(len) });
  } else {
    parts.push({ name: "MASK + 127", bytes: [maskBit | 127], note: `mask=${maskKey ? 1 : 0}, 127 = 64-bit length follows` });
    parts.push({ name: "length (64 bits)", bytes: [0, 0, 0, 0, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff], note: String(len) });
  }
  if (maskKey) {
    parts.push({ name: "masking key", bytes: maskKey, note: "random per frame" });
    parts.push({ name: "payload, masked", bytes: Array.from(payload, (b, i) => b ^ maskKey[i % 4]), note: "byte i XOR key[i mod 4]" });
  } else parts.push({ name: "payload", bytes: Array.from(payload), note: "servers never mask" });
  return parts;
}

export function unmask(masked: number[], key: number[]): string {
  return new TextDecoder().decode(new Uint8Array(masked.map((b, i) => b ^ key[i % 4])));
}

// Bytes per chat message: a WebSocket frame vs polling with a full HTTP request and response.
export function overhead(payloadBytes: number) {
  const wsClient = (payloadBytes < 126 ? 2 : payloadBytes < 65536 ? 4 : 10) + 4;
  const wsServer = payloadBytes < 126 ? 2 : payloadBytes < 65536 ? 4 : 10;
  const pollRequest = 420; // GET line, Host, cookies, user agent, accept headers
  const pollResponse = 260; // status line, content type, length, cache headers
  return { wsClient, wsServer, poll: pollRequest + pollResponse };
}

// ── An hour through a proxy ──────────────────────────────────────────────────

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

export const HOUR = 3600;
let msgTimes: number[] | null = null;
// Chat messages in bursts with long quiet gaps: seconds into the hour.
export function messages(): number[] {
  if (msgTimes) return msgTimes;
  const r = rng(21);
  const out: number[] = [];
  let t = 5;
  while (t < HOUR) {
    const burst = 2 + Math.floor(r() * 6);
    for (let i = 0; i < burst && t < HOUR; i++) {
      out.push(Math.round(t));
      t += 2 + r() * 20;
    }
    t += 30 + -Math.log(1 - r()) * 140; // quiet gap
  }
  msgTimes = out;
  return out;
}

export type Idle = { drops: number[]; lost: number; delivered: number; pings: number; down: [number, number][] };

// The proxy closes the connection after `timeout` seconds without traffic in either direction.
// The client notices only when it next tries to use it, or on its own ping; it reconnects in
// `reconnect` seconds. Messages pushed by the server while the connection is down are lost.
export function idleHour(timeout: number, ping: number, reconnect = 2): Idle {
  const ms = messages();
  const drops: number[] = [];
  const down: [number, number][] = [];
  let last = 0;
  let pings = 0;
  let lost = 0;
  let i = 0;
  let t = 0;
  while (t < HOUR) {
    const nextMsg = i < ms.length ? ms[i] : Infinity;
    const nextPing = ping > 0 ? last + ping : Infinity;
    const deadline = last + timeout;
    const next = Math.min(nextMsg, nextPing, HOUR);
    if (deadline < next) {
      // closed for being idle; nobody notices until the next ping or message
      drops.push(deadline);
      const noticed = Math.min(next, HOUR);
      const back = noticed + reconnect;
      down.push([deadline, Math.min(back, HOUR)]);
      while (i < ms.length && ms[i] < back) {
        lost++;
        i++;
      }
      t = back;
      last = back;
      continue;
    }
    t = next;
    if (next === nextMsg) {
      i++;
      last = t;
    } else if (next === nextPing) {
      pings++;
      last = t;
    } else break;
  }
  return { drops, lost, delivered: ms.length - lost, pings, down };
}
