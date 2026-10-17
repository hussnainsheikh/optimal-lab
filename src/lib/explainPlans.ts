// Two EXPLAIN ANALYZE outputs for the same query, with and without an index on
// orders.customer_id. Costs use PostgreSQL defaults: customers is 10,000 rows in 94 pages,
// orders is 1,000,000 rows in 7,353 pages, and 118 customers live in NZ.
//
//   Seq Scan customers  = 94 + 10,000 × 0.01 + 10,000 × 0.0025         = 219.00
//   Seq Scan orders     = 7,353 + 1,000,000 × 0.01                      = 17,353.00
//   Nested Loop         ≈ 219 + 120 loops × 104.42 + 12,000 × 0.01     ≈ 12,869.40
// Actual rows: 11,874 orders belong to the 118 NZ customers (11,874 / 118 ≈ 100.6 per loop).

export type Variant = "no-index" | "index";
export type Field = "order" | "type" | "cost" | "rows" | "loops";

export const QUERY = "SELECT c.name, o.total\nFROM orders o JOIN customers c ON c.id = o.customer_id\nWHERE c.country = 'NZ';";

export type PlanNode = {
  depth: number;
  type: string;
  detail?: string;
  startup: number;
  total: number;
  rows: number;
  width: number;
  actualStart: number;
  actualEnd: number;
  actualRows: number;
  loops: number;
  extra?: string;
  /** Position in execution order: which node produces rows first. */
  runs: number;
  note: string;
};

export const PLANS: Record<Variant, { nodes: PlanNode[]; time: number; summary: string }> = {
  "no-index": {
    time: 152.9,
    summary: "No index on orders.customer_id, so the planner hashes the 118 NZ customers and streams all 1,000,000 orders past them.",
    nodes: [
      { depth: 0, type: "Hash Join", startup: 220.5, total: 20212.5, rows: 12000, width: 19, actualStart: 2.1, actualEnd: 148.3, actualRows: 11874, loops: 1, extra: "Hash Cond: (o.customer_id = c.id)", runs: 3, note: "Joins the two inputs. It can't return a row until the hash table below is built, so its startup cost includes the Hash." },
      { depth: 1, type: "Seq Scan", detail: "on orders o", startup: 0, total: 17353, rows: 1000000, width: 12, actualStart: 0.01, actualEnd: 62.4, actualRows: 1000000, loops: 1, runs: 2, note: "Reads every one of the 7,353 pages of orders. This is where most of the time goes." },
      { depth: 1, type: "Hash", startup: 219, total: 219, rows: 120, width: 15, actualStart: 2.0, actualEnd: 2.0, actualRows: 118, loops: 1, extra: "Buckets: 1024  Memory Usage: 14kB", runs: 1, note: "Builds an in-memory hash table from its child. Startup equals total: nothing comes out until it is done." },
      { depth: 2, type: "Seq Scan", detail: "on customers c", startup: 0, total: 219, rows: 120, width: 15, actualStart: 0.012, actualEnd: 1.9, actualRows: 118, loops: 1, extra: "Filter: (country = 'NZ')  Rows Removed by Filter: 9882", runs: 0, note: "Runs first. Reads all 10,000 customers and keeps the 118 in NZ. Estimate 120, actual 118: the statistics are good." },
    ],
  },
  index: {
    time: 23.4,
    summary: "With an index on orders.customer_id, the planner loops over the 118 NZ customers and looks up each one's orders.",
    nodes: [
      { depth: 0, type: "Nested Loop", startup: 0.42, total: 12869.4, rows: 12000, width: 19, actualStart: 0.05, actualEnd: 21.7, actualRows: 11874, loops: 1, runs: 2, note: "For each row from the outer child (first), run the inner child (second) once. It returns rows right away, so startup is near 0." },
      { depth: 1, type: "Seq Scan", detail: "on customers c", startup: 0, total: 219, rows: 120, width: 15, actualStart: 0.012, actualEnd: 1.9, actualRows: 118, loops: 1, extra: "Filter: (country = 'NZ')  Rows Removed by Filter: 9882", runs: 0, note: "The outer side. Runs once and feeds 118 customers to the loop." },
      { depth: 1, type: "Index Scan", detail: "using orders_customer_id_idx on orders o", startup: 0.42, total: 104.42, rows: 100, width: 12, actualStart: 0.01, actualEnd: 0.15, actualRows: 101, loops: 118, extra: "Index Cond: (customer_id = c.id)", runs: 1, note: "The inner side. Runs 118 times, once per customer. Time and rows are per loop: 101 rows × 118 loops ≈ 11,900 rows, 0.15 ms × 118 ≈ 17.7 ms." },
    ],
  },
};

export const FIELDS: { id: Field; label: string; title: string; text: string }[] = [
  { id: "order", label: "Order", title: "Read from the inside out", text: "Each indented line is a child of the line above it. Children run first and pass rows up to their parent, so the most indented node starts the work." },
  { id: "type", label: "Node type", title: "Read the node type", text: "Seq Scan reads every page. Index Scan follows an index. Hash, Hash Join, Nested Loop and Sort name what the node does with rows from its children." },
  { id: "cost", label: "cost", title: "Read cost=startup..total", text: "Costs are in planner units, not milliseconds. The first number is the cost before the first row comes out; the second is the cost for all rows. A parent's cost includes its children." },
  { id: "rows", label: "rows", title: "Compare estimated and actual rows", text: "rows= in the cost part is the planner's guess. rows= in the actual part is what happened. A gap of 10× or more means the statistics misled the planner." },
  { id: "loops", label: "loops", title: "Multiply by loops", text: "Actual time and rows are averages per loop. A node inside a nested loop runs once per outer row, so multiply by loops to get its real total." },
];

export function line(n: PlanNode, analyze: boolean) {
  const name = `${n.type}${n.detail ? ` ${n.detail}` : ""}`;
  const cost = `cost=${n.startup.toFixed(2)}..${n.total.toFixed(2)} rows=${n.rows} width=${n.width}`;
  const actual = analyze ? `actual time=${n.actualStart.toFixed(3)}..${n.actualEnd.toFixed(3)} rows=${n.actualRows} loops=${n.loops}` : "";
  return { name, cost, actual };
}

/** Estimated vs actual rows, as a ratio ≥ 1 (how far off the estimate was). */
export function misestimate(n: PlanNode) {
  const a = Math.max(1, n.actualRows), e = Math.max(1, n.rows);
  return Math.max(a / e, e / a);
}
