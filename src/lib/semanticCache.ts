// A support bot gets a stream of questions. An exact-match cache only helps when the
// words are identical; a semantic cache embeds each question and reuses an earlier
// answer when the new one is close enough. Similarity here is the cosine between
// bag-of-words vectors after lowercasing, removing stop words and mapping a few
// synonyms: a small, real stand-in for an embedding model. Each question carries the
// intent it really has, so a reused answer can be checked for being wrong.

export type Q = { text: string; intent: string; personal?: boolean };

export const STREAM: Q[] = [
  { text: "What is your refund policy?", intent: "refund-policy" },
  { text: "How do I reset my password?", intent: "reset-password" },
  { text: "What's your refund policy?", intent: "refund-policy" },
  { text: "Can I get a refund?", intent: "refund-policy" },
  { text: "How can I reset my password?", intent: "reset-password" },
  { text: "What is your refund policy for gift cards?", intent: "refund-giftcards" },
  { text: "Do you ship to Canada?", intent: "ship-canada" },
  { text: "Do you ship to Mexico?", intent: "ship-mexico" },
  { text: "Where is my order 4471?", intent: "order-4471", personal: true },
  { text: "Where is my order 9930?", intent: "order-9930", personal: true },
  { text: "I forgot my password, how do I reset it?", intent: "reset-password" },
  { text: "What is the refund policy?", intent: "refund-policy" },
  { text: "Do you deliver to Canada?", intent: "ship-canada" },
  { text: "How long do refunds take?", intent: "refund-time" },
  { text: "How do I change my password?", intent: "reset-password" },
  { text: "Is there a refund policy?", intent: "refund-policy" },
  { text: "What is your refund policy?", intent: "refund-policy" },
];

const STOP = new Set(["what", "is", "your", "the", "a", "an", "do", "i", "can", "how", "my", "to", "for", "it", "you", "there", "s", "get", "me", "where", "of"]);
const SYN: Record<string, string> = { deliver: "ship", change: "reset", forgot: "reset", refunds: "refund" };

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP.has(w)).map((w) => SYN[w] ?? w);
}

export function cosine(a: string, b: string): number {
  const va = new Map<string, number>();
  const vb = new Map<string, number>();
  for (const t of tokens(a)) va.set(t, (va.get(t) ?? 0) + 1);
  for (const t of tokens(b)) vb.set(t, (vb.get(t) ?? 0) + 1);
  let dot = 0;
  for (const [k, v] of va) dot += v * (vb.get(k) ?? 0);
  const n = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((s, v) => s + v * v, 0));
  return n(va) && n(vb) ? dot / (n(va) * n(vb)) : 0;
}

export type Mode = "none" | "exact" | "semantic";
export const LLM_MS = 2200;
export const CACHE_MS = 40;
export const LLM_COST = 0.012; // $ per answer
export const EMBED_COST = 0.00002;

export type Lookup = { q: Q; hit: boolean; matched: Q | null; score: number; wrong: boolean; skipped: boolean };
export type Result = { lookups: Lookup[]; hits: number; wrong: number; llmCalls: number; cost: number; avgMs: number; leaked: number };

export function run(mode: Mode, threshold: number, skipPersonal: boolean): Result {
  const cache: Q[] = [];
  const lookups: Lookup[] = [];
  for (const q of STREAM) {
    let best: Q | null = null;
    let score = 0;
    const skipped = mode === "semantic" && skipPersonal && !!q.personal;
    if (mode === "exact") {
      best = cache.find((c) => c.text.toLowerCase().trim() === q.text.toLowerCase().trim()) ?? null;
      score = best ? 1 : 0;
    } else if (mode === "semantic" && !skipped) {
      for (const c of cache) {
        const s = cosine(q.text, c.text);
        if (s > score) {
          score = s;
          best = c;
        }
      }
      if (score + 1e-9 < threshold) best = null;
    }
    const hit = !!best;
    const wrong = hit && best!.intent !== q.intent;
    lookups.push({ q, hit, matched: best, score, wrong, skipped });
    if (!hit && !skipped) cache.push(q);
  }
  const hits = lookups.filter((l) => l.hit).length;
  const wrong = lookups.filter((l) => l.wrong).length;
  const llmCalls = lookups.length - hits;
  const embeds = mode === "semantic" ? lookups.filter((l) => !l.skipped).length : 0;
  const cost = llmCalls * LLM_COST + embeds * EMBED_COST;
  const avgMs = (llmCalls * LLM_MS + hits * CACHE_MS) / lookups.length;
  const leaked = lookups.filter((l) => l.wrong && l.matched?.personal).length;
  return { lookups, hits, wrong, llmCalls, cost, avgMs, leaked };
}

export const THRESHOLDS = [0.95, 0.8, 0.5];
