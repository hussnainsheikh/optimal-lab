// A small shop front-end as ES modules: an entry, a barrel file (utils/index.js re-exporting
// three modules), a cart that uses lodash's debounce, and a chart module behind import().
// Two things are computed from the same graph:
//  - loading it unbundled: the browser discovers imports only after fetching each file, so
//    every level of the graph costs a round trip, unless modulepreload lists them up front;
//  - bundling it: mark the exports actually used, starting at the entry, keep modules whose
//    top-level code may have side effects, and put import() targets in their own chunk.
// lodash-es's import chain for debounce is the real one; byte sizes are approximate.

export type Ref = { mod: string; name: string };
export type Mod = {
  id: string;
  file: string;
  top: number; // KB of top-level code that runs when the module is evaluated
  sideEffect?: string; // what that top-level code does, if anything observable
  topUses?: Ref[];
  exports: Record<string, { kb: number; uses?: Ref[] }>;
  reexports?: Record<string, Ref>;
  deps?: string[]; // static imports with no named binding used here (e.g. internal helpers)
  dynamic?: string[];
  cjs?: boolean;
  pkg?: "utils" | "lodash" | "chart";
};

const lodashEs: Mod[] = [
  { id: "debounce", file: "lodash-es/debounce.js", top: 0, exports: { default: { kb: 1.1, uses: [{ mod: "isObject", name: "default" }, { mod: "now", name: "default" }, { mod: "toNumber", name: "default" }] } }, pkg: "lodash" },
  { id: "isObject", file: "lodash-es/isObject.js", top: 0, exports: { default: { kb: 0.1 } }, pkg: "lodash" },
  { id: "now", file: "lodash-es/now.js", top: 0, exports: { default: { kb: 0.1, uses: [{ mod: "root", name: "default" }] } }, pkg: "lodash" },
  { id: "toNumber", file: "lodash-es/toNumber.js", top: 0, exports: { default: { kb: 0.4, uses: [{ mod: "baseTrim", name: "default" }, { mod: "isObject", name: "default" }, { mod: "isSymbol", name: "default" }] } }, pkg: "lodash" },
  { id: "baseTrim", file: "lodash-es/_baseTrim.js", top: 0, exports: { default: { kb: 0.1, uses: [{ mod: "trimmedEndIndex", name: "default" }] } }, pkg: "lodash" },
  { id: "trimmedEndIndex", file: "lodash-es/_trimmedEndIndex.js", top: 0, exports: { default: { kb: 0.1 } }, pkg: "lodash" },
  { id: "isSymbol", file: "lodash-es/isSymbol.js", top: 0, exports: { default: { kb: 0.1, uses: [{ mod: "baseGetTag", name: "default" }, { mod: "isObjectLike", name: "default" }] } }, pkg: "lodash" },
  { id: "isObjectLike", file: "lodash-es/isObjectLike.js", top: 0, exports: { default: { kb: 0.1 } }, pkg: "lodash" },
  { id: "baseGetTag", file: "lodash-es/_baseGetTag.js", top: 0, exports: { default: { kb: 0.2, uses: [{ mod: "Symbol", name: "default" }, { mod: "getRawTag", name: "default" }, { mod: "objectToString", name: "default" }] } }, pkg: "lodash" },
  { id: "Symbol", file: "lodash-es/_Symbol.js", top: 0.05, exports: { default: { kb: 0, uses: [{ mod: "root", name: "default" }] } }, pkg: "lodash" },
  { id: "getRawTag", file: "lodash-es/_getRawTag.js", top: 0, exports: { default: { kb: 0.3, uses: [{ mod: "Symbol", name: "default" }] } }, pkg: "lodash" },
  { id: "objectToString", file: "lodash-es/_objectToString.js", top: 0, exports: { default: { kb: 0.1 } }, pkg: "lodash" },
  { id: "root", file: "lodash-es/_root.js", top: 0.1, exports: { default: { kb: 0, uses: [{ mod: "freeGlobal", name: "default" }] } }, pkg: "lodash" },
  { id: "freeGlobal", file: "lodash-es/_freeGlobal.js", top: 0.1, exports: { default: { kb: 0 } }, pkg: "lodash" },
];

