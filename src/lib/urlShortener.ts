// Design a URL shortener: size it, generate short codes, look them up through a
// cache, redirect, and count clicks. Every number below is computed.

export const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const BASE = ALPHABET.length; // 62

export function base62(n: number) {
  if (n === 0) return "0";
  let s = "";
  while (n > 0) {
    s = ALPHABET[n % BASE] + s;
    n = Math.floor(n / BASE);
  }
  return s;
}

// 32-bit FNV-1a over the URL, run with two seeds; 5 base-62 digits from the first
// hash and 2 from the second make a 7-character code.
function fnv(str: string, seed: number) {
  let h = seed >>> 0;
  for (const c of str) {
    h ^= c.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
export function hashCode(url: string) {
  const digits = (h: number, n: number) => {
    let s = "";
    for (let i = 0; i < n; i++) {
      s += ALPHABET[h % BASE];
      h = Math.floor(h / BASE);
    }
    return s;
  };
  return digits(fnv(url, 0x811c9dc5), 5) + digits(fnv(url, 0x01234567), 2);
}

// Sizing from new links a month, with 100 reads for every write.
export const READ_RATIO = 100;
export const PEAK = 3;
export const ROW_BYTES = 500; // code, long URL, owner, created, expiry
export const YEARS = 5;
export const VOLUMES = [10e6, 100e6, 1e9];

export function size(perMonth: number) {
  const writes = perMonth / (30 * 86400);
  const reads = writes * READ_RATIO;
  const total = perMonth * 12 * YEARS;
  let len = 1;
  while (BASE ** len < total * 10) len++; // keep the space at least 10× fuller than needed
  return { writes, reads, peakReads: reads * PEAK, total, storageTB: (total * ROW_BYTES) / 1e12, len, space: BASE ** len };
}

export type CodeGen = "hash" | "counter" | "random";
export const CODEGENS: { id: CodeGen; label: string; one: string }[] = [
  { id: "hash", label: "Hash the URL", one: "Hash the long URL and keep the first 7 base-62 characters. The same URL always gets the same code, and different URLs can collide." },
  { id: "counter", label: "Counter", one: "Take the next number from a counter (handed out in blocks to each server) and write it in base 62. Never collides; codes are sequential and guessable." },
  { id: "random", label: "Random", one: "Pick 7 random base-62 characters and insert with a uniqueness check, retrying on the rare clash. Unguessable; costs a check per write." },
];

// Expected collisions among n codes drawn uniformly from a space of size N (birthday bound).
export const collisions = (n: number, N: number) => (n * n) / (2 * N);

// Zipf popularity: the share of clicks that go to the top k of n links (s = 1).
const harmonic = (n: number) => (n < 1e6 ? Array.from({ length: n }, (_, i) => 1 / (i + 1)).reduce((a, b) => a + b, 0) : Math.log(n) + 0.5772156649 + 1 / (2 * n));
export const hitRatio = (cached: number, links: number) => harmonic(Math.min(cached, links)) / harmonic(links);
export const CACHE_SIZES = [0, 1e5, 1e6, 1e7];

// Redirect status: 301 is cached by browsers, so repeat clicks never reach you.
export const CAMPAIGN = { clicks: 1000, browsers: 320 };
export function counted(code: 301 | 302) {
  return code === 301 ? CAMPAIGN.browsers : CAMPAIGN.clicks;
}

export const fmt = (n: number) => (n >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);
