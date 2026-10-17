// One small enrolment sheet taken from unnormalized form to 3NF, one rule at a time.
// Every number below (copies, rows touched) is counted from the tables in this file.

export type Stage = "unf" | "1nf" | "2nf" | "3nf";
export type Change = "move" | "rename" | "add" | "drop";

export type Table = { name: string; cols: string[]; key: string[]; rows: string[][] };

export const STAGES: { id: Stage; label: string }[] = [
  { id: "unf", label: "Raw sheet" },
  { id: "1nf", label: "1NF" },
  { id: "2nf", label: "2NF" },
  { id: "3nf", label: "3NF" },
];

export const CHANGES: { id: Change; label: string }[] = [
  { id: "move", label: "CS moves to Hopper Hall" },
  { id: "rename", label: "Rename Databases" },
  { id: "add", label: "Add a course with no students" },
  { id: "drop", label: "Bo drops DB101" },
];

const ONE_NF: Table = {
  name: "enrolments",
  cols: ["student_id", "student", "dept", "building", "course_id", "title", "grade"],
  key: ["student_id", "course_id"],
  rows: [
    ["1", "Ada", "CS", "Turing Hall", "DB101", "Databases", "A"],
    ["1", "Ada", "CS", "Turing Hall", "OS201", "Operating systems", "B"],
    ["2", "Bo", "CS", "Turing Hall", "DB101", "Databases", "B"],
    ["3", "Cy", "Math", "Euler Hall", "ST110", "Statistics", "A"],
    ["3", "Cy", "Math", "Euler Hall", "DB101", "Databases", "C"],
  ],
};

export const TABLES: Record<Stage, Table[]> = {
  unf: [
    {
      name: "enrolments",
      cols: ["student_id", "student", "dept", "building", "courses"],
      key: ["student_id"],
      rows: [
        ["1", "Ada", "CS", "Turing Hall", "DB101 Databases A; OS201 Operating systems B"],
        ["2", "Bo", "CS", "Turing Hall", "DB101 Databases B"],
        ["3", "Cy", "Math", "Euler Hall", "ST110 Statistics A; DB101 Databases C"],
      ],
    },
  ],
  "1nf": [ONE_NF],
  "2nf": [
    {
      name: "students",
      cols: ["student_id", "student", "dept", "building"],
      key: ["student_id"],
      rows: [
        ["1", "Ada", "CS", "Turing Hall"],
        ["2", "Bo", "CS", "Turing Hall"],
        ["3", "Cy", "Math", "Euler Hall"],
      ],
    },
    {
      name: "courses",
      cols: ["course_id", "title"],
      key: ["course_id"],
      rows: [
        ["DB101", "Databases"],
        ["OS201", "Operating systems"],
        ["ST110", "Statistics"],
      ],
    },
    {
      name: "enrolments",
      cols: ["student_id", "course_id", "grade"],
      key: ["student_id", "course_id"],
      rows: [
        ["1", "DB101", "A"],
        ["1", "OS201", "B"],
        ["2", "DB101", "B"],
        ["3", "ST110", "A"],
        ["3", "DB101", "C"],
      ],
    },
  ],
  "3nf": [
    {
      name: "students",
      cols: ["student_id", "student", "dept"],
      key: ["student_id"],
      rows: [
        ["1", "Ada", "CS"],
        ["2", "Bo", "CS"],
        ["3", "Cy", "Math"],
      ],
    },
    {
      name: "departments",
      cols: ["dept", "building"],
      key: ["dept"],
      rows: [
        ["CS", "Turing Hall"],
        ["Math", "Euler Hall"],
      ],
    },
    {
      name: "courses",
      cols: ["course_id", "title"],
      key: ["course_id"],
      rows: [
        ["DB101", "Databases"],
        ["OS201", "Operating systems"],
        ["ST110", "Statistics"],
      ],
    },
    {
      name: "enrolments",
      cols: ["student_id", "course_id", "grade"],
      key: ["student_id", "course_id"],
      rows: [
        ["1", "DB101", "A"],
        ["1", "OS201", "B"],
        ["2", "DB101", "B"],
        ["3", "ST110", "A"],
        ["3", "DB101", "C"],
      ],
    },
  ],
};

export type Effect = {
  /** Cells to highlight, as "table:row:col". */
  cells: string[];
  /** Rows to highlight whole, as "table:row". */
  rows: string[];
  ok: boolean;
  text: string;
};

const MATCH: Partial<Record<Change, string>> = { move: "Turing Hall", rename: "Databases" };

function cellsContaining(stage: Stage, needle: string) {
  const out: string[] = [];
  TABLES[stage].forEach((t) => t.rows.forEach((r, ri) => r.forEach((v, ci) => v.includes(needle) && out.push(`${t.name}:${ri}:${ci}`))));
  return out;
}

/** Rows that must be written to apply the change. */
function rowsTouched(cells: string[]) {
  return new Set(cells.map((c) => c.split(":").slice(0, 2).join(":"))).size;
}

export function effect(stage: Stage, change: Change): Effect {
  if (change === "move" || change === "rename") {
    const cells = cellsContaining(stage, MATCH[change]!);
    const n = rowsTouched(cells);
    const what = change === "move" ? "“Turing Hall”" : "“Databases”";
    const ok = n === 1;
    return {
      cells,
      rows: [],
      ok,
      text: ok
        ? `${what} is stored once. One row changes and nothing can disagree.`
        : `${what} is stored ${cells.length} times across ${n} rows. Every copy must change in one go, or the data contradicts itself (an update anomaly).`,
    };
  }
  if (change === "add") {
    if (stage === "unf" || stage === "1nf")
      return {
        cells: [],
        rows: [],
        ok: false,
        text:
          stage === "unf"
            ? "Courses only exist inside a student's list. A course nobody takes has nowhere to go (an insert anomaly)."
            : "The key is (student_id, course_id) and a key can't be NULL. A course with no student can't be stored (an insert anomaly).",
      };
    return { cells: [], rows: [], ok: true, text: "INSERT INTO courses VALUES ('GR300', 'Graphs'). One row, no student needed." };
  }
  // drop: Bo leaves DB101, his only course
  if (stage === "unf")
    return { cells: ["enrolments:1:4"], rows: [], ok: false, text: "Bo's course list becomes empty. The row survives, but a blank list is easy to lose or misread." };
  if (stage === "1nf")
    return {
      cells: [],
      rows: ["enrolments:2"],
      ok: false,
      text: "Deleting Bo's only enrolment row also deletes the only record of Bo, his name and his department (a delete anomaly).",
    };
  const idx = TABLES[stage].find((t) => t.name === "enrolments")!.rows.findIndex((r) => r[0] === "2" && r[1] === "DB101");
  return { cells: [], rows: [`enrolments:${idx}`], ok: true, text: "One enrolment row goes. Bo is still in students." };
}

export function cellCount(stage: Stage) {
  return TABLES[stage].reduce((n, t) => n + t.rows.length * t.cols.length, 0);
}
