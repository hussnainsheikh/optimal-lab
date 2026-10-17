"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CHANGES, STAGES, TABLES, cellCount, effect, type Change, type Stage } from "@/lib/normalForms";

const ACCENT = "var(--db)";
const ORDER: Stage[] = ["unf", "1nf", "2nf", "3nf"];
// Joins needed to list each enrolment with the student's name, course title and building.
const JOINS: Record<Stage, number> = { unf: 0, "1nf": 0, "2nf": 2, "3nf": 3 };

export default function NormalFormsDemo() {
  const [stage, setStage] = useState<Stage>("1nf");
  const [change, setChange] = useState<Change>("move");
  const fx = effect(stage, change);
  const cells = new Set(fx.cells);
  const rows = new Set(fx.rows);
  const tone = fx.ok ? "var(--good)" : "var(--bad)";
  const at = ORDER.indexOf(stage);

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Normal forms"
        blurb="A sheet of students and their courses, taken from raw to third normal form. Each step moves columns into their own table so each fact is stored once. Try a change at each stage and count how many rows it has to touch."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The tables at this stage">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
                {STAGES[at].label} · {TABLES[stage].length} {TABLES[stage].length === 1 ? "table" : "tables"} · {cellCount(stage)} cells · key columns underlined
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {TABLES[stage].map((t) => (
                  <div key={t.name} className={`min-w-0 ${t.cols.length > 4 ? "sm:col-span-2" : ""}`}>
                    <p className="font-mono text-xs" style={{ color: ACCENT }}>
                      {t.name}
                    </p>
                    <div className="mt-1 overflow-x-auto rounded-md bg-[var(--inset)] p-1.5">
                      <table className="w-full font-mono text-[11px]">
                        <thead>
                          <tr className="text-left text-[var(--faint)]">
                            {t.cols.map((c) => (
                              <th key={c} className={`pr-2 pb-1 font-normal ${t.key.includes(c) ? "underline underline-offset-2" : ""}`}>
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {t.rows.map((r, ri) => {
                            const rowHot = rows.has(`${t.name}:${ri}`);
                            return (
                              <tr key={ri} className="border-t border-[var(--line)] align-top" style={rowHot ? { outline: `2px solid ${tone}`, outlineOffset: -2 } : undefined}>
                                {r.map((v, ci) => (
                                  <td
                                    key={ci}
                                    className="py-0.5 pr-2"
                                    style={cells.has(`${t.name}:${ri}:${ci}`) ? { color: tone, fontWeight: 700, background: `color-mix(in srgb, ${tone} 14%, transparent)` } : undefined}
                                  >
                                    {v}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={<span style={{ color: tone }}>{fx.text}</span>}>
              <Choices label="Stage" accent={ACCENT} value={stage} onChange={setStage} options={STAGES} />
              <Choices label="Try a change" accent={ACCENT} value={change} onChange={setChange} options={CHANGES} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Start from the raw sheet" what="One row per student, with all their courses packed into one cell. The database can't index or join on part of a cell." accent={ACCENT} active={stage === "unf"}>
                <p className="font-mono text-xs">courses = &apos;DB101 Databases A; OS201 …&apos;</p>
              </FlowStep>
              <FlowArrow label="one value per cell" accent={ACCENT} />
              <FlowStep n={2} title="Split lists into rows (1NF)" what="First normal form: every cell holds one value. Now each row is one student in one course, and the key is the pair (student_id, course_id)." accent={ACCENT} active={stage === "1nf"}>
                <p className="text-sm text-[var(--muted)]">The price: Ada&apos;s name, department and building now repeat on each of her rows.</p>
              </FlowStep>
              <FlowArrow label="columns that need half the key" accent={ACCENT} />
              <FlowStep n={3} title="Move columns that depend on part of the key (2NF)" what="A student's name depends only on student_id, a course title only on course_id. Each moves to its own table, keyed by the column it depends on." accent={ACCENT} active={stage === "2nf"}>
                <p className="text-sm text-[var(--muted)]">Only the grade needs both ids, so only it stays in enrolments.</p>
              </FlowStep>
              <FlowArrow label="columns that depend on a non-key column" accent={ACCENT} />
              <FlowStep n={4} title="Move columns that depend on another column (3NF)" what="The building depends on the department, not on the student. Move it to a departments table so each building is written once." accent={ACCENT} active={stage === "3nf"}>
                <p className="text-sm text-[var(--muted)]">Rule of thumb: every column depends on the key, the whole key, and nothing but the key.</p>
              </FlowStep>
              <FlowArrow label="fewer copies, more joins" accent={ACCENT} />
              <FlowStep n={5} title="Stop when reads get too costly" what="Each split adds a join to read the data back. 3NF is the usual stopping point. Copy data back on purpose only when a measured read is too slow." accent={ACCENT}>
                <p className="text-sm">
                  Joins to list grades with student, title and building at this stage: <span className="font-mono" style={{ color: ACCENT }}>{JOINS[stage]}</span>
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
