// A RAG answer about a company's leave policy, built from four retrieved chunks.
// Its four sentences: two well supported, one cited to the wrong chunk, and one the
// model made up. How much a reader can check depends on how the answer cites its
// sources. Support is computed: the share of a sentence's content words that appear
// in the chunk it cites, and the best chunk for each sentence.

export type Chunk = { id: string; doc: string; section: string; text: string };
export const CHUNKS: Chunk[] = [
  { id: "c1", doc: "Employee handbook", section: "§4.1 Annual leave", text: "Full-time employees receive 25 days of paid annual leave each calendar year, plus public holidays." },
  { id: "c2", doc: "Employee handbook", section: "§4.3 Carry-over", text: "Up to 5 unused leave days may be carried over into the next year and must be used by 31 March." },
  { id: "c3", doc: "Parental leave policy", section: "§2 Eligibility", text: "Parental leave of 16 weeks at full pay is available after 6 months of employment." },
  { id: "c4", doc: "Travel policy", section: "§1 Booking", text: "Book all business travel through the travel portal at least 14 days in advance." },
];

export type Sentence = { text: string; cites: string | null; truth: "supported" | "miscited" | "unsupported" };
export const ANSWER: Sentence[] = [
  { text: "Full-time employees get 25 days of paid annual leave a year, plus public holidays.", cites: "c1", truth: "supported" },
  { text: "Up to 5 unused days can be carried over, and must be used by 31 March.", cites: "c2", truth: "supported" },
  { text: "Parental leave is 16 weeks at full pay after 6 months of employment.", cites: "c2", truth: "miscited" },
  { text: "Unused carried-over days are paid out in April.", cites: "c2", truth: "unsupported" },
];

export const QUESTION = "How much leave do I get, and what happens to days I don't use?";

const STOP = new Set(["a", "an", "the", "of", "and", "or", "to", "in", "into", "at", "by", "be", "is", "are", "can", "may", "must", "get", "each", "per", "after", "plus", "up", "days", "day", "year", "next", "used", "use", "unused"]);
export const words = (s: string) => (s.toLowerCase().match(/[a-z0-9-]+/g) ?? []).map((w) => w.replace(/s$/, "")).filter((w) => !STOP.has(w) && !STOP.has(w + "s"));

export function support(sentence: string, chunk: Chunk): number {
  const w = [...new Set(words(sentence))];
  const c = new Set(words(chunk.text));
  return w.length ? w.filter((x) => c.has(x)).length / w.length : 0;
}

export const THRESHOLD = 0.6;

export type Style = "none" | "sources" | "inline" | "verified";
export const STYLES: { id: Style; label: string; one: string }[] = [
  { id: "none", label: "No citations", one: "Just the answer. The reader has to trust it." },
  { id: "sources", label: "Sources at the end", one: "A list of the documents retrieved, under the answer." },
  { id: "inline", label: "Inline, per sentence", one: "Each sentence points at the chunk it came from: [1], [2]." },
  { id: "verified", label: "Inline, then verified", one: "Each citation is checked against its chunk before the answer is shown; failures are fixed or flagged." },
];

export type Check = { s: Sentence; cited: Chunk | null; citedSupport: number; best: Chunk; bestSupport: number; status: "ok" | "wrong-source" | "no-source" };

export function check(): Check[] {
  return ANSWER.map((s) => {
    const cited = s.cites ? CHUNKS.find((c) => c.id === s.cites)! : null;
    const citedSupport = cited ? support(s.text, cited) : 0;
    const ranked = CHUNKS.map((c) => ({ c, v: support(s.text, c) })).sort((a, b) => b.v - a.v);
    const best = ranked[0];
    const status = citedSupport >= THRESHOLD ? "ok" : best.v >= THRESHOLD ? "wrong-source" : "no-source";
    return { s, cited, citedSupport, best: best.c, bestSupport: best.v, status };
  });
}

// What the reader can catch, by style.
export function visible(style: Style): { checkable: number; caught: number; shownWrong: number; note: string } {
  const c = check();
  const bad = c.filter((x) => x.status !== "ok").length;
  if (style === "none") return { checkable: 0, caught: 0, shownWrong: bad, note: "Nothing to check. Two of the four sentences are wrong, and they read exactly like the other two." };
  if (style === "sources") return { checkable: 0, caught: 0, shownWrong: bad, note: "The reader knows which documents were used, but not which sentence came from where, so checking means rereading everything." };
  if (style === "inline") return { checkable: c.length, caught: 0, shownWrong: bad, note: "Each sentence can be checked in one click, but only if the reader clicks. The fake carry-over rule still points confidently at §4.3." };
  const fixed = c.filter((x) => x.status === "wrong-source").length;
  const flagged = c.filter((x) => x.status === "no-source").length;
  return { checkable: c.length, caught: fixed + flagged, shownWrong: 0, note: `Verification re-points ${fixed} citation to the chunk that supports it and removes or flags ${flagged} sentence nothing supports.` };
}
