// A notes app that works offline: where it stores notes, how it queues changes, how it syncs,
// what it does when the same note was edited on two devices, and whether the browser may
// delete its data. The merge is a real line-by-line three-way merge (for edits that replace
// lines); last-write-wins compares the devices' own clocks, so a skewed clock really loses
// the newer edit. Sizes and timings are illustrative.

export type Storage = "localStorage" | "indexedDB";
export const NOTE_KB = 3.2; // average note as JSON, with formatting
export const LOCAL_STORAGE_KB = 5 * 1024; // about 5 MB per origin, and UTF-16 doubles it
export function storageCheck(store: Storage, notes: number) {
  if (store === "indexedDB") return { ok: true, usedKb: notes * NOTE_KB, note: "async, structured, and allowed a share of the disk (often gigabytes)" };
  const usedKb = notes * NOTE_KB * 2; // JavaScript strings are stored as UTF-16
  return { ok: usedKb <= LOCAL_STORAGE_KB, usedKb, note: usedKb <= LOCAL_STORAGE_KB ? "fits, but every read and write blocks the main thread" : "QuotaExceededError: localStorage is about 5 MB, and strings take 2 bytes a character" };
}

export type Op = { id: string; kind: "create" | "edit" | "delete"; note: string; at: string };
export const OFFLINE_OPS: Op[] = [
  { id: "op1", kind: "create", note: "Packing list", at: "09:02" },
  { id: "op2", kind: "edit", note: "Trip plan", at: "09:05" },
  { id: "op3", kind: "delete", note: "Old draft", at: "09:07" },
  { id: "op4", kind: "edit", note: "Packing list", at: "09:09" },
];

/** Replay the outbox; the first create times out after the server saved it, and is retried. */
export function sync(idempotent: boolean, inOrder: boolean) {
  const order = inOrder ? OFFLINE_OPS : [OFFLINE_OPS[3], OFFLINE_OPS[0], OFFLINE_OPS[1], OFFLINE_OPS[2]];
  const log: { op: Op; result: string; bad: boolean }[] = [];
  const created = new Set<string>();
  let packingLists = 0;
  for (const op of order) {
    if (op.kind === "create") {
      packingLists++;
      created.add(op.note);
      log.push({ op, result: "saved, but the response was lost: retrying", bad: false });
      if (idempotent) log.push({ op, result: "retry: same Idempotency-Key, server returns the first result", bad: false });
      else {
        packingLists++;
        log.push({ op, result: "retry: created a second Packing list", bad: true });
      }
      continue;
    }
    if (op.kind === "edit" && op.note === "Packing list" && !created.has(op.note)) {
      log.push({ op, result: "404: the note doesn't exist yet (its create hasn't been sent)", bad: true });
      continue;
    }
    log.push({ op, result: "applied", bad: false });
  }
  return { log, packingLists, problems: log.filter((l) => l.bad).length };
}

// ---- conflicts --------------------------------------------------------------------------

export const BASE = ["Trip plan", "Fly out Friday 18:40", "Hotel: Harbour Inn", "Dinner: book a table", "Pack: charger, passport"];
export function phoneEdit() {
  return ["Trip plan", "Fly out Friday 07:15", BASE[2], "Dinner: Saturday at Nopa", BASE[4]];
}
export function laptopEdit(touchesDinner: boolean) {
  return ["Trip plan", BASE[1], BASE[2], touchesDinner ? "Dinner: Saturday at Zuni" : BASE[3], "Pack: charger, passport, adapter"];
}

export type Strategy = "lww" | "merge";
export const PHONE_SAVED = "10:12"; // real time of the phone's edit (later)
export const LAPTOP_SAVED = "10:10";
export const PHONE_CLOCK_SKEW_MIN = -4; // the phone's clock runs four minutes slow

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function resolve(strategy: Strategy, touchesDinner: boolean) {
  const phone = phoneEdit();
  const laptop = laptopEdit(touchesDinner);
  if (strategy === "lww") {
    const phoneStamp = toMin(PHONE_SAVED) + PHONE_CLOCK_SKEW_MIN;
    const laptopStamp = toMin(LAPTOP_SAVED);
    const phoneWins = phoneStamp > laptopStamp;
    const lost = phoneWins ? laptop.filter((l, i) => l !== BASE[i]).length : phone.filter((l, i) => l !== BASE[i]).length;
    return { lines: (phoneWins ? phone : laptop).map((text) => ({ text, from: phoneWins ? "phone" : "laptop", conflict: false })), lostEdits: lost, conflicts: 0, note: `phone stamped ${fmt(phoneStamp)} (really ${PHONE_SAVED}), laptop ${LAPTOP_SAVED}: the ${phoneWins ? "phone" : "laptop"}'s whole note wins` };
  }
  // Three-way merge, line by line: take whichever side changed a line; both changed it = conflict.
  const lines = BASE.map((base, i) => {
    const a = phone[i];
    const b = laptop[i];
    if (a === b) return { text: a, from: "both", conflict: false };
    if (a === base) return { text: b, from: "laptop", conflict: false };
    if (b === base) return { text: a, from: "phone", conflict: false };
    return { text: `${a}  ⟷  ${b}`, from: "conflict", conflict: true };
  });
  const conflicts = lines.filter((l) => l.conflict).length;
  return { lines, lostEdits: 0, conflicts, note: conflicts ? `${conflicts} line changed on both devices: ask the person` : "every edit kept: the devices changed different lines" };
}

export function eviction(persisted: boolean, installed: boolean) {
  if (persisted) return { safe: true, note: "navigator.storage.persist() granted: the browser won't clear it under storage pressure" };
  if (installed) return { safe: true, note: "installed to the home screen, so Safari's 7-day limit doesn't apply; still best-effort under storage pressure" };
  return { safe: false, note: "best-effort storage: cleared under storage pressure, and Safari deletes script-written data after 7 days without a visit" };
}
