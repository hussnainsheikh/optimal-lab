// Typing 5 characters into a search box whose parent also renders an expensive chart.
export type Mode = "none" | "memo" | "memoBroken";
export const MODES: { id: Mode; label: string }[] = [
  { id: "none", label: "No memoisation" },
  { id: "memoBroken", label: "React.memo, inline callback" },
  { id: "memo", label: "React.memo + useCallback" },
];
export const CHART_MS = 45, INPUT_MS = 2;
export function keystrokes(m: Mode, n = 5) {
  return Array.from({ length: n }, (_, i) => {
    const chartRenders = m === "memo" ? false : true;
    return { key: "lamps"[i], chartRenders, ms: INPUT_MS + (chartRenders ? CHART_MS : 0) };
  });
}
