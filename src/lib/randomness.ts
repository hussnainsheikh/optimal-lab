// Where a server's "random" tokens come from, and whether someone who has seen a few can guess the next.
//   counter   token = previous + 1
//   lcg       a linear congruential generator seeded from the clock (like old rand()): fast, not secret
//   crypto    the operating system's cryptographic random generator (crypto.getRandomValues)

export type Source = "counter" | "lcg" | "crypto";
export const SOURCES: { id: Source; label: string }[] = [
  { id: "counter", label: "Counter" },
  { id: "lcg", label: "Clock-seeded rand()" },
  { id: "crypto", label: "Crypto RNG" },
];

/** The seed: the second the server started, 2026-10-17 09:00:00 UTC. Anyone can guess a clock. */
export const START_SECONDS = 1792227600;
export const LCG_A = 1103515245;
export const LCG_C = 12345;

/** One LCG step: x' = (a·x + c) mod 2^31. Math.imul keeps the multiply exact in 32 bits. */
export const lcgNext = (x: number) => (Math.imul(LCG_A, x) + LCG_C) & 0x7fffffff;

export const hex8 = (n: number) => (n >>> 0).toString(16).padStart(8, "0");

/** The k-th token (0-based) for the predictable sources: 32-bit values, shown as 8 hex digits. */
export function predictableToken(source: "counter" | "lcg", k: number): string {
  if (source === "counter") return hex8(0x0001a2f0 + k);
  let x = START_SECONDS & 0x7fffffff;
  for (let i = 0; i <= k; i++) x = lcgNext(x);
  return hex8(x);
}

/**
 * What an observer can work out from the last token they saw.
 * Counter: add one. LCG: the token IS the generator's whole state, so run one more step.
 * Crypto: nothing. Every bit is fresh and independent.
 */
export function predictNext(source: Source, last: string | undefined): string | null {
  if (!last) return null;
  const v = parseInt(last, 16);
  if (source === "counter") return hex8(v + 1);
  if (source === "lcg") return hex8(lcgNext(v));
  return null;
}

/** Fresh random bytes from the OS (browser or Node). Call from event handlers, not during render. */
export function cryptoToken(bytes = 16): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Bits of unpredictability an observer faces for the next token. */
export const unknownBits = (source: Source, bytes = 16) => (source === "crypto" ? bytes * 8 : 0);

/**
 * Guessing a random token of `bits` bits at `perSecond` guesses a second:
 * on average half the possible values have to be tried.
 */
export function guessTime(bits: number, perSecond: number) {
  const seconds = 2 ** (bits - 1) / perSecond;
  return { seconds, label: humanTime(seconds) };
}

export function humanTime(s: number): string {
  if (s < 1) return "under a second";
  if (s < 120) return `${Math.round(s)} seconds`;
  if (s < 7200) return `${Math.round(s / 60)} minutes`;
  if (s < 172800) return `${Math.round(s / 3600)} hours`;
  if (s < 3.156e7 * 2) return `${Math.round(s / 86400)} days`;
  const years = s / 3.156e7;
  if (years < 1e6) return `${Math.round(years).toLocaleString("en-US")} years`;
  return `about 10^${Math.floor(Math.log10(years))} years`;
}

// ---- Nonces: a number used once ----
// A stream cipher XORs the message with a keystream made from (key, nonce).
// Reuse the nonce and two messages share a keystream: c1 XOR c2 = m1 XOR m2, and the key drops out.

/** A toy keystream byte for (key, nonce, position). Not a real cipher. */
export function keystreamByte(key: number, nonce: number, i: number) {
  let x = (key * 2654435761 + nonce * 40503 + i * 97) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12; x = Math.imul(x, 0x297a2d39) >>> 0; x ^= x >>> 15;
  return x & 255;
}

export function streamEncrypt(text: string, key: number, nonce: number): number[] {
  return Array.from(text, (ch, i) => (ch.charCodeAt(0) & 255) ^ keystreamByte(key, nonce, i));
}

/** XOR two ciphertexts. With a shared nonce, a 0 byte means the two messages had the same letter there. */
export const xorBytes = (a: number[], b: number[]) => a.slice(0, Math.min(a.length, b.length)).map((x, i) => x ^ b[i]);
