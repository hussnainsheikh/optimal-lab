// Design a chat app: persistent connections, ordering, group fan-out, delivery and
// read receipts, and presence. Sizing is analytic; a group message's receipts are
// simulated with a fixed seed.

export const ONLINE = 10e6; // concurrent connections at peak
export const PER_GATEWAY = 100_000; // WebSocket connections one gateway server holds
export const GATEWAYS = Math.ceil(ONLINE / PER_GATEWAY);
export const ONLINE_SHARE = 0.4; // share of a group's members online right now

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ordering: two people reply at nearly the same time; Alice's phone clock runs 4 s fast.
export const SKEW_S = 4;
export const MESSAGES = [
  { from: "Sam", text: "Are we still on for 7?", sentAt: 0, arrivesAt: 0.1 },
  { from: "Alice", text: "Yes! See you there", sentAt: 2, arrivesAt: 2.1 },
  { from: "Sam", text: "Great, I'll book the table", sentAt: 3, arrivesAt: 3.1 },
];
export function order(by: "client" | "server") {
  const withStamp = MESSAGES.map((m) => ({ ...m, stamp: by === "client" ? m.sentAt + (m.from === "Alice" ? SKEW_S : 0) : m.arrivesAt }));
  return [...withStamp].sort((a, b) => a.stamp - b.stamp).map((m, i) => ({ ...m, seq: i + 1 }));
}

export const GROUPS = [2, 50, 500];

export function fanout(members: number) {
  const others = members - 1;
  const online = Math.max(members === 2 ? 1 : 0, Math.round(others * ONLINE_SHARE));
  const offline = others - online;
  // distinct gateways the online members are spread over
  const gateways = Math.round(GATEWAYS * (1 - (1 - 1 / GATEWAYS) ** online));
  return { others, online, offline, gateways };
}

export type Receipts = "each" | "batched";
export const BATCH_S = 30;
// Each recipient's delivered and read times over the next hour.
export function receipts(members: number, mode: Receipts) {
  const r = mulberry32(members);
  const f = fanout(members);
  const events: number[] = [];
  for (let i = 0; i < f.others; i++) {
    const delivered = i < f.online ? r() * 0.5 : r() * 3600;
    events.push(delivered);
    if (r() < 0.7) events.push(delivered + r() * r() * 1800); // 70% read it within the hour
  }
  const toSender = mode === "each" ? events.length : new Set(events.map((t) => Math.floor(t / BATCH_S))).size;
  return { events: events.length, toSender };
}

// Presence: users go online/offline about six times an hour.
export const CHANGES_PER_HOUR = 6;
export const ONLINE_CONTACTS = 40;
export type Presence = "eager" | "lazy";
export function presenceRate(mode: Presence) {
  const changes = (ONLINE * CHANGES_PER_HOUR) / 3600;
  // eager: tell every online contact; lazy: only people with your chat open (about 1)
  return Math.round(changes * (mode === "eager" ? ONLINE_CONTACTS : 1));
}

export const fmt = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);
