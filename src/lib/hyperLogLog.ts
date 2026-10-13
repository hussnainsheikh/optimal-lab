// HyperLogLog with 64 registers: estimate distinct visitors from leading zeros of hashes.
export const M = 64; // registers (6 bits of the hash pick one)
const mix = (x: number) => { x = Math.imul(x ^ (x >>> 16), 0x7feb352d); x = Math.imul(x ^ (x >>> 15), 0x846ca68b); return (x ^ (x >>> 16)) >>> 0; };
const hash = (i: number) => mix(i * 2654435761 + 12345);
export function run(n: number) {
  const reg = Array(M).fill(0);
  for (let i = 0; i < n; i++) {
    const h = hash(i);
    const j = h & (M - 1);
    const w = h >>> 6; // remaining 26 bits
    let rank = 1; while (rank <= 26 && !(w & (1 << (26 - rank)))) rank++;
    reg[j] = Math.max(reg[j], rank);
  }
  const alpha = 0.709;
  let est = (alpha * M * M) / reg.reduce((s, r) => s + 2 ** -r, 0);
  const zeros = reg.filter((r) => r === 0).length;
  if (est <= 2.5 * M && zeros) est = M * Math.log(M / zeros);
  return { reg, est: Math.round(est), error: (est - n) / n, hllBytes: (M * 6) / 8, setBytes: n * 16 };
}
