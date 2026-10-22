// A social app with users in the US, Europe and Singapore, and three cloud regions:
// Virginia, Frankfurt and Singapore. Four ways to spread one database over them.
// Latency is network round trips (approximate public-cloud figures) plus 2 ms in
// the database.

export type Region = "us" | "eu" | "ap";
export const REGIONS: { id: Region; label: string; city: string; users: string }[] = [
  { id: "us", label: "us-east", city: "Virginia", users: "US" },
  { id: "eu", label: "eu-central", city: "Frankfurt", users: "Europe" },
  { id: "ap", label: "ap-southeast", city: "Singapore", users: "Singapore" },
];

// Round trip in ms from users in one place to a region.
const RTT: Record<Region, Record<Region, number>> = {
  us: { us: 12, eu: 90, ap: 230 },
  eu: { us: 90, eu: 12, ap: 165 },
  ap: { us: 230, eu: 165, ap: 12 },
};
export const rtt = (from: Region, to: Region) => RTT[from][to];
export const DB_MS = 2;
export const LAG_MS = 400; // typical async cross-region replication lag
export const WRITES_PER_SEC = 2000;

export type Design = "single" | "replicas" | "active" | "home";
export const DESIGNS: { id: Design; label: string; one: string }[] = [
  { id: "single", label: "One region", one: "Everything in Virginia. Simple, one copy of the truth." },
  { id: "replicas", label: "Read replicas", one: "The primary database in Virginia; async read replicas in Frankfurt and Singapore. Reads are local, writes cross the ocean." },
  { id: "active", label: "Active-active", one: "Every region takes writes and replicates them to the others asynchronously. Everything is local; two regions can change the same row at once." },
  { id: "home", label: "Home region", one: "Each user's data lives in their home region, replicated across zones there. Other users' data is a cross-region call away." },
];

export type Fail = "none" | Region;

const nearestUp = (from: Region, down: Fail): Region | null => {
  const up = (["us", "eu", "ap"] as Region[]).filter((r) => r !== down);
  return up.sort((a, b) => rtt(from, a) - rtt(from, b))[0] ?? null;
};

export type Access = { readMs: number | null; writeMs: number | null; readAt: Region | null; writeAt: Region | null; note: string };

// What a user in `user` gets reading and writing their own data.
export function access(d: Design, user: Region, down: Fail = "none"): Access {
  const ms = (to: Region | null) => (to === null ? null : rtt(user, to) + DB_MS);
  if (d === "single") {
    const ok = down !== "us";
    return { readMs: ok ? ms("us") : null, writeMs: ok ? ms("us") : null, readAt: ok ? "us" : null, writeAt: ok ? "us" : null, note: ok ? "all traffic to Virginia" : "the only region is down" };
  }
  if (d === "replicas") {
    const readAt = down === user ? nearestUp(user, down) : user;
    // losing the primary stops every write until a replica is promoted
    const writeAt = down === "us" ? null : "us";
    return { readMs: ms(readAt), writeMs: ms(writeAt), readAt, writeAt, note: down === "us" ? "primary lost: reads work, writes wait for a replica to be promoted" : "reads local, writes to the primary" };
  }
  if (d === "active") {
    const at = down === user ? nearestUp(user, down) : user;
    return { readMs: ms(at), writeMs: ms(at), readAt: at, writeAt: at, note: down === user ? "rerouted to the next region" : "reads and writes local" };
  }
  // home region: own data lives at home only
  const ok = down !== user;
  return { readMs: ok ? ms(user) : null, writeMs: ok ? ms(user) : null, readAt: ok ? user : null, writeAt: ok ? user : null, note: ok ? "own data at home" : "home region down: this user's data is unavailable" };
}

// Reading another user's post, from a user in `user`, written by someone homed in `author`.
export function readOther(d: Design, user: Region, author: Region) {
  if (d === "single") return rtt(user, "us") + DB_MS;
  if (d === "home") return rtt(user, author) + DB_MS;
  return rtt(user, user) + DB_MS;
}

// Writes acknowledged but not yet copied elsewhere when a region dies.
export function lostOnFailure(d: Design, down: Fail) {
  if (down === "none") return 0;
  if (d === "single") return down === "us" ? Infinity : 0; // everything, unless backups restore it
  const lagWrites = Math.round((WRITES_PER_SEC / 3) * (LAG_MS / 1000));
  if (d === "replicas") return down === "us" ? Math.round(WRITES_PER_SEC * (LAG_MS / 1000)) : 0;
  if (d === "active") return lagWrites;
  return 0; // home region keeps its data in sync replicas inside the region: unavailable, not lost
}

// Two people edit the same group's title within the replication lag, from Europe and Singapore.
export function conflict(d: Design) {
  if (d === "active") return { lost: true, note: "Both regions accept the edit; last-writer-wins keeps Singapore's title and silently drops Europe's." };
  if (d === "home") return { lost: false, note: "The group has one home region; both edits go there and are ordered." };
  return { lost: false, note: "Both edits go to the one primary and are ordered." };
}

// Where a European user's personal data is stored.
export function residency(d: Design) {
  if (d === "single") return { ok: false, where: "Virginia only" };
  if (d === "home") return { ok: true, where: "Frankfurt only" };
  return { ok: false, where: "copied to all three regions" };
}

// How many regions hold a full copy of all the data.
export const copies = (d: Design) => ({ single: 1, replicas: 3, active: 3, home: 1 })[d];
