// A support agent proposes actions as JSON for the backend to execute: refunds,
// account changes, SQL for a report, and emails. Six proposals, some wrong in ways a
// model really gets wrong. Four layers of checks run between the model and the
// action; which proposals each layer stops, and what reaches production, is computed.

export type Proposal = { id: string; label: string; json: string; problem: "none" | "schema" | "rule" | "scope" | "judgement"; harm: string };
export const PROPOSALS: Proposal[] = [
  { id: "ok", label: "A correct refund", json: '{ "action": "refund", "order": 7731, "amount": 24.00 }', problem: "none", harm: "" },
  { id: "badjson", label: "Malformed output", json: '{ "action": "refund", "order": "7731", "amount": "twenty-four" }', problem: "schema", harm: "the refund service crashes on a string amount, or worse, parses 0" },
  { id: "toomuch", label: "Refund more than was paid", json: '{ "action": "refund", "order": 7731, "amount": 240.00 }', problem: "rule", harm: "€216 paid out that the customer never spent" },
  { id: "sql", label: "SQL that writes", json: '{ "action": "report", "sql": "UPDATE users SET plan = \'pro\' WHERE id = 42" }', problem: "scope", harm: "a report query upgrades an account for free" },
  { id: "email", label: "Email to the wrong person", json: '{ "action": "email", "to": "all-customers@list", "body": "Your refund of €24…" }', problem: "scope", harm: "a private refund notice goes to the whole mailing list" },
  { id: "large", label: "A large but plausible refund", json: '{ "action": "refund", "order": 9120, "amount": 1850.00 }', problem: "judgement", harm: "correct by every rule, and still a €1,850 decision nobody looked at" },
];

export type Layer = "schema" | "rules" | "allowlist" | "approval";
export const LAYERS: { id: Layer; label: string; catches: Proposal["problem"]; what: string }[] = [
  { id: "schema", label: "Schema validation", catches: "schema", what: "Parse against a JSON Schema: types, required fields, enums. Reject and ask the model to fix it." },
  { id: "rules", label: "Business rules", catches: "rule", what: "Check against the source of truth: refund ≤ amount paid, order belongs to this customer, not already refunded." },
  { id: "allowlist", label: "Allowlists and scopes", catches: "scope", what: "Report SQL runs read-only on approved tables; emails only go to the customer on the ticket." },
  { id: "approval", label: "Human approval above a threshold", catches: "judgement", what: "Refunds over €500 wait for an agent to approve, with the reasoning and the order shown." },
];

export type Outcome = { stoppedBy: Layer | null; executed: boolean; harmful: boolean };
export function check(p: Proposal, on: Record<Layer, boolean>): Outcome {
  for (const l of LAYERS) if (on[l.id] && l.catches === p.problem) return { stoppedBy: l.id, executed: false, harmful: false };
  return { stoppedBy: null, executed: true, harmful: p.problem !== "none" };
}

export const NONE: Record<Layer, boolean> = { schema: false, rules: false, allowlist: false, approval: false };
export const ALL: Record<Layer, boolean> = { schema: true, rules: true, allowlist: true, approval: true };

// Approval load: how many actions a day reach a person at different thresholds.
export const REFUNDS_PER_DAY = 3000;
export const THRESHOLDS = [100, 500, 2000];
// share of refunds above each threshold
export const SHARE_ABOVE: Record<number, number> = { 100: 0.18, 500: 0.03, 2000: 0.004 };