export type Opts = { lodash: "esm" | "cjs"; sideEffects: "unknown" | "accurate" | "false"; lazyCharts: boolean; preload: boolean };
export const NAIVE: Opts = { lodash: "cjs", sideEffects: "unknown", lazyCharts: false, preload: false };
export const TUNED: Opts = { lodash: "esm", sideEffects: "accurate", lazyCharts: true, preload: true };
export const RTT_MS = 80;

export function graph(o: Opts): Mod[] {
  const lodashRef: Ref = o.lodash === "esm" ? { mod: "debounce", name: "default" } : { mod: "lodash", name: "debounce" };
  const mods: Mod[] = [
    { id: "main", file: "main.js", top: 3, sideEffect: "renders the page", topUses: [{ mod: "utils", name: "formatPrice" }, { mod: "cart", name: "renderCart" }, ...(o.lazyCharts ? [] : [{ mod: "charts", name: "drawChart" }])], exports: {}, dynamic: o.lazyCharts ? ["charts"] : [] },
    { id: "utils", file: "utils/index.js", top: 0, exports: {}, reexports: { formatPrice: { mod: "format", name: "formatPrice" }, formatDate: { mod: "format", name: "formatDate" }, track: { mod: "analytics", name: "track" }, parseDate: { mod: "dates", name: "parseDate" } }, pkg: "utils" },
    { id: "format", file: "utils/format.js", top: 0, exports: { formatPrice: { kb: 0.8 }, formatDate: { kb: 1.4 } }, pkg: "utils" },
    { id: "analytics", file: "utils/analytics.js", top: 0.6, sideEffect: "sends a page view as soon as it's loaded", topUses: [{ mod: "analytics", name: "track" }], exports: { track: { kb: 2.2 } }, pkg: "utils" },
    { id: "dates", file: "utils/dates.js", top: 28, sideEffect: "builds locale tables at load (a call the bundler can't prove is pure)", exports: { parseDate: { kb: 3 } }, pkg: "utils" },
    { id: "cart", file: "cart.js", top: 0, exports: { renderCart: { kb: 4, uses: [lodashRef] } } },
    { id: "charts", file: "charts.js", top: 0, exports: { drawChart: { kb: 2, uses: [{ mod: "chartlib", name: "Chart" }] } } },
    { id: "chartlib", file: "chart-lib/index.js", top: 0, exports: { Chart: { kb: 180 } }, pkg: "chart" },
    ...(o.lodash === "esm" ? lodashEs : [{ id: "lodash", file: "lodash/lodash.js", top: 72, cjs: true, sideEffect: "CommonJS: assigns module.exports at runtime", exports: { debounce: { kb: 0 } }, pkg: "lodash" as const }]),
  ];
  return mods;
}

const byId = (mods: Mod[]) => new Map(mods.map((m) => [m.id, m]));
const sizeOf = (m: Mod) => m.top + Object.values(m.exports).reduce((a, e) => a + e.kb, 0);

/** Static imports of a module, as the browser sees them in its import statements. */
export function staticDeps(m: Mod): string[] {
  const out = new Set<string>(m.deps ?? []);
  for (const r of m.topUses ?? []) if (r.mod !== m.id) out.add(r.mod);
  for (const e of Object.values(m.exports)) for (const r of e.uses ?? []) if (r.mod !== m.id) out.add(r.mod);
  for (const r of Object.values(m.reexports ?? {})) out.add(r.mod);
  return [...out];
}

/** Unbundled: which files the browser fetches before main.js can run, level by level. */
export function nativeLoad(o: Opts) {
  const mods = graph(o);
  const map = byId(mods);
  const depth = new Map<string, number>([["main", 1]]);
  const queue = ["main"];
  while (queue.length) {
    const id = queue.shift()!;
    for (const d of staticDeps(map.get(id)!)) {
      if (depth.has(d)) continue;
      depth.set(d, depth.get(id)! + 1);
      queue.push(d);
    }
  }
  const files = [...depth.entries()].map(([id, d]) => ({ id, file: map.get(id)!.file, level: d, kb: sizeOf(map.get(id)!) }));
  const levels = Math.max(...files.map((f) => f.level));
  const cjsBroken = files.some((f) => map.get(f.id)!.cjs);
  // With modulepreload the HTML lists every file, so they're all requested in one round trip.
  const roundTrips = o.preload ? 1 : levels;
  return { files, levels, roundTrips, ms: roundTrips * RTT_MS, requests: files.length, kb: files.reduce((a, f) => a + f.kb, 0), cjsBroken };
}

