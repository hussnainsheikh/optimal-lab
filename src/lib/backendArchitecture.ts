// POST /transfers moves money between two accounts. A request passes through
// authentication middleware, a controller, a service with the business rules, the
// database, and an email side effect. Five requests, four of them bad in a different
// way, go through the layers; whether each one is stopped, and what state it leaves
// behind, depends on which responsibilities are placed where.

export type Guards = { validate: boolean; authorize: boolean; transaction: boolean; outbox: boolean };
export const NONE: Guards = { validate: false, authorize: false, transaction: false, outbox: false };

export type Layer = "middleware" | "controller" | "service" | "db" | "email";
export const LAYERS: { id: Layer; label: string }[] = [
  { id: "middleware", label: "Auth middleware" },
  { id: "controller", label: "Controller" },
  { id: "service", label: "Transfer service" },
  { id: "db", label: "Postgres" },
  { id: "email", label: "Email" },
];

export type RequestId = "ok" | "negative" | "notYours" | "crash" | "commitFails";
export const REQUESTS: { id: RequestId; label: string; body: string; what: string }[] = [
  { id: "ok", label: "A normal transfer", body: "Sara: 50 from her account to Ben", what: "Everything is fine." },
  { id: "negative", label: "A negative amount", body: "Sara: −50 from her account to Ben", what: "Moving −50 out of Sara's account moves 50 into it from Ben's." },
  { id: "notYours", label: "Someone else's account", body: "Sara: 50 from Ben's account to hers", what: "She is logged in, but the account isn't hers." },
  { id: "crash", label: "Crash between the writes", body: "Sara: 50 to Ben; the process dies after the debit", what: "The debit is written; the credit never is." },
  { id: "commitFails", label: "Commit fails after the email", body: "Sara: 50 to Ben; the commit hits a deadlock", what: "The email is sent, then the transaction is rolled back." },
];

export const START_BALANCE = { sara: 200, ben: 200 };

export type Outcome = {
  stoppedAt: Layer | null;
  status: number;
  balances: { sara: number; ben: number };
  emailSent: boolean;
  correct: boolean;
  path: Layer[];
  note: string;
};

export function handle(req: RequestId, g: Guards): Outcome {
  const b = { ...START_BALANCE };
  const path: Layer[] = ["middleware", "controller"];
  // middleware always authenticates (who is calling); it can't know which accounts she may use
  if (req === "negative" && g.validate) return { stoppedAt: "controller", status: 400, balances: b, emailSent: false, correct: true, path, note: "The schema says amount > 0. Rejected before any business code runs." };
  path.push("service");
  if (req === "notYours" && g.authorize) return { stoppedAt: "service", status: 403, balances: b, emailSent: false, correct: true, path, note: "The service checks the source account belongs to the caller. Authentication said who she is; authorization says what she may touch." };
  path.push("db");
  const amount = req === "negative" ? -50 : 50;
  const [from, to] = req === "notYours" ? (["ben", "sara"] as const) : (["sara", "ben"] as const);

  if (req === "crash") {
    if (g.transaction) return { stoppedAt: "db", status: 500, balances: b, emailSent: false, correct: true, path, note: "The process died inside the transaction; Postgres rolls the debit back. Balances unchanged, the client can retry." };
    b[from] -= amount;
    return { stoppedAt: "db", status: 500, balances: b, emailSent: false, correct: false, path, note: "The debit was its own write and it committed. 50 left Sara's account and arrived nowhere." };
  }

  b[from] -= amount;
  b[to] += amount;

  if (req === "commitFails") {
    if (g.outbox) {
      return { stoppedAt: "db", status: 503, balances: { ...START_BALANCE }, emailSent: false, correct: true, path, note: "The email was only a row in the outbox table, in the same transaction; the rollback removed it too. Nothing was promised." };
    }
    path.push("email");
    return { stoppedAt: "db", status: 503, balances: g.transaction ? { ...START_BALANCE } : b, emailSent: true, correct: false, path, note: g.transaction ? "The email went out before the commit, then the commit failed. Ben is told he has 50 he doesn't have." : "Without a transaction there's nothing to roll back: the writes stand, but the client got an error and will retry." };
  }

  path.push("email");
  const correct = req === "ok";
  return {
    stoppedAt: null,
    status: 201,
    balances: b,
    emailSent: true,
    correct,
    path,
    note:
      req === "ok"
        ? g.outbox
          ? "Committed with an outbox row; a relay sends the email after the commit."
          : "Committed, then the email was sent."
        : req === "negative"
          ? "Nothing checked the amount. Sara's balance went up by 50 and Ben's down: a transfer in the wrong direction, by anyone, to anyone."
          : "Nothing checked who owns the account. Any logged-in user can empty any account.",
  };
}

export function score(g: Guards): { correct: number; total: number } {
  const total = REQUESTS.length;
  return { correct: REQUESTS.filter((r) => handle(r.id, g).correct).length, total };
}
