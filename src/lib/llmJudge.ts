// LLM-as-judge, with its biases made explicit. A judge model sees a question and two answers
// and picks the better one. Here each pick is computed from three pushes, so you can see why:
//   real quality difference + position bias (favours whichever answer is shown first)
//   + length bias (favours the longer answer, even when the extra words add nothing)
// People's picks are the ground truth the judge should match.

export type Pair = {
  id: string;
  question: string;
  a: { text: string; words: number };
  b: { text: string; words: number };
  quality: number; // A minus B, as people rated it: positive means A is better
};

export const PAIRS: Pair[] = [
  { id: "p1", question: "How do I reset my password?", a: { text: "Settings → Security → Reset password. You'll get an email link.", words: 11 }, b: { text: "Passwords are important. There are many ways to manage them, and security matters a lot. You may find a reset option somewhere in your account, possibly under settings or security, depending on the version.", words: 36 }, quality: 1.5 },
  { id: "p2", question: "Is the refund window 14 or 30 days?", a: { text: "Our refund policy is designed to be fair. In most cases you have 14 days to request a refund, after which requests are reviewed case by case by our support team.", words: 31 }, b: { text: "30 days from delivery.", words: 4 }, quality: -2 },
  { id: "p3", question: "Summarize the outage report.", a: { text: "A config push broke DNS for 40 minutes. Rolled back at 10:42. Adding a canary step.", words: 16 }, b: { text: "There was an outage.", words: 4 }, quality: 2 },
  { id: "p4", question: "Can I use the API on the free plan?", a: { text: "Yes, up to 100 requests a day.", words: 7 }, b: { text: "Yes. The free plan includes API access, limited to 100 requests per day; paid plans raise the limit.", words: 18 }, quality: -0.9 },
  { id: "p5", question: "What does error 429 mean?", a: { text: "Error 429 is an HTTP status code. HTTP status codes are grouped into classes. The 4xx class covers client errors, which can have many causes, so you should check your request carefully.", words: 33 }, b: { text: "Too many requests: you hit the rate limit. Wait and retry with backoff.", words: 13 }, quality: -2.5 },
  { id: "p6", question: "Translate 'thank you' to Spanish.", a: { text: "Gracias.", words: 1 }, b: { text: "Muchas gracias.", words: 2 }, quality: 0.3 },
  { id: "p7", question: "Which plan has SSO?", a: { text: "Enterprise only.", words: 2 }, b: { text: "Single sign-on (SSO) lets users log in with one identity provider. It is available on the Enterprise plan, which also includes audit logs and priority support.", words: 28 }, quality: 1 },
  { id: "p8", question: "Why is my build failing?", a: { text: "Builds fail for many reasons, including dependency issues, configuration errors, flaky tests, network problems and resource limits. Review your logs to find the cause.", words: 25 }, b: { text: "The log shows a missing env var: DATABASE_URL. Add it to CI secrets.", words: 13 }, quality: -2 },
];

export type Setup = "naive" | "swap" | "rubric";

export const SETUPS: { id: Setup; label: string; note: string }[] = [
  { id: "naive", label: "One pass", note: "Show A first, ask which is better." },
  { id: "swap", label: "Both orders", note: "Ask twice with A and B swapped; only count a win if both orders agree." },
  { id: "rubric", label: "Both orders + rubric", note: "Also tell the judge to ignore length and grade against a checklist." },
];

const POSITION = 0.8; // push toward whichever answer is shown first
const LENGTH = 0.06; // push per extra word
const LENGTH_WITH_RUBRIC = 0.005;

export type Verdict = "A" | "B" | "tie";

export type Judged = {
  pair: Pair;
  human: Verdict;
  judge: Verdict;
  agrees: boolean;
  pushes: { quality: number; position: number; length: number }; // for the A-first pass
  passes: { order: "AB" | "BA"; total: number; pick: "A" | "B" }[];
};

function pass(p: Pair, order: "AB" | "BA", lengthWeight: number) {
  const position = order === "AB" ? POSITION : -POSITION; // positive favours A
  const length = (p.a.words - p.b.words) * lengthWeight;
  const total = p.quality + position + length;
  return { order, total, pick: (total >= 0 ? "A" : "B") as "A" | "B", position, length };
}

export function judge(p: Pair, setup: Setup): Judged {
  const lw = setup === "rubric" ? LENGTH_WITH_RUBRIC : LENGTH;
  const first = pass(p, "AB", lw);
  const passes = setup === "naive" ? [first] : [first, pass(p, "BA", lw)];
  const picks = passes.map((x) => x.pick);
  const judgeV: Verdict = picks.every((x) => x === "A") ? "A" : picks.every((x) => x === "B") ? "B" : "tie";
  const human: Verdict = p.quality > 0 ? "A" : "B";
  return {
    pair: p,
    human,
    judge: judgeV,
    agrees: judgeV === human,
    pushes: { quality: p.quality, position: first.position, length: first.length },
    passes: passes.map(({ order, total, pick }) => ({ order, total, pick })),
  };
}

export function tally(setup: Setup) {
  const all = PAIRS.map((p) => judge(p, setup));
  return {
    agree: all.filter((j) => j.agrees).length,
    wrong: all.filter((j) => j.judge !== "tie" && !j.agrees).length,
    ties: all.filter((j) => j.judge === "tie").length,
  };
}

// One-pass picks that would flip if B were shown first: they came from position, not quality.
export const flipsWhenSwapped = () =>
  PAIRS.filter((p) => pass(p, "AB", LENGTH).pick !== pass(p, "BA", LENGTH).pick).length;
