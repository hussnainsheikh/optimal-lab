// Window functions over a small sales table.
export const ROWS = [
  { rep: "Ada", month: 1, amount: 300 }, { rep: "Ada", month: 2, amount: 500 }, { rep: "Ada", month: 3, amount: 200 },
  { rep: "Bo", month: 1, amount: 400 }, { rep: "Bo", month: 2, amount: 400 }, { rep: "Bo", month: 3, amount: 700 },
];
export type Fn = "row_number" | "rank" | "running" | "lag";
export const FNS: { id: Fn; label: string; sql: string }[] = [
  { id: "row_number", label: "ROW_NUMBER", sql: "ROW_NUMBER() OVER (PARTITION BY rep ORDER BY amount DESC)" },
  { id: "rank", label: "RANK", sql: "RANK() OVER (PARTITION BY rep ORDER BY amount DESC)" },
  { id: "running", label: "Running SUM", sql: "SUM(amount) OVER (PARTITION BY rep ORDER BY month)" },
  { id: "lag", label: "LAG", sql: "amount - LAG(amount) OVER (PARTITION BY rep ORDER BY month)" },
];

export function compute(fn: Fn) {
  return ROWS.map((r, i) => {
    const part = ROWS.map((x, j) => ({ ...x, j })).filter((x) => x.rep === r.rep);
    let value: string, frame: number[];
    if (fn === "row_number" || fn === "rank") {
      const sorted = [...part].sort((a, b) => b.amount - a.amount || a.month - b.month);
      const pos = sorted.findIndex((x) => x.j === i);
      value = String(fn === "row_number" ? pos + 1 : sorted.findIndex((x) => x.amount === r.amount) + 1);
      frame = part.map((x) => x.j);
    } else if (fn === "running") {
      const upto = part.filter((x) => x.month <= r.month);
      value = String(upto.reduce((a, x) => a + x.amount, 0));
      frame = upto.map((x) => x.j);
    } else {
      const prev = part.find((x) => x.month === r.month - 1);
      value = prev ? (r.amount - prev.amount >= 0 ? "+" : "") + (r.amount - prev.amount) : "NULL";
      frame = prev ? [prev.j, i] : [i];
    }
    return { ...r, value, frame, partition: part.map((x) => x.j) };
  });
}
