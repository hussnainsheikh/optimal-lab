// A support assistant handles a day's tickets. Some contain card numbers, national
// insurance numbers, passwords pasted by customers, or an API key from an engineer's
// debugging. Each kind of sensitive item can end up in five places it shouldn't. The
// count reaching each place is computed from the ticket mix and the controls on.

export const TICKETS = 10_000;
export const ITEMS: { id: string; label: string; perTicket: number; detectable: number }[] = [
  { id: "card", label: "Card numbers", perTicket: 0.02, detectable: 0.99 },
  { id: "nino", label: "National ID numbers", perTicket: 0.01, detectable: 0.95 },
  { id: "password", label: "Passwords pasted by customers", perTicket: 0.005, detectable: 0.6 },
  { id: "apikey", label: "API keys in debug notes", perTicket: 0.002, detectable: 0.97 },
  { id: "health", label: "Health details", perTicket: 0.03, detectable: 0.7 },
];

export type Sink = "provider" | "logs" | "training" | "otherUsers" | "tickets";
export const SINKS: { id: Sink; label: string; what: string }[] = [
  { id: "provider", label: "The model provider", what: "Every prompt is sent to the provider's API." },
  { id: "logs", label: "Your logs and traces", what: "Prompts and completions are logged for debugging, kept 90 days, readable by most engineers." },
  { id: "training", label: "Future model training", what: "Prompts are used to improve models unless that is turned off by agreement." },
  { id: "otherUsers", label: "Other customers", what: "A cache or shared memory returns one customer's details to another." },
  { id: "tickets", label: "Replies and summaries", what: "The assistant repeats sensitive values in replies or internal summaries." },
];

export type Control = "redact" | "logScrub" | "zdr" | "noShare" | "outputFilter";
export const CONTROLS: { id: Control; label: string; protects: Sink[]; what: string }[] = [
  { id: "redact", label: "Redact before the prompt", protects: ["provider", "logs", "training", "otherUsers", "tickets"], what: "A detector replaces card numbers, IDs and keys with placeholders before the text reaches the model; only what it detects." },
  { id: "logScrub", label: "Scrub and shorten logs", protects: ["logs"], what: "Logs keep metadata and redacted text, for 7 days, behind access control." },
  { id: "zdr", label: "Zero data retention agreement", protects: ["training"], what: "The provider contract excludes prompts from training and storage." },
  { id: "noShare", label: "Per-user caches and memory", protects: ["otherUsers"], what: "Nothing personal is cached or remembered across customers." },
  { id: "outputFilter", label: "Filter the output", protects: ["tickets"], what: "Replies are scanned and sensitive values masked before they're sent or stored." },
];

// Before controls: how often each sink receives an item that is in the prompt.
const BASE_REACH: Record<Sink, number> = { provider: 1, logs: 1, training: 1, otherUsers: 0.002, tickets: 0.15 };

export function reach(on: Record<Control, boolean>): Record<Sink, number> {
  const out = { provider: 0, logs: 0, training: 0, otherUsers: 0, tickets: 0 } as Record<Sink, number>;
  for (const item of ITEMS) {
    const count = TICKETS * item.perTicket;
    const afterRedact = on.redact ? count * (1 - item.detectable) : count;
    for (const s of SINKS) {
      let n = afterRedact * BASE_REACH[s.id];
      if (s.id === "logs" && on.logScrub) n *= 0.05; // what slips through redaction and is still kept, briefly
      if (s.id === "training" && on.zdr) n = 0;
      if (s.id === "otherUsers" && on.noShare) n = 0;
      if (s.id === "tickets" && on.outputFilter) n *= 1 - item.detectable;
      out[s.id] += n;
    }
  }
  return out;
}

export const NONE: Record<Control, boolean> = { redact: false, logScrub: false, zdr: false, noShare: false, outputFilter: false };
export const ALL: Record<Control, boolean> = { redact: true, logScrub: true, zdr: true, noShare: true, outputFilter: true };
export const totalItems = () => ITEMS.reduce((s, i) => s + TICKETS * i.perTicket, 0);
