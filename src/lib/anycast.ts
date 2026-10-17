// Anycast: three sites announce the same prefix with BGP. Each user's network
// picks the route with the fewest AS hops, which is usually, but not always, the
// nearest site. Round-trip times are typical figures, not measurements.

export const PREFIX = "198.51.100.0/24"; // documentation range (RFC 5737)
export const ADDRESS = "198.51.100.53";

export type SiteId = "fra" | "sin" | "iad";
export const SITES: { id: SiteId; city: string }[] = [
  { id: "fra", city: "Frankfurt" },
  { id: "sin", city: "Singapore" },
  { id: "iad", city: "Virginia" },
];

export type UserId = "lon" | "nyc" | "khi" | "syd" | "sao";

export const USERS: { id: UserId; city: string; rtt: Record<SiteId, number>; asHops: Record<SiteId, number> }[] = [
  { id: "lon", city: "London", rtt: { fra: 15, sin: 170, iad: 75 }, asHops: { fra: 2, sin: 4, iad: 3 } },
  { id: "nyc", city: "New York", rtt: { fra: 85, sin: 230, iad: 8 }, asHops: { fra: 3, sin: 4, iad: 2 } },
  // Karachi's provider buys transit through Europe, so BGP prefers Frankfurt even though Singapore is closer.
  { id: "khi", city: "Karachi", rtt: { fra: 130, sin: 90, iad: 220 }, asHops: { fra: 2, sin: 3, iad: 3 } },
  { id: "syd", city: "Sydney", rtt: { fra: 280, sin: 95, iad: 200 }, asHops: { fra: 4, sin: 2, iad: 3 } },
  { id: "sao", city: "São Paulo", rtt: { fra: 190, sin: 330, iad: 120 }, asHops: { fra: 3, sin: 4, iad: 2 } },
];

// With plain unicast, the one server lives in Virginia.
export const UNICAST_SITE: SiteId = "iad";

export function pick(user: UserId, up: Record<SiteId, boolean>): { site: SiteId | null; rtt: number | null; nearest: SiteId | null } {
  const u = USERS.find((x) => x.id === user)!;
  const live = SITES.filter((s) => up[s.id]).map((s) => s.id);
  if (!live.length) return { site: null, rtt: null, nearest: null };
  // Fewest AS hops wins; lower round trip breaks a tie (a stand-in for BGP's tie-breakers).
  const byBgp = [...live].sort((a, b) => u.asHops[a] - u.asHops[b] || u.rtt[a] - u.rtt[b]);
  const byRtt = [...live].sort((a, b) => u.rtt[a] - u.rtt[b]);
  return { site: byBgp[0], rtt: u.rtt[byBgp[0]], nearest: byRtt[0] };
}

export function table(up: Record<SiteId, boolean>) {
  return USERS.map((u) => {
    const p = pick(u.id, up);
    return { user: u, ...p, unicast: up[UNICAST_SITE] ? u.rtt[UNICAST_SITE] : null };
  });
}
