// Liking a post when the server takes 800 ms, and sometimes fails.
export type Mode = "wait" | "optimistic";
export type Outcome = "ok" | "fail";
export const LATENCY = 800;
export const TIMES = [0, 50, 400, 800, 850, 1200];
export function at(m: Mode, o: Outcome, t: number) {
  const responded = t >= LATENCY;
  if (m === "wait") {
    if (!responded) return { liked: false, count: 41, pending: true, error: false };
    return { liked: o === "ok", count: o === "ok" ? 42 : 41, pending: false, error: o === "fail" };
  }
  if (!responded) return { liked: true, count: 42, pending: false, error: false };
  return o === "ok" ? { liked: true, count: 42, pending: false, error: false } : { liked: false, count: 41, pending: false, error: true };
}
