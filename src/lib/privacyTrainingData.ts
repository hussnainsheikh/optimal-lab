// Privacy and training data: what a model memorizes, and how to keep personal data out.
// Carlini et al. 2022 measured that the chance a model will reproduce a training string
// grows log-linearly with how many times it appeared, with model size, and with how
// much of its context the attacker can supply. The curve below has that shape with
// made-up constants, and the page says so. The defenses act on the inputs to it.

export type Item = {
  id: string;
  label: string;
  kind: "secret" | "personal" | "public";
  copies: number; // times it appears in the crawl
  detect: { regex: number; ner: number }; // chance a scrubber catches it: pattern rules, or a named-entity model
  what: string;
};

export const ITEMS: Item[] = [
  { id: "key", label: "An API key committed to one public repo", kind: "secret", copies: 1, detect: { regex: 0.95, ner: 0.3 }, what: "A 40-character token with a known prefix." },
  { id: "email", label: "A private email quoted in a forum thread", kind: "personal", copies: 3, detect: { regex: 0.9, ner: 0.6 }, what: "An address and two lines of the message." },
  { id: "address", label: "A home address in a scraped public register", kind: "personal", copies: 40, detect: { regex: 0.2, ner: 0.7 }, what: "Name, street and postcode, in forty mirror sites." },
  { id: "record", label: "A patient's note in a leaked dataset", kind: "personal", copies: 12, detect: { regex: 0.1, ner: 0.55 }, what: "A paragraph of free text with a name and a diagnosis." },
  { id: "quote", label: "A famous novel's first sentence", kind: "public", copies: 100000, detect: { regex: 0, ner: 0 }, what: "Memorizing this is the point of training." },
];

export const SIZES = [
  { id: "small", label: "1B", logSize: 0 },
  { id: "mid", label: "8B", logSize: 1 },
  { id: "large", label: "70B", logSize: 2 },
];

export const PROMPTS = [
  { id: "short", label: "A few words", bonus: 0 },
  { id: "long", label: "The whole paragraph before it", bonus: 1.2 },
];

export type Defenses = { dedup: boolean; scrub: "none" | "regex" | "ner"; dp: "none" | "loose" | "tight"; prompts: boolean };
export const NONE: Defenses = { dedup: false, scrub: "none", dp: "none", prompts: false };

export const DP = {
  none: { label: "Off", epsilon: null, cut: 0, quality: 1 },
  loose: { label: "ε = 8", epsilon: 8, cut: 0.7, quality: 0.96 },
  tight: { label: "ε = 1", epsilon: 1, cut: 0.97, quality: 0.85 },
} as const;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// Chance an attacker who knows the context can make the model reproduce the item.
export function extractChance(item: Item, sizeId: string, promptId: string, d: Defenses): number {
  const copies = d.dedup ? Math.min(item.copies, item.kind === "public" ? item.copies : 1) : item.copies;
  const size = SIZES.find((s) => s.id === sizeId)!.logSize;
  const prompt = PROMPTS.find((p) => p.id === promptId)!.bonus;
  const base = sigmoid(1.1 * Math.log2(copies) + 0.9 * size + prompt - 5.2);
  const kept = d.scrub === "none" || item.kind === "public" ? 1 : 1 - item.detect[d.scrub];
  const dp = 1 - DP[d.dp].cut;
  return Math.min(0.99, base * kept * dp);
}

// How well the model works, relative to training on everything with no noise.
export function quality(d: Defenses): number {
  let q = DP[d.dp].quality;
  if (d.dedup) q += 0.01; // deduplicated data trains a slightly better model (Lee et al. 2021)
  return Math.min(1, q);
}

// The other direction: what users type becomes training data unless you turn it off.
export const USER_PROMPTS = { perDay: 50_000, withPII: 0.04 };

export const pct = (x: number) => (x < 0.01 ? "<1%" : `${Math.round(x * 100)}%`);
