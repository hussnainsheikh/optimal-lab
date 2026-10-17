// BGP between six networks (autonomous systems). AS numbers 64496–64511 and the
// prefix 203.0.113.0/24 are reserved for documentation (RFC 5398, RFC 5737).
// Simplified best-path choice: shortest AS path. Real routers check local
// preference (business deals) first, and several tie-breakers after.

export type AsId = "origin" | "a" | "c" | "b" | "isp" | "rogue";

export const ASES: Record<AsId, { asn: number; name: string }> = {
  origin: { asn: 64500, name: "Example Co" },
  a: { asn: 64501, name: "Transit A" },
  c: { asn: 64504, name: "Transit C" },
  b: { asn: 64502, name: "Transit B" },
  isp: { asn: 64503, name: "Your ISP" },
  rogue: { asn: 64510, name: "Other network" },
};

export const LINKS: [AsId, AsId][] = [
  ["origin", "a"],
  ["origin", "c"],
  ["c", "b"],
  ["a", "isp"],
  ["b", "isp"],
  ["rogue", "isp"],
];

export const PREFIX = "203.0.113.0/24";
export const DEST = "203.0.113.10";
// The origin's RPKI record (ROA): only AS64500 may announce this, and nothing longer than /24.
export const ROA = { prefix: PREFIX, asn: 64500, maxLength: 24 };

export type ScenarioId = "normal" | "link-down" | "hijack" | "more-specific";

export const SCENARIOS: { id: ScenarioId; label: string; story: string }[] = [
  { id: "normal", label: "Normal day", story: "Example Co announces its /24 to both transit providers." },
  { id: "link-down", label: "Cable to Transit A cut", story: "The link between Example Co and Transit A fails, so Transit A withdraws the route." },
  { id: "hijack", label: "Someone else claims it", story: "Another network announces the same /24, by mistake or on purpose. Its path to your ISP is shorter, so your ISP believes it." },
  { id: "more-specific", label: "Someone claims two /25s", story: "Another network announces 203.0.113.0/25 and 203.0.113.128/25. More specific routes always win. Pakistan Telecom took YouTube offline worldwide this way in 2008." },
];

export type Route = {
  prefix: string;
  len: number;
  path: AsId[]; // as received by your ISP: nearest AS first, origin last
  via: AsId; // the neighbour it came from
  valid: boolean; // RPKI result
  dropped: boolean; // rejected by RPKI checks
  best: boolean;
  covers: boolean; // does this prefix contain DEST?
};

export type Result = {
  routes: Route[];
  used: Route; // the route that forwards traffic to DEST
  trafficPath: AsId[]; // from your ISP to whoever ends up with the traffic
  hijacked: boolean;
  announced: AsId[][]; // announcement paths, each from the announcer to your ISP
};

const asPath = (p: AsId[]) => p.map((x) => ASES[x].asn).join(" ");
export const pathText = asPath;

// 203.0.113.10 is inside 203.0.113.0/24 and 203.0.113.0/25, not 203.0.113.128/25.
const coversDest = (prefix: string) => prefix !== "203.0.113.128/25";

export function compute(scenario: ScenarioId, rpki: boolean): Result {
  const routes: Route[] = [];
  const add = (prefix: string, path: AsId[]) => {
    const len = Number(prefix.split("/")[1]);
    const origin = ASES[path[path.length - 1]].asn;
    const valid = origin === ROA.asn && len <= ROA.maxLength;
    routes.push({ prefix, len, path, via: path[0], valid, dropped: rpki && !valid, best: false, covers: coversDest(prefix) });
  };

  if (scenario !== "link-down") add(PREFIX, ["a", "origin"]);
  add(PREFIX, ["b", "c", "origin"]);
  if (scenario === "hijack") add(PREFIX, ["rogue"]);
  if (scenario === "more-specific") {
    add("203.0.113.0/25", ["rogue"]);
    add("203.0.113.128/25", ["rogue"]);
  }

  // Best path per prefix: shortest AS path among routes that weren't dropped.
  const prefixes = [...new Set(routes.map((r) => r.prefix))];
  for (const p of prefixes) {
    const live = routes.filter((r) => r.prefix === p && !r.dropped).sort((x, y) => x.path.length - y.path.length);
    if (live[0]) live[0].best = true;
  }
  // Forwarding: the longest best prefix that contains the destination.
  const used = routes.filter((r) => r.best && r.covers).sort((x, y) => y.len - x.len)[0];
  const trafficPath: AsId[] = ["isp", ...used.path];
  const hijacked = used.path[used.path.length - 1] === "rogue";

  const announced: AsId[][] = [];
  if (scenario !== "link-down") announced.push(["origin", "a", "isp"]);
  else announced.push(["origin", "c", "b", "isp"]);
  if (scenario === "normal") announced.push(["origin", "c", "b", "isp"]);
  if (scenario === "hijack" || scenario === "more-specific") {
    announced.push(["origin", "c", "b", "isp"]);
    announced.push(["rogue", "isp"]);
  }
  return { routes, used, trafficPath, hijacked, announced };
}
