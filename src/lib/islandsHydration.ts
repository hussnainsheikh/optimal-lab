// A blog post rendered as static HTML with interactive islands. Each island hydrates on its
// own schedule: at load, when the browser is idle, when it scrolls into view, or never (plain
// HTML that works without JavaScript). A reader scrolls and clicks on a fixed schedule, and
// each click either finds its island ready, falls back to plain HTML, or does nothing.
// Sizes and timings are illustrative.

export type Directive = "load" | "idle" | "visible" | "none";
export const DIRECTIVES: { id: Directive; label: string; astro: string }[] = [
  { id: "load", label: "load", astro: "client:load" },
  { id: "idle", label: "idle", astro: "client:idle" },
  { id: "visible", label: "visible", astro: "client:visible" },
  { id: "none", label: "no JS", astro: "(static HTML)" },
];

export type Island = { id: string; label: string; kb: number; hydrateMs: number; y: "top" | "middle" | "bottom"; click: number; action: string; worksWithoutJs: boolean };

export const ISLANDS: Island[] = [
  { id: "search", label: "Search box", kb: 18, hydrateMs: 25, y: "top", click: 700, action: "types a search", worksWithoutJs: true },
  { id: "theme", label: "Theme switch", kb: 3, hydrateMs: 5, y: "top", click: 2500, action: "switches to dark mode", worksWithoutJs: false },
  { id: "copy", label: "Copy-code buttons", kb: 4, hydrateMs: 8, y: "middle", click: 5200, action: "copies a code sample", worksWithoutJs: false },
  { id: "newsletter", label: "Newsletter form", kb: 6, hydrateMs: 10, y: "bottom", click: 9400, action: "signs up for the newsletter", worksWithoutJs: true },
  { id: "comments", label: "Comments", kb: 85, hydrateMs: 140, y: "bottom", click: 10200, action: "posts a comment", worksWithoutJs: true },
];

export const RUNTIME_KB = 12; // a small framework runtime, shared by every island
export const WHOLE_PAGE_KB = 210; // the same page as one hydrated app
export const WHOLE_PAGE_HYDRATE = 420;
export const T = { html: 300, kbPerMs: 0.6, idle: 1400, scrollMiddle: 4800, scrollBottom: 9000 };

export type Opts = { mode: "islands" | "whole"; directive: Record<string, Directive>; enhance: boolean };
export const ALL_LOAD: Opts = { mode: "islands", directive: { search: "load", theme: "load", copy: "load", newsletter: "load", comments: "load" }, enhance: false };
export const TUNED: Opts = { mode: "islands", directive: { search: "load", theme: "idle", copy: "visible", newsletter: "none", comments: "visible" }, enhance: true };
export const WHOLE: Opts = { mode: "whole", directive: ALL_LOAD.directive, enhance: false };

const visibleAt = (y: Island["y"]) => (y === "top" ? T.html : y === "middle" ? T.scrollMiddle : T.scrollBottom);

export function run(o: Opts) {
  const dl = (kb: number) => Math.round(kb / T.kbPerMs);
  if (o.mode === "whole") {
    const ready = T.html + dl(WHOLE_PAGE_KB) + WHOLE_PAGE_HYDRATE;
    const rows = ISLANDS.map((i) => ({ island: i, starts: T.html, ready, outcome: i.click >= ready ? ("works" as const) : ("dead" as const) }));
    return { rows, jsAtLoad: WHOLE_PAGE_KB, jsTotal: WHOLE_PAGE_KB, mainThreadAtLoad: WHOLE_PAGE_HYDRATE, interactiveTop: ready, dead: rows.filter((r) => r.outcome === "dead").length };
  }
  const startOf = (i: Island) => {
    const d = o.directive[i.id];
    return d === "none" ? null : d === "load" ? T.html : d === "idle" ? T.idle : visibleAt(i.y);
  };
  // The shared runtime comes with whichever island loads first.
  const firstId = ISLANDS.filter((i) => startOf(i) !== null).sort((a, b) => startOf(a)! - startOf(b)!)[0]?.id;
  // Islands that start together share the bandwidth, so their downloads finish together;
  // then they hydrate one after another on the single main thread.
  let pipeFree = 0;
  let mainFree = 0;
  const readyAt = new Map<string, number>();
  const starts = [...new Set(ISLANDS.map(startOf).filter((x): x is number => x !== null))].sort((a, b) => a - b);
  for (const t of starts) {
    const batch = ISLANDS.filter((i) => startOf(i) === t);
    const kb = batch.reduce((a, i) => a + i.kb + (i.id === firstId ? RUNTIME_KB : 0), 0);
    pipeFree = Math.max(pipeFree, t) + dl(kb);
    for (const i of batch) {
      mainFree = Math.max(mainFree, pipeFree) + i.hydrateMs;
      readyAt.set(i.id, mainFree);
    }
  }
  const rows = ISLANDS.map((i) => {
    const d = o.directive[i.id];
    if (d === "none") return { island: i, starts: null as number | null, ready: null as number | null, outcome: i.worksWithoutJs && o.enhance ? ("plain" as const) : ("dead" as const) };
    const start = startOf(i)!;
    const ready = readyAt.get(i.id)!;
    // Before its JavaScript arrives, an island is plain HTML: a real <form> still submits.
    const outcome = i.click >= ready ? ("works" as const) : i.worksWithoutJs && o.enhance ? ("plain" as const) : ("dead" as const);
    return { island: i, starts: start, ready, outcome };
  });
  const loaded = rows.filter((r) => o.directive[r.island.id] === "load");
  const jsAtLoad = loaded.reduce((a, r) => a + r.island.kb, 0) + (loaded.length ? RUNTIME_KB : 0);
  const used = rows.filter((r) => r.starts !== null);
  const jsTotal = used.reduce((a, r) => a + r.island.kb, 0) + (used.length ? RUNTIME_KB : 0);
  const search = rows.find((r) => r.island.id === "search")!;
  return { rows, jsAtLoad, jsTotal, mainThreadAtLoad: loaded.reduce((a, r) => a + r.island.hydrateMs, 0), interactiveTop: search.ready ?? T.html, dead: rows.filter((r) => r.outcome === "dead").length };
}
