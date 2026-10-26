// A small malloc over one heap, block by block. Every block has an 8-byte header and is a
// multiple of 16 bytes (the alignment glibc uses on 64-bit), at least 32 bytes. malloc(n) looks
// for a free block big enough, splits off what it doesn't need, and grows the heap with sbrk when
// nothing fits. free() marks the block free and, with coalescing, merges it with free neighbours
// (the boundary-tag trick). Four placement policies: first fit, next fit, best fit, and size
// classes (round up to a class and reuse only blocks of that class, like jemalloc or tcmalloc).
// Sizes are scaled down to bytes so a heap fits on screen; the policies are the real ones.

export const HEADER = 8;
export const ALIGN = 16;
export const MIN_BLOCK = 32;
export const START_HEAP = 1024;
export const GROW = 256; // sbrk step

export type Policy = "first" | "next" | "best" | "classes";
export const POLICIES: Policy[] = ["first", "next", "best", "classes"];
export const POLICY_LABEL: Record<Policy, string> = { first: "First fit", next: "Next fit", best: "Best fit", classes: "Size classes" };
export const POLICY_NOTE: Record<Policy, string> = {
  first: "Walk the free list from the start of the heap and take the first block that's big enough.",
  next: "Like first fit, but start where the last search stopped, so the front of the heap isn't searched over and over.",
  best: "Look at every free block and take the smallest that fits, leaving the least behind.",
  classes: "Round the size up to a class (32, 48, … 256, 320 …) and reuse only a freed block of that exact class. One lookup, no search, but more rounding.",
};

// jemalloc-like classes: 16-byte steps to 128, then four classes per doubling
export const CLASSES = [32, 48, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 448, 512, 640, 768, 896, 1024, 1280, 1536, 1792, 2048];

export type Op = { kind: "malloc"; id: string; n: number } | { kind: "free"; id: string };
export type Block = { addr: number; size: number; free: boolean; id?: string; n?: number };

export type Step = {
  op: Op;
  need: number; // block size after header, alignment and class rounding (malloc only)
  examined: number; // free blocks looked at
  addr: number | null; // where the block landed or was freed
  grew: number; // bytes added with sbrk
  split: number; // free remainder split off
  merged: number; // neighbours merged on free
  blocks: Block[];
  stats: Stats;
};

export type Stats = { heap: number; used: number; requested: number; internal: number; free: number; largest: number; holes: number; extFrag: number };

const align = (n: number) => Math.ceil(n / ALIGN) * ALIGN;
export const blockSize = (n: number) => Math.max(MIN_BLOCK, align(n + HEADER));
export const classSize = (n: number) => CLASSES.find((c) => c >= blockSize(n)) ?? align(blockSize(n));
export const needFor = (n: number, p: Policy) => (p === "classes" ? classSize(n) : blockSize(n));

export function stats(blocks: Block[]): Stats {
  const heap = blocks.reduce((s, b) => s + b.size, 0);
  const used = blocks.filter((b) => !b.free).reduce((s, b) => s + b.size, 0);
  const requested = blocks.filter((b) => !b.free).reduce((s, b) => s + (b.n ?? 0), 0);
  const frees = blocks.filter((b) => b.free);
  const free = heap - used;
  const largest = Math.max(0, ...frees.map((b) => b.size));
  return { heap, used, requested, internal: used - requested, free, largest, holes: frees.length, extFrag: free ? 1 - largest / free : 0 };
}

