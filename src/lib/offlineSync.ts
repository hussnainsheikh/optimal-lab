// A to-do app on a phone and a laptop. The phone goes offline on the train and
// edits a task; meanwhile the laptop edits the same task online. When the phone
// reconnects, the server has two versions of one record. Each conflict strategy is
// applied to the real edits below, and the edits it throws away are counted.

export type Task = { title: string; done: boolean; due: string };
export type Field = keyof Task;
export type Edit = { device: "phone" | "laptop"; at: number; field: Field; value: Task[Field] }; // `at`: true minutes since 09:00

export const BASE: Task = { title: "Buy milk", done: false, due: "Fri" };
export const BASE_VERSION = 7;

export const EDITS: Edit[] = [
  { device: "phone", at: 5, field: "title", value: "Buy oat milk" },
  { device: "laptop", at: 8, field: "due", value: "Thu" },
  { device: "laptop", at: 12, field: "title", value: "Buy milk and eggs" },
  { device: "phone", at: 20, field: "done", value: true },
];
export const OFFLINE_FROM = 2;
export const RECONNECT_AT = 30;

export type Strategy = "recordLww" | "serverWins" | "fieldLww" | "keepBoth";
export const STRATEGIES: { id: Strategy; label: string; one: string }[] = [
  { id: "recordLww", label: "Last write wins (record)", one: "Whichever device saved last, by its own clock, replaces the whole record." },
  { id: "serverWins", label: "Server wins", one: "The version already on the server stays; the phone's offline changes are rejected." },
  { id: "fieldLww", label: "Merge by field", one: "Each field takes the latest change to that field; only edits to the same field compete." },
  { id: "keepBoth", label: "Keep both, ask", one: "When the same field changed on both sides, keep both values and ask the user." },
];

export type Result = {
  final: Task;
  lost: Edit[];
  conflictFields: Field[];
  needsUser: boolean;
  pending: number; // changes queued on the phone while offline
  note: string;
};

const apply = (base: Task, edits: Edit[]): Task => {
  const t = { ...base } as Record<Field, Task[Field]>;
  for (const e of [...edits].sort((a, b) => a.at - b.at)) t[e.field] = e.value;
  return t as Task;
};

export function sync(s: Strategy, phoneClockSkewMin: number): Result {
  const phone = EDITS.filter((e) => e.device === "phone");
  const laptop = EDITS.filter((e) => e.device === "laptop");
  const stamped = (e: Edit) => e.at + (e.device === "phone" ? phoneClockSkewMin : 0); // what each device writes as its timestamp
  const phoneFields = new Set(phone.map((e) => e.field));
  const conflictFields = [...new Set(laptop.map((e) => e.field))].filter((f) => phoneFields.has(f));
  const pending = phone.filter((e) => e.at >= OFFLINE_FROM).length;
  let final: Task;
  let lost: Edit[] = [];
  let needsUser = false;
  let note = "";

  if (s === "recordLww") {
    const phoneLast = Math.max(...phone.map(stamped));
    const laptopLast = Math.max(...laptop.map(stamped));
    const winner = phoneLast > laptopLast ? "phone" : "laptop";
    final = apply(BASE, winner === "phone" ? phone : laptop);
    lost = EDITS.filter((e) => e.device !== winner);
    note =
      phoneClockSkewMin < 0 && winner === "laptop" && Math.max(...phone.map((e) => e.at)) > Math.max(...laptop.map((e) => e.at))
        ? `The phone really saved last, but its clock is ${-phoneClockSkewMin} min slow, so its timestamp loses. Every change it made is thrown away.`
        : `The ${winner}'s record replaces the other wholesale, including fields nobody was arguing about.`;
  } else if (s === "serverWins") {
    final = apply(BASE, laptop);
    lost = phone;
    note = `The phone made ${phone.length} changes offline; all of them bounce. The user sees their edits disappear on reconnect.`;
  } else if (s === "fieldLww") {
    const latest = new Map<Field, Edit>();
    for (const e of EDITS) {
      const cur = latest.get(e.field);
      if (!cur || stamped(e) > stamped(cur)) latest.set(e.field, e);
    }
    final = { ...BASE };
    for (const [f, e] of latest) (final as Record<Field, Task[Field]>)[f] = e.value;
    lost = EDITS.filter((e) => latest.get(e.field) !== e);
    note = `Fields that only one device touched merge cleanly. ${conflictFields.length} field${conflictFields.length === 1 ? "" : "s"} changed on both: the later timestamp wins and the other edit is lost.`;
  } else {
    final = { ...BASE };
    const latest = new Map<Field, Edit>();
    for (const e of EDITS) {
      const cur = latest.get(e.field);
      if (!cur || e.at > cur.at) latest.set(e.field, e);
    }
    for (const [f, e] of latest) if (!conflictFields.includes(f)) (final as Record<Field, Task[Field]>)[f] = e.value;
    for (const f of conflictFields) (final as Record<Field, Task[Field]>)[f] = `${(laptop.filter((e) => e.field === f).pop()!.value)} | ${(phone.filter((e) => e.field === f).pop()!.value)}` as never;
    needsUser = conflictFields.length > 0;
    note = "Nothing is lost: the clean fields merge, and the field both devices changed is shown with both values until the user picks one.";
  }
  return { final, lost, conflictFields, needsUser, pending, note };
}

// The sync protocol's numbers: what goes over the wire on reconnect.
export const FULL_RECORDS = 2400; // tasks in the account
export const RECORD_BYTES = 180;
export const syncBytes = (delta: boolean, pending: number) => (delta ? pending * 90 + 400 : FULL_RECORDS * RECORD_BYTES);
