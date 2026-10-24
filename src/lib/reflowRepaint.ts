// Layout thrashing, modelled the way browsers schedule work: a style write only marks things
// dirty, and the real work (style, layout, paint) waits for the end of the frame. Reading
// geometry (offsetHeight, getBoundingClientRect) while layout is dirty forces the browser to
// lay out the page right there, synchronously. A loop that alternates writes and reads does
// that once per item. The counts below come from running the loop through that dirty-flag
// model; the millisecond costs are illustrative (the demo also measures the real thing).

export type Prop = "height" | "background" | "transform";
export const PROPS: { id: Prop; label: string; css: string; dirties: "layout" | "paint" | "composite" }[] = [
  { id: "height", label: "height", css: "card.style.height = h + 8 + 'px'", dirties: "layout" },
  { id: "background", label: "background", css: "card.style.background = 'gold'", dirties: "paint" },
  // The cards are styled with will-change: transform. Without it, going from no transform to
  // one changes the containing block, and Chrome lays out again.
  { id: "transform", label: "transform", css: "card.style.transform = 'translateX(8px)'   // has will-change: transform", dirties: "composite" },
];

export type Shape = "interleaved" | "writes-then-reads" | "reads-then-writes";
export const SHAPES: { id: Shape; label: string; code: (write: string) => string }[] = [
  {
    id: "interleaved",
    label: "Read, write, read, write…",
    code: (w) => `for (const card of cards) {\n  const h = card.offsetHeight;   // read\n  ${w};   // write\n}`,
  },
  {
    id: "writes-then-reads",
    label: "All writes, then all reads",
    code: (w) => `for (const card of cards) {\n  const h = 120;\n  ${w};   // write\n}\nconst heights = cards.map(c => c.offsetHeight);   // read`,
  },
  {
    id: "reads-then-writes",
    label: "All reads, then all writes",
    code: (w) => `const heights = cards.map(c => c.offsetHeight);   // read\ncards.forEach((card, i) => {\n  const h = heights[i];\n  ${w};   // write\n});`,
  },
];

export const CARDS = 100;
// Illustrative costs in ms for a page of about 1,500 elements on a mid-range laptop.
export const COST = { op: 0.004, style: 0.06, layout: 0.4, paint: 1.1, composite: 0.25 };
export const FRAME_MS = 1000 / 60;

type Op = { kind: "read" } | { kind: "write" };

export function ops(shape: Shape, n = CARDS): Op[] {
  const out: Op[] = [];
  if (shape === "interleaved") for (let i = 0; i < n; i++) out.push({ kind: "read" }, { kind: "write" });
  if (shape === "writes-then-reads") {
    for (let i = 0; i < n; i++) out.push({ kind: "write" });
    for (let i = 0; i < n; i++) out.push({ kind: "read" });
  }
  if (shape === "reads-then-writes") {
    for (let i = 0; i < n; i++) out.push({ kind: "read" });
    for (let i = 0; i < n; i++) out.push({ kind: "write" });
  }
  return out;
}

export type Segment = { kind: "js" | "style" | "layout" | "paint" | "composite"; ms: number; forced?: boolean };

export function runFrame(shape: Shape, prop: Prop, n = CARDS) {
  const dirties = PROPS.find((p) => p.id === prop)!.dirties;
  let styleDirty = false;
  let layoutDirty = false;
  let paintDirty = false;
  let forcedStyle = 0;
  let forcedLayout = 0;
  const segs: Segment[] = [];
  const js = (ms: number) => {
    const last = segs[segs.length - 1];
    if (last?.kind === "js") last.ms += ms;
    else segs.push({ kind: "js", ms });
  };
  for (const op of ops(shape, n)) {
    js(COST.op);
    if (op.kind === "write") {
      styleDirty = true;
      if (dirties === "layout") layoutDirty = paintDirty = true;
      if (dirties === "paint") paintDirty = true;
      continue;
    }
    // A geometry read needs up-to-date style and layout, so anything dirty is done now.
    if (styleDirty) {
      forcedStyle++;
      segs.push({ kind: "style", ms: COST.style, forced: true });
      styleDirty = false;
    }
    if (layoutDirty) {
      forcedLayout++;
      segs.push({ kind: "layout", ms: COST.layout, forced: true });
      layoutDirty = false;
    }
  }
  // End of the frame: the browser does whatever is still dirty, once.
  let frameStyle = false;
  let frameLayout = false;
  let framePaint = false;
  if (styleDirty) {
    segs.push({ kind: "style", ms: COST.style });
    frameStyle = true;
  }
  if (layoutDirty) {
    segs.push({ kind: "layout", ms: COST.layout });
    frameLayout = true;
  }
  if (paintDirty) {
    segs.push({ kind: "paint", ms: COST.paint });
    framePaint = true;
  }
  segs.push({ kind: "composite", ms: COST.composite });
  const total = segs.reduce((a, s) => a + s.ms, 0);
  const layouts = forcedLayout + (frameLayout ? 1 : 0);
  return {
    segs,
    forcedStyle,
    forcedLayout,
    layouts,
    styles: forcedStyle + (frameStyle ? 1 : 0),
    paints: framePaint ? 1 : 0,
    total,
    layoutMs: layouts * COST.layout,
    overBudget: total > FRAME_MS,
    droppedFrames: Math.max(0, Math.ceil(total / FRAME_MS) - 1),
  };
}

/** The dirty flags after each of the first few operations, for the step-by-step view. */
export function trace(shape: Shape, prop: Prop, steps = 6) {
  const dirties = PROPS.find((p) => p.id === prop)!.dirties;
  let layoutDirty = false;
  const rows: { op: string; layoutDirty: boolean; forced: boolean }[] = [];
  for (const op of ops(shape).slice(0, steps)) {
    let forced = false;
    if (op.kind === "write") {
      if (dirties === "layout") layoutDirty = true;
    } else if (layoutDirty) {
      forced = true;
      layoutDirty = false;
    }
    rows.push({ op: op.kind === "read" ? "read offsetHeight" : `write ${prop}`, layoutDirty, forced });
  }
  return rows;
}
