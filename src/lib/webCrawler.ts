// Design a web crawler. A small synthetic web of five hosts is crawled by two
// fetchers. Links come in messy forms (tracking parameters, fragments, trailing
// slashes, upper-case hosts), one host mirrors another, and robots.txt disallows the
// shop's cart pages. The crawl is simulated event by event.

export const HOSTS = [
  { host: "news.example", pages: 40 },
  { host: "shop.example", pages: 30 },
  { host: "blog.example", pages: 20 },
  { host: "docs.example", pages: 20 },
  { host: "mirror.example", pages: 20, mirrorOf: "blog.example" },
] as const;
export const DISALLOW = { host: "shop.example", prefix: "/cart/" };
export const WORKERS = 2; // fetchers per crawl node; real crawlers run thousands over millions of hosts
export const FETCH_S = 0.3;
export const POLITE_S = 1;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pathOf = (host: string, i: number) => (host === DISALLOW.host && i >= 25 ? `${DISALLOW.prefix}${i}` : `/p/${i}`);

type Page = { url: string; host: string; content: string; links: string[] };
export const PAGES: Map<string, Page> = (() => {
  const r = mulberry32(5);
  const m = new Map<string, Page>();
  const all = HOSTS.flatMap((h) => Array.from({ length: h.pages }, (_, i) => ({ host: h.host, i })));
  for (const h of HOSTS) {
    for (let i = 0; i < h.pages; i++) {
      const url = `https://${h.host}${pathOf(h.host, i)}`;
      const content = "mirrorOf" in h ? `blog.example${pathOf("blog.example", i)}` : `${h.host}${pathOf(h.host, i)}`;
      const links: string[] = [];
      for (let k = 0; k < 4; k++) {
        const t = r() < 0.75 ? { host: h.host, i: Math.floor(r() * h.pages) } : all[Math.floor(r() * all.length)];
        let link = `https://${t.host}${pathOf(t.host, t.i)}`;
        const v = r();
        if (v < 0.1) link += "?utm_source=newsletter";
        else if (v < 0.2) link += "#comments";
        else if (v < 0.27) link += "/";
        else if (v < 0.32) link = link.replace(t.host, t.host.toUpperCase());
        links.push(link);
      }
      m.set(url, { url, host: h.host, content, links });
    }
  }
  return m;
})();
export const SEEDS = HOSTS.map((h) => `https://${h.host}/p/0`);

// Lower-case the host, drop the fragment and tracking parameters, drop a trailing slash.
export function normalize(u: string) {
  const m = u.match(/^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i);
  if (!m) return u;
  const host = m[2].toLowerCase();
  let path = m[3] || "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  const query = (m[4] ?? "")
    .slice(1)
    .split("&")
    .filter((p) => p && !p.startsWith("utm_"))
    .join("&");
  return `${m[1].toLowerCase()}://${host}${path}${query ? `?${query}` : ""}`;
}
const hostOf = (u: string) => normalize(u).split("/")[2];
const disallowed = (u: string) => {
  const n = normalize(u);
  return hostOf(u) === DISALLOW.host && n.includes(DISALLOW.prefix);
};

export type Frontier = "fifo" | "fifoPolite" | "perHost";
export const FRONTIERS: { id: Frontier; label: string; one: string }[] = [
  { id: "fifo", label: "One queue, no delay", one: "Fetchers take the next URL from one queue and fetch it at once." },
  { id: "fifoPolite", label: "One queue, polite", one: `One queue, but a fetcher waits until the host hasn't been hit for ${POLITE_S} s, idling while it waits.` },
  { id: "perHost", label: "A queue per host", one: `A queue per host, each with a next-allowed time. A free fetcher takes from any host that's ready, so nobody idles and no host gets more than one request per ${POLITE_S} s.` },
];

export type Options = { frontier: Frontier; normalize: boolean; robots: boolean; fingerprint: boolean };

