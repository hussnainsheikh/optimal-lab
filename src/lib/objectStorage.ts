// Store one 120 MB object on nine storage nodes in three zones, three ways, then
// fail disks and zones. A scheme splits the object into k data pieces and adds m more
// (copies or parity); any k of the k + m pieces rebuild it.
//
//   2 copies    k = 1, m = 1   2.0× the raw size, survives 1 lost piece
//   3 copies    k = 1, m = 2   3.0×, survives 2
//   erasure 6+3 k = 6, m = 3   1.5×, survives 3   (Reed-Solomon)

export const OBJECT_MB = 120;
export const ZONES = ["A", "B", "C"] as const;
export const NODES = ZONES.flatMap((z) => [1, 2, 3].map((i) => `${z}${i}`));

export type Scheme = "rep2" | "rep3" | "ec63";
export const SCHEMES: { id: Scheme; label: string; k: number; m: number; one: string }[] = [
  { id: "rep2", label: "2 copies", k: 1, m: 1, one: "Write the whole object twice, in two zones." },
  { id: "rep3", label: "3 copies", k: 1, m: 2, one: "Write the whole object three times, one copy in each zone." },
  { id: "ec63", label: "Erasure 6+3", k: 6, m: 3, one: "Cut it into 6 data pieces, compute 3 parity pieces, put 3 pieces in each zone. Any 6 rebuild the object." },
];
export const scheme = (s: Scheme) => SCHEMES.find((x) => x.id === s)!;

export type Piece = { i: number; node: string; parity: boolean; mb: number };

// Placement: spread pieces round-robin over zones so each zone holds an equal share.
export function place(s: Scheme): Piece[] {
  const { k, m } = scheme(s);
  const n = k + m;
  const mb = OBJECT_MB / k;
  const used = new Map<string, number>();
  return Array.from({ length: n }, (_, i) => {
    const z = ZONES[i % ZONES.length];
    const slot = (used.get(z) ?? 0) + 1;
    used.set(z, slot);
    return { i, node: `${z}${slot}`, parity: k > 1 && i >= k, mb };
  });
}

export type FailPreset = "none" | "disk" | "two" | "zone" | "zonePlus";
export const FAILS: { id: FailPreset; label: string; nodes: string[] }[] = [
  { id: "none", label: "Nothing", nodes: [] },
  { id: "disk", label: "One disk", nodes: ["A1"] },
  { id: "two", label: "Two disks", nodes: ["A1", "B1"] },
  { id: "zone", label: "Zone A", nodes: ["A1", "A2", "A3"] },
  { id: "zonePlus", label: "Zone A + a disk", nodes: ["A1", "A2", "A3", "B1"] },
];

export function status(s: Scheme, failed: string[]) {
  const { k, m } = scheme(s);
  const pieces = place(s);
  const alive = pieces.filter((p) => !failed.includes(p.node));
  const lost = pieces.length - alive.length;
  const readable = alive.length >= k;
  const degraded = readable && lost > 0;
  // A read fetches k pieces. With erasure coding, if a data piece is gone, the
  // missing data is decoded from parity on the fly.
  const dataLost = pieces.filter((p) => !p.parity && failed.includes(p.node)).length;
  const readMB = OBJECT_MB;
  // Rebuilding one lost piece reads k pieces' worth: a full copy for replication,
  // k fragments for erasure coding.
  const repairMB = lost * k * (OBJECT_MB / k);
  const rebuiltMB = lost * (OBJECT_MB / k);
  return { pieces, alive: alive.length, lost, readable, degraded, dataLost, decode: k > 1 && dataLost > 0, readMB, repairMB, rebuiltMB, margin: m - lost };
}

export const overhead = (s: Scheme) => {
  const { k, m } = scheme(s);
  return (k + m) / k;
};

// Durability: disks fail independently at AFR a year; a lost piece is rebuilt within
// `repairHours`. The object is lost only if more than m of its n pieces fail inside one
// repair window. Probability per year ≈ windows per year × P(more than m of n fail).
export const AFR = 0.02;
export const REPAIR_HOURS = [1, 24, 168];

function choose(n: number, r: number) {
  let c = 1;
  for (let i = 0; i < r; i++) c = (c * (n - i)) / (i + 1);
  return c;
}

export function lossPerYear(s: Scheme, repairHours: number) {
  const { k, m } = scheme(s);
  const n = k + m;
  const p = (AFR * repairHours) / 8760;
  let tail = 0;
  for (let f = m + 1; f <= n; f++) tail += choose(n, f) * p ** f * (1 - p) ** (n - f);
  return Math.min(1, (8760 / repairHours) * tail);
}

export const nines = (pLoss: number) => Math.floor(-Math.log10(pLoss));

// Raw disk needed for a petabyte of customer data.
export const rawPB = (s: Scheme) => overhead(s);
