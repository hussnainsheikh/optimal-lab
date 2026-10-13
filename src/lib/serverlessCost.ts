// Functions vs an always-on container, by monthly traffic. Example prices only.
// Function: $0.20 per million requests + 128 MB × 120 ms compute. Container: 2 small instances for redundancy.
export function costs(reqMillions: number) {
  const fn = reqMillions * 0.2 + reqMillions * 1e6 * 0.125 * 0.12 * 0.0000166667;
  const containers = Math.max(2, Math.ceil((reqMillions * 1e6) / (30 * 86400) / 80)) * 30;
  return { fn, containers };
}
export const SERIES = [0.1, 0.5, 1, 3, 10, 30, 100, 300].map((m) => ({ m, ...costs(m) }));
// Cold starts: share of requests that hit a new instance, by traffic shape
export const COLD = { steady: 0.002, spiky: 0.04, rare: 0.6 };
