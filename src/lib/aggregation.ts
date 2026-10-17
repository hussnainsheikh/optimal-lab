// GROUP BY in the order the database runs it: WHERE, then GROUP BY, then the
// aggregate per group, then HAVING. Eight orders, small enough to check by hand.

export type Row = { id: number; region: string; product: string; amount: number };

export const ROWS: Row[] = [
  { id: 1, region: "North", product: "Pens", amount: 12 },
  { id: 2, region: "North", product: "Paper", amount: 30 },
  { id: 3, region: "South", product: "Pens", amount: 25 },
  { id: 4, region: "South", product: "Pens", amount: 8 },
  { id: 5, region: "East", product: "Paper", amount: 40 },
  { id: 6, region: "North", product: "Pens", amount: 18 },
  { id: 7, region: "South", product: "Paper", amount: 22 },
  { id: 8, region: "East", product: "Pens", amount: 5 },
];

export type GroupBy = "region" | "product" | "both";
export type Agg = "count" | "sum" | "avg" | "max";

export const GROUP_BYS: { id: GroupBy; label: string; sql: string }[] = [
  { id: "region", label: "region", sql: "region" },
  { id: "product", label: "product", sql: "product" },
  { id: "both", label: "region, product", sql: "region, product" },
];

export const AGGS: { id: Agg; label: string; sql: string }[] = [
  { id: "count", label: "COUNT(*)", sql: "COUNT(*)" },
  { id: "sum", label: "SUM", sql: "SUM(amount)" },
  { id: "avg", label: "AVG", sql: "AVG(amount)" },
  { id: "max", label: "MAX", sql: "MAX(amount)" },
];

export const WHERE_MIN = 10;

export type Group = { key: string; rows: Row[]; value: number; kept: boolean };

export type Query = { groupBy: GroupBy; agg: Agg; where: boolean; having: number };

export function keyOf(r: Row, g: GroupBy) {
  return g === "region" ? r.region : g === "product" ? r.product : `${r.region} · ${r.product}`;
}

export function aggregate(rows: Row[], agg: Agg) {
  const amounts = rows.map((r) => r.amount);
  if (agg === "count") return rows.length;
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (agg === "sum") return sum;
  if (agg === "avg") return Math.round((sum / rows.length) * 100) / 100;
  return Math.max(...amounts);
}

export function passesWhere(r: Row, where: boolean) {
  return !where || r.amount >= WHERE_MIN;
}

export function run(q: Query) {
  const input = ROWS.filter((r) => passesWhere(r, q.where));
  const map = new Map<string, Row[]>();
  for (const r of input) {
    const k = keyOf(r, q.groupBy);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  const groups: Group[] = [...map.entries()].map(([key, rows]) => {
    const value = aggregate(rows, q.agg);
    return { key, rows, value, kept: value > q.having };
  });
  return { input, groups, out: groups.filter((g) => g.kept) };
}

export function sqlFor(q: Query) {
  const g = GROUP_BYS.find((x) => x.id === q.groupBy)!.sql;
  const a = AGGS.find((x) => x.id === q.agg)!.sql;
  return [
    `SELECT ${g}, ${a}`,
    "FROM orders",
    q.where ? `WHERE amount >= ${WHERE_MIN}` : null,
    `GROUP BY ${g}`,
    q.having > 0 ? `HAVING ${a} > ${q.having}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Largest useful HAVING threshold for each aggregate, for the slider. */
export const HAVING_MAX: Record<Agg, number> = { count: 4, sum: 60, avg: 40, max: 40 };
