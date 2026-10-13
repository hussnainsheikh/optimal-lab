// Four ways to render a blog post page. Times in ms, illustrative.
export type Mode = "csr" | "ssr" | "ssg" | "isr";
export const MODES = [
  { id: "csr" as Mode, label: "Client-side rendering", ttfb: 40, content: 1400, build: "fast", serverWork: "none", fresh: "always (fetched in the browser)", seo: "weak: empty HTML at first" },
  { id: "ssr" as Mode, label: "Server-side rendering", ttfb: 320, content: 420, build: "fast", serverWork: "every request", fresh: "always", seo: "good" },
  { id: "ssg" as Mode, label: "Static generation", ttfb: 40, content: 160, build: "slow (every page)", serverWork: "none", fresh: "only after a rebuild", seo: "good" },
  { id: "isr" as Mode, label: "Incremental static regeneration", ttfb: 40, content: 160, build: "fast", serverWork: "once per revalidate window", fresh: "within 60 s", seo: "good" },
];
// The author fixes a typo at t = 0. Which version does a visitor at time t (seconds) see?
export function sees(m: Mode, t: number) {
  if (m === "csr" || m === "ssr") return "new";
  if (m === "ssg") return "old (until the next deploy)";
  return t >= 60 ? "new" : "old (regenerates in the background)";
}
