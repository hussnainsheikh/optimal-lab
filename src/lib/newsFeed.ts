// Design a news feed. Posters come in three tiers by follower count. Fan-out on write
// copies each post id into every follower's feed; fan-out on read gathers posts from
// everyone you follow when you open the app. A hybrid pushes for most accounts and
// pulls for accounts above a follower threshold.

export const USERS = 500e6;
export const DAU = 100e6;
export const LOADS_PER_DAY = 10; // feed opens per active user
export const POSTS_PER_DAY = 20e6;

export const TIERS = [
  { id: "regular", label: "Regular", followers: 200, share: 0.9995, followed: 295 },
  { id: "popular", label: "Popular", followers: 100_000, share: 0.00049, followed: 3 },
  { id: "celebrity", label: "Celebrity", followers: 20_000_000, share: 0.00001, followed: 2 },
] as const;
export type Tier = (typeof TIERS)[number]["id"];
export const FOLLOWS = TIERS.reduce((s, t) => s + t.followed, 0);

// Pull accounts with more followers than this; push the rest.
export const THRESHOLDS = [Infinity, 1e6, 10_000, 0];
export const thresholdLabel = (t: number) => (t === Infinity ? "Push everyone" : t === 0 ? "Pull everyone" : `Pull above ${t >= 1e6 ? `${t / 1e6}M` : `${t / 1e3}k`}`);

export const WORKER_INSERTS_PER_S = 500_000;
export const FEED_LENGTH = 500; // post ids kept per user
export const ID_BYTES = 8;

export function design(threshold: number, activeOnly: boolean) {
  const reach = activeOnly ? DAU / USERS : 1;
  let insertsPerDay = 0;
  let pulledPerLoad = 0;
  const pushed: Tier[] = [];
  for (const t of TIERS) {
    if (t.followers > threshold) pulledPerLoad += t.followed;
    else {
      pushed.push(t.id);
      insertsPerDay += POSTS_PER_DAY * t.share * t.followers * reach;
    }
  }
  const celeb = TIERS[2];
  const celebPushed = pushed.includes("celebrity");
  return {
    insertsPerSec: insertsPerDay / 86400,
    readsPerSec: (DAU * LOADS_PER_DAY) / 86400,
    // each feed load reads the precomputed list (if anything is pushed) plus one
    // recent-posts lookup per pulled account
    lookupsPerLoad: (pushed.length ? 1 : 0) + pulledPerLoad,
    lookupsPerSec: ((DAU * LOADS_PER_DAY) / 86400) * ((pushed.length ? 1 : 0) + pulledPerLoad),
    // how long until the last follower of a celebrity sees a new post
    celebLagS: celebPushed ? (celeb.followers * reach) / WORKER_INSERTS_PER_S : 0,
    feedCacheGB: pushed.length ? ((activeOnly ? DAU : USERS) * FEED_LENGTH * ID_BYTES) / 1e9 : 0,
    pushed,
  };
}

export const fmt = (n: number) => (n >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);
export const secs = (s: number) => (s === 0 ? "at read time" : s < 60 ? `${Math.round(s)} s` : `${(s / 60).toFixed(1)} min`);
