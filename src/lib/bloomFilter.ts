// A Bloom filter: a row of bits and a few hash functions. Adding an item sets k bits.
// Checking an item looks at the same k bits: any 0 means "definitely not added";
// all 1s means "probably added", because other items may have set those bits.

export const M = 24; // bits
export const K = 3; // hash functions

function hash(s: string, seed: number) {
  let h = 2166136261 ^ seed;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % M;
}

export const positions = (s: string) => [...new Set([0, 1, 2].slice(0, K).map((i) => hash(s, i * 7919 + 1)))];

export const ADDED = ["alice", "bob", "carol", "dave", "erin"];

export function bits(items: string[]) {
  const b = Array<boolean>(M).fill(false);
  for (const it of items) for (const p of positions(it)) b[p] = true;
  return b;
}

export function check(item: string, items: string[]) {
  const b = bits(items);
  const pos = positions(item);
  const maybe = pos.every((p) => b[p]);
  const really = items.includes(item);
  return { pos, maybe, really, falsePositive: maybe && !really };
}

// Expected false-positive rate after n items.
export const fpRate = (n: number, m = M, k = K) => (1 - Math.exp((-k * n) / m)) ** k;
