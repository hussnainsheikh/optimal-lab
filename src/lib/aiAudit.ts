// An AI system decides on loan pre-approvals. Three months later a customer
// complains and a regulator asks questions. What can be answered depends on what was
// recorded for each decision, and how long it was kept; what it costs in storage and
// in personal data held is computed for each design.

export type Field = "input" | "retrieved" | "promptVersion" | "modelVersion" | "output" | "toolCalls" | "reviewer" | "rawPrompt";
export const FIELDS: { id: Field; label: string; bytes: number; personal: boolean }[] = [
  { id: "input", label: "Application data (redacted)", bytes: 2000, personal: true },
  { id: "retrieved", label: "IDs of policy documents retrieved", bytes: 200, personal: false },
  { id: "promptVersion", label: "Prompt template version", bytes: 40, personal: false },
  { id: "modelVersion", label: "Model name and version", bytes: 40, personal: false },
  { id: "output", label: "Decision and stated reasons", bytes: 800, personal: true },
  { id: "toolCalls", label: "Tool calls and results (credit check)", bytes: 1500, personal: true },
  { id: "reviewer", label: "Human reviewer and their decision", bytes: 100, personal: false },
  { id: "rawPrompt", label: "Full raw prompt and completion", bytes: 30000, personal: true },
];

export type Design = "none" | "rawLogs" | "records" | "recordsRetained";
export const DESIGNS: { id: Design; label: string; one: string; fields: Field[]; days: number }[] = [
  { id: "none", label: "Application logs only", one: "Request IDs, status codes and latency; nothing about the decision.", fields: [], days: 30 },
  { id: "rawLogs", label: "Raw prompt logs, 30 days", one: "Every full prompt and completion, kept 30 days for debugging.", fields: ["rawPrompt"], days: 30 },
  { id: "records", label: "Decision records, 30 days", one: "A structured record per decision: inputs, versions, retrieved IDs, output, tools, reviewer.", fields: ["input", "retrieved", "promptVersion", "modelVersion", "output", "toolCalls", "reviewer"], days: 30 },
  { id: "recordsRetained", label: "Decision records, 2 years", one: "The same records kept for the period regulation requires, with application data redacted and access logged.", fields: ["input", "retrieved", "promptVersion", "modelVersion", "output", "toolCalls", "reviewer"], days: 730 },
];

export const QUESTIONS: { text: string; needs: Field[] }[] = [
  { text: "What did the system decide for this customer, and why?", needs: ["output"] },
  { text: "Which model and prompt version made the decision?", needs: ["modelVersion", "promptVersion"] },
  { text: "Which policy documents was it working from?", needs: ["retrieved"] },
  { text: "Did a person review it, and who?", needs: ["reviewer"] },
  { text: "What did the credit check return?", needs: ["toolCalls"] },
];

export const DECISIONS_PER_DAY = 5000;

export const ASKED_AFTER = [20, 90];

export function answerable(d: Design, qi: number, after = 90): boolean {
  const des = DESIGNS.find((x) => x.id === d)!;
  const q = QUESTIONS[qi];
  if (after > des.days) return false;
  // raw prompts contain everything except versions and reviewer (not in the prompt)
  if (des.fields.includes("rawPrompt")) return q.needs.every((f) => ["output", "retrieved", "toolCalls"].includes(f));
  return q.needs.every((f) => des.fields.includes(f));
}

export function cost(d: Design): { gb: number; personalRecords: number; perRecordKB: number } {
  const des = DESIGNS.find((x) => x.id === d)!;
  const bytes = des.fields.reduce((s, f) => s + FIELDS.find((x) => x.id === f)!.bytes, 0);
  const records = DECISIONS_PER_DAY * des.days;
  const personal = des.fields.some((f) => FIELDS.find((x) => x.id === f)!.personal);
  return { gb: (records * bytes) / 1e9, personalRecords: personal ? records : 0, perRecordKB: bytes / 1000 };
}

export const score = (d: Design, after = 90) => QUESTIONS.filter((_, i) => answerable(d, i, after)).length;
