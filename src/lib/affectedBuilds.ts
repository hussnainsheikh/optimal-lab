// A monorepo: build only what a change affects.
export const PKGS = [
  { id: "utils", deps: [] as string[], secs: 20 },
  { id: "ui", deps: ["utils"], secs: 60 },
  { id: "api", deps: ["utils"], secs: 90 },
  { id: "web", deps: ["ui", "utils"], secs: 120 },
  { id: "docs", deps: [] as string[], secs: 40 },
];
export function affected(changed: string) {
  const out = new Set([changed]);
  let grew = true;
  while (grew) { grew = false; for (const p of PKGS) if (!out.has(p.id) && p.deps.some((d) => out.has(d))) { out.add(p.id); grew = true; } }
  return out;
}
export function cost(changed: string, mode: "all" | "affected" | "cached") {
  const set = affected(changed);
  return PKGS.map((p) => ({ ...p, runs: mode === "all" ? true : set.has(p.id), restored: mode === "cached" && !set.has(p.id) }));
}
