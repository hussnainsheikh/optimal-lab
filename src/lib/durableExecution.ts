// An agent workflow for an insurance claim: read documents, extract fields with an
// LLM, charge an excess payment, request a repair, write a summary, email the
// customer. The worker crashes in the middle. What happens on restart depends on
// what was recorded: nothing, a checkpoint after each step, or a durable event
// history with idempotency keys. Steps rerun, money charged twice and tokens spent
// again are computed per design.

export type Step = { id: string; label: string; kind: "llm" | "read" | "payment" | "external" | "email"; tokens: number; seconds: number };
export const STEPS: Step[] = [
  { id: "read", label: "Read claim documents", kind: "read", tokens: 0, seconds: 3 },
  { id: "extract", label: "Extract fields with the LLM", kind: "llm", tokens: 40_000, seconds: 20 },
  { id: "charge", label: "Charge the €150 excess", kind: "payment", tokens: 0, seconds: 2 },
  { id: "repair", label: "Book the repair shop", kind: "external", tokens: 0, seconds: 5 },
  { id: "summary", label: "Write the claim summary", kind: "llm", tokens: 25_000, seconds: 15 },
  { id: "email", label: "Email the customer", kind: "email", tokens: 0, seconds: 1 },
];

export type Design = "none" | "checkpoint" | "durable";
export const DESIGNS: { id: Design; label: string; one: string }[] = [
  { id: "none", label: "Nothing recorded", one: "The workflow is one function call; a crash loses everything and the job starts over." },
  { id: "checkpoint", label: "Checkpoint after each step", one: "Save “step N done” to the database after each step; on restart, skip what's done." },
  { id: "durable", label: "Durable execution", one: "An engine records each step's result in an event history before moving on, and every side effect carries an idempotency key." },
];

export type CrashPoint = "afterExtract" | "duringCharge" | "afterRepair";
export const CRASHES: { id: CrashPoint; label: string; index: number; between: boolean }[] = [
  { id: "afterExtract", label: "After the LLM extraction", index: 1, between: false },
  { id: "duringCharge", label: "After charging, before recording it", index: 2, between: true },
  { id: "afterRepair", label: "After booking the repair", index: 3, between: false },
];

export const TOKEN_PRICE = 3 / 1e6;

export type Outcome = { reran: string[]; doubleCharged: boolean; doubleBooked: boolean; wastedTokens: number; wastedSeconds: number; note: string };

export function recover(d: Design, c: CrashPoint): Outcome {
  const crash = CRASHES.find((x) => x.id === c)!;
  // steps whose effect happened before the crash
  const happened = STEPS.slice(0, crash.index + 1);
  // steps the system knows are done
  const recorded = d === "none" ? [] : crash.between ? happened.slice(0, -1) : happened;
  const reran = happened.filter((s) => !recorded.includes(s));
  const isPayment = (s: Step) => s.kind === "payment";
  const isExternal = (s: Step) => s.kind === "external";
  // durable execution: even an unrecorded payment is retried with the same idempotency key, so the provider dedupes it
  const doubleCharged = d !== "durable" && reran.some(isPayment);
  const doubleBooked = d !== "durable" && reran.some(isExternal);
  const wastedTokens = reran.reduce((s, x) => s + x.tokens, 0);
  const wastedSeconds = reran.reduce((s, x) => s + x.seconds, 0);
  const note =
    d === "none"
      ? `Everything before the crash runs again: ${reran.map((s) => s.label.toLowerCase()).join(", ")}.${doubleCharged ? " The customer is charged twice." : ""}`
      : d === "checkpoint"
        ? crash.between
          ? "The charge went through but the checkpoint wasn't written; on restart the charge runs again. Checkpoints can't close the gap between doing and recording."
          : "Done steps are skipped; the workflow resumes at the next one."
        : crash.between
          ? "The charge is retried with the same idempotency key; the payment provider returns the first result instead of charging again."
          : "The engine replays the recorded history to rebuild the workflow's state, without calling anything again, and continues.";
  return { reran: reran.map((s) => s.label), doubleCharged, doubleBooked, wastedTokens, wastedSeconds, note };
}
