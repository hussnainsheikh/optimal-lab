// A Cassandra-style wide-column table on a six-node ring. Partition keys are hashed with
// MurmurHash3 (the 32-bit x86 variant here; Cassandra uses the 128-bit one) onto a token
// ring; each partition lives on the node that owns its token and the next two (replication
// factor 3). A chat app's messages are stored with or without a day bucket in the partition
// key; partition sizes, per-node load, which partitions a query touches, and whether a read
// or write at a consistency level succeeds with nodes down are all computed. Message volumes
// are generated from a seeded Zipf curve; sizes are illustrative.

export function murmur3(key: string, seed = 0): number {
  const bytes = new TextEncoder().encode(key);
  let h = seed >>> 0;
  const c1 = 0xcc9e2d51, c2 = 0x1b873593;
  const n = bytes.length & ~3;
  for (let i = 0; i < n; i += 4) {
    let k = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
    k = Math.imul(k, c1);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, c2);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  let k = 0;
  switch (bytes.length & 3) {
    case 3:
      k ^= bytes[n + 2] << 16;
    // falls through
    case 2:
      k ^= bytes[n + 1] << 8;
    // falls through
    case 1:
      k ^= bytes[n];
      k = Math.imul(k, c1);
      k = (k << 15) | (k >>> 17);
      k = Math.imul(k, c2);
      h ^= k;
  }
  h ^= bytes.length;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export const NODES = ["n1", "n2", "n3", "n4", "n5", "n6"];
export const RF = 3;
/** The node owning a token: each node owns an equal slice of the 32-bit ring. */
export const owner = (token: number) => Math.floor((token / 2 ** 32) * NODES.length);
export const replicas = (token: number) => Array.from({ length: RF }, (_, i) => NODES[(owner(token) + i) % NODES.length]);

export const CHANNELS = 2_000;
export const DAYS = 30;
export const MSG_B = 220; // one message row: id, author, text, timestamps
export const MAX_GOOD_MB = 100; // Cassandra's long-standing advice: keep partitions well under ~100 MB

/** Messages a day for each channel: a few huge channels, a long tail of quiet ones. */
export const perDay = (rank: number) => Math.round(400_000 / Math.pow(rank + 1, 1.1));

export type Design = "channel" | "channelDay";
export function partitions(design: Design) {
  const out: { key: string; token: number; mb: number; nodes: string[] }[] = [];
  for (let c = 0; c < CHANNELS; c++) {
    const daily = perDay(c);
    if (design === "channel") {
      const key = `channel-${c + 1}`;
      const token = murmur3(key);
      out.push({ key, token, mb: (daily * DAYS * MSG_B) / 1e6, nodes: replicas(token) });
    } else {
      for (let d = 0; d < DAYS; d++) {
        const key = `channel-${c + 1}:2024-06-${String(d + 1).padStart(2, "0")}`;
        const token = murmur3(key);
        out.push({ key, token, mb: (daily * MSG_B) / 1e6, nodes: replicas(token) });
      }
    }
  }
  return out;
}

const layouts = new Map<Design, ReturnType<typeof buildLayout>>();
export function layout(design: Design) {
  if (!layouts.has(design)) layouts.set(design, buildLayout(design));
  return layouts.get(design)!;
}
function buildLayout(design: Design) {
  const ps = partitions(design);
  const load = Object.fromEntries(NODES.map((n) => [n, 0])) as Record<string, number>;
  for (const p of ps) for (const n of p.nodes) load[n] += p.mb;
  const biggest = ps.reduce((a, p) => (p.mb > a.mb ? p : a));
  const tooBig = ps.filter((p) => p.mb > MAX_GOOD_MB).length;
  const loads = Object.values(load);
  return { count: ps.length, load, biggest, tooBig, imbalance: Math.max(...loads) / (loads.reduce((a, b) => a + b, 0) / loads.length) };
}

export type QueryId = "latest" | "byUser" | "range";
export const QUERIES: Record<QueryId, { label: string; cql: (d: Design) => string }> = {
  latest: { label: "Latest 50 in #general", cql: (d) => `SELECT * FROM messages WHERE channel_id = 1${d === "channelDay" ? " AND day = '2024-06-30'" : ""} LIMIT 50` },
  range: { label: "#general, last 3 days", cql: (d) => (d === "channelDay" ? "SELECT * FROM messages WHERE channel_id = 1 AND day IN ('2024-06-28', '2024-06-29', '2024-06-30')" : "SELECT * FROM messages WHERE channel_id = 1 AND sent_at > '2024-06-28'") },
  byUser: { label: "Everything one user wrote", cql: () => "SELECT * FROM messages WHERE author_id = 9917" },
};

/** Which partitions a query reads, and whether Cassandra accepts it. */
export function plan(q: QueryId, design: Design, byUserTable: boolean) {
  if (q === "byUser") {
    if (byUserTable) return { allowed: true, partitions: 1, note: "messages_by_author has author_id as its partition key: one partition", table: "messages_by_author" };
    const n = design === "channel" ? CHANNELS : CHANNELS * DAYS;
    return { allowed: false, partitions: n, note: `author_id isn't the partition key: Cassandra refuses unless you add ALLOW FILTERING, which reads all ${n.toLocaleString("en-US")} partitions on every node`, table: "messages" };
  }
  const n = q === "latest" ? 1 : design === "channelDay" ? 3 : 1;
  return { allowed: true, partitions: n, note: n === 1 ? "one partition, read in clustering order (newest first)" : "three day-partitions, one per bucket", table: "messages" };
}

export type CL = "ONE" | "QUORUM" | "ALL";
export const needed = (cl: CL) => (cl === "ONE" ? 1 : cl === "QUORUM" ? Math.floor(RF / 2) + 1 : RF);
export function consistency(write: CL, read: CL, down: number) {
  const up = RF - down; // replicas of this partition that answer
  const w = needed(write), r = needed(read);
  return { writeOk: up >= w, readOk: up >= r, strong: w + r > RF, w, r, up };
}
