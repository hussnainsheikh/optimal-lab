// Horizontal Pod Autoscaler: desired = ceil(current × currentUtilisation ÷ target).
export const REQUEST_M = 500, TARGET = 60, MIN = 2, MAX = 10;
export function decide(totalMillicores: number, current: number) {
  const util = (totalMillicores / current / REQUEST_M) * 100;
  const raw = Math.ceil(current * (util / TARGET));
  const desired = Math.min(MAX, Math.max(MIN, raw));
  return { util, raw, desired, capped: raw > MAX };
}
export function settle(totalMillicores: number) {
  let cur = 3; const steps = [];
  for (let i = 0; i < 5; i++) { const d = decide(totalMillicores, cur); steps.push({ cur, ...d }); if (d.desired === cur) break; cur = d.desired; }
  return steps;
}
