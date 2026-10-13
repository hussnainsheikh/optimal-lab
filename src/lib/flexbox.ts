// How flexbox shares space along a row. Each item starts at its flex-basis. Leftover space is
// handed out in proportion to flex-grow; a shortfall is taken back in proportion to
// flex-shrink × basis. (Simplified: no min/max sizes, no wrapping.)

export type Item = { name: string; basis: number; grow: number; shrink: number };

export const ITEMS: Item[] = [
  { name: "nav", basis: 120, grow: 0, shrink: 1 },
  { name: "main", basis: 300, grow: 2, shrink: 1 },
  { name: "aside", basis: 160, grow: 1, shrink: 2 },
];

export function layout(container: number, items = ITEMS) {
  const total = items.reduce((s, i) => s + i.basis, 0);
  const free = container - total;
  if (free >= 0) {
    const g = items.reduce((s, i) => s + i.grow, 0);
    return { free, mode: "grow" as const, sizes: items.map((i) => ({ ...i, size: i.basis + (g ? (free * i.grow) / g : 0), delta: g ? (free * i.grow) / g : 0 })) };
  }
  const weight = items.reduce((s, i) => s + i.shrink * i.basis, 0);
  return { free, mode: "shrink" as const, sizes: items.map((i) => { const d = (free * i.shrink * i.basis) / weight; return { ...i, size: i.basis + d, delta: d }; }) };
}
