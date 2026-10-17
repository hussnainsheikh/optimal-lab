// Join semantics: which rows come out of INNER, LEFT, RIGHT and FULL joins.
// employees e JOIN departments d ON e.dept_id = d.id, walked one left row at a time.

export type Employee = { id: number; name: string; deptId: number | null };
export type Department = { id: number; name: string };

export const EMPLOYEES: Employee[] = [
  { id: 1, name: "Ana", deptId: 10 },
  { id: 2, name: "Ben", deptId: 20 },
  { id: 3, name: "Caz", deptId: 10 },
  { id: 4, name: "Dev", deptId: null },
  { id: 5, name: "Eli", deptId: 40 },
];

export const DEPARTMENTS: Department[] = [
  { id: 10, name: "Sales" },
  { id: 20, name: "Support" },
  { id: 30, name: "Legal" },
];

export type JoinType = "inner" | "left" | "right" | "full";
export const JOIN_TYPES: { id: JoinType; label: string; sql: string }[] = [
  { id: "inner", label: "INNER", sql: "JOIN" },
  { id: "left", label: "LEFT", sql: "LEFT JOIN" },
  { id: "right", label: "RIGHT", sql: "RIGHT JOIN" },
  { id: "full", label: "FULL", sql: "FULL JOIN" },
];

export type Filter = "none" | "anti" | "where-sales" | "on-sales";
export const FILTERS: { id: Filter; label: string }[] = [
  { id: "none", label: "No filter" },
  { id: "anti", label: "WHERE d.id IS NULL" },
  { id: "where-sales", label: "WHERE d.name = 'Sales'" },
  { id: "on-sales", label: "ON … AND d.name = 'Sales'" },
];

export type OutRow = {
  e: Employee | null;
  d: Department | null;
  kind: "match" | "left-only" | "right-only";
  /** Removed by the WHERE clause after the join. */
  filtered: boolean;
};

export type Frame = {
  /** Left row being compared, or null in the later phases. */
  left: number | null;
  /** Department indexes that matched the current left row. */
  hits: number[];
  phase: "scan" | "right" | "where" | "done";
  rows: OutRow[];
  text: string;
};

const keepLeft = (t: JoinType) => t === "left" || t === "full";
const keepRight = (t: JoinType) => t === "right" || t === "full";

export function sqlFor(t: JoinType, f: Filter) {
  const kw = JOIN_TYPES.find((x) => x.id === t)!.sql;
  const on = f === "on-sales" ? "e.dept_id = d.id AND d.name = 'Sales'" : "e.dept_id = d.id";
  const where = f === "anti" ? "\nWHERE d.id IS NULL" : f === "where-sales" ? "\nWHERE d.name = 'Sales'" : "";
  return `SELECT e.name, d.name\nFROM employees e\n${kw} departments d\n  ON ${on}${where};`;
}

export function frames(t: JoinType, f: Filter): Frame[] {
  const on = (e: Employee, d: Department) => e.deptId !== null && e.deptId === d.id && (f !== "on-sales" || d.name === "Sales");
  const rows: OutRow[] = [];
  const used = new Set<number>();
  const out: Frame[] = [];

  EMPLOYEES.forEach((e, li) => {
    const hits: number[] = [];
    DEPARTMENTS.forEach((d, di) => {
      if (on(e, d)) {
        hits.push(di);
        used.add(di);
        rows.push({ e, d, kind: "match", filtered: false });
      }
    });
    let text: string;
    if (hits.length) text = `${e.name} (dept ${e.deptId}) matches ${hits.map((h) => DEPARTMENTS[h].name).join(", ")}: one output row per match.`;
    else {
      const why =
        e.deptId === null
          ? "dept_id is NULL, and NULL never equals anything"
          : DEPARTMENTS.some((d) => d.id === e.deptId)
            ? `dept ${e.deptId} fails the extra ON condition`
            : `no department has id ${e.deptId}`;
      if (keepLeft(t)) {
        rows.push({ e, d: null, kind: "left-only", filtered: false });
        text = `${e.name}: ${why}. ${t.toUpperCase()} keeps the row and fills the department with NULL.`;
      } else text = `${e.name}: ${why}. ${t.toUpperCase()} drops the row.`;
    }
    out.push({ left: li, hits, phase: "scan", rows: rows.map((r) => ({ ...r })), text });
  });

  const unmatched = DEPARTMENTS.filter((_, i) => !used.has(i));
  if (keepRight(t)) unmatched.forEach((d) => rows.push({ e: null, d, kind: "right-only", filtered: false }));
  out.push({
    left: null,
    hits: [],
    phase: "right",
    rows: rows.map((r) => ({ ...r })),
    text: keepRight(t)
      ? unmatched.length
        ? `Departments nobody matched (${unmatched.map((d) => d.name).join(", ")}) are added with NULL for the employee.`
        : "Every department matched, so nothing is added."
      : `${t.toUpperCase()} doesn't keep unmatched departments, so ${unmatched.map((d) => d.name).join(", ")} ${unmatched.length === 1 ? "is" : "are"} left out.`,
  });

  if (f === "anti" || f === "where-sales") {
    rows.forEach((r) => {
      r.filtered = f === "anti" ? r.d !== null : r.d?.name !== "Sales";
    });
    const kept = rows.filter((r) => !r.filtered).length;
    out.push({
      left: null,
      hits: [],
      phase: "where",
      rows: rows.map((r) => ({ ...r })),
      text:
        f === "anti"
          ? `WHERE runs after the join and keeps only rows with no department: ${kept} left. This is an anti-join.`
          : `WHERE runs after the join and keeps only Sales rows: ${kept} left.${keepLeft(t) ? " NULL = 'Sales' is not true, so the padded rows go too and your outer join acts like an inner join." : ""}`,
    });
  }

  const final = rows.filter((r) => !r.filtered).length;
  out.push({ left: null, hits: [], phase: "done", rows: rows.map((r) => ({ ...r })), text: `${final} ${final === 1 ? "row" : "rows"} out.` });
  return out;
}
