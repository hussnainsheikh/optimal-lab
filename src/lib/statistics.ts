// How the planner turns column statistics into a row estimate, and how a bad estimate
// picks the wrong plan. One table of 1,000,000 rows in 10,000 pages, PostgreSQL cost defaults.
//
//   Seq scan cost   = 10,000 pages × 1 + 1,000,000 rows × (0.01 + 0.0025) = 22,500 (any number of matches)
//   Index scan cost ≈ 4 + rows × 4.015   (one random page read, random_page_cost 4, per matching row)
// The two cross at about 5,600 rows: below that the index wins, above it the seq scan does.

export const TABLE_ROWS = 1_000_000;
export const SEQ_COST = 10_000 * 1 + TABLE_ROWS * (0.01 + 0.0025); // 22,500

export function indexCost(rows: number) {
  return Math.round(4 + rows * 4.015);
}

export type Plan = "seq" | "index";

export function costOf(plan: Plan, rows: number) {
  return plan === "seq" ? SEQ_COST : indexCost(rows);
}

export function pick(rows: number): Plan {
  return indexCost(rows) < SEQ_COST ? "index" : "seq";
}

export type Scenario = "stale" | "correlated";

export type Case = {
  id: Scenario;
  label: string;
  sql: string;
  actual: number;
  fixLabel: string;
  fixSql: string;
  before: { stats: string[]; formula: string; estimate: number };
  after: { stats: string[]; formula: string; estimate: number };
};

export const CASES: Case[] = [
  {
    id: "stale",
    label: "Stale statistics",
    sql: "SELECT * FROM orders WHERE status = 'pending';",
    actual: 1_000,
    fixLabel: "Run ANALYZE",
    fixSql: "ANALYZE orders;",
    before: {
      stats: ["Last ANALYZE: when the table was new", "most common values: pending 0.50, shipped 0.50", "rows now: 1,000,000"],
      formula: "1,000,000 × 0.50",
      estimate: 500_000,
    },
    after: {
      stats: ["ANALYZE sampled 30,000 rows", "most common values: shipped 0.999, pending 0.001", "rows now: 1,000,000"],
      formula: "1,000,000 × 0.001",
      estimate: 1_000,
    },
  },
  {
    id: "correlated",
    label: "Correlated columns",
    sql: "SELECT * FROM addresses\nWHERE city = 'Paris' AND country = 'FR';",
    actual: 20_000,
    fixLabel: "CREATE STATISTICS",
    fixSql: "CREATE STATISTICS addr_city_country (dependencies)\n  ON city, country FROM addresses;\nANALYZE addresses;",
    before: {
      stats: ["city = 'Paris': 0.02", "country = 'FR': 0.05", "columns assumed independent"],
      formula: "1,000,000 × 0.02 × 0.05",
      estimate: 1_000,
    },
    after: {
      stats: ["city = 'Paris': 0.02", "country = 'FR': 0.05", "dependency city → country: 1.00"],
      formula: "1,000,000 × 0.02 × 1.00",
      estimate: 20_000,
    },
  },
];

export function outcome(c: Case, fixed: boolean) {
  const est = fixed ? c.after.estimate : c.before.estimate;
  const chosen = pick(est);
  const best = pick(c.actual);
  const real = costOf(chosen, c.actual);
  const ideal = costOf(best, c.actual);
  return { est, chosen, best, real, ideal, slower: real / ideal, off: Math.max(est / c.actual, c.actual / est) };
}
