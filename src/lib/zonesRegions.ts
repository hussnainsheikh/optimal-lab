// Where to run, and which failures you survive.
export type Layout = "one" | "multiaz" | "multiregion";
export const LAYOUTS: { id: Layout; label: string; cost: string; latency: string }[] = [
  { id: "one", label: "One availability zone", cost: "1×", latency: "lowest" },
  { id: "multiaz", label: "Three zones, one region", cost: "~1.1× (+ cross-zone traffic)", latency: "+~1 ms between zones" },
  { id: "multiregion", label: "Two regions", cost: "~2×", latency: "+60–100 ms between regions" },
];
export const FAILURES = [
  { id: "server", label: "A server dies", odds: "weekly, somewhere" },
  { id: "az", label: "A data center (zone) loses power", odds: "a few times a year" },
  { id: "region", label: "A whole region has an outage", odds: "rare, but it happens" },
];
export function survives(l: Layout, f: string) {
  if (f === "server") return l !== "one" ? "yes" : "yes, if you run more than one server";
  if (f === "az") return l === "one" ? "no" : "yes";
  return l === "multiregion" ? "yes" : "no";
}
