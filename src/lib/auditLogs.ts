// An audit log of who did what, and an insider who wants to hide one entry. Each
// entry can carry the hash of the one before it (a hash chain), and the latest hash
// can be copied somewhere the insider can't reach (an anchor). Verification is
// computed: the chain is re-hashed and compared, entry by entry.
// The hash is 32-bit FNV-1a so the numbers fit on screen; real systems use SHA-256.

export type Entry = { seq: number; at: string; actor: string; action: string; prev: string; hash: string };

export const ACTIONS: { at: string; actor: string; action: string }[] = [
  { at: "09:02", actor: "ana", action: "signed in" },
  { at: "09:05", actor: "ana", action: "viewed patient 1182" },
  { at: "09:40", actor: "raj", action: "changed role of kim to admin" },
  { at: "10:12", actor: "kim", action: "exported 4,000 patient records" },
  { at: "10:13", actor: "kim", action: "changed role of kim to staff" },
  { at: "11:30", actor: "ana", action: "updated patient 1182" },
  { at: "12:01", actor: "lee", action: "signed in" },
  { at: "12:04", actor: "lee", action: "viewed invoice 77" },
];

export function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const content = (e: { seq: number; at: string; actor: string; action: string }, prev: string) => `${e.seq}|${e.at}|${e.actor}|${e.action}|${prev}`;

export function buildLog(): Entry[] {
  let prev = "00000000";
  return ACTIONS.map((a, i) => {
    const seq = i + 1;
    const hash = fnv(content({ seq, ...a }, prev));
    const e = { seq, ...a, prev, hash };
    prev = hash;
    return e;
  });
}

export type Store = "table" | "appendOnly" | "chain" | "anchored";
export const STORES: { id: Store; label: string; one: string }[] = [
  { id: "table", label: "A normal table", one: "Rows in the app's own database. Whoever can UPDATE or DELETE there can change history." },
  { id: "appendOnly", label: "Append-only permissions", one: "The app's database user can INSERT but not UPDATE or DELETE. A database admin still can." },
  { id: "chain", label: "Hash chain", one: "Every entry stores the hash of the previous one, so changing any entry breaks every link after it." },
  { id: "anchored", label: "Chain + external anchor", one: "The latest hash is copied every few minutes to storage the insider can't write: another account, write-once (WORM) storage." },
];

export type Tamper = "edit" | "delete" | "rewrite";
export const TAMPERS: { id: Tamper; label: string; one: string }[] = [
  { id: "edit", label: "Edit entry 4", one: "Change “exported 4,000 patient records” to “viewed patient 1182”." },
  { id: "delete", label: "Delete entries 3–5", one: "Remove the role change, the export and the change back." },
  { id: "rewrite", label: "Edit and re-hash everything after", one: "Edit entry 4, then recompute every hash after it so the chain looks whole." },
];

export type Verify = { log: Entry[]; tamperedAt: number | null; detectedAt: number | null; detected: boolean; how: string; succeeded: boolean };

export function attack(store: Store, t: Tamper, insiderIsDba: boolean): Verify {
  const original = buildLog();
  // Can the insider change the stored rows at all?
  const canWrite = store === "table" || insiderIsDba;
  if (!canWrite) return { log: original, tamperedAt: null, detectedAt: null, detected: false, how: "The insider's database user can only INSERT. The UPDATE is refused, and the refusal itself is logged.", succeeded: false };

  let log = original.map((e) => ({ ...e }));
  let tamperedAt: number | null = null;
  if (t === "edit" || t === "rewrite") {
    log[3].action = "viewed patient 1182";
    tamperedAt = 4;
    if (t === "rewrite") {
      let prev = log[2].hash;
      for (let i = 3; i < log.length; i++) {
        log[i].prev = prev;
        log[i].hash = fnv(content(log[i], prev));
        prev = log[i].hash;
      }
    }
  } else {
    log = log.filter((e) => e.seq < 3 || e.seq > 5);
    tamperedAt = 3;
  }

  if (store === "table" || store === "appendOnly") return { log, tamperedAt, detectedAt: null, detected: false, how: "Nothing records what the rows used to be. The log now says what the insider wants.", succeeded: true };

  // Verify the chain: recompute each hash from its content and the previous entry's hash.
  let detectedAt: number | null = null;
  let prev = "00000000";
  for (const e of log) {
    if (e.prev !== prev || fnv(content(e, prev)) !== e.hash) {
      detectedAt = e.seq;
      break;
    }
    prev = e.hash;
  }
  if (detectedAt === null && store === "anchored") {
    const anchor = original[original.length - 1].hash;
    if (log[log.length - 1].hash !== anchor) detectedAt = log[log.length - 1].seq;
    return {
      log,
      tamperedAt,
      detectedAt,
      detected: detectedAt !== null,
      how: detectedAt !== null ? `The chain is internally consistent, but its last hash (${log[log.length - 1].hash}) doesn't match the anchor copied out at 12:05 (${anchor}).` : "No change detected.",
      succeeded: detectedAt === null,
    };
  }
  return {
    log,
    tamperedAt,
    detectedAt,
    detected: detectedAt !== null,
    how: detectedAt !== null ? `Re-hashing entry ${detectedAt} doesn't give the hash stored after it: the chain breaks there.` : "Every hash was recomputed, so the chain checks out. Without a copy of the last hash somewhere else, the rewrite is invisible.",
    succeeded: detectedAt === null,
  };
}
