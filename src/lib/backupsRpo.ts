// A bad migration drops the orders table at 14:30. How much can you get back, and how fast?
export type Strategy = "nightly" | "hourly" | "pitr";
export const STRATEGIES: { id: Strategy; label: string }[] = [
  { id: "nightly", label: "Nightly full backup (02:00)" },
  { id: "hourly", label: "Hourly snapshots" },
  { id: "pitr", label: "Continuous WAL archiving (PITR)" },
];
export const DISASTER = 14.5;
export function evaluate(s: Strategy) {
  const restorePoint = s === "nightly" ? 2 : s === "hourly" ? 14 : 14.49;
  const points = s === "nightly" ? [2] : s === "hourly" ? Array.from({ length: 15 }, (_, h) => h) : [];
  const lostH = DISASTER - restorePoint;
  const rtoMin = s === "nightly" ? 95 : s === "hourly" ? 25 : 40;
  const lostOrders = Math.round(lostH * 1200);
  return { restorePoint, points, lostH, rtoMin, lostOrders };
}
export const clock = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
