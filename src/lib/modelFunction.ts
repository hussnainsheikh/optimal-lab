// A model is a function with knobs. This one is a tiny spam filter:
// three numbers describe an email, four parameters weigh them, and a squash
// turns the weighted sum into a probability. Training only means finding good
// values for the parameters. A large language model has the same shape, with
// billions of parameters instead of four.

export type Email = {
  id: string;
  subject: string;
  links: number; // links in the body
  hype: number; // words like "free", "winner", "urgent"
  known: 0 | 1; // 1 if the sender is in your contacts
  spam: boolean; // the right answer (the label)
};

export const EMAILS: Email[] = [
  { id: "lunch", subject: "Lunch on Friday?", links: 0, hype: 0, known: 1, spam: false },
  { id: "winner", subject: "You are a WINNER, claim your FREE prize", links: 3, hype: 3, known: 0, spam: true },
  { id: "invoice", subject: "Invoice for October", links: 1, hype: 0, known: 1, spam: false },
  { id: "shipping", subject: "Free shipping ends tonight!!!", links: 4, hype: 1, known: 0, spam: true },
  { id: "trial", subject: "Your free trial is ending", links: 1, hype: 1, known: 1, spam: false },
  { id: "verify", subject: "Click to verify your account", links: 2, hype: 0, known: 0, spam: true },
  { id: "photos", subject: "Photos from the trip", links: 2, hype: 0, known: 1, spam: false },
  { id: "tickets", subject: "Free tickets, want them? (Sam)", links: 0, hype: 1, known: 1, spam: false },
];

export type Params = { links: number; hype: number; known: number; bias: number };

export const PRESETS: { id: string; label: string; params: Params }[] = [
  { id: "zero", label: "All zero", params: { links: 0, hype: 0, known: 0, bias: 0 } },
  { id: "guess", label: "A first guess", params: { links: 1, hype: 1, known: 0, bias: -1 } },
  { id: "trained", label: "Found by training", params: { links: 0.9, hype: 1.2, known: -2.5, bias: -0.8 } },
];

export const FEATURES = [
  { key: "links", label: "Links" },
  { key: "hype", label: "Hype words" },
  { key: "known", label: "Known sender" },
] as const;

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

// Step 2: the weighted sum. Each feature times its weight, plus the bias.
export function score(e: Email, p: Params) {
  const parts = [e.links * p.links, e.hype * p.hype, e.known * p.known];
  return { parts, z: parts[0] + parts[1] + parts[2] + p.bias };
}

export function predict(e: Email, p: Params) {
  const { parts, z } = score(e, p);
  const prob = sigmoid(z);
  const saysSpam = prob >= 0.5;
  // log loss: how surprised the model is by the right answer
  const pRight = e.spam ? prob : 1 - prob;
  const loss = -Math.log(Math.max(pRight, 1e-9));
  return { parts, z, prob, saysSpam, right: saysSpam === e.spam, loss };
}

export function evaluate(p: Params) {
  const rows = EMAILS.map((e) => ({ email: e, ...predict(e, p) }));
  const correct = rows.filter((r) => r.right).length;
  const loss = rows.reduce((s, r) => s + r.loss, 0) / rows.length;
  return { rows, correct, loss };
}

// Same shape, larger scale. Parameter counts are public, rounded figures.
export const SCALE = [
  { name: "This spam filter", params: 4 },
  { name: "GPT-2 small (2019)", params: 124e6 },
  { name: "A 7B open model", params: 7e9 },
  { name: "A 70B open model", params: 70e9 },
];

export function fmtParams(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(0)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} million`;
  return String(n);
}
