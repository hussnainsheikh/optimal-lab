// A marketplace takes two card payments, keeps a 10% fee, gets settled by the card
// processor and pays the seller. Two ways to keep the books, run over the same
// events and the same faults:
//
//   balances  one balance column per account, updated with separate writes, no keys
//   ledger    double entry: each transaction is a set of entries that sum to zero,
//             written atomically, with an idempotency key; balances are derived
//
// Every amount is in integer cents. A balance is debits minus credits, so assets
// (money we hold or are owed) are positive and what we owe others is negative.
// In balanced books the balances always add up to zero.

export type Account = "receivable" | "bank" | "seller" | "revenue";
export const ACCOUNTS: { id: Account; label: string; kind: string }[] = [
  { id: "receivable", label: "Owed by the card processor", kind: "asset" },
  { id: "bank", label: "Bank account", kind: "asset" },
  { id: "seller", label: "Owed to the seller", kind: "liability" },
  { id: "revenue", label: "Platform fees", kind: "revenue" },
];

export type Design = "balances" | "ledger";
export const DESIGNS: { id: Design; label: string; one: string }[] = [
  { id: "balances", label: "Balance columns", one: "UPDATE accounts SET balance = balance + x, one row at a time, for each webhook that arrives." },
  { id: "ledger", label: "Double-entry ledger", one: "INSERT one transaction with its entries in a single database transaction, keyed by the event id; balances are sums of entries." },
];

export type Faults = { duplicate: boolean; crash: boolean };

export type Entry = { account: Account; amount: number }; // + debit, − credit
export type Event = { id: string; key: string; label: string; kind: "pay" | "dup" | "settle" | "payout" | "reconcile"; entries?: Entry[] };

export const FEE_RATE = 0.1;
const pay = (key: string, label: string, cents: number): Event => {
  const fee = Math.round(cents * FEE_RATE);
  return {
    id: key,
    key,
    label,
    kind: "pay",
    entries: [
      { account: "receivable", amount: cents },
      { account: "seller", amount: -(cents - fee) },
      { account: "revenue", amount: -fee },
    ],
  };
};

export const ORDER_A = 4000;
export const ORDER_B = 2500;
const A = pay("evt_A", "Order A paid, €40.00", ORDER_A);
const B = pay("evt_B", "Order B paid, €25.00", ORDER_B);
// what the seller should receive for the two orders
export const FAIR = ORDER_A + ORDER_B - Math.round(ORDER_A * FEE_RATE) - Math.round(ORDER_B * FEE_RATE);

export const EVENTS: Event[] = [
  A,
  B,
  { ...B, id: "evt_B_retry", kind: "dup", label: "The processor sends order B's webhook again" },
  {
    id: "settle",
    key: "settle_1",
    kind: "settle",
    label: "The processor settles €65.00 into the bank",
    entries: [
      { account: "bank", amount: ORDER_A + ORDER_B },
      { account: "receivable", amount: -(ORDER_A + ORDER_B) },
    ],
  },
  { id: "payout", key: "payout_1", kind: "payout", label: "Pay the seller what they're owed" },
  { id: "reconcile", key: "", kind: "reconcile", label: "Reconcile with the processor and the bank" },
];

export type Balances = Record<Account, number>;
const zero = (): Balances => ({ receivable: 0, bank: 0, seller: 0, revenue: 0 });

export type Frame = {
  i: number;
  event: Event | null;
  balances: Balances;
  journal: { key: string; label: string; entries: Entry[]; note?: string }[];
  writes: string[]; // what this event did to the database
  sentToSeller: number; // money that actually left the bank for the seller
  note: string;
  tone: "good" | "bad" | "accent";
};

const euros = (c: number) => `€${(Math.abs(c) / 100).toFixed(2)}`;
export const fmt = (c: number) => `${c < 0 ? "−" : ""}${euros(c)}`;
export const sum = (b: Balances) => b.receivable + b.bank + b.seller + b.revenue;

