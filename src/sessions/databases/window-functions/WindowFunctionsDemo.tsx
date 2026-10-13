"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { compute, FNS, type Fn } from "@/lib/windowFunctions";

const ACCENT = "var(--db)";

export default function WindowFunctionsDemo() {
  const [fn, setFn] = useState<Fn>("running");
  const [sel, setSel] = useState(4);
  const rows = compute(fn);
  const cur = rows[sel];
  const f = FNS.find((x) => x.id === fn)!;
  return (
    <SessionPage>
      <SessionHeader kicker="Databases · interactive" title="Window functions" blurb="GROUP BY squashes rows into one per group. A window function keeps every row and adds a value computed over related rows: its partition, in an order, over a frame. Click a row to see which rows its value came from." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Sales table with a window column">
              <pre className="whitespace-pre-wrap rounded-md bg-[var(--inset)] p-2 font-mono text-xs">SELECT rep, month, amount,{"\n"}  <span style={{ color: ACCENT }}>{f.sql}</span>{"\n"}FROM sales;</pre>
              <table className="mt-3 w-full font-mono text-sm">
                <thead><tr className="text-left text-xs text-[var(--faint)]"><th className="font-normal">rep</th><th className="font-normal">month</th><th className="font-normal">amount</th><th className="text-right font-normal" style={{ color: ACCENT }}>{f.label}</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => {
                    const inPart = cur.partition.includes(i), inFrame = cur.frame.includes(i);
                    return (
                      <tr key={i} onClick={() => setSel(i)} className="cursor-pointer" style={{ background: i === sel ? ACCENT : inFrame ? "var(--inset)" : undefined, color: i === sel ? "var(--on-accent)" : inPart ? undefined : "var(--faint)", borderTop: i === 3 ? "2px solid var(--line-strong)" : undefined }}>
                        <td className="py-1.5 pl-1">{r.rep}</td><td>{r.month}</td><td>{r.amount}</td><td className="pr-1 text-right font-medium">{r.value}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-[var(--muted)]">Faded: other partitions. Shaded: rows that fed the selected value.</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={`Row ${cur.rep}, month ${cur.month}: ${fn === "running" ? `sum of ${cur.rep}'s months 1–${cur.month}` : fn === "lag" ? "this amount minus the previous month's" : `position within ${cur.rep}'s rows by amount`} = ${cur.value}.${fn === "rank" ? " Ties share a rank (RANK) where ROW_NUMBER breaks them." : ""}`}>
              <Choices label="Function" accent={ACCENT} value={fn} onChange={setFn} options={FNS.map((x) => ({ id: x.id, label: x.label }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="PARTITION BY splits the rows" what="Like GROUP BY, but the rows stay. Each partition is computed separately." accent={ACCENT}><p className="font-mono text-xs">PARTITION BY rep</p></FlowStep>
              <FlowArrow label="order them" accent={ACCENT} />
              <FlowStep n={2} title="ORDER BY sets the sequence" what="Ranking functions and LAG/LEAD need an order within the partition." accent={ACCENT} active={fn !== "running"}><p className="text-sm text-[var(--muted)]">Top-N per group: ROW_NUMBER() ≤ 3.</p></FlowStep>
              <FlowArrow label="choose a frame" accent={ACCENT} />
              <FlowStep n={3} title="The frame picks the rows to aggregate" what="With ORDER BY, SUM defaults to “from the start up to this row”: a running total. ROWS BETWEEN 2 PRECEDING AND CURRENT ROW gives a moving window." accent={ACCENT} active={fn === "running"}><p className="font-mono text-xs">ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</p></FlowStep>
              <FlowArrow label="why" accent={ACCENT} />
              <FlowStep n={4} title="One pass instead of self-joins" what="Month-over-month change, rankings and running totals used to need correlated subqueries. Window functions do them in one sorted scan." accent={ACCENT} active={fn === "lag"}><p className="text-sm text-[var(--muted)]">Filter on them in an outer query or with QUALIFY.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
