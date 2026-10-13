// A consumer processes 5 payment messages and crashes once, after doing the work for #3 but before committing.
export type Mode = "at-most-once" | "at-least-once" | "idempotent";
export const MODES: { id: Mode; label: string }[] = [
  { id: "at-most-once", label: "Commit, then process" },
  { id: "at-least-once", label: "Process, then commit" },
  { id: "idempotent", label: "Process, commit + dedupe by id" },
];
export const MESSAGES = [1, 2, 3, 4, 5].map((n) => ({ id: `pay-${n}`, amount: n * 10 }));
export type Ev = { text: string; kind: "ok" | "crash" | "dup" | "skip" | "lost" | "info" };

export function run(mode: Mode) {
  const events: Ev[] = [];
  const applied: string[] = [];
  const seen = new Set<string>();
  let offset = 0;
  let crashed = false;
  const process = (id: string) => {
    if (mode === "idempotent" && seen.has(id)) { events.push({ text: `${id}: already processed, skip`, kind: "skip" }); return; }
    seen.add(id); applied.push(id);
    events.push({ text: `${id}: charge ${MESSAGES.find((m) => m.id === id)!.amount}`, kind: applied.filter((x) => x === id).length > 1 ? "dup" : "ok" });
  };
  while (offset < MESSAGES.length) {
    const m = MESSAGES[offset];
    const crashHere = m.id === "pay-3" && !crashed;
    if (mode === "at-most-once") {
      offset++; events.push({ text: `commit offset ${offset}`, kind: "info" });
      if (crashHere) { crashed = true; events.push({ text: "crash before charging pay-3", kind: "crash" }, { text: "restart from the committed offset", kind: "info" }, { text: "pay-3 is never charged", kind: "lost" }); continue; }
      process(m.id);
    } else {
      process(m.id);
      if (crashHere) { crashed = true; events.push({ text: "crash before committing", kind: "crash" }, { text: `restart from offset ${offset}: pay-3 is delivered again`, kind: "info" }); continue; }
      offset++; events.push({ text: `commit offset ${offset}`, kind: "info" });
    }
  }
  const total = applied.reduce((a, id) => a + MESSAGES.find((m) => m.id === id)!.amount, 0);
  return { events, applied, total, expected: MESSAGES.reduce((a, m) => a + m.amount, 0) };
}
