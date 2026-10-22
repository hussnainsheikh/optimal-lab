// A shop's origin: a 10 Gbps link, servers that handle 5,000 requests a second,
// and 2,000 a second of real customers. Five attacks arrive, one at a time. Layers
// of defence in front of the origin each remove part of each attack (and sometimes
// part of the real traffic). What reaches the origin, and whether customers still
// get through, is computed layer by layer.

export const LINK_GBPS = 10;
export const ORIGIN_RPS = 5000;
export const LEGIT_RPS = 2000;
export const LEGIT_GBPS = 0.4;

export type AttackId = "udp" | "syn" | "http" | "stuffing" | "sqli";
export const ATTACKS: { id: AttackId; label: string; layer: string; gbps: number; rps: number; what: string }[] = [
  { id: "udp", label: "UDP reflection flood", layer: "L3/4", gbps: 300, rps: 0, what: "300 Gbps of DNS and memcached replies aimed at your IP." },
  { id: "syn", label: "SYN flood", layer: "L4", gbps: 8, rps: 2_000_000, what: "Two million half-open connections a second fill the server's connection table." },
  { id: "http", label: "HTTP flood", layer: "L7", gbps: 2, rps: 60_000, what: "60,000 real-looking GET requests a second from a botnet of home routers." },
  { id: "stuffing", label: "Credential stuffing", layer: "L7", gbps: 0.05, rps: 800, what: "800 login attempts a second with leaked username and password pairs." },
  { id: "sqli", label: "SQL injection probes", layer: "L7", gbps: 0.01, rps: 50, what: "A scanner tries thousands of injection payloads against every form." },
];

export type DefenseId = "anycast" | "synCookies" | "rateLimit" | "bot" | "waf" | "cache";
export const DEFENSES: { id: DefenseId; label: string; where: string; what: string }[] = [
  { id: "anycast", label: "Anycast network and scrubbing", where: "edge", what: "Traffic lands on hundreds of edge locations with terabits of capacity; floods are dropped there." },
  { id: "synCookies", label: "SYN cookies / proxying at the edge", where: "edge", what: "The edge completes TCP handshakes itself; half-open connections never reach you." },
  { id: "cache", label: "Cache at the edge", where: "edge", what: "Product pages are served from the CDN; only misses reach the origin." },
  { id: "rateLimit", label: "Rate limits per IP and per account", where: "edge", what: "No IP may send more than 20 requests a second, and no account more than 5 logins a minute." },
  { id: "bot", label: "Bot detection and challenges", where: "edge", what: "Suspicious clients get a challenge; most bots fail it, and a few real customers are bothered." },
  { id: "waf", label: "WAF managed rules", where: "edge", what: "Known attack patterns (SQL injection, XSS, path traversal) are blocked by signature." },
];

const CACHE_HIT = 0.8;
export const BOT_FALSE_POSITIVE = 0.02;

export type Outcome = {
  stages: { label: string; gbps: number; rps: number; note: string }[];
  originGbps: number;
  originRps: number; // attack requests reaching the origin
  linkFull: boolean;
  serversFull: boolean;
  breached: boolean; // credentials or data compromised
  legitServed: number; // share of real customers served
  verdict: string;
};

export function run(a: AttackId, d: Record<DefenseId, boolean>): Outcome {
  const atk = ATTACKS.find((x) => x.id === a)!;
  let gbps = atk.gbps;
  let rps = atk.rps;
  let legitRps = LEGIT_RPS;
  let legitBlocked = 0;
  const stages: Outcome["stages"] = [{ label: "attack", gbps, rps, note: atk.what }];
  if (d.anycast && (a === "udp" || a === "syn")) {
    gbps = a === "udp" ? 0 : gbps * 0.05;
    stages.push({ label: "anycast scrubbing", gbps, rps, note: a === "udp" ? "UDP to a web port is dropped at the edge." : "Volume spread over the edge network." });
  }
  if (d.synCookies && a === "syn") {
    rps = 0;
    gbps = 0;
    stages.push({ label: "edge TCP proxy", gbps, rps, note: "Half-open connections die at the edge." });
  }
  if (d.cache) {
    legitRps *= 1 - CACHE_HIT;
    if (a === "http") {
      rps *= 1 - CACHE_HIT;
      stages.push({ label: "edge cache", gbps, rps, note: `${Math.round(CACHE_HIT * 100)}% of GETs answered from cache.` });
    }
  }
  if (d.rateLimit && (a === "http" || a === "stuffing")) {
    rps *= a === "stuffing" ? 0.1 : 0.5; // a big botnet spreads load across many IPs, so per-IP limits only halve it
    stages.push({ label: "rate limits", gbps, rps, note: a === "stuffing" ? "Per-account limits stop most guesses." : "Botnet IPs each stay under the limit; it only halves the flood." });
  }
  if (d.bot && (a === "http" || a === "stuffing")) {
    rps *= 0.05;
    legitBlocked = BOT_FALSE_POSITIVE;
    stages.push({ label: "bot challenge", gbps, rps, note: `Bots fail the challenge; ${Math.round(BOT_FALSE_POSITIVE * 100)}% of real customers see one too.` });
  }
  if (d.waf && a === "sqli") {
    rps = 0;
    stages.push({ label: "WAF rules", gbps, rps, note: "Injection signatures blocked." });
  }
  const originGbps = gbps + LEGIT_GBPS;
  const linkFull = originGbps > LINK_GBPS;
  const load = rps + legitRps;
  const serversFull = a !== "udp" && load > ORIGIN_RPS;
  const breached = (a === "sqli" && rps > 0) || (a === "stuffing" && rps > 50);
  let legitServed = 1 - legitBlocked;
  if (linkFull) legitServed *= LINK_GBPS / originGbps;
  else if (serversFull) legitServed *= ORIGIN_RPS / load;
  const verdict = linkFull
    ? `The link is full: ${Math.round(originGbps)} Gbps into a ${LINK_GBPS} Gbps pipe. Nothing you run on the servers can help; it has to be stopped before it reaches you.`
    : serversFull
      ? `${Math.round(load).toLocaleString("en-US")} requests a second against ${ORIGIN_RPS.toLocaleString("en-US")} the servers can handle: real customers time out.`
      : breached
        ? a === "sqli"
          ? "Traffic is tiny and the site stays up, but the probes reach the app. Without a WAF (and parameterized queries), one of them may work."
          : `The site stays up, but ${Math.round(rps)} guesses a second reach the login. At a 0.5% hit rate that's an account taken over every few seconds.`
        : "The origin barely notices.";
  return { stages, originGbps, originRps: rps, linkFull, serversFull, breached, legitServed, verdict };
}

export const NONE: Record<DefenseId, boolean> = { anycast: false, synCookies: false, cache: false, rateLimit: false, bot: false, waf: false };
export const ALL: Record<DefenseId, boolean> = { anycast: true, synCookies: true, cache: true, rateLimit: true, bot: true, waf: true };
export const fmt = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : Math.round(v).toLocaleString("en-US"));
