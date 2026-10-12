// Query rewriting and HyDE. Users type vague, chatty questions; documents are written in
// careful product language. Rewriting the question (or writing a fake answer and searching
// with that, HyDE) closes the gap. Scoring counts shared words, standing in for embeddings.

export type Doc = { id: string; title: string; text: string };

export const DOCS: Doc[] = [
  { id: "declined", title: "Why a payment is declined", text: "A card payment can be declined by the issuing bank for insufficient funds, an expired card, a billing address mismatch or a fraud check. Update the card details or contact the bank." },
  { id: "billing-address", title: "Updating your billing address", text: "Change the billing address on file under Settings, Billing. The address must match the one your bank has for the card." },
  { id: "refunds", title: "Refund timing", text: "Approved refunds return to the original payment method within 5 to 7 business days." },
  { id: "export", title: "Exporting your data", text: "Download a CSV export of all projects and tasks from Settings, Data, Export. Large exports are emailed as a link." },
  { id: "sso", title: "Single sign-on", text: "Enterprise workspaces can require single sign-on with Okta, Azure AD or Google Workspace." },
  { id: "rate-limits", title: "API rate limits", text: "The API allows 100 requests per minute per key. Requests over the limit return HTTP 429; retry with exponential backoff." },
];

export type Example = {
  id: string;
  label: string;
  raw: string; // what the user typed
  rewritten: string; // an LLM's rewrite into a search query
  hyde: string; // an LLM's guess at what the answer document says
  target: string; // the doc that answers it
};

export const EXAMPLES: Example[] = [
  {
    id: "card",
    label: "“it keeps saying no when i try to pay??”",
    raw: "it keeps saying no when i try to pay??",
    rewritten: "card payment declined reasons",
    hyde: "Your card payment was declined by the bank, possibly because of insufficient funds, an expired card or a billing address mismatch.",
    target: "declined",
  },
  {
    id: "spreadsheet",
    label: "“how do i get all my stuff into a spreadsheet”",
    raw: "how do i get all my stuff into a spreadsheet",
    rewritten: "export projects tasks CSV download",
    hyde: "You can download a CSV export of your projects and tasks from Settings.",
    target: "export",
  },
  {
    id: "too-fast",
    label: "“the api stopped answering after a while”",
    raw: "the api stopped answering after a while",
    rewritten: "API rate limit requests per minute 429",
    hyde: "The API returns HTTP 429 when you send too many requests per minute. Retry with backoff.",
    target: "rate-limits",
  },
];

export type Mode = "raw" | "rewrite" | "hyde";

export const MODES: { id: Mode; label: string; note: string }[] = [
  { id: "raw", label: "As typed", note: "Search with exactly what the user wrote." },
  { id: "rewrite", label: "Rewritten", note: "An LLM turns the question into a short search query first." },
  { id: "hyde", label: "HyDE", note: "An LLM writes a fake answer, and you search with that. Answers look like documents." },
];

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "it", "i", "my", "your", "you", "can", "be", "by", "with", "from", "how", "do", "when", "into", "all", "get", "after", "while", "was", "are", "this", "that", "so", "per"]);
const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "");
export const terms = (t: string) =>
  t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);

export function queryFor(ex: Example, mode: Mode) {
  return mode === "raw" ? ex.raw : mode === "rewrite" ? ex.rewritten : ex.hyde;
}

// The words of a text that survive filtering, keyed by stem so "declined" matches "decline".
const wordsByStem = (t: string) => {
  const out = new Map<string, string>();
  for (const w of t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)) {
    if (w.length > 1 && !STOP.has(w) && !out.has(stem(w))) out.set(stem(w), w);
  }
  return out;
};

export function search(query: string, docs = DOCS) {
  const q = new Set(terms(query));
  return docs
    .map((d) => {
      const shared = [...wordsByStem(`${d.title} ${d.text}`)].filter(([s]) => q.has(s)).map(([, w]) => w);
      return { doc: d, score: shared.length, shared };
    })
    .sort((a, b) => b.score - a.score || DOCS.indexOf(a.doc) - DOCS.indexOf(b.doc));
}

// Where the right document lands (1 = top), or null if nothing matched it at all.
export function rankOf(ex: Example, mode: Mode) {
  const results = search(queryFor(ex, mode));
  const i = results.findIndex((r) => r.doc.id === ex.target);
  return results[i].score === 0 ? null : i + 1;
}
