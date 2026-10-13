// A counter that ticks every second using setInterval inside useEffect.
export type Version = "stale" | "functional" | "deps";
export const VERSIONS: { id: Version; label: string; code: string[] }[] = [
  { id: "stale", label: "setCount(count + 1), deps []", code: ["useEffect(() => {", "  const id = setInterval(() => setCount(count + 1), 1000);", "  return () => clearInterval(id);", "}, []);  // runs once"] },
  { id: "functional", label: "setCount(c => c + 1), deps []", code: ["useEffect(() => {", "  const id = setInterval(() => setCount((c) => c + 1), 1000);", "  return () => clearInterval(id);", "}, []);"] },
  { id: "deps", label: "setCount(count + 1), deps [count]", code: ["useEffect(() => {", "  const id = setInterval(() => setCount(count + 1), 1000);", "  return () => clearInterval(id);", "}, [count]);  // re-subscribe every change"] },
];
export function ticks(v: Version, n = 5) {
  const rows = [];
  let count = 0, captured = 0, intervals = 1;
  for (let i = 1; i <= n; i++) {
    const before = count;
    if (v === "stale") count = captured + 1;
    else count = count + 1;
    if (v === "deps") { captured = count; intervals++; }
    rows.push({ t: i, sees: v === "functional" ? before : v === "deps" ? before : 0, count });
  }
  return { rows, intervals };
}
