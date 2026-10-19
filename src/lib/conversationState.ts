// A chat assistant's conversation has to survive things users actually do: reload
// the page, open it on their phone, lose the connection halfway through an answer,
// and the server restarting during a deploy. Where the conversation lives decides
// which of those it survives; resending the whole history each turn decides the bill.

export type Store = "memory" | "local" | "server" | "serverStream";
export const STORES: { id: Store; label: string; one: string }[] = [
  { id: "memory", label: "In the page's memory", one: "The messages are a JavaScript array in the open tab." },
  { id: "local", label: "Browser storage", one: "Saved to localStorage after every message." },
  { id: "server", label: "Server database", one: "Each message is written to a conversations table, keyed by conversation and user." },
  { id: "serverStream", label: "Database + resumable streams", one: "As above, and each answer is streamed from a server-side buffer the client can reconnect to by message id and offset." },
];

export type EventId = "reload" | "phone" | "drop" | "deploy" | "tabs";
export const EVENTS: { id: EventId; label: string; what: string }[] = [
  { id: "reload", label: "Reload the page", what: "The user presses refresh." },
  { id: "phone", label: "Continue on the phone", what: "They open the same chat on another device." },
  { id: "drop", label: "Connection drops mid-answer", what: "The train enters a tunnel while the answer is streaming." },
  { id: "deploy", label: "Server restarts mid-answer", what: "A deploy replaces the server that was generating the answer." },
  { id: "tabs", label: "Two tabs at once", what: "The chat is open in two tabs and the user sends from both." },
];

export type Outcome = { ok: boolean; what: string };
export function outcome(s: Store, e: EventId): Outcome {
  switch (e) {
    case "reload":
      return s === "memory" ? { ok: false, what: "The array is gone; the chat is empty." } : { ok: true, what: "The chat is restored." };
    case "phone":
      return s === "server" || s === "serverStream" ? { ok: true, what: "The phone loads the conversation from the server." } : { ok: false, what: "The phone has its own, empty storage." };
    case "drop":
      return s === "serverStream"
        ? { ok: true, what: "The client reconnects with the message id and the last offset it saw, and the answer continues where it stopped." }
        : s === "server"
          ? { ok: false, what: "The finished answer is saved, but the user stares at half an answer until they reload." }
          : { ok: false, what: "The half answer is all there is; the user has to ask again and pay for it again." };
    case "deploy":
      return s === "serverStream"
        ? { ok: true, what: "Generation runs in a worker that writes to the buffer; the new server serves the rest of it." }
        : { ok: false, what: "The answer dies with the server that was generating it; the user sees an error." };
    case "tabs":
      return s === "server" || s === "serverStream"
        ? { ok: true, what: "Both tabs append to one ordered list on the server; each sees the other's messages." }
        : { ok: false, what: "Each tab keeps its own copy; one overwrites the other in storage." };
  }
}

// What resending history costs: every turn sends the whole conversation so far.
export const TOKENS_PER_TURN = 350; // a user message and an answer
export const SYSTEM_TOKENS = 1500;
export const PRICE_INPUT = 3 / 1e6;
export const PRICE_CACHED = 0.3 / 1e6; // prompt-cache read price
export function historyCost(turns: number, cached: boolean): { tokens: number; cost: number } {
  let tokens = 0;
  let cost = 0;
  for (let t = 1; t <= turns; t++) {
    const prior = SYSTEM_TOKENS + (t - 1) * TOKENS_PER_TURN;
    const fresh = TOKENS_PER_TURN / 2; // the new user message
    tokens += prior + fresh;
    cost += cached && t > 1 ? prior * PRICE_CACHED + fresh * PRICE_INPUT : (prior + fresh) * PRICE_INPUT;
  }
  return { tokens, cost };
}
export const TURN_CHOICES = [10, 40, 100];
