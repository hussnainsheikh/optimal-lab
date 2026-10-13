// An orders table with 12 months of data, 10M rows a month, optionally partitioned by month.
export const MONTHS = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
export const PER = 10_000_000;
export type Q = "recent" | "customer" | "drop";
export const QUERIES: { id: Q; label: string; sql: string }[] = [
  { id: "recent", label: "Last 7 days", sql: "SELECT … WHERE created_at > now() - interval '7 days'" },
  { id: "customer", label: "One customer's orders", sql: "SELECT … WHERE customer_id = 42" },
  { id: "drop", label: "Delete data older than a year", sql: "retention: remove November" },
];
export function plan(q: Q, partitioned: boolean) {
  if (q === "recent") return partitioned
    ? { touched: [11], rows: PER, note: "Partition pruning: only October can contain the last 7 days, so 11 partitions are skipped without being read.", cost: "fast" }
    : { touched: MONTHS.map((_, i) => i), rows: PER * 12, note: "Without an index on created_at, every row is scanned. With one, it's fine, but the index itself covers 120M rows.", cost: "slow" };
  if (q === "customer") return { touched: MONTHS.map((_, i) => i), rows: PER * 12, note: partitioned ? "customer_id isn't the partition key, so every partition must be checked (each via its own index). Partitioning doesn't help, and can hurt, queries that ignore the key." : "One index lookup on customer_id.", cost: partitioned ? "slower" : "fast" };
  return partitioned
    ? { touched: [0], rows: 0, note: "DROP TABLE orders_nov (or DETACH PARTITION): instant, no row-by-row deletes, no bloat.", cost: "instant" }
    : { touched: [0], rows: PER, note: "DELETE … WHERE created_at < '2025-12-01' rewrites 10M rows: hours of I/O, locks, a huge WAL spike, then vacuum.", cost: "hours" };
}
