// Vertical vs horizontal scaling for a given load. Each vCPU handles ~250 req/s. Prices are illustrative, per month.
export const SIZES = [2, 4, 8, 16, 32, 64, 96];
const PRICE = (v: number) => v * 25 * (v >= 64 ? 1.6 : v >= 32 ? 1.25 : 1);
export const PER_VCPU = 250;
export function vertical(load: number) {
  const size = SIZES.find((v) => v * PER_VCPU >= load);
  return size ? { ok: true, size, cost: PRICE(size), cap: size * PER_VCPU, lossOnFailure: 100 } : { ok: false, size: 96, cost: PRICE(96), cap: 96 * PER_VCPU, lossOnFailure: 100 };
}
export function horizontal(load: number) {
  const nodeCap = 4 * PER_VCPU;
  const n = Math.max(2, Math.ceil((load * 1.25) / nodeCap)); // keep 25% headroom, at least 2
  return { ok: true, nodes: n, cost: n * PRICE(4) + 20, cap: n * nodeCap, lossOnFailure: Math.round(100 / n) };
}
