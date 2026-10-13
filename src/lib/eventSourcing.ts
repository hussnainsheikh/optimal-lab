// An account stored as an append-only list of events. State is a fold over them.
export const EVENTS = [
  { type: "AccountOpened", data: "owner: Ada", amount: 0, at: "Mar 1" },
  { type: "MoneyDeposited", data: "+100", amount: 100, at: "Mar 2" },
  { type: "MoneyWithdrawn", data: "−30", amount: -30, at: "Mar 5" },
  { type: "MoneyDeposited", data: "+250", amount: 250, at: "Mar 9" },
  { type: "MoneyWithdrawn", data: "−80", amount: -80, at: "Mar 12" },
  { type: "AddressChanged", data: "Lahore", amount: 0, at: "Mar 15" },
  { type: "MoneyWithdrawn", data: "−40", amount: -40, at: "Mar 20" },
];
export function project(upto: number) {
  const evs = EVENTS.slice(0, upto + 1);
  const balance = evs.reduce((a, e) => a + e.amount, 0);
  const deposits = evs.filter((e) => e.amount > 0).length;
  const withdrawals = evs.filter((e) => e.amount < 0).reduce((a, e) => a - e.amount, 0);
  const address = [...evs].reverse().find((e) => e.type === "AddressChanged")?.data ?? "Karachi";
  return { balance, deposits, withdrawals, address };
}
