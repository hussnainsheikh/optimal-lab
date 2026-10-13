"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, Slider } from "@/components/session/ui";
import { run, type Mode } from "@/lib/hedged";

const ACCENT = "var(--sys)";
const SPAN = 800;

export default function HedgedDemo() {
  const [mode, setMode] = useState<Mode>("hedge");
  const [after, setAfter] = useState(60);
  const r = run(mode, after);
  const base = run("none", 0);
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Hedged requests and tail latency" blurb="Most requests to this backend take 15–40 ms, but about 1 in 10 hits a slow server and takes half a second. If you wait a little and then send a backup copy to another server, you take whichever answers first." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="40 requests">
              <ul className="space-y-0.5">
                {r.reqs.map((q, i) => (
                  <li key={i} className="relative h-2.5 rounded-sm bg-[var(--track)]" title={`${q.total} ms`}>
                    <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(Math.min(q.a, SPAN) / SPAN) * 100}%`, background: q.hedged ? "var(--ghost)" : q.a > 200 ? "var(--bad)" : ACCENT }} />
                    {q.hedged && q.b !== null && <span className="absolute inset-y-0 rounded-sm" style={{ left: `${(after / SPAN) * 100}%`, width: `${((q.b - after) / SPAN) * 100}%`, background: "var(--good)" }} />}
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>0</span><span>400 ms</span><span>800 ms</span></div>
              <table className="mt-4 w-full font-mono text-sm">
                <thead><tr className="text-left text-xs text-[var(--faint)]"><th className="font-normal" /><th className="font-normal">p50</th><th className="font-normal">p95</th><th className="font-normal">p99</th></tr></thead>
                <tbody>
                  <tr><td className="text-xs text-[var(--muted)]">no hedging</td><td>{base.p50}</td><td>{base.p95}</td><td>{base.p99}</td></tr>
                  <tr style={{ color: ACCENT }}><td className="text-xs">{mode === "hedge" ? `hedge at ${after} ms` : "selected"}</td><td>{r.p50}</td><td>{r.p95}</td><td>{r.p99}</td></tr>
                </tbody>
              </table>
              <p className="mt-2 text-xs text-[var(--muted)]">Extra requests sent: {r.extra} of 40 ({Math.round((r.extra / 40) * 100)}%). Grey: the slow original, abandoned. Green: the backup that won.</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={mode === "none" ? `p50 is ${base.p50} ms but p99 is ${base.p99} ms. A page that makes 20 calls almost always hits a slow one.` : `Hedging at ${after} ms cuts p99 from ${base.p99} to ${r.p99} ms for ${Math.round((r.extra / 40) * 100)}% extra load.`}>
              <Choices label="Strategy" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "none", label: "Wait for it" }, { id: "hedge", label: "Hedge" }]} />
              {mode === "hedge" && <Slider label="Send backup after" accent={ACCENT} value={after} min={20} max={300} step={10} format={(v) => `${v} ms`} onChange={setAfter} />}
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="The tail dominates at scale" what="If one call has a 1% chance of being slow, a request that fans out to 100 servers is slow 63% of the time." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Measure p99, not averages.</p></FlowStep>
              <FlowArrow label="wait a bit" accent={ACCENT} />
              <FlowStep n={2} title="Hedge after about p95" what="Send a second copy only when the first is slower than usual. Most requests never need one." accent={ACCENT} active={mode === "hedge"}><p className="text-sm text-[var(--muted)]">Too early doubles load; too late saves nothing.</p></FlowStep>
              <FlowArrow label="take the winner" accent={ACCENT} />
              <FlowStep n={3} title="Use the first answer, cancel the other" what="Cancelling the loser keeps the extra work small." accent={ACCENT}><p className="text-sm text-[var(--muted)]">From Google&apos;s “The Tail at Scale”.</p></FlowStep>
              <FlowArrow label="safety" accent={ACCENT} />
              <FlowStep n={4} title="Only for safe requests" what="Reads and idempotent writes only. Cap the hedge rate so an overloaded backend doesn't get double the traffic." accent={ACCENT}><p className="text-sm text-[var(--muted)]">gRPC supports hedging policies.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
