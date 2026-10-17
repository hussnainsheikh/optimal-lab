"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CASES, SEQ_COST, indexCost, outcome, type Scenario } from "@/lib/statistics";

const ACCENT = "var(--db)";
const n = (v: number) => Math.round(v).toLocaleString();
const PLAN_NAME = { seq: "Seq Scan", index: "Index Scan" } as const;

// Log-log chart geometry.
const W = 320, H = 180, L = 40, R = 10, T = 10, B = 28;
const X0 = 2, X1 = 6; // 100 .. 1,000,000 rows
const Y0 = 3, Y1 = 7; // 1,000 .. 10,000,000 cost units
const x = (rows: number) => L + ((Math.log10(Math.max(rows, 100)) - X0) / (X1 - X0)) * (W - L - R);
const y = (cost: number) => T + (1 - (Math.log10(Math.min(Math.max(cost, 1000), 1e7)) - Y0) / (Y1 - Y0)) * (H - T - B);

export default function StatisticsDemo() {
  const [scenario, setScenario] = useState<Scenario>("stale");
  const [fixed, setFixed] = useState(false);
  const walk = useWalk(5, 1000);
  const c = CASES.find((k) => k.id === scenario)!;
  const o = outcome(c, fixed);
  const s = fixed ? c.after : c.before;
  const at = walk.stage;
  const good = o.chosen === o.best;

  const caption =
    at === null
      ? good
        ? `Estimate ${n(o.est)}, actual ${n(c.actual)}. The planner picked ${PLAN_NAME[o.chosen]}, the right plan.`
        : `Estimate ${n(o.est)}, actual ${n(c.actual)}: off by ${o.off.toFixed(0)}×. The planner picked ${PLAN_NAME[o.chosen]} and runs ${o.slower.toFixed(1)}× slower than it could.`
      : [
          "The planner never reads the table to plan. It reads the statistics ANALYZE saved.",
          `Selectivity × table rows: ${s.formula} = ${n(o.est)} rows.`,
          `At ${n(o.est)} rows, Seq Scan costs ${n(SEQ_COST)} and Index Scan costs ${n(indexCost(o.est))}.`,
          `${PLAN_NAME[o.chosen]} is cheaper on paper, so it runs.`,
          good ? "The real row count agrees with the guess. Good plan." : `${n(c.actual)} rows really match. The other plan would have been ${o.slower.toFixed(1)}× cheaper.`,
        ][at];

  const pts = [100, 1e3, 1e4, 1e5, 1e6];
  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Statistics and bad plans"
        blurb="The planner picks a plan from a guess: how many rows will match? It makes that guess from statistics saved by ANALYZE. When those are stale or miss a pattern, the guess is wrong and so is the plan. Break it, then fix it."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Plan cost against matching rows">
              <pre className="whitespace-pre-wrap break-words rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{c.sql}</pre>
              <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={`Seq scan costs ${n(SEQ_COST)} at any row count. Index scan cost grows with rows. Estimate ${n(o.est)}, actual ${n(c.actual)}.`}>
                {pts.map((p) => (
                  <g key={p}>
                    <line x1={x(p)} x2={x(p)} y1={T} y2={H - B} style={{ stroke: "var(--line)" }} />
                    <text x={x(p)} y={H - B + 12} textAnchor="middle" fontSize="8" style={{ fill: "var(--faint)" }}>
                      {p >= 1e6 ? "1M" : p >= 1e3 ? `${p / 1e3}k` : p}
                    </text>
                  </g>
                ))}
                {[1e3, 1e4, 1e5, 1e6, 1e7].map((v) => (
                  <text key={v} x={L - 4} y={y(v) + 3} textAnchor="end" fontSize="8" style={{ fill: "var(--faint)" }}>
                    {v >= 1e6 ? `${v / 1e6}M` : `${v / 1e3}k`}
                  </text>
                ))}
                <text x={(L + W - R) / 2} y={H - 2} textAnchor="middle" fontSize="8" style={{ fill: "var(--muted)" }}>
                  rows that match (log)
                </text>
                <line x1={x(100)} x2={x(1e6)} y1={y(SEQ_COST)} y2={y(SEQ_COST)} strokeWidth="2" style={{ stroke: "var(--c2)" }} />
                <text x={x(150)} y={y(SEQ_COST) - 4} fontSize="9" style={{ fill: "var(--c2)" }}>
                  Seq Scan
                </text>
                <line x1={x(250)} x2={x(1e6)} y1={y(indexCost(250))} y2={y(indexCost(1e6))} strokeWidth="2" style={{ stroke: "var(--c1)" }} />
                <text x={x(1.2e5)} y={y(indexCost(1.2e5)) + 12} fontSize="9" style={{ fill: "var(--c1)" }}>
                  Index Scan
                </text>
                <line x1={x(o.est)} x2={x(o.est)} y1={T} y2={H - B} strokeWidth="1.5" strokeDasharray="4 3" style={{ stroke: ACCENT }} />
                <text x={x(o.est) + 3} y={T + 9} fontSize="8" style={{ fill: ACCENT }}>
                  estimate
                </text>
                <line x1={x(c.actual)} x2={x(c.actual)} y1={T + 14} y2={H - B} strokeWidth="1.5" style={{ stroke: "var(--text)" }} />
                <text x={x(c.actual) + 3} y={T + 22} fontSize="8" style={{ fill: "var(--text)" }}>
                  actual
                </text>
                <circle cx={x(c.actual)} cy={y(o.real)} r="4" style={{ fill: good ? "var(--good)" : "var(--bad)" }} />
                {!good && <circle cx={x(c.actual)} cy={y(o.ideal)} r="3.5" style={{ fill: "none", stroke: "var(--good)", strokeWidth: 1.5 }} />}
              </svg>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Filled dot: the chosen plan&apos;s real cost. {good ? "It is the cheapest." : "Ring: the cheaper plan it missed."}
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={<span style={{ color: at === null ? (good ? "var(--good)" : "var(--bad)") : undefined }}>{caption}</span>}>
              <Choices
                label="Scenario"
                accent={ACCENT}
                value={scenario}
                onChange={(v) => {
                  setScenario(v);
                  setFixed(false);
                }}
                options={CASES.map((k) => ({ id: k.id, label: k.label }))}
              />
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT}>
                Plan the query
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Read the saved statistics" what="ANALYZE samples rows and stores, per column, the most common values and how often each appears. The planner trusts these numbers." accent={ACCENT} active={at === 0}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {s.stats.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <div className="mt-3">
                  <Choices
                    label="Fix"
                    accent={ACCENT}
                    value={fixed ? "fixed" : "broken"}
                    onChange={(v) => setFixed(v === "fixed")}
                    options={[
                      { id: "broken", label: "As is" },
                      { id: "fixed", label: c.fixLabel },
                    ]}
                  />
                </div>
                {fixed && <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-[var(--muted)]">{c.fixSql}</pre>}
              </FlowStep>
              <FlowArrow label="selectivity" accent={ACCENT} />
              <FlowStep n={2} title="Estimate the matching rows" what="Multiply the table's row count by the fraction expected to match. For two conditions it multiplies both fractions, as if the columns were unrelated." accent={ACCENT} active={at === 1}>
                <p className="font-mono text-xs">
                  {s.formula} = <span style={{ color: ACCENT }}>{n(o.est)}</span> rows
                </p>
              </FlowStep>
              <FlowArrow label={`${n(o.est)} rows (guess)`} accent={ACCENT} />
              <FlowStep n={3} title="Price each plan" what="A seq scan reads all 10,000 pages whatever matches. An index scan pays about one random page read per matching row." accent={ACCENT} active={at === 2}>
                <p className="font-mono text-xs">
                  Seq Scan {n(SEQ_COST)} · Index Scan {n(indexCost(o.est))}
                </p>
              </FlowStep>
              <FlowArrow label="two costs" accent={ACCENT} />
              <FlowStep n={4} title="Pick the cheaper plan" what="The planner keeps the lowest cost. It has no other information, so a wrong guess gives a confident wrong choice." accent={ACCENT} active={at === 3}>
                <p className="font-mono text-xs" style={{ color: ACCENT }}>
                  {PLAN_NAME[o.chosen]}
                </p>
              </FlowStep>
              <FlowArrow label="the plan runs" accent={ACCENT} />
              <FlowStep n={5} title="Compare the guess with reality" what="EXPLAIN ANALYZE prints estimated and actual rows side by side. A gap of 10× or more points at the statistics." accent={ACCENT} active={at === 4}>
                <p className="font-mono text-xs">
                  rows={n(o.est)} (estimate) · rows={n(c.actual)} (actual)
                </p>
                <p className="mt-1 text-sm" style={{ color: good ? "var(--good)" : "var(--bad)" }}>
                  {good ? "Estimate close enough. Right plan." : `Off by ${o.off.toFixed(0)}×. Real cost ${n(o.real)} vs ${n(o.ideal)} for the other plan. Try the fix in step 1.`}
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
