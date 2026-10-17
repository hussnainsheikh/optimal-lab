"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DEPARTMENTS, EMPLOYEES, FILTERS, JOIN_TYPES, frames, sqlFor, type Filter, type JoinType } from "@/lib/sqlJoins";

const ACCENT = "var(--db)";
const label = "font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]";

export default function SqlJoinsDemo() {
  const [type, setType] = useState<JoinType>("left");
  const [filter, setFilter] = useState<Filter>("none");
  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="How joins work"
        blurb="Five employees, three departments. Dev has no department and Eli's points at one that doesn't exist. Pick a join type and step through it one employee at a time to see which rows come out, and where NULLs appear."
      />
      <div className="mt-6">
        <Run key={`${type}-${filter}`} type={type} setType={setType} filter={filter} setFilter={setFilter} />
      </div>
    </SessionPage>
  );
}

function Run({ type, setType, filter, setFilter }: { type: JoinType; setType: (t: JoinType) => void; filter: Filter; setFilter: (f: Filter) => void }) {
  const all = frames(type, filter);
  const playback = usePlayback(all.length, 1300);
  const f = all[playback.i];
  const scanning = f.phase === "scan";
  const matched = scanning && f.hits.length > 0;

  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Two tables and the join result">
          <pre className="whitespace-pre-wrap break-words rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{sqlFor(type, filter)}</pre>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <p className={label}>employees e</p>
              <ul className="mt-1 space-y-1 font-mono text-xs">
                {EMPLOYEES.map((e, i) => (
                  <li
                    key={e.id}
                    className="rounded px-2 py-1"
                    style={{
                      background: "var(--inset)",
                      outline: f.left === i ? `2px solid ${f.hits.length ? "var(--good)" : "var(--bad)"}` : undefined,
                      opacity: f.left !== null && i > f.left ? 0.5 : 1,
                    }}
                  >
                    {e.name} · dept {e.deptId ?? <span className="text-[var(--faint)]">NULL</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              <p className={label}>departments d</p>
              <ul className="mt-1 space-y-1 font-mono text-xs">
                {DEPARTMENTS.map((d, i) => {
                  const unmatched = f.phase !== "scan" && !f.rows.some((r) => r.kind === "match" && r.d?.id === d.id);
                  return (
                    <li
                      key={d.id}
                      className="rounded px-2 py-1"
                      style={{
                        background: "var(--inset)",
                        outline: f.hits.includes(i) ? "2px solid var(--good)" : f.phase === "right" && unmatched ? `2px solid ${ACCENT}` : undefined,
                      }}
                    >
                      {d.id} · {d.name}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <p className={`mt-4 ${label}`}>Result so far</p>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full font-mono text-xs">
              <thead>
                <tr className="text-left text-[var(--faint)]">
                  <th className="py-1 pr-2 font-normal">e.name</th>
                  <th className="pr-2 font-normal">d.name</th>
                  <th className="pr-2 text-right font-normal">why</th>
                </tr>
              </thead>
              <tbody>
                {f.rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-1 text-[var(--faint)]">
                      no rows yet
                    </td>
                  </tr>
                )}
                {f.rows.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--line)]" style={{ opacity: r.filtered ? 0.35 : 1, textDecoration: r.filtered ? "line-through" : undefined }}>
                    <td className="py-1 pr-2">{r.e ? r.e.name : <span className="text-[var(--faint)]">NULL</span>}</td>
                    <td className="pr-2">{r.d ? r.d.name : <span className="text-[var(--faint)]">NULL</span>}</td>
                    <td className="pr-2 text-right text-[var(--muted)]">{r.kind === "match" ? "match" : r.kind === "left-only" ? "left only" : "right only"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="Join type" accent={ACCENT} value={type} onChange={setType} options={JOIN_TYPES.map((j) => ({ id: j.id, label: j.label }))} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next row" status={`${f.rows.filter((r) => !r.filtered).length} rows`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Match each left row on the ON condition" what="Every employee is checked against every department. Each pair where e.dept_id = d.id becomes one output row." accent={ACCENT} active={matched}>
            <p className="text-sm text-[var(--muted)]">Ana and Caz both match Sales, so Sales appears twice. A join can repeat rows from either side.</p>
          </FlowStep>
          <FlowArrow label="matched pairs" accent={ACCENT} />
          <FlowStep n={2} title="Keep or drop unmatched left rows" what="An employee with no match is dropped by INNER and RIGHT. LEFT and FULL keep it and put NULL in every department column." accent={ACCENT} active={scanning && !matched}>
            <p className="text-sm text-[var(--muted)]">Dev&apos;s dept_id is NULL. NULL = 10 is not true, so Dev never matches anything.</p>
          </FlowStep>
          <FlowArrow label="left side done" accent={ACCENT} />
          <FlowStep n={3} title="Add unmatched right rows" what="RIGHT and FULL then add every department nobody matched, with NULL in the employee columns." accent={ACCENT} active={f.phase === "right"}>
            <p className="text-sm text-[var(--muted)]">Legal has no employees. Only RIGHT and FULL show it.</p>
          </FlowStep>
          <FlowArrow label="joined rows" accent={ACCENT} />
          <FlowStep n={4} title="Filter the joined rows with WHERE" what="WHERE runs after the join. A condition placed in ON instead decides what counts as a match, so outer rows survive." accent={ACCENT} active={f.phase === "where" || f.phase === "done"}>
            <Choices label="Filter" accent={ACCENT} value={filter} onChange={setFilter} options={FILTERS} />
          </FlowStep>
        </>
      }
    />
  );
}
