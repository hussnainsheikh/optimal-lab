"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { MONTHS, PER, plan, QUERIES, type Q } from "@/lib/partitioning";

const ACCENT = "var(--db)";

export default function PartitioningDemo() {
  const [q, setQ] = useState<Q>("recent");
  const [part, setPart] = useState("yes");
  const p = plan(q, part === "yes");
  return (
    <SessionPage>
      <SessionHeader kicker="Databases · interactive" title="Table partitioning" blurb="An orders table holds 120 million rows: 10 million a month. Partitioning by month stores each month as its own physical table behind one name. Queries that filter on the partition key skip the rest, and old months drop in an instant." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Partitions">
              <pre className="whitespace-pre-wrap rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{QUERIES.find((x) => x.id === q)!.sql}</pre>
              {part === "yes" ? (
                <div className="mt-3 grid grid-cols-4 gap-1 sm:grid-cols-6">
                  {MONTHS.map((m, i) => { const t = p.touched.includes(i); return <div key={m} className="rounded-md border p-1.5 text-center" style={{ borderColor: t ? (q === "drop" ? "var(--bad)" : ACCENT) : "var(--line)", background: t ? "var(--inset)" : undefined, opacity: t ? 1 : 0.4 }}><p className="font-mono text-[11px]">orders_{m.toLowerCase()}</p><p className="text-[10px] text-[var(--muted)]">10M rows</p></div>; })}
                </div>
              ) : (
                <div className="mt-3 rounded-md border p-3 text-center" style={{ borderColor: ACCENT, background: "var(--inset)" }}><p className="font-mono text-xs">orders</p><p className="text-[11px] text-[var(--muted)]">one table, 120M rows</p></div>
              )}
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {[["Partitions touched", part === "yes" ? `${p.touched.length} of 12` : "—"], ["Rows involved", (p.rows / 1e6).toFixed(0) + "M"], ["Cost", p.cost]].map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono" style={{ color: v === "instant" || v === "fast" ? "var(--good)" : v === "hours" || v === "slow" || v === "slower" ? "var(--bad)" : undefined }}>{v}</dd></div>)}
              </dl>
              <p className="mt-2 text-[11px] text-[var(--faint)]">{PER.toLocaleString()} rows per month</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={p.note}>
              <Choices label="Operation" accent={ACCENT} value={q} onChange={setQ} options={QUERIES.map((x) => ({ id: x.id, label: x.label }))} />
              <Choices label="Table" accent={ACCENT} value={part} onChange={setPart} options={[{ id: "no", label: "One big table" }, { id: "yes", label: "Partitioned by month" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="One logical table, many physical ones" what="Rows are routed to a partition by the key: a date range, a list of values or a hash." accent={ACCENT}><p className="font-mono text-xs">PARTITION BY RANGE (created_at)</p></FlowStep>
              <FlowArrow label="queries with the key" accent={ACCENT} />
              <FlowStep n={2} title="Partition pruning" what="Filter on the partition key and the planner skips partitions that can't match." accent={ACCENT} active={q === "recent" && part === "yes"}><p className="text-sm text-[var(--muted)]">Smaller indexes per partition, too.</p></FlowStep>
              <FlowArrow label="retention" accent={ACCENT} />
              <FlowStep n={3} title="Drop old data instantly" what="Detaching or dropping a partition is a metadata change. Deleting millions of rows is hours of I/O and bloat." accent={ACCENT} active={q === "drop"}><p className="text-sm text-[var(--muted)]">The most common reason to partition.</p></FlowStep>
              <FlowArrow label="but" accent={ACCENT} />
              <FlowStep n={4} title="Queries without the key get worse" what="They must visit every partition. Pick a key your most important queries filter on, and don't partition small tables." accent={ACCENT} active={q === "customer" && part === "yes"}><p className="text-sm text-[var(--muted)]">Partitioning isn&apos;t sharding: it&apos;s still one server.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
