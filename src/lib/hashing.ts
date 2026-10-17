// SHA-256 written out in plain TypeScript (FIPS 180-4), so every step can be shown:
// text → bytes → padded 64-byte blocks → 64 mixing rounds per block → 256 bits.
// Checked against the standard test vectors ("abc", "") and Node's crypto.

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];
const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

/** UTF-8 bytes of a string. */
export function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

/** Append 0x80, zeros and the 64-bit bit length so the total is a multiple of 64 bytes. */
export function pad(bytes: number[]): number[] {
  const out = [...bytes, 0x80];
  while (out.length % 64 !== 56) out.push(0);
  const bits = bytes.length * 8;
  const hi = Math.floor(bits / 2 ** 32);
  for (const word of [hi, bits >>> 0]) out.push((word >>> 24) & 255, (word >>> 16) & 255, (word >>> 8) & 255, word & 255);
  return out;
}

/** SHA-256 of raw bytes, as 32 bytes. */
export function sha256Bytes(bytes: number[]): number[] {
  const m = pad(bytes);
  const h = [...H0];
  const w = new Array<number>(64);
  for (let off = 0; off < m.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      w[i] = ((m[j] << 24) | (m[j + 1] << 16) | (m[j + 2] << 8) | m[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }
  return h.flatMap((x) => [(x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255]);
}

export const toHex = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
export const sha256Hex = (text: string) => toHex(sha256Bytes(utf8(text)));

/** The 256 bits of a 32-byte digest, most significant first. */
export const bitsOf = (bytes: number[]) => bytes.flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >> (7 - i)) & 1));

export type Tweak = "same" | "case" | "space" | "char" | "bit";
export const TWEAKS: { id: Tweak; label: string }[] = [
  { id: "same", label: "Nothing (same text)" },
  { id: "case", label: "Capitalise first letter" },
  { id: "space", label: "Add a space" },
  { id: "char", label: "Next letter at the end" },
  { id: "bit", label: "Flip one bit" },
];

/** Bytes of the second input: the first input with one small change. */
export function tweakBytes(bytes: number[], t: Tweak): number[] {
  if (t === "same") return [...bytes];
  if (t === "space") return [...bytes, 0x20];
  if (bytes.length === 0) return [0x01];
  const out = [...bytes];
  if (t === "case") {
    const b = out[0];
    out[0] = b >= 0x61 && b <= 0x7a ? b - 32 : b >= 0x41 && b <= 0x5a ? b + 32 : b ^ 1;
    return out;
  }
  if (t === "char") {
    out[out.length - 1] = (out[out.length - 1] + 1) & 255;
    return out;
  }
  out[out.length - 1] ^= 1; // lowest bit of the last byte
  return out;
}

/** Which byte positions differ (for highlighting the input). */
export function changedBytes(a: number[], b: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) out.push(i);
  return out;
}

export function compare(text: string, t: Tweak) {
  const a = utf8(text);
  const b = tweakBytes(a, t);
  const ha = sha256Bytes(a);
  const hb = sha256Bytes(b);
  const ba = bitsOf(ha);
  const bb = bitsOf(hb);
  const diff = ba.map((x, i) => x !== bb[i]);
  const inputBitsChanged = changedBytes(a, b).reduce((n, i) => {
    let x = (a[i] ?? 0) ^ (b[i] ?? 0);
    let c = i >= a.length || i >= b.length ? 8 : 0;
    if (!c) while (x) { c += x & 1; x >>= 1; }
    return n + c;
  }, 0);
  return {
    a, b, ha, hb, ba, bb, diff,
    flipped: diff.filter(Boolean).length,
    inputBitsChanged,
    changed: changedBytes(a, b),
    blocksA: pad(a).length / 64,
    blocksB: pad(b).length / 64,
    hexA: toHex(ha),
    hexB: toHex(hb),
    textB: new TextDecoder().decode(new Uint8Array(b)),
  };
}
