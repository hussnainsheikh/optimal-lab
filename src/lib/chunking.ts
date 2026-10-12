// Chunking for retrieval. A document is split into chunks; a question retrieves the best-scoring
// chunk; the answer only works if that chunk holds the whole answer. Scoring here counts shared
// words, standing in for embedding similarity so every number can be checked by hand.

export const DOC = `# Acme Store help

## Refunds
You can ask for a refund within 30 days of delivery. Refunds go back to the original payment method. Once approved, a refund takes 5 to 7 business days to show up on your statement. Gift cards are refunded as store credit.

## Shipping
Standard shipping takes 3 to 5 business days. Express shipping arrives the next business day if you order before 2 pm. We ship to the US, Canada and the UK.

## Damaged items
If an item arrives damaged, send us a photo within 48 hours. We will send a replacement at no cost, and you do not need to return the damaged item.

## Account
You can change your email address in Settings. To delete your account, contact support. Deletion is permanent after 14 days.`;

export type Question = { id: string; text: string; answer: string };

export const QUESTIONS: Question[] = [
  { id: "refund-time", text: "How long does a refund take to show up?", answer: "a refund takes 5 to 7 business days to show up on your statement" },
  { id: "damaged", text: "What do I do if my item arrives damaged?", answer: "send us a photo within 48 hours. We will send a replacement at no cost" },
  { id: "canada", text: "Do you ship to Canada?", answer: "We ship to the US, Canada and the UK." },
];

export type Strategy = "fixed" | "overlap" | "heading";

export const STRATEGIES: { id: Strategy; label: string; note: string }[] = [
  { id: "fixed", label: "Fixed size", note: "Cut every N characters, wherever that lands." },
  { id: "overlap", label: "Fixed size + overlap", note: "Same size, but each chunk repeats the end of the previous one." },
  { id: "heading", label: "By heading", note: "One chunk per section, so each chunk is one topic." },
];

export const SIZES = [120, 200, 320];

export type Chunk = { i: number; start: number; end: number; text: string };

export function chunk(strategy: Strategy, size: number, doc = DOC): Chunk[] {
  const spans: [number, number][] = [];
  if (strategy === "heading") {
    const starts = [...doc.matchAll(/^## /gm)].map((m) => m.index!);
    const first = starts[0] ?? doc.length;
    if (first > 0) spans.push([0, first]);
    starts.forEach((s, k) => spans.push([s, k + 1 < starts.length ? starts[k + 1] : doc.length]));
  } else {
    const step = strategy === "overlap" ? Math.round(size * 0.5) : size;
    for (let s = 0; s < doc.length; s += step) {
      spans.push([s, Math.min(doc.length, s + size)]);
      if (s + size >= doc.length) break;
    }
  }
  return spans.map(([start, end], i) => ({ i, start, end, text: doc.slice(start, end) }));
}

const STOP = new Set(["the", "and", "you", "your", "for", "how", "long", "does", "what", "do", "if", "my", "to", "a", "an", "of", "in", "on", "is", "are", "we", "us", "it", "i", "up"]);

export const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "");

export type Match = { words: number; hits: number; value: number };

// How many of the question's words the chunk contains, then how often they appear.
export function score(question: string, text: string): Match {
  const q = new Set(words(question).map(stem));
  const t = words(text).map(stem);
  const found = t.filter((w) => q.has(w));
  const unique = new Set(found).size;
  return { words: unique, hits: found.length, value: unique * 100 + found.length };
}

export const TOP_K = 1;

export type Retrieval = {
  scores: Match[]; // one per chunk
  top: number[]; // indexes of the retrieved chunks, best first
  answerStart: number;
  answerEnd: number;
  verdict: "whole" | "partial" | "missing";
  extraChars: number; // retrieved text that isn't the answer: what the model has to read past
};

// Retrieve the TOP_K best chunks (ties go to the earlier chunk). The answer works if a
// retrieved chunk holds all of it; "partial" means it was cut across a chunk boundary.
export function retrieve(chunks: Chunk[], q: Question, doc = DOC, k = TOP_K): Retrieval {
  const scores = chunks.map((c) => score(q.text, c.text));
  const top = chunks
    .map((c) => c.i)
    .sort((a, b) => scores[b].value - scores[a].value || a - b)
    .slice(0, k)
    .filter((i) => scores[i].value > 0);
  const answerStart = doc.indexOf(q.answer);
  const answerEnd = answerStart + q.answer.length;
  const covered = top.map((i) => Math.max(0, Math.min(chunks[i].end, answerEnd) - Math.max(chunks[i].start, answerStart)));
  const verdict = covered.some((c) => c === q.answer.length) ? "whole" : covered.some((c) => c > 0) ? "partial" : "missing";
  const retrievedChars = top.reduce((s, i) => s + chunks[i].text.length, 0);
  return { scores, top, answerStart, answerEnd, verdict, extraChars: Math.max(0, retrievedChars - q.answer.length) };
}
