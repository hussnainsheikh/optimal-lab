// Breakpoints (Tailwind's defaults) and what the layout does at each width.
export const BREAKPOINTS = [{ name: "sm", min: 640 }, { name: "md", min: 768 }, { name: "lg", min: 1024 }, { name: "xl", min: 1280 }];
export function at(width: number, dpr: number) {
  const active = BREAKPOINTS.filter((b) => width >= b.min).map((b) => b.name);
  const cols = width >= 1024 ? 3 : width >= 640 ? 2 : 1;
  const nav = width >= 768 ? "links" : "menu button";
  const sidebar = width >= 1024;
  const candidates = [400, 800, 1200, 1600];
  const needed = (width / cols) * dpr;
  const img = candidates.find((c) => c >= needed) ?? 1600;
  return { active, cols, nav, sidebar, img, needed: Math.round(needed) };
}
