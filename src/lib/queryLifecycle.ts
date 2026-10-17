// What a database does with one SQL string: parse, analyze, plan, execute, return.
// Plans and costs follow PostgreSQL's default cost settings for a 100,000-row users
// table stored in 1,000 pages (seq_page_cost 1, cpu_tuple_cost 0.01, cpu_operator_cost 0.0025).

export type QueryId = "by-id" | "by-country" | "typo" | "bad-column";

export const STEPS = ["send", "parse", "analyze", "plan", "execute", "return"] as const;
export type StepId = (typeof STEPS)[number];

export type QueryCase = {
  id: QueryId;
  label: string;
  sql: string;
  /** Index of the step that raises an error, if any. */
  failsAt?: number;
  error?: string;
  tokens: string[];
  tree: string;
  resolved: string;
  plan: string;
  execute: string;
  rows: number;
};

const TABLE_ROWS = 100_000;
const TABLE_PAGES = 1_000;
// Seq scan with one filter: pages × 1 + rows × (0.01 + 0.0025)
export const SEQ_COST = TABLE_PAGES * 1 + TABLE_ROWS * 0.01 + TABLE_ROWS * 0.0025; // 2,250

export const QUERIES: QueryCase[] = [
  {
    id: "by-id",
    label: "WHERE id = 42",
    sql: "SELECT name FROM users WHERE id = 42;",
    tokens: ["SELECT", "name", "FROM", "users", "WHERE", "id", "=", "42", ";"],
    tree: "SelectStmt → target: name · from: users · where: id = 42",
    resolved: "users is table 16384 · name is text · id is integer · = is int4eq",
    plan: "Index Scan using users_pkey on users  (cost=0.29..8.31 rows=1)",
    execute: "Read 2 index pages and 1 table page. 1 row matches.",
    rows: 1,
  },
  {
    id: "by-country",
    label: "WHERE country = 'NZ'",
    sql: "SELECT name FROM users WHERE country = 'NZ';",
    tokens: ["SELECT", "name", "FROM", "users", "WHERE", "country", "=", "'NZ'", ";"],
    tree: "SelectStmt → target: name · from: users · where: country = 'NZ'",
    resolved: "users is table 16384 · country is text · no index on country",
    plan: `Seq Scan on users  (cost=0.00..${SEQ_COST.toFixed(2)} rows=1250)\n  Filter: (country = 'NZ')`,
    execute: "Read all 1,000 pages, test 100,000 rows. 1,250 match.",
    rows: 1250,
  },
  {
    id: "typo",
    label: "SELEC (typo)",
    sql: "SELEC name FROM users WHERE id = 42;",
    failsAt: 1,
    error: 'ERROR:  syntax error at or near "SELEC"\nLINE 1: SELEC name FROM users WHERE id = 42;\n        ^',
    tokens: ["SELEC", "name", "FROM", "…"],
    tree: "No statement starts with SELEC. Parsing stops.",
    resolved: "",
    plan: "",
    execute: "",
    rows: 0,
  },
  {
    id: "bad-column",
    label: "nmae (no such column)",
    sql: "SELECT nmae FROM users WHERE id = 42;",
    failsAt: 2,
    error: 'ERROR:  column "nmae" does not exist\nLINE 1: SELECT nmae FROM users WHERE id = 42;\n               ^',
    tokens: ["SELECT", "nmae", "FROM", "users", "WHERE", "id", "=", "42", ";"],
    tree: "SelectStmt → target: nmae · from: users · where: id = 42",
    resolved: "users has no column nmae. The grammar was fine; the names are not.",
    plan: "",
    execute: "",
    rows: 0,
  },
];

/** The steps a run goes through, as indexes into STEPS. */
export function path(q: QueryCase, prepared: boolean): number[] {
  if (q.failsAt !== undefined) return Array.from({ length: q.failsAt + 1 }, (_, i) => i);
  // A prepared statement was parsed, analyzed and planned once; later runs reuse the plan.
  return prepared ? [0, 4, 5] : [0, 1, 2, 3, 4, 5];
}
