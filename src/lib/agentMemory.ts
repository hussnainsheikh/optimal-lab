// A personal assistant meets the same user across six sessions over a month. Later
// questions need facts from earlier sessions. Four ways to remember: nothing, replay
// every past transcript, keep a summary per session, or extract facts and episodes
// into a store and retrieve the relevant ones. Which questions are answered, and how
// many tokens each turn costs, are computed from the sessions below.

export type Fact = { id: string; text: string; session: number; kind: "semantic" | "episodic"; keywords: string[]; detail: boolean };
// detail: a specific value a short summary tends to drop
export const FACTS: Fact[] = [
  { id: "diet", text: "Sara is vegetarian", session: 1, kind: "semantic", keywords: ["food", "restaurant", "dinner", "eat"], detail: false },
  { id: "kids", text: "Two children, aged 4 and 7", session: 1, kind: "semantic", keywords: ["children", "kids", "family"], detail: true },
  { id: "flight", text: "Flight to Lisbon on 14 June, seat 23A", session: 2, kind: "episodic", keywords: ["flight", "lisbon", "trip", "seat"], detail: true },
  { id: "allergy", text: "Allergic to penicillin", session: 3, kind: "semantic", keywords: ["allergy", "medicine", "doctor"], detail: false },
  { id: "budget", text: "Holiday budget £2,400", session: 4, kind: "semantic", keywords: ["budget", "holiday", "hotel", "cost"], detail: true },
  { id: "hotel", text: "Rejected Hotel Avenida: too noisy", session: 5, kind: "episodic", keywords: ["hotel", "lisbon", "avenida"], detail: true },
];
export const SESSION_TOKENS = [2400, 3100, 1800, 2600, 2900, 2200]; // transcript length of each session
export const SUMMARY_TOKENS = 150;
export const FACT_TOKENS = 25;

export const QUESTIONS: { text: string; needs: string[]; keywords: string[] }[] = [
  { text: "Book us dinner in Lisbon.", needs: ["diet", "kids"], keywords: ["dinner", "lisbon", "family"] },
  { text: "Which seat am I in?", needs: ["flight"], keywords: ["seat", "flight"] },
  { text: "Find a hotel within budget, not the noisy one.", needs: ["budget", "hotel"], keywords: ["hotel", "budget", "avenida"] },
  { text: "Can I take amoxicillin?", needs: ["allergy"], keywords: ["medicine", "allergy"] },
];

export type Strategy = "none" | "transcripts" | "summaries" | "facts";
export const STRATEGIES: { id: Strategy; label: string; one: string }[] = [
  { id: "none", label: "No memory", one: "Each session starts blank." },
  { id: "transcripts", label: "Replay all transcripts", one: "Put every past session's full transcript in the prompt." },
  { id: "summaries", label: "A summary per session", one: "After each session, write a 150-token summary; put all summaries in the prompt." },
  { id: "facts", label: "Extracted memories + retrieval", one: "After each session, extract facts and notable events; retrieve the ones relevant to the question." },
];
export const CONTEXT_LIMIT = 12_000; // what this app allows for memory in the prompt

export type Answer = { q: string; recalled: string[]; missing: string[]; tokens: number; ok: boolean };

export function answer(s: Strategy, qi: number, session = 7): Answer {
  const q = QUESTIONS[qi];
  const past = FACTS.filter((f) => f.session < session);
  let recalled: string[] = [];
  let tokens = 0;
  if (s === "transcripts") {
    // newest first until the context limit
    let used = 0;
    const kept: number[] = [];
    for (let i = session - 2; i >= 0; i--) {
      if (used + SESSION_TOKENS[i] > CONTEXT_LIMIT) break;
      used += SESSION_TOKENS[i];
      kept.push(i + 1);
    }
    tokens = used;
    recalled = past.filter((f) => kept.includes(f.session)).map((f) => f.id);
  } else if (s === "summaries") {
    tokens = (session - 1) * SUMMARY_TOKENS;
    recalled = past.filter((f) => !f.detail).map((f) => f.id); // summaries keep the gist, lose specific values
  } else if (s === "facts") {
    const hits = past.filter((f) => f.keywords.some((k) => q.keywords.includes(k)));
    recalled = hits.map((f) => f.id);
    tokens = hits.length * FACT_TOKENS;
  }
  const missing = q.needs.filter((n) => !recalled.includes(n));
  return { q: q.text, recalled: recalled.filter((r) => q.needs.includes(r)), missing, tokens, ok: missing.length === 0 };
}

export function score(s: Strategy): { ok: number; tokens: number } {
  const all = QUESTIONS.map((_, i) => answer(s, i));
  return { ok: all.filter((a) => a.ok).length, tokens: Math.round(all.reduce((x, a) => x + a.tokens, 0) / all.length) };
}

export const factName = (id: string) => FACTS.find((f) => f.id === id)!.text;
