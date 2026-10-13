// Percentage rollout by hashing user ids, so each user's answer is stable as the percentage rises.
export const USERS = Array.from({ length: 100 }, (_, i) => ({ id: `u${i + 1}`, staff: i < 4 }));
const bucket = (id: string) => { let h = 2166136261; for (const c of "new-checkout:" + id) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) % 100; };
export const BUCKETS = USERS.map((u) => bucket(u.id));
export function evaluate(pct: number, staffFirst: boolean, kill: boolean) {
  return USERS.map((u, i) => !kill && ((staffFirst && u.staff) || BUCKETS[i] < pct));
}
