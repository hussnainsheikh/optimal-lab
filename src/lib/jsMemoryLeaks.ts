// A single-page app opens and closes a photo viewer again and again. Each open allocates a
// viewer object, a decoded image, a dialog's DOM, two callbacks and a cached thumbnail. After
// it closes, a garbage collector frees whatever can't be reached from the roots (window, the
// document, the timer list). This builds that object graph, marks it from the roots exactly as
// a tracing collector does, and finds the retainer path a heap snapshot would show. WeakMap
// entries are ephemerons: the value stays only while the key is reachable. Sizes are
// illustrative; the generational part is a small simulation of a scavenger.

export type Fixes = { removeListener: boolean; clearTimer: boolean; weakCache: boolean; clearFocus: boolean };
export const LEAKY: Fixes = { removeListener: false, clearTimer: false, weakCache: false, clearFocus: false };
export const FIXED: Fixes = { removeListener: true, clearTimer: true, weakCache: true, clearFocus: true };

export type Obj = { id: string; label: string; kb: number; root?: boolean; open?: number };
type Edge = { from: string; to: string; label: string; weakKey?: string };

export const KB = { viewer: 40, image: 4096, dialog: 120, closure: 1, thumb: 200 };

export function buildHeap(opens: number, fixes: Fixes, stillOpen = false) {
  const objs: Obj[] = [
    { id: "window", label: "window", kb: 0, root: true },
    { id: "document", label: "document", kb: 0, root: true },
    { id: "timers", label: "timer list", kb: 0, root: true },
    { id: "cache", label: "thumbnail cache", kb: 1 },
  ];
  const edges: Edge[] = [{ from: "window", to: "cache", label: "module variable" }];
  for (let i = 1; i <= opens; i++) {
    const open = stillOpen && i === opens;
    const v = `viewer${i}`;
    objs.push(
      { id: v, label: `viewer #${i}`, kb: KB.viewer, open: i },
      { id: `image${i}`, label: `decoded image #${i}`, kb: KB.image, open: i },
      { id: `dialog${i}`, label: `<dialog> #${i} and its DOM`, kb: KB.dialog, open: i },
      { id: `onResize${i}`, label: `onResize closure #${i}`, kb: KB.closure, open: i },
      { id: `onTick${i}`, label: `setInterval callback #${i}`, kb: KB.closure, open: i },
      { id: `thumb${i}`, label: `thumbnail #${i}`, kb: KB.thumb, open: i },
    );
    edges.push(
      { from: v, to: `image${i}`, label: "this.image" },
      { from: v, to: `dialog${i}`, label: "this.el" },
      { from: `dialog${i}`, to: v, label: "onclick closure" },
      { from: `onResize${i}`, to: v, label: "closure scope" },
      { from: `onTick${i}`, to: v, label: "closure scope" },
    );
    if (open || !fixes.removeListener) edges.push({ from: "window", to: `onResize${i}`, label: "resize listener" });
    if (open || !fixes.clearTimer) edges.push({ from: "timers", to: `onTick${i}`, label: "interval" });
    if (open) edges.push({ from: "document", to: `dialog${i}`, label: "body.children" });
    // A Map keyed by photo id holds every thumbnail; a WeakMap keyed by the viewer lets each go.
    edges.push(fixes.weakCache ? { from: "cache", to: `thumb${i}`, label: "WeakMap value", weakKey: v } : { from: "cache", to: `thumb${i}`, label: `Map.get("photo-${i}")` });
  }
  // lastFocused remembers the last button clicked, inside the most recent dialog.
  if (opens > 0 && (stillOpen || !fixes.clearFocus)) edges.push({ from: "window", to: `dialog${opens}`, label: "lastFocused" });
  return { objs, edges };
}

