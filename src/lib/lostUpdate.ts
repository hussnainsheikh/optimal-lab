// The lost update. Two transactions read the same balance, add to it in the app, and write it
// back. The second write erases the first. Four ways to run it.

export type Strategy = "naive" | "for-update" | "serializable" | "atomic";
export type LuFrame = { who: "T1" | "T2" | "db"; text: string; balance: number; error?: boolean };

export const STRATEGIES: { id: Strategy; label: string; sql: string }[] = [
  { id: "naive", label: "Read, then write", sql: "SELECT balance …; UPDATE … SET balance = :new" },
  { id: "for-update", label: "SELECT … FOR UPDATE", sql: "SELECT balance … FOR UPDATE; UPDATE …" },
  { id: "serializable", label: "SERIALIZABLE", sql: "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE" },
  { id: "atomic", label: "Atomic update", sql: "UPDATE accounts SET balance = balance + :amount" },
];

export function runLostUpdate(s: Strategy): LuFrame[] {
  const f: LuFrame[] = [];
  let b = 100;
  const p = (who: LuFrame["who"], text: string, error = false) => f.push({ who, text, balance: b, error });
  p("db", "balance = 100. T1 adds 30, T2 adds 50. It should end at 180.");
  if (s === "naive") {
    p("T1", "reads 100");
    p("T2", "reads 100");
    b = 130;
    p("T1", "writes 100 + 30 = 130, commits");
    b = 150;
    p("T2", "writes 100 + 50 = 150, commits", true);
    p("db", "Final 150: T1's +30 is gone.", true);
  } else if (s === "for-update") {
    p("T1", "reads 100 and locks the row");
    p("T2", "tries to read FOR UPDATE: waits for T1's lock");
    b = 130;
    p("T1", "writes 130, commits, releases the lock");
    p("T2", "now reads 130");
    b = 180;
    p("T2", "writes 130 + 50 = 180, commits");
    p("db", "Final 180. T2 waited instead of overwriting.");
  } else if (s === "serializable") {
    p("T1", "reads 100");
    p("T2", "reads 100");
    b = 130;
    p("T1", "writes 130, commits");
    p("T2", "writes 150: rejected, could not serialize access", true);
    p("T2", "retries the whole transaction: reads 130");
    b = 180;
    p("T2", "writes 180, commits");
    p("db", "Final 180. The database caught the conflict; the app had to retry.");
  } else {
    b = 130;
    p("T1", "UPDATE balance = balance + 30: the database reads and writes in one step");
    b = 180;
    p("T2", "UPDATE balance = balance + 50: waits for T1's row lock, then adds to 130");
    p("db", "Final 180, with no read in the application at all.");
  }
  return f;
}
