// A product page whose parts wait on data. A component that isn't ready suspends; React shows
// the nearest <Suspense> boundary's fallback and reveals everything inside that boundary
// together once all of it is ready. Where the boundaries go decides what the reader sees and
// when. Layout shift is scored the way CLS is: impact fraction × distance fraction for each
// reveal that moves content already on screen. Data times are illustrative.

export type Section = { id: "header" | "product" | "reviews" | "recs"; label: string; height: number; data: number };
export const SECTIONS: Section[] = [
  { id: "header", label: "Header", height: 80, data: 0 },
  { id: "product", label: "Product", height: 320, data: 150 },
  { id: "reviews", label: "Reviews", height: 360, data: 900 },
  { id: "recs", label: "Recommendations", height: 240, data: 600 },
];
export const BADGES_MS = 300; // author badges inside Reviews, fetched by a child component
export const VIEWPORT = 800;
export const FALLBACK_SPINNER = 48;

export type Boundaries = "none" | "one" | "each" | "nested";
export const BOUNDARY_OPTS: { id: Boundaries; label: string; code: string }[] = [
  { id: "none", label: "No boundary", code: "<Header />\n<Product />\n<Reviews />\n<Recs />" },
  { id: "one", label: "One around the rest", code: "<Header />\n<Suspense fallback={<Spinner />}>\n  <Product />\n  <Reviews />\n  <Recs />\n</Suspense>" },
  { id: "each", label: "One per section", code: "<Header />\n<Suspense fallback={…}><Product /></Suspense>\n<Suspense fallback={…}><Reviews /></Suspense>\n<Suspense fallback={…}><Recs /></Suspense>" },
  { id: "nested", label: "Per section + nested", code: "<Header />\n<Suspense fallback={…}><Product /></Suspense>\n<Suspense fallback={…}>\n  <Reviews>\n    <Suspense fallback={…}><Badges /></Suspense>\n  </Reviews>\n</Suspense>\n<Suspense fallback={…}><Recs /></Suspense>" },
];

export type Opts = { boundaries: Boundaries; parallel: boolean; sizedFallback: boolean; transition: boolean };
export const NAIVE: Opts = { boundaries: "none", parallel: false, sizedFallback: false, transition: false };
export const TUNED: Opts = { boundaries: "nested", parallel: true, sizedFallback: true, transition: true };

/** When each piece is ready: badges start after the reviews arrive, unless fetched in parallel. */
export function ready(o: Opts) {
  const reviews = SECTIONS.find((s) => s.id === "reviews")!.data;
  const badges = o.parallel ? Math.max(BADGES_MS, 0) : reviews + BADGES_MS;
  return { header: 0, product: 150, reviews, recs: 600, badges };
}

export type Shown = "content" | "fallback" | "blank";
export type Frame = { t: number; shown: Record<Section["id"], Shown>; badges: Shown };

export function frames(o: Opts): Frame[] {
  const r = ready(o);
  const reviewsFull = Math.max(r.reviews, r.badges);
  // When each section's boundary reveals.
  const revealAt: Record<string, number> = {};
  if (o.boundaries === "none") {
    const all = Math.max(r.product, reviewsFull, r.recs);
    for (const s of SECTIONS) revealAt[s.id] = all;
  } else if (o.boundaries === "one") {
    revealAt.header = 0;
    const all = Math.max(r.product, reviewsFull, r.recs);
    revealAt.product = revealAt.reviews = revealAt.recs = all;
  } else {
    revealAt.header = 0;
    revealAt.product = r.product;
    revealAt.recs = r.recs;
    revealAt.reviews = o.boundaries === "nested" ? r.reviews : reviewsFull;
  }
  const badgesAt = o.boundaries === "nested" ? Math.max(r.reviews, r.badges) : revealAt.reviews;
  const times = [...new Set([0, ...Object.values(revealAt), badgesAt])].sort((a, b) => a - b);
  return times.map((t) => {
    const shown = {} as Record<Section["id"], Shown>;
    for (const s of SECTIONS) shown[s.id] = t >= revealAt[s.id] ? "content" : o.boundaries === "none" ? "blank" : "fallback";
    return { t, shown, badges: shown.reviews === "content" ? (t >= badgesAt ? "content" : "fallback") : shown.reviews };
  });
}

const heightOf = (s: Section, shown: Shown, sized: boolean) => (shown === "content" ? s.height : shown === "fallback" ? (sized ? s.height : FALLBACK_SPINNER) : 0);

/** Layout shift: for each reveal, content already visible that moves scores impact × distance. */
export function layoutShift(o: Opts) {
  const fs = frames(o);
  let score = 0;
  const shifts: { t: number; score: number }[] = [];
  for (let i = 1; i < fs.length; i++) {
    let y0 = 0;
    let y1 = 0;
    let impact = 0;
    let dist = 0;
    for (const s of SECTIONS) {
      const before = fs[i - 1].shown[s.id];
      const h0 = heightOf(s, before, o.sizedFallback);
      const h1 = heightOf(s, fs[i].shown[s.id], o.sizedFallback);
      // Only elements that were on screen before and still are can shift.
      if (before !== "blank" && h0 > 0 && fs[i].shown[s.id] === before && y0 !== y1 && y0 < VIEWPORT) {
        const top = Math.min(y0, y1);
        const bottom = Math.min(VIEWPORT, Math.max(y0 + h0, y1 + h1));
        impact += Math.max(0, bottom - top) / VIEWPORT;
        dist = Math.max(dist, Math.abs(y1 - y0) / VIEWPORT);
      }
      y0 += h0;
      y1 += h1;
    }
    const sc = Math.min(1, impact) * dist;
    if (sc > 0) shifts.push({ t: fs[i].t, score: sc });
    score += sc;
  }
  return { score: Math.round(score * 1000) / 1000, shifts };
}

/** Switching tabs to content that suspends for 400 ms: a fallback flash, or the old tab kept. */
export function tabSwitch(o: Opts) {
  return o.transition
    ? { during: "the Reviews tab stays, dimmed while isPending", flash: false, ms: 400 }
    : { during: "the tab's content is replaced by its fallback", flash: true, ms: 400 };
}

export function firstContent(o: Opts) {
  const fs = frames(o);
  const f = fs.find((x) => Object.values(x.shown).some((v) => v === "content"));
  const product = fs.find((x) => x.shown.product === "content")!;
  const done = fs[fs.length - 1].t;
  return { first: f ? f.t : done, product: product.t, done };
}
