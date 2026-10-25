// How a service stays up under a flood: this is about the defences, not how to run an attack.
// A volume of unwanted traffic arrives at the edge, and each layer in front of the origin removes
// part of it. A single link has a fixed capacity, so anything above it is congestion that drops
// good and bad traffic alike; blackholing the address at the ISP takes the service fully offline;
// an anycast network answers the same address from hundreds of locations, so the load divides and
// each site filters the junk. Separately, a connection flood fills a server's half-open queue,
// which SYN cookies let the server answer without keeping state. Capacities and traffic volumes
// are illustrative round numbers.

export const LINK_GBPS = 10;
export const LEGIT_GBPS = 2;
export const POPS = 300;
export const POP_GBPS = 100;
export const HOTTEST_SHARE = 0.03; // the busiest anycast site's share of a spread-out flood

export type Vector = "volumetric" | "stateExhaustion" | "application";
export const VECTOR: Record<Vector, { label: string; unit: string; size: number; what: string }> = {
  volumetric: { label: "A bandwidth flood", unit: "Gbps", size: 240, what: "Enough traffic to fill the link, so real packets never reach the server." },
  stateExhaustion: { label: "A connection flood", unit: "k half-open/s", size: 800, what: "Half-finished handshakes that fill the server's connection table." },
  application: { label: "An application flood", unit: "k requests/s", size: 90, what: "Real-looking requests that each make the server do expensive work." },
};

export type Defense = "link" | "blackhole" | "anycast";
export const DEFENSE_LABEL: Record<Defense, string> = { link: "One 10 Gbps link", blackhole: "ISP drops all traffic to the IP", anycast: "Anycast scrubbing network" };

export type Absorb = { reaches: number; capacity: number; legitThrough: number; up: boolean; note: string };

// A volumetric flood (Gbps) against each defence.
export function absorbVolume(d: Defense, floodGbps: number): Absorb {
  const offered = floodGbps + LEGIT_GBPS;
  if (d === "blackhole")
    return { reaches: 0, capacity: 0, legitThrough: 0, up: false, note: "The ISP null-routes the address, so the flood stops hurting the ISP, but the service is fully down for everyone." };
  if (d === "anycast") {
    const perSite = offered * HOTTEST_SHARE;
    const up = perSite <= POP_GBPS;
    return { reaches: perSite, capacity: POP_GBPS, legitThrough: up ? LEGIT_GBPS : LEGIT_GBPS * (POP_GBPS / perSite), up, note: up ? `Spread across ${POPS} sites, the busiest handles ${perSite.toFixed(1)} Gbps and filters the junk there.` : "Even divided, the busiest site is over capacity." };
  }
  const up = offered <= LINK_GBPS;
  return { reaches: Math.min(offered, LINK_GBPS), capacity: LINK_GBPS, legitThrough: up ? LEGIT_GBPS : LEGIT_GBPS * (LINK_GBPS / offered), up, note: up ? "Under the link's capacity, everything gets through." : `The ${LINK_GBPS} Gbps link is saturated; good and bad traffic drop together.` };
}

// ── A connection flood and SYN cookies ───────────────────────────────────────

export const BACKLOG = 1024; // half-open connections the queue holds
export const SYNACK_HOLD_S = 63; // Linux holds a half-open entry ~63 s (5 SYN-ACK retries)
export const LEGIT_CONN_PER_S = 500;

export type Queue = { attackEntries: number; capacity: number; cookies: boolean; legitAccepted: number; note: string };

export function synQueue(halfOpenPerS: number, cookies: boolean): Queue {
  if (cookies)
    return { attackEntries: 0, capacity: BACKLOG, cookies: true, legitAccepted: 1, note: "SYN cookies encode the connection in the sequence number, so the server keeps no half-open state and the queue never fills." };
  const attack = halfOpenPerS * 1000 * (SYNACK_HOLD_S / 1000); // entries held at once
  const full = attack >= BACKLOG;
  const crowded = attack >= BACKLOG * 0.5;
  return {
    attackEntries: Math.min(attack, BACKLOG),
    capacity: BACKLOG,
    cookies: false,
    legitAccepted: full ? 0 : 1 - attack / BACKLOG,
    note: full
      ? `${Math.round(attack).toLocaleString("en-US")} half-open entries overflow the ${BACKLOG}-slot queue; new SYNs, real ones included, are dropped.`
      : crowded
        ? `${Math.round(attack).toLocaleString("en-US")} of ${BACKLOG} slots are held by half-open connections, so most real SYNs find no room.`
        : "The queue has room for the half-open connections and the real ones.",
  };
}

// ── Telling real from fake at the application layer ──────────────────────────

export type Filter = "none" | "ratelimit" | "challenge" | "fingerprint";
export const FILTER_LABEL: Record<Filter, string> = { none: "No filter", ratelimit: "Rate limit per IP", challenge: "JavaScript / proof-of-work challenge", fingerprint: "Challenge + TLS fingerprint reputation" };

// Illustrative: how much of a request flood and of real traffic each filter lets through.
const FILTERS: Record<Filter, { botThrough: number; humanThrough: number }> = {
  none: { botThrough: 1, humanThrough: 1 },
  ratelimit: { botThrough: 0.35, humanThrough: 0.98 },
  challenge: { botThrough: 0.04, humanThrough: 0.95 },
  fingerprint: { botThrough: 0.01, humanThrough: 0.99 },
};

export function appFilter(f: Filter, botKRps: number, humanKRps: number, serverCapKRps: number) {
  const ft = FILTERS[f];
  const bots = botKRps * ft.botThrough;
  const humans = humanKRps * ft.humanThrough;
  const offered = bots + humans;
  const overloaded = offered > serverCapKRps;
  const served = overloaded ? serverCapKRps : offered;
  const humanServed = overloaded ? served * (humans / offered) : humans;
  return { bots, humans, offered, overloaded, humanServed, humanShare: humanServed / humanKRps };
}
