"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CAT_RATE, run, THREADS } from "@/lib/bulkheads";

const ACCENT = "var(--sys)";

export default function BulkheadsDemo() {
  const [b, setB] = useState("no");
  const r = run(b === "yes");
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Bulkheads" blurb={`A service has ${THREADS} worker threads. The payments provider starts hanging for 10 seconds per call. Catalog calls are fast and have nothing to do with payments. Watch what happens to the catalog.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Threads over time">
              <ul className="space-y-1">
                {r.ticks.map((t) => (
                  <li key={t.t} className="grid grid-cols-[2.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-xs">
                    <span className="font-mono text-[var(--faint)]">{t.t}s</span>
                    <span className="flex gap-px">{Array.from({ length: THREADS }, (_, i) => <span key={i} className="h-3 flex-1 rounded-sm" style={{ background: i < t.payThreads ? "var(--bad)" : b === "yes" && i >= r.payPool ? ACCENT : b === "yes" ? "var(--ghost)" : ACCENT, opacity: b === "yes" && i >= r.payPool ? 1 : i < t.payThreads ? 1 : 0.55, marginLeft: b === "yes" && i === r.payPool ? 4 : 0 }} />)}</span>
                    <span className="text-right font-mono" style={{ color: t.catFailed ? "var(--bad)" : "var(--good)" }}>catalog {t.catServed}/{CAT_RATE}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-[var(--muted)]">Red: threads stuck waiting on payments. {b === "yes" ? "Left: payments pool (5). Right: catalog pool (15)." : "All 20 threads are shared."}</p>
              <p className="mt-2 font-mono text-sm" style={{ color: r.catFailed ? "var(--bad)" : "var(--good)" }}>{r.catFailed} catalog requests failed</p>
            </section>
          }
          panel={<SystemMapPanel caption={b === "no" ? "Each hanging payment call holds a thread for 10 s. After 5 s every thread is stuck on payments and the catalog, which is perfectly healthy, goes down too." : "Payments can only ever use 5 threads. Those fill up and payments fail fast, but the catalog keeps its own 15 threads and never notices."}><Choices label="Thread pools" accent={ACCENT} value={b} onChange={setB} options={[{ id: "no", label: "One shared pool" }, { id: "yes", label: "Bulkheads (5 + 15)" }]} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Slow is worse than down" what="A dead dependency fails fast. A hanging one holds threads, connections and memory until they run out." accent={ACCENT} active={b === "no"}><p className="text-sm text-[var(--muted)]">Resource exhaustion spreads failures.</p></FlowStep>
              <FlowArrow label="partition" accent={ACCENT} />
              <FlowStep n={2} title="Separate pools per dependency" what="Like a ship's watertight compartments: a flood in one doesn't sink the rest." accent={ACCENT} active={b === "yes"}><p className="text-sm text-[var(--muted)]">Thread pools, connection pools, semaphores.</p></FlowStep>
              <FlowArrow label="bigger scale" accent={ACCENT} />
              <FlowStep n={3} title="Also by tenant or traffic class" what="Separate clusters or queues for big customers, batch jobs and interactive traffic." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Cell-based architecture is bulkheads for whole stacks.</p></FlowStep>
              <FlowArrow label="combine" accent={ACCENT} />
              <FlowStep n={4} title="With timeouts and circuit breakers" what="Timeouts bound each call, breakers stop calling a broken dependency, bulkheads cap the damage." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Resilience4j has all three.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
