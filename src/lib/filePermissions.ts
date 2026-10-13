// Unix permissions on deploy.sh, owned by alice, group web.
export type Who = "u" | "g" | "o";
export type Bit = "r" | "w" | "x";
export const WHO: { id: Who; label: string }[] = [{ id: "u", label: "owner (alice)" }, { id: "g", label: "group (web)" }, { id: "o", label: "others" }];
export const BITS: Bit[] = ["r", "w", "x"];
export const ACTORS = [
  { name: "alice", groups: ["alice", "web"], cls: "u" as Who },
  { name: "deploy", groups: ["deploy", "web"], cls: "g" as Who },
  { name: "guest", groups: ["guest"], cls: "o" as Who },
];
export type Perms = Record<Who, Record<Bit, boolean>>;
export const octal = (p: Perms) => (["u", "g", "o"] as Who[]).map((w) => (p[w].r ? 4 : 0) + (p[w].w ? 2 : 0) + (p[w].x ? 1 : 0)).join("");
export const lsString = (p: Perms) => "-" + (["u", "g", "o"] as Who[]).map((w) => BITS.map((b) => (p[w][b] ? b : "-")).join("")).join("");
export function fromOctal(s: string): Perms {
  const d = s.split("").map(Number);
  const mk = (n: number) => ({ r: !!(n & 4), w: !!(n & 2), x: !!(n & 1) });
  return { u: mk(d[0]), g: mk(d[1]), o: mk(d[2]) };
}
export const PRESETS = ["755", "644", "700", "777", "750"];
