// Two engineers apply at the same time, with and without state locking.
export type Frame = { text: string; state: string[]; real: string[]; a: string; b: string; bad?: boolean };
export function frames(lock: boolean): Frame[] {
  const out: Frame[] = [];
  let state = ["vpc", "db"], real = ["vpc", "db"];
  const snap = (a: string, b: string, text: string, bad = false) => out.push({ text, state: [...state], real: [...real], a, b, bad });
  snap("idle", "idle", "The shared state file (in S3) records what Terraform created: a VPC and a database.");
  if (!lock) {
    snap("reads state v1", "reads state v1", "Ana and Ben both run terraform apply. Both read the same state.");
    real = [...real, "cache"]; snap("creates cache", "planning", "Ana's apply creates a Redis cache.");
    real = [...real, "queue"]; snap("creating", "creates queue", "Ben's apply creates a queue.");
    state = ["vpc", "db", "cache"]; snap("writes state", "applying", "Ana writes state: vpc, db, cache.");
    state = ["vpc", "db", "queue"]; snap("done", "writes state", "Ben writes his state on top: vpc, db, queue. Ana's cache is gone from state.", true);
    snap("done", "done", "The cache still exists and costs money, but Terraform no longer knows about it. The next plan may try to create it again.", true);
  } else {
    snap("acquires lock", "waiting", "Ana's apply takes the state lock (a DynamoDB item, or the backend's native lock).");
    snap("applying", "Error: state locked by Ana", "Ben's apply fails fast: “Error acquiring the state lock”.");
    real = [...real, "cache"]; state = ["vpc", "db", "cache"]; snap("releases lock", "retries", "Ana finishes, writes state and releases the lock.");
    snap("done", "reads state v2", "Ben retries and reads the new state, which includes the cache.");
    real = [...real, "queue"]; state = [...state, "queue"]; snap("done", "done", "Ben adds the queue. State matches reality: vpc, db, cache, queue.");
  }
  return out;
}
