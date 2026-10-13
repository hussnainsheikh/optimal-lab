// One page load, hop by hop, cold vs warm. Times in ms, illustrative.
export type Path = "cold" | "warm" | "cached";
export const PATHS: { id: Path; label: string }[] = [
  { id: "cold", label: "First visit, cache misses" },
  { id: "warm", label: "Return visit, app cache hit" },
  { id: "cached", label: "Served from the CDN" },
];
export function hops(p: Path) {
  const all = [
    { name: "DNS lookup", ms: p === "cold" ? 40 : 0, note: p === "cold" ? "Resolver walks to the authoritative server" : "Cached by the OS" },
    { name: "TCP + TLS to CDN edge", ms: p === "cold" ? 30 : 0, note: p === "cold" ? "Two round trips to a nearby edge" : "Connection reused" },
    { name: "CDN edge", ms: 2, note: p === "cached" ? "Cache hit: response sent from the edge" : "Miss: forward to the origin" },
    { name: "Edge → origin load balancer", ms: p === "cached" ? 0 : 70, note: "Long-haul to the region" },
    { name: "App server", ms: p === "cached" ? 0 : 15, note: "Render, call services" },
    { name: "Cache (Redis)", ms: p === "cached" ? 0 : 1, note: p === "cold" ? "Miss" : "Hit" },
    { name: "Database", ms: p === "cold" ? 25 : 0, note: p === "cold" ? "Query on the primary" : "Skipped" },
    { name: "Response back to the user", ms: p === "cached" ? 10 : 80, note: "Return trip, then the browser renders" },
  ];
  return { hops: all, total: all.reduce((a, h) => a + h.ms, 0) };
}
