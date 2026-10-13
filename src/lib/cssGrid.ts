// Track sizing for a few grid-template-columns values.
export type Preset = "thirds" | "sidebar" | "autofill" | "areas";
export const PRESETS: { id: Preset; label: string; css: string }[] = [
  { id: "thirds", label: "Three equal", css: "grid-template-columns: 1fr 1fr 1fr;" },
  { id: "sidebar", label: "Sidebar + main", css: "grid-template-columns: 200px 1fr;" },
  { id: "autofill", label: "Responsive cards", css: "grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));" },
  { id: "areas", label: "Named areas", css: 'grid-template-areas:\n  "head head"\n  "side main"\n  "foot foot";\ngrid-template-columns: 180px 1fr;' },
];
export const GAP = 12;
export type Cell = { name: string; col: number; span: number; row: number };

export function layout(p: Preset, width: number) {
  let cols: number[];
  let cells: Cell[];
  const fr = (fixed: number[], frs: number) => (width - fixed.reduce((a, b) => a + b, 0) - GAP * (fixed.length + frs - 1)) / frs;
  if (p === "thirds") { const f = fr([], 3); cols = [f, f, f]; cells = Array.from({ length: 6 }, (_, i) => ({ name: String(i + 1), col: i % 3, span: 1, row: Math.floor(i / 3) })); }
  else if (p === "sidebar") { cols = [200, fr([200], 1)]; cells = [{ name: "nav", col: 0, span: 1, row: 0 }, { name: "main", col: 1, span: 1, row: 0 }]; }
  else if (p === "autofill") {
    const n = Math.max(1, Math.floor((width + GAP) / (160 + GAP)));
    const f = (width - GAP * (n - 1)) / n; cols = Array(n).fill(f);
    cells = Array.from({ length: 7 }, (_, i) => ({ name: `card ${i + 1}`, col: i % n, span: 1, row: Math.floor(i / n) }));
  } else {
    cols = [180, fr([180], 1)];
    cells = [{ name: "head", col: 0, span: 2, row: 0 }, { name: "side", col: 0, span: 1, row: 1 }, { name: "main", col: 1, span: 1, row: 1 }, { name: "foot", col: 0, span: 2, row: 2 }];
  }
  const left = cols.map((_, i) => cols.slice(0, i).reduce((a, b) => a + b, 0) + GAP * i);
  return { cols, left, cells, rows: Math.max(...cells.map((c) => c.row)) + 1 };
}
