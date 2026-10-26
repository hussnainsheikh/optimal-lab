// An autocomplete box, simulated event by event: someone types "running", pauses, then
// deletes back to "run". Each request takes a different time (the server is slower for broad prefixes), so
// responses can come back out of order. Debouncing, ignoring stale responses, a cache and a
// minimum length each change what's sent and what's shown. Keystroke times and server
// latencies are fixed, illustrative numbers; the suggestions are filtered for real.

export const PRODUCTS = [
  "running shoes", "running shorts", "running socks", "running jacket", "running belt", "running cap",
  "rain jacket", "rucksack", "rugby ball", "ruler", "rubber boots", "trail runners", "runner's watch",
  "insulated bottle", "headlamp", "hiking poles", "sun hat", "swim goggles",
];

export function suggest(q: string, limit = 5) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  return PRODUCTS.filter((p) => p.includes(s)).sort((a, b) => Number(!a.startsWith(s)) - Number(!b.startsWith(s)) || a.localeCompare(b)).slice(0, limit);
}

export const KEYS: { t: number; value: string }[] = [
  { t: 0, value: "r" },
  { t: 120, value: "ru" },
  { t: 230, value: "run" },
  { t: 400, value: "runn" },
  { t: 520, value: "runni" },
  { t: 610, value: "runnin" },
  { t: 750, value: "running" },
  { t: 1500, value: "run" }, // select the word's end and delete it
];

// Broad prefixes match more rows, so the server is slower for them.
export const LATENCY: Record<string, number> = { r: 320, ru: 280, run: 680, runn: 220, runni: 190, runnin: 160, running: 120 };

export type Opts = { debounce: 0 | 150 | 300; latestOnly: boolean; cache: boolean; minChars: 1 | 2 };
export const NAIVE: Opts = { debounce: 0, latestOnly: false, cache: false, minChars: 1 };
export const TUNED: Opts = { debounce: 150, latestOnly: true, cache: true, minChars: 2 };

export type Ev = { t: number; kind: "key" | "send" | "cache" | "response" | "ignored" | "show"; q: string };

export function simulate(o: Opts) {
  const events: Ev[] = [];
  const sends: { t: number; q: string }[] = [];
  // Which queries get sent, and when.
  KEYS.forEach((k, i) => {
    events.push({ t: k.t, kind: "key", q: k.value });
    const next = KEYS[i + 1];
    const fireAt = k.t + o.debounce;
    if (next && next.t < fireAt) return; // a newer keystroke cancelled the timer
    if (k.value.length < o.minChars) return;
    sends.push({ t: fireAt, q: k.value });
  });
  const cache = new Map<string, number>(); // query -> time its answer arrived
  type Arrival = { t: number; q: string; fromCache: boolean };
  const arrivals: Arrival[] = [];
  for (const s of sends) {
    const cachedAt = cache.get(s.q);
    if (o.cache && cachedAt !== undefined && cachedAt <= s.t) {
      events.push({ t: s.t, kind: "cache", q: s.q });
      arrivals.push({ t: s.t, q: s.q, fromCache: true });
      continue;
    }
    events.push({ t: s.t, kind: "send", q: s.q });
    const at = s.t + LATENCY[s.q];
    arrivals.push({ t: at, q: s.q, fromCache: false });
    if (!cache.has(s.q)) cache.set(s.q, at);
  }
  // Show results as they arrive, unless they're for an older query than the input holds now.
  const valueAt = (t: number) => [...KEYS].reverse().find((k) => k.t <= t)!.value;
  let shown = "";
  const shows: { t: number; q: string; stale: boolean }[] = [];
  for (const a of [...arrivals].sort((x, y) => x.t - y.t)) {
    if (!a.fromCache) events.push({ t: a.t, kind: "response", q: a.q });
    const current = valueAt(a.t);
    if (o.latestOnly && a.q !== current) {
      events.push({ t: a.t, kind: "ignored", q: a.q });
      continue;
    }
    if (a.q === shown) continue;
    shown = a.q;
    events.push({ t: a.t, kind: "show", q: a.q });
    shows.push({ t: a.t, q: a.q, stale: a.q !== current });
  }
  events.sort((a, b) => a.t - b.t || ["key", "send", "cache", "response", "ignored", "show"].indexOf(a.kind) - ["key", "send", "cache", "response", "ignored", "show"].indexOf(b.kind));
  // How long the list shows results for something other than what's in the box.
  const END = KEYS[KEYS.length - 1].t + 800;
  let staleMs = 0;
  const marks = [...new Set([...KEYS.map((k) => k.t), ...shows.map((x) => x.t), END])].sort((a, b) => a - b);
  for (let i = 0; i < marks.length - 1; i++) {
    const t = marks[i];
    const on = [...shows].reverse().find((x) => x.t <= t);
    if (on && on.q !== valueAt(t)) staleMs += marks[i + 1] - t;
  }
  const final = KEYS[KEYS.length - 1].value;
  const lastKey = KEYS[KEYS.length - 1].t;
  const showingAtLastKey = [...shows].reverse().find((x) => x.t <= lastKey)?.q;
  const correctAt = showingAtLastKey === final ? lastKey : (shows.find((x) => x.t >= lastKey && x.q === final)?.t ?? null);
  return {
    events,
    requests: events.filter((e) => e.kind === "send").length,
    cacheHits: events.filter((e) => e.kind === "cache").length,
    flashes: shows.length,
    staleShown: shows.filter((s) => s.stale).length,
    staleMs,
    endsWith: shown,
    endsCorrect: shown === final,
    waitAfterLastKey: correctAt === null ? null : correctAt - lastKey,
    final,
  };
}
