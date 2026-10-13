// A lock with a lease, and why it isn't enough on its own. Client 1 takes the lock for 10 s,
// then freezes (a long garbage-collection pause). The lease runs out, client 2 takes the lock
// and writes. Client 1 wakes up still believing it holds the lock, and writes too.
// A fencing token (a number that goes up with every lock grant) lets storage reject the old one.

export type LockFrame = { t: number; who: "client 1" | "client 2" | "lock service" | "storage"; text: string; holder: string; storage: string; rejected?: boolean };

export function runLock(fencing: boolean): LockFrame[] {
  const f: LockFrame[] = [];
  let storage = "empty";
  let maxToken = 0;
  f.push({ t: 0, who: "client 1", text: `Takes the lock for 10 s${fencing ? ", gets token 33" : ""}.`, holder: "client 1", storage });
  f.push({ t: 1, who: "client 1", text: "Freezes: a 15-second garbage-collection pause.", holder: "client 1", storage });
  f.push({ t: 10, who: "lock service", text: "Lease expired. The lock is free.", holder: "nobody", storage });
  f.push({ t: 11, who: "client 2", text: `Takes the lock${fencing ? ", gets token 34" : ""}.`, holder: "client 2", storage });
  storage = "client 2's data";
  maxToken = 34;
  f.push({ t: 12, who: "client 2", text: `Writes to storage${fencing ? " with token 34" : ""}.`, holder: "client 2", storage });
  if (fencing) {
    f.push({ t: 16, who: "storage", text: `Client 1 wakes and writes with token 33. Storage has seen ${maxToken}, so it rejects 33.`, holder: "client 2", storage, rejected: true });
  } else {
    storage = "client 1's data (overwrote client 2)";
    f.push({ t: 16, who: "client 1", text: "Wakes up, still thinks it holds the lock, and writes. Two writers at once.", holder: "client 2", storage });
  }
  return f;
}