/** Mark: everything reachable from the roots, with WeakMap values kept only if their key is. */
export function mark(heap: ReturnType<typeof buildHeap>) {
  const marked = new Set(heap.objs.filter((o) => o.root).map((o) => o.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of heap.edges) {
      if (!marked.has(e.from) || marked.has(e.to)) continue;
      if (e.weakKey && !marked.has(e.weakKey)) continue;
      marked.add(e.to);
      changed = true;
    }
  }
  return marked;
}

/** The shortest chain of references from a root, as DevTools' Retainers panel shows it. */
export function retainerPath(heap: ReturnType<typeof buildHeap>, target: string): { id: string; label: string; via?: string }[] | null {
  const marked = mark(heap);
  if (!marked.has(target)) return null;
  const roots = heap.objs.filter((o) => o.root).map((o) => o.id);
  const prev = new Map<string, Edge | null>(roots.map((r) => [r, null]));
  const queue = [...roots];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === target) break;
    for (const e of heap.edges) {
      if (e.from !== cur || prev.has(e.to)) continue;
      if (e.weakKey && !marked.has(e.weakKey)) continue;
      prev.set(e.to, e);
      queue.push(e.to);
    }
  }
  const label = (id: string) => heap.objs.find((o) => o.id === id)!.label;
  const path: { id: string; label: string; via?: string }[] = [];
  let at: string | undefined = target;
  while (at) {
    const e: Edge | null | undefined = prev.get(at);
    path.unshift({ id: at, label: label(at), via: e?.label });
    at = e?.from;
  }
  return path;
}

export function collect(opens: number, fixes: Fixes) {
  const heap = buildHeap(opens, fixes);
  const marked = mark(heap);
  const live = heap.objs.filter((o) => marked.has(o.id) && !o.root);
  const freed = heap.objs.filter((o) => !marked.has(o.id));
  const retainedKb = live.reduce((a, o) => a + o.kb, 0);
  const leakedViewers = live.filter((o) => o.id.startsWith("viewer")).length;
  const detachedDialogs = live.filter((o) => o.id.startsWith("dialog")).length;
  return { heap, marked, live, freed, retainedKb, freedKb: freed.reduce((a, o) => a + o.kb, 0), leakedViewers, detachedDialogs, thumbs: live.filter((o) => o.id.startsWith("thumb")).length };
}

/** Retained heap after each open-and-close, for the chart. */
export function growth(opens: number, fixes: Fixes) {
  return Array.from({ length: opens }, (_, i) => collect(i + 1, fixes).retainedKb);
}

// --- generations ------------------------------------------------------------------------

export const GEN = { temps: 2000, tempKb: 0.5, tempLife: 40, longEvery: 40, youngKb: 256 };

/** One open of the viewer through a scavenger: survive two minor GCs and you're promoted. */
export function generations() {
  type Cell = { born: number; life: number; kb: number; survived: number };
  let young: Cell[] = [];
  let usedKb = 0;
  let scavenges = 0;
  let copied = 0;
  let promoted = 0;
  let promotedKb = 0;
  let allocated = 0;
  for (let t = 0; t < GEN.temps; t++) {
    const long = t % GEN.longEvery === 0;
    const cell: Cell = { born: t, life: long ? Infinity : GEN.tempLife, kb: long ? 2 : GEN.tempKb, survived: 0 };
    if (usedKb + cell.kb > GEN.youngKb) {
      scavenges++;
      const next: Cell[] = [];
      for (const c of young) {
        if (t - c.born >= c.life) continue; // dead: never even looked at
        c.survived++;
        if (c.survived >= 2) {
          promoted++;
          promotedKb += c.kb;
        } else {
          copied++;
          next.push(c);
        }
      }
      young = next;
      usedKb = young.reduce((a, c) => a + c.kb, 0);
    }
    young.push(cell);
    usedKb += cell.kb;
    allocated++;
  }
  const longLived = Math.ceil(GEN.temps / GEN.longEvery);
  return { allocated, scavenges, copied, promoted, promotedKb, longLived, diedYoung: allocated - longLived };
}

export const fmtKb = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`);
