// One slow query, fixed one change at a time. orders has 5,000,000 rows in 64,103 pages
// (78 rows per 8 KB page), 200 stores and 500 days of history, so one store sells about
// 25,000 orders in total and 50 on one day. Orders from different stores are interleaved,
// so one store's rows sit on about 25,000 different pages.
//
// Buffers are pages touched (EXPLAIN (ANALYZE, BUFFERS)). Times are for a warm cache and
// are rounded; the buffer counts are the part to trust.

export type Level = 0 | 1 | 2 | 3 | 4;

export type Version = {
  level: Level;
  label: string;
  change: string;
  ddl?: string;
  sql: string;
  plan: string;
  buffers: number;
  ms: number;
  indexes: number;
  note: string;
};

const SLOW_SQL = "SELECT count(*), sum(total)\nFROM orders\nWHERE store_id = 7\n  AND date(created_at) = '2026-10-16';";
const FAST_SQL = "SELECT count(*), sum(total)\nFROM orders\nWHERE store_id = 7\n  AND created_at >= '2026-10-16'\n  AND created_at <  '2026-10-17';";

export const VERSIONS: Version[] = [
  {
    level: 0,
    label: "As written",
    change: "Measure first",
    sql: SLOW_SQL,
    plan: "Seq Scan on orders\n  Filter: (store_id = 7 AND date(created_at) = '2026-10-16')\n  Rows Removed by Filter: 4,999,950\n  Buffers: shared hit=64,103",
    buffers: 64_103,
    ms: 410,
    indexes: 1,
    note: "Every page of the table is read to return 50 rows. 4,999,950 rows are read and thrown away.",
  },
  {
    level: 1,
    label: "+ index on store_id",
    change: "Index the filter column",
    ddl: "CREATE INDEX ON orders (store_id);",
    sql: SLOW_SQL,
    plan: "Bitmap Heap Scan on orders\n  Recheck Cond: (store_id = 7)\n  Filter: (date(created_at) = '2026-10-16')\n  Rows Removed by Filter: 24,950\n  Buffers: shared hit=25,070\n  -> Bitmap Index Scan on orders_store_id_idx\n       Index Cond: (store_id = 7)",
    buffers: 25_070,
    ms: 38,
    indexes: 2,
    note: "The index finds store 7's 25,000 rows, but they sit on 25,000 different pages. The date test still runs on every one.",
  },
  {
    level: 2,
    label: "+ created_at in the index",
    change: "Add the second column",
    ddl: "CREATE INDEX ON orders (store_id, created_at);",
    sql: SLOW_SQL,
    plan: "Index Scan using orders_store_id_created_at_idx on orders\n  Index Cond: (store_id = 7)\n  Filter: (date(created_at) = '2026-10-16')\n  Rows Removed by Filter: 24,950\n  Buffers: shared hit=25,100",
    buffers: 25_100,
    ms: 36,
    indexes: 3,
    note: "No better. date(created_at) is a new value computed per row, and the index stores created_at, not date(created_at). Only store_id can use it.",
  },
  {
    level: 3,
    label: "+ rewrite the date test",
    change: "Rewrite the predicate",
    sql: FAST_SQL,
    plan: "Index Scan using orders_store_id_created_at_idx on orders\n  Index Cond: (store_id = 7 AND created_at >= '2026-10-16'\n              AND created_at < '2026-10-17')\n  Buffers: shared hit=53",
    buffers: 53,
    ms: 0.15,
    indexes: 3,
    note: "A plain range on created_at matches the index order. It jumps straight to store 7, Oct 16, and reads 50 rows from 50 pages plus 3 index pages.",
  },
  {
    level: 4,
    label: "+ INCLUDE (total)",
    change: "Cover the query",
    ddl: "CREATE INDEX ON orders (store_id, created_at) INCLUDE (total);",
    sql: FAST_SQL,
    plan: "Index Only Scan using orders_store_id_created_at_total_idx on orders\n  Index Cond: (store_id = 7 AND created_at >= '2026-10-16'\n              AND created_at < '2026-10-17')\n  Heap Fetches: 0\n  Buffers: shared hit=3",
    buffers: 3,
    ms: 0.05,
    indexes: 4,
    note: "total is now stored in the index too, so the table is never touched. 3 pages instead of 64,103.",
  },
];

/** What the reader should have learned at the end: keep only the indexes the final query uses. */
export const CLEANUP = "DROP INDEX orders_store_id_idx;\nDROP INDEX orders_store_id_created_at_idx;";
