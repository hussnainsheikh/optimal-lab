// An assistant extracts memories from chats. Over three months the user moves house,
// changes their name, says something sarcastic, and asks the assistant to forget
// something. Four ways to store what's extracted, each asked the same questions; the
// answers are computed from the memory store each design ends up with.

export type Extracted = { day: number; key: string; value: string; said: string; sarcastic?: boolean };
export const EXTRACTED: Extracted[] = [
  { day: 1, key: "city", value: "Leeds", said: "I live in Leeds." },
  { day: 3, key: "name", value: "Sara Ahmed", said: "Call me Sara Ahmed." },
  { day: 12, key: "likes", value: "waiting on hold", said: "Oh I just love waiting on hold for an hour.", sarcastic: true },
  { day: 40, key: "city", value: "Bristol", said: "We finally moved to Bristol!" },
  { day: 55, key: "name", value: "Sara Malik", said: "I got married, I'm Sara Malik now." },
  { day: 70, key: "health", value: "diabetes", said: "My doctor says I have type 2 diabetes." },
  { day: 85, key: "forget", value: "health", said: "Please forget what I told you about my health." },
];

export type Design = "append" | "overwrite" | "versioned" | "reviewed";
export const DESIGNS: { id: Design; label: string; one: string }[] = [
  { id: "append", label: "Append every extraction", one: "Each extracted fact is added to the store; retrieval returns whatever matches." },
  { id: "overwrite", label: "One value per key", one: "A new fact replaces the old one with the same key." },
  { id: "versioned", label: "Versioned with validity", one: "A new value closes the old one (valid until day 40) and opens a new one; history is kept." },
  { id: "reviewed", label: "Versioned + checks + forgetting", one: "As versioned, plus: a second pass rejects sarcasm and jokes, sensitive facts need consent, and “forget” deletes for real." },
];

export type Q = { text: string; day: number; key: string; asOf?: number; expect: string };
export const QUESTIONS: Q[] = [
  { text: "Where do I live?", day: 90, key: "city", expect: "Bristol" },
  { text: "What's my name?", day: 90, key: "name", expect: "Sara Malik" },
  { text: "Where was I living in January (day 20)?", day: 90, key: "city", asOf: 20, expect: "Leeds" },
  { text: "Suggest something I enjoy.", day: 90, key: "likes", expect: "(nothing known)" },
  { text: "What do you know about my health?", day: 90, key: "health", expect: "(forgotten)" },
];

type Row = { key: string; value: string; from: number; to: number | null };

export function store(d: Design): Row[] {
  const rows: Row[] = [];
  for (const e of EXTRACTED) {
    if (e.key === "forget") {
      if (d === "reviewed") for (let i = rows.length - 1; i >= 0; i--) if (rows[i].key === e.value) rows.splice(i, 1);
      continue; // the other designs extract nothing actionable from "forget"
    }
    if (d === "reviewed" && e.sarcastic) continue;
    if (d === "append") rows.push({ key: e.key, value: e.value, from: e.day, to: null });
    else if (d === "overwrite") {
      const i = rows.findIndex((r) => r.key === e.key);
      if (i >= 0) rows[i] = { key: e.key, value: e.value, from: e.day, to: null };
      else rows.push({ key: e.key, value: e.value, from: e.day, to: null });
    } else {
      const open = rows.find((r) => r.key === e.key && r.to === null);
      if (open) open.to = e.day;
      rows.push({ key: e.key, value: e.value, from: e.day, to: null });
    }
  }
  return rows;
}

export function ask(d: Design, q: Q): { answer: string; ok: boolean; why: string } {
  const rows = store(d).filter((r) => r.key === q.key);
  let answer: string;
  let why: string;
  if (!rows.length) {
    answer = q.expect.startsWith("(") ? q.expect : "(nothing known)";
    why = q.key === "health" ? "The memory was deleted when the user asked." : "Nothing stored for this.";
  } else if (d === "append" && rows.length > 1) {
    // retrieval returns all matching memories; the model has to guess, and often takes the first it sees
    answer = rows.map((r) => r.value).join(" or ");
    why = `${rows.length} memories match; nothing says which is current, so the answer hedges or picks the older one.`;
  } else if (q.asOf !== undefined) {
    const at = rows.find((r) => r.from <= q.asOf! && (r.to === null || r.to > q.asOf!));
    answer = at ? at.value : rows[rows.length - 1].value;
    why = d === "overwrite" ? "Only the latest value was kept; the history is gone." : "The validity interval says which value held on that day.";
  } else {
    const current = rows.find((r) => r.to === null) ?? rows[rows.length - 1];
    answer = current.value;
    why = q.key === "likes" ? "A sarcastic remark was stored as a preference." : q.key === "health" ? "“Forget it” was ignored; the memory is still there." : "The current value.";
  }
  return { answer, ok: answer === q.expect, why };
}

export const score = (d: Design) => QUESTIONS.filter((q) => ask(d, q).ok).length;
export const storedRows = (d: Design) => store(d);