export function crawl(o: Options) {
  const key = (u: string) => (o.normalize ? normalize(u) : u);
  const seen = new Set<string>();
  const queues = new Map<string, string[]>();
  const fifo: string[] = [];
  const push = (u: string) => {
    if (o.robots && disallowed(u)) return;
    const k = key(u);
    if (seen.has(k)) return;
    seen.add(k);
    if (o.frontier === "perHost") {
      const h = hostOf(u);
      if (!queues.has(h)) queues.set(h, []);
      queues.get(h)!.push(u);
    } else fifo.push(u);
  };
  SEEDS.forEach(push);

  const workerFree = Array(WORKERS).fill(0);
  const hostNext = new Map<string, number>();
  const hits = new Map<string, number[]>();
  const contents = new Set<string>();
  let fetches = 0;
  let duplicateFetches = 0;
  let duplicateContent = 0;
  let robotsViolations = 0;
  let idle = 0;
  let end = 0;
  const fetchedPages = new Set<string>();
  // pending completions: links become available when a fetch finishes
  const pending: { at: number; links: string[] }[] = [];

  const nextUrl = (t: number): { u: string; start: number } | null => {
    if (o.frontier === "perHost") {
      let best: string | null = null;
      let bestAt = Infinity;
      for (const [h, q] of queues) {
        if (!q.length) continue;
        const at = Math.max(t, hostNext.get(h) ?? 0);
        if (at < bestAt) {
          bestAt = at;
          best = h;
        }
      }
      if (!best) return null;
      return { u: queues.get(best)!.shift()!, start: bestAt };
    }
    const u = fifo.shift();
    if (!u) return null;
    const start = o.frontier === "fifoPolite" ? Math.max(t, hostNext.get(hostOf(u)) ?? 0) : t;
    return { u, start };
  };

  for (let guard = 0; guard < 5000; guard++) {
    const w = workerFree.indexOf(Math.min(...workerFree));
    let t = workerFree[w];
    // release links from fetches finished by now
    pending.sort((a, b) => a.at - b.at);
    while (pending.length && pending[0].at <= t) pending.shift()!.links.forEach(push);
    const n = nextUrl(t);
    if (!n) {
      if (!pending.length) break;
      t = pending[0].at;
      workerFree[w] = t;
      continue;
    }
    idle += n.start - t;
    const h = hostOf(n.u);
    hostNext.set(h, n.start + POLITE_S);
    if (!hits.has(h)) hits.set(h, []);
    hits.get(h)!.push(n.start);
    const done = n.start + FETCH_S;
    workerFree[w] = done;
    end = Math.max(end, done);
    fetches++;
    if (disallowed(n.u)) robotsViolations++;
    const page = PAGES.get(normalize(n.u));
    if (!page) continue;
    if (fetchedPages.has(page.url)) {
      duplicateFetches++;
      continue;
    }
    fetchedPages.add(page.url);
    if (contents.has(page.content)) {
      duplicateContent++;
      if (o.fingerprint) continue; // same bytes as a page already indexed: skip it and its links
    }
    contents.add(page.content);
    pending.push({ at: done, links: page.links });
  }

  // the busiest second any host saw
  let peak = 0;
  for (const ts of hits.values()) {
    ts.sort((a, b) => a - b);
    let j = 0;
    for (let i = 0; i < ts.length; i++) {
      while (ts[i] - ts[j] >= 1 - 1e-9) j++;
      peak = Math.max(peak, i - j + 1);
    }
  }
  return { hits: Object.fromEntries(hits) as Record<string, number[]>, fetches, unique: fetchedPages.size, duplicateFetches, duplicateContent: o.fingerprint ? 0 : duplicateContent, skippedMirror: o.fingerprint ? duplicateContent : 0, robotsViolations, seconds: end, peakPerHost: peak, idleS: idle };
}

// The seen-URL set at web scale: exact set vs Bloom filter.
export const WEB_URLS = 10e9;
export const URL_BYTES = 80;
export const FP_RATES = [0.01, 0.001];
export const bloomGB = (p: number) => (WEB_URLS * (-Math.log(p) / Math.LN2 ** 2)) / 8 / 1e9;
export const exactGB = () => (WEB_URLS * URL_BYTES) / 1e9;
export const hashSetGB = () => (WEB_URLS * 16) / 1e9; // 8-byte fingerprint + table overhead