export function run(ops: Op[], policy: Policy, coalesce: boolean): Step[] {
  let blocks: Block[] = [{ addr: 0, size: START_HEAP, free: true }];
  let rover = 0; // next fit: where the last search stopped
  const merge = coalesce && policy !== "classes";
  const steps: Step[] = [];

  for (const op of ops) {
    let need = 0, examined = 0, grew = 0, split = 0, merged = 0;
    let addr: number | null = null;

    if (op.kind === "malloc") {
      need = needFor(op.n, policy);
      const frees = blocks.filter((b) => b.free);
      let pick: Block | undefined;
      if (policy === "first") {
        for (const b of frees) { examined++; if (b.size >= need) { pick = b; break; } }
      } else if (policy === "next") {
        const order = [...frees.filter((b) => b.addr >= rover), ...frees.filter((b) => b.addr < rover)];
        for (const b of order) { examined++; if (b.size >= need) { pick = b; break; } }
      } else if (policy === "best") {
        for (const b of frees) {
          examined++;
          if (b.size >= need && (!pick || b.size < pick.size)) pick = b;
          if (b.size === need) break; // an exact fit can't be beaten
        }
      } else {
        // one free list per class: take a freed block of exactly this size, else carve from the top
        const exact = frees.find((b) => b.size === need && b !== blocks[blocks.length - 1]);
        examined = 1;
        pick = exact;
        const top = blocks[blocks.length - 1];
        if (!pick && top.free && top.size >= need) pick = top;
      }

      if (!pick) {
        // nothing fits: grow the heap; a free block at the end is extended rather than wasted
        const last = blocks[blocks.length - 1];
        const have = last.free ? last.size : 0;
        grew = Math.ceil((need - have) / GROW) * GROW;
        if (last.free) {
          blocks = blocks.map((b) => (b === last ? { ...b, size: b.size + grew } : b));
          pick = blocks[blocks.length - 1];
        } else {
          const nb = { addr: last.addr + last.size, size: grew, free: true };
          blocks = [...blocks, nb];
          pick = nb;
        }
      }

      const p = pick;
      addr = p.addr;
      const rest = p.size - need;
      const i = blocks.indexOf(p);
      const taken: Block = { addr: p.addr, size: rest >= MIN_BLOCK ? need : p.size, free: false, id: op.id, n: op.n };
      const parts = rest >= MIN_BLOCK ? [taken, { addr: p.addr + need, size: rest, free: true }] : [taken];
      if (rest >= MIN_BLOCK) split = rest;
      blocks = [...blocks.slice(0, i), ...parts, ...blocks.slice(i + 1)];
      rover = taken.addr + taken.size;
    } else {
      const i = blocks.findIndex((b) => !b.free && b.id === op.id);
      if (i >= 0) {
        const b = blocks[i];
        addr = b.addr;
        let lo = i, hi = i;
        if (merge) {
          if (i > 0 && blocks[i - 1].free) { lo = i - 1; merged++; }
          if (i < blocks.length - 1 && blocks[i + 1].free) { hi = i + 1; merged++; }
        }
        const size = blocks.slice(lo, hi + 1).reduce((s, x) => s + x.size, 0);
        blocks = [...blocks.slice(0, lo), { addr: blocks[lo].addr, size, free: true }, ...blocks.slice(hi + 1)];
      }
    }
    steps.push({ op, need, examined, addr, grew, split, merged, blocks, stats: stats(blocks) });
  }
  return steps;
}

export type Summary = { policy: Policy; heap: number; peak: number; growths: number; mallocs: number; examined: number; extFrag: number; internal: number; requested: number };

export function summary(ops: Op[], policy: Policy, coalesce: boolean): Summary {
  const steps = run(ops, policy, coalesce);
  const last = steps[steps.length - 1].stats;
  const mallocs = steps.filter((s) => s.op.kind === "malloc");
  return {
    policy,
    heap: last.heap,
    peak: Math.max(...steps.map((s) => s.stats.heap)),
    growths: steps.filter((s) => s.grew > 0).length,
    mallocs: mallocs.length,
    examined: mallocs.reduce((s, m) => s + m.examined, 0),
    extFrag: last.extFrag,
    internal: last.internal,
    requested: last.requested,
  };
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Workload = "holes" | "neighbours" | "churn";
export const WORKLOADS: Workload[] = ["holes", "neighbours", "churn"];
export const WORKLOAD: Record<Workload, { label: string; blurb: string }> = {
  holes: { label: "Small and large, interleaved", blurb: "Six 24-byte records each followed by a 120-byte buffer. The buffers are freed, then a 400-byte request arrives." },
  neighbours: { label: "Free neighbours", blurb: "Eight 100-byte blocks side by side. Three neighbours are freed, then a 320-byte request arrives." },
  churn: { label: "Random churn", blurb: "48 random mallocs and frees of 16–240 bytes, the way a long-running program behaves." },
};

export function ops(w: Workload): Op[] {
  if (w === "holes") {
    const o: Op[] = [];
    for (let i = 0; i < 6; i++) o.push({ kind: "malloc", id: `s${i}`, n: 24 }, { kind: "malloc", id: `L${i}`, n: 120 });
    for (let i = 0; i < 6; i++) o.push({ kind: "free", id: `L${i}` });
    o.push({ kind: "malloc", id: "big", n: 400 }, { kind: "malloc", id: "m0", n: 100 }, { kind: "malloc", id: "m1", n: 100 });
    return o;
  }
  if (w === "neighbours") {
    const ids = "abcdefgh".split("");
    return [
      ...ids.map((id): Op => ({ kind: "malloc", id, n: 100 })),
      { kind: "free", id: "b" }, { kind: "free", id: "c" }, { kind: "free", id: "d" }, { kind: "free", id: "f" },
      { kind: "malloc", id: "big", n: 320 },
      { kind: "malloc", id: "x", n: 90 },
    ];
  }
  const r = rng(7);
  const live: string[] = [];
  const o: Op[] = [];
  let k = 0;
  while (o.length < 48) {
    if (live.length > 2 && (r() < 0.42 || live.length > 9)) {
      const [id] = live.splice(Math.floor(r() * live.length), 1);
      o.push({ kind: "free", id });
    } else {
      const id = `r${k++}`;
      live.push(id);
      o.push({ kind: "malloc", id, n: 16 + Math.floor(r() * 15) * 16 });
    }
  }
  return o;
}

export const opLabel = (op: Op) => (op.kind === "malloc" ? `${op.id} = malloc(${op.n})` : `free(${op.id})`);
