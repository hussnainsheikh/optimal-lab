// Where to render a page: at an origin next to the database (northern Virginia), or at an edge
// location in each visitor's city. Round trips are computed from great-circle distances
// (haversine), with light in fibre at about 200 km per ms and routes about 1.5 times longer
// than the straight line. A page that queries a database several times can be slower at the
// edge, because every query crosses the ocean. Render time and the edge limits are illustrative.

export type City = { id: string; name: string; lat: number; lon: number };
export const CITIES: City[] = [
  { id: "nyc", name: "New York", lat: 40.71, lon: -74.01 },
  { id: "lon", name: "London", lat: 51.51, lon: -0.13 },
  { id: "sao", name: "São Paulo", lat: -23.55, lon: -46.63 },
  { id: "bom", name: "Mumbai", lat: 19.08, lon: 72.88 },
  { id: "tyo", name: "Tokyo", lat: 35.68, lon: 139.69 },
  { id: "syd", name: "Sydney", lat: -33.87, lon: 151.21 },
];
export const ORIGIN = { name: "N. Virginia", lat: 39.04, lon: -77.49 };

export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Round trip in ms over fibre, with a small fixed cost for the hops in between. */
export const rtt = (distanceKm: number) => Math.round((2 * distanceKm * 1.5) / 200 + 2);

export type Where = "origin" | "edge" | "edge-cache";
export const WHERE: { id: Where; label: string; what: string }[] = [
  { id: "origin", label: "Origin, by the database", what: "The CDN forwards the request to servers in N. Virginia, next to the database." },
  { id: "edge", label: "Edge, querying the database", what: "An edge function in each city renders the page and queries the database in N. Virginia." },
  { id: "edge-cache", label: "Edge, with data at the edge", what: "The edge renders from a replicated key-value store, and only writes go back to N. Virginia." },
];

export type Opts = { where: Where; queries: number; personalised: boolean; renderMs: number };
export const RENDER_MS = 15;

export function ttfb(city: City, o: Opts) {
  const toEdge = 4; // a visitor is a few km from the nearest edge location
  const edgeToOrigin = rtt(km(city, ORIGIN));
  if (o.where === "origin") {
    // The CDN keeps a warm connection to the origin, so one extra round trip, then local queries.
    const t = toEdge + edgeToOrigin + o.queries * 1 + o.renderMs;
    return { total: t, parts: [{ label: "to the edge", ms: toEdge }, { label: "edge ↔ origin", ms: edgeToOrigin }, { label: `${o.queries} queries, local`, ms: o.queries }, { label: "render", ms: o.renderMs }] };
  }
  if (o.where === "edge") {
    // Queries run one after another (each needs the previous result), each crossing to Virginia.
    const q = o.queries * edgeToOrigin;
    return { total: toEdge + q + o.renderMs, parts: [{ label: "to the edge", ms: toEdge }, { label: `${o.queries} queries across the ocean`, ms: q }, { label: "render", ms: o.renderMs }] };
  }
  // Replicated KV: reads are local; personalised data that isn't replicated still goes home once.
  const home = o.personalised ? edgeToOrigin : 0;
  return { total: toEdge + o.queries * 2 + home + o.renderMs, parts: [{ label: "to the edge", ms: toEdge }, { label: `${o.queries} reads from the edge store`, ms: o.queries * 2 }, ...(home ? [{ label: "per-user data from origin", ms: home }] : []), { label: "render", ms: o.renderMs }] };
}

export function table(o: Opts) {
  return CITIES.map((c) => {
    const here = ttfb(c, o);
    const origin = ttfb(c, { ...o, where: "origin" });
    return { city: c, distance: Math.round(km(c, ORIGIN)), rtt: rtt(km(c, ORIGIN)), ms: here.total, parts: here.parts, vsOrigin: here.total - origin.total };
  });
}

/** Queries at which rendering at the edge stops paying off, per city. */
export function breakEven(city: City) {
  for (let q = 0; q <= 10; q++) {
    const o: Opts = { where: "edge", queries: q, personalised: false, renderMs: RENDER_MS };
    if (ttfb(city, o).total > ttfb(city, { ...o, where: "origin" }).total) return q;
  }
  return null;
}

export type Feature = { id: string; label: string; edgeOk: boolean; why: string };
export const FEATURES: Feature[] = [
  { id: "tcp", label: "Postgres over a TCP driver", edgeOk: false, why: "Edge runtimes speak HTTP and WebSockets, not raw TCP: use an HTTP or WebSocket driver, or a pooler with an HTTP API." },
  { id: "fs", label: "Reading files from disk", edgeOk: false, why: "There's no filesystem; bundle the data or fetch it." },
  { id: "image", label: "Resizing images with a native library", edgeOk: false, why: "Native modules don't run in V8 isolates, and CPU time per request is capped." },
  { id: "fetch", label: "fetch() to other APIs", edgeOk: true, why: "Web-standard APIs like fetch, Request, Response and crypto.subtle are available." },
  { id: "cookies", label: "Reading cookies for A/B tests", edgeOk: true, why: "Headers and cookies are right there in the request." },
];
