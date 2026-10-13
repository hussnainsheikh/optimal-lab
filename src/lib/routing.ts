// Longest-prefix match in a router's table.
import { contains } from "./subnets";
export const TABLE = [
  { prefix: "0.0.0.0/0", via: "ISP uplink", note: "default route" },
  { prefix: "10.0.0.0/8", via: "Core router", note: "all of 10.x" },
  { prefix: "10.1.0.0/16", via: "Office VPN", note: "office network" },
  { prefix: "10.1.2.0/24", via: "Lab switch", note: "one lab subnet" },
  { prefix: "192.168.0.0/16", via: "LAN", note: "local devices" },
];
export const DESTS = ["10.1.2.77", "10.1.9.4", "10.200.0.1", "192.168.1.20", "8.8.8.8"];
export function lookup(ip: string) {
  const matches = TABLE.filter((r) => contains(r.prefix, ip)).map((r) => ({ ...r, len: Number(r.prefix.split("/")[1]) }));
  const best = matches.reduce((a, b) => (b.len > a.len ? b : a));
  return { matches: matches.map((m) => m.prefix), best };
}