export function frames(design: Design, faults: Faults): Frame[] {
  const out: Frame[] = [];
  const b = zero();
  const journal: Frame["journal"] = [];
  const keys = new Set<string>();
  let sent = 0;
  out.push({ i: 0, event: null, balances: { ...b }, journal: [], writes: [], sentToSeller: 0, note: "Empty books. Six things are about to happen.", tone: "accent" });

  EVENTS.forEach((e, idx) => {
    const writes: string[] = [];
    let note = "";
    let tone: Frame["tone"] = "good";

    if (e.kind === "dup" && !faults.duplicate) {
      note = "No retry this time: the first webhook was acknowledged.";
      out.push({ i: idx + 1, event: e, balances: { ...b }, journal: [...journal], writes, sentToSeller: sent, note, tone: "accent" });
      return;
    }

    if (e.kind === "pay" || e.kind === "dup" || e.kind === "settle") {
      const entries = e.entries!;
      if (design === "balances") {
        for (const x of entries) {
          b[x.account] += x.amount;
          writes.push(`UPDATE ${x.account} ${x.amount > 0 ? "+" : "−"} ${euros(x.amount)}`);
        }
        note = e.kind === "dup" ? `Applied a second time: order B is now counted twice, and the seller is owed ${euros(ORDER_B - Math.round(ORDER_B * FEE_RATE))} more than was ever paid.` : `${e.label}: ${entries.length} balances updated.`;
        tone = e.kind === "dup" ? "bad" : "good";
      } else if (keys.has(e.key)) {
        writes.push(`INSERT … key ${e.key} → unique violation, skipped`);
        note = `Key ${e.key} is already in the ledger. The retry is acknowledged and nothing is written.`;
        tone = "good";
      } else {
        keys.add(e.key);
        for (const x of entries) b[x.account] += x.amount;
        journal.push({ key: e.key, label: e.label, entries });
        writes.push(`BEGIN · INSERT transaction ${e.key} · INSERT ${entries.length} entries (sum 0) · COMMIT`);
        note = `${e.label}: one transaction, ${entries.length} entries that add up to zero.`;
      }
    }

    if (e.kind === "payout") {
      const owed = -b.seller;
      const entries: Entry[] = [
        { account: "seller", amount: owed },
        { account: "bank", amount: -owed },
      ];
      if (design === "balances") {
        sent += owed;
        writes.push(`bank transfer ${euros(owed)} to the seller`);
        b.bank -= owed;
        writes.push(`UPDATE bank − ${euros(owed)}`);
        if (faults.crash) {
          writes.push("process killed: UPDATE seller never runs");
          note = `${euros(owed)} left the bank and the bank balance says so, but the server died before reducing what the seller is owed. The books are now off by ${euros(owed)}, and tomorrow's payout run will pay it again.`;
          tone = "bad";
        } else {
          b.seller += owed;
          writes.push(`UPDATE seller + ${euros(owed)}`);
          note = `Paid ${euros(owed)}${faults.duplicate ? `, which includes order B twice: ${euros(owed - FAIR)} the platform never collected` : ""}.`;
          tone = faults.duplicate ? "bad" : "good";
        }
      } else {
        if (faults.crash) {
          writes.push(`BEGIN · INSERT payout_1 · bank transfer ${euros(owed)} (key payout_1) · process killed → ROLLBACK`);
          writes.push(`retry: bank sees key payout_1 again, returns the first transfer · COMMIT`);
        } else {
          writes.push(`BEGIN · INSERT payout_1 · bank transfer ${euros(owed)} (key payout_1) · COMMIT`);
        }
        sent += owed;
        for (const x of entries) b[x.account] += x.amount;
        keys.add(e.key);
        journal.push({ key: e.key, label: `Payout to the seller, ${euros(owed)}`, entries });
        note = faults.crash
          ? `The server died mid-payout. The transaction rolled back, the job retried with the same key, and the bank returned the transfer it already made instead of sending ${euros(owed)} twice.`
          : `Paid ${euros(owed)}, the seller's share of two orders.`;
      }
    }

    if (e.kind === "reconcile") {
      const r = reconcile(b, sent);
      note = r.ok ? "Every number matches the processor's report and the bank statement." : r.lines.filter((l) => !l.ok).map((l) => `${l.label}: books ${fmt(l.books)}, outside ${fmt(l.outside)}`).join(". ") + ".";
      tone = r.ok ? "good" : "bad";
    }

    out.push({ i: idx + 1, event: e, balances: { ...b }, journal: [...journal], writes, sentToSeller: sent, note, tone });
  });
  return out;
}

// What the outside world says: the processor collected two payments and settled them,
// and the bank statement shows the settlement minus whatever was transferred out.
export function reconcile(b: Balances, sent: number) {
  const lines = [
    { label: "Owed by the processor", books: b.receivable, outside: 0 },
    { label: "Bank balance", books: b.bank, outside: ORDER_A + ORDER_B - sent },
    { label: "Paid to the seller", books: sent, outside: FAIR },
    { label: "Still owed to the seller", books: -b.seller, outside: 0 },
    { label: "Books balance (sum of all accounts)", books: sum(b), outside: 0 },
  ].map((l) => ({ ...l, ok: l.books === l.outside }));
  return { lines, ok: lines.every((l) => l.ok) };
}

// Rounding: a 10% fee on €19.99 in floating point vs integer cents.
export function rounding() {
  const price = 19.99;
  const feeFloat = price * FEE_RATE;
  const sellerFloat = price - feeFloat;
  const cents = 1999;
  const fee = Math.round(cents * FEE_RATE);
  const seller = cents - fee;
  // a thousand such orders added up in floats
  let total = 0;
  for (let i = 0; i < 1000; i++) total += feeFloat;
  return { feeFloat, sellerFloat, fee, seller, cents, thousandFloat: total, thousandCents: fee * 1000 };
}