export type Kept = { id: string; file: string; kb: number; full: number; why: string; chunk: "main" | "charts" };

/** Bundled: mark used exports from the entry (and from import() targets), then emit chunks. */
export function bundle(o: Opts) {
  const mods = graph(o);
  const map = byId(mods);
  const pureByConfig = (m: Mod) => (m.pkg === "utils" ? (o.sideEffects === "false" ? true : o.sideEffects === "accurate" ? m.id !== "analytics" : false) : m.pkg === "chart" || m.pkg === "lodash" ? !m.cjs : false);

  const usedIn = (entry: string, start: Ref[] = [], seen = new Set<string>()) => {
    const used = new Map<string, Set<string>>();
    const evaluated = new Set<string>();
    const markRef = (r: Ref, q: Ref[]) => {
      const set = used.get(r.mod) ?? new Set();
      if (set.has(r.name)) return;
      set.add(r.name);
      used.set(r.mod, set);
      q.push(r);
    };
    const queue: Ref[] = [];
    const evaluate = (id: string) => {
      if (evaluated.has(id) || seen.has(id)) return;
      evaluated.add(id);
      for (const r of map.get(id)!.topUses ?? []) markRef(r, queue);
    };
    evaluate(entry);
    for (const r of start) markRef(r, queue);
    // Modules reached by an import statement run their top-level code unless known to be pure.
    const visit = new Set<string>([entry]);
    const reach = [entry];
    while (reach.length) {
      const id = reach.shift()!;
      for (const d of staticDeps(map.get(id)!)) {
        if (visit.has(d) || seen.has(d)) continue;
        visit.add(d);
        reach.push(d);
      }
    }
    for (const id of visit) if (map.get(id)!.sideEffect && !pureByConfig(map.get(id)!)) evaluate(id);
    while (queue.length) {
      const r = queue.shift()!;
      const m = map.get(r.mod)!;
      const re = m.reexports?.[r.name];
      if (re) {
        markRef(re, queue);
        continue;
      }
      for (const u of m.exports[r.name]?.uses ?? []) markRef(u, queue);
    }
    return { used, evaluated, visit };
  };

  const main = usedIn("main");
  const chunks: Record<"main" | "charts", Kept[]> = { main: [], charts: [] };
  const emit = (chunk: "main" | "charts", u: ReturnType<typeof usedIn>, skip = new Set<string>()) => {
    for (const m of mods) {
      if (skip.has(m.id) || !u.visit.has(m.id)) continue;
      const names = u.used.get(m.id) ?? new Set<string>();
      const runs = u.evaluated.has(m.id);
      let kb = 0;
      let why = "";
      if (m.cjs) {
        kb = runs || names.size ? sizeOf(m) : 0;
        why = "CommonJS: kept whole, its exports are only known at runtime";
      } else {
        // Used exports need the module's own top-level code (the values they read) too.
        kb = (runs || names.size ? m.top : 0) + [...names].reduce((a, n) => a + (m.exports[n]?.kb ?? 0), 0);
        const dropped = Object.keys(m.exports).filter((n) => !names.has(n));
        why = [runs && m.sideEffect ? `top-level code kept: ${m.sideEffect}` : null, names.size ? `uses ${[...names].join(", ")}` : null, dropped.length && kb ? `drops ${dropped.join(", ")}` : null].filter(Boolean).join("; ") || "nothing used: removed";
      }
      chunks[chunk].push({ id: m.id, file: m.file, kb, full: sizeOf(m), why, chunk });
    }
  };
  emit("main", main);
  // main.js calls drawChart once import("./charts.js") resolves, so mark from there.
  if (o.lazyCharts) emit("charts", usedIn("charts", [{ mod: "charts", name: "drawChart" }], main.visit), main.visit);
  const total = (c: Kept[]) => c.reduce((a, k) => a + k.kb, 0);
  const pageViewSent = main.evaluated.has("analytics");
  const before = mods.reduce((a, m) => a + sizeOf(m), 0);
  return { chunks, mainKb: total(chunks.main), chartsKb: total(chunks.charts), before, pageViewSent };
}

export const kb = (n: number) => (n >= 10 ? `${Math.round(n)} KB` : `${n.toFixed(1)} KB`);
