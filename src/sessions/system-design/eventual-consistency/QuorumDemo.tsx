"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { LAGS, N, run } from "@/lib/quorum";

const ACCENT = "var(--sys)";

export default function QuorumDemo() {
  const [w, setW] = useState(1);
  const [r, setR] = useState(1);
  const [at, setAt] = useState(100);
  const x = run(w, r, at);
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Eventual consistency and quorums" blurb={`Data is copied to ${N} replicas, which apply a write at different speeds. A write is acknowledged after W replicas have it; a read asks R replicas and keeps the newest. If R + W > N, every read overlaps the latest write.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Replicas">
              <p className="font-mono text-xs text-[var(--faint)]">write name = &quot;Ada L.&quot; at 0 ms · acknowledged at {x.ackAt} ms · read at {at} ms</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {LAGS.map((l, i) => (
                  <div key={i} className="rounded-lg border-2 p-2.5" style={{ borderColor: x.asked.includes(i) ? ACCENT : "var(--line)" }}>
                    <p className="text-xs text-[var(--muted)]">replica {i + 1} · lag {l} ms</p>
                    <p className="font-mono text-sm" style={{ color: x.has[i] ? "var(--good)" : "var(--auto)" }}>{x.has[i] ? "Ada L. (v2)" : "Ada (v1)"}</p>
                    {x.asked.includes(i) && <p className="text-[10px]" style={{ color: ACCENT }}>asked by the read</p>}
                  </div>
                ))}
              </div>
              <p className="mt-4 font-mono text-sm" style={{ color: x.sees ? "var(--good)" : "var(--bad)" }}>read returns {x.sees ? "v2: up to date" : "v1: stale"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">R + W = {r + w} {x.overlap ? ">" : "≤"} N = {N}: {x.overlap ? "guaranteed to overlap" : "a read can miss the write"}. This shows the worst case: the read hits the slowest replicas.</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={x.overlap ? "Some replica in every read set also took the write, so reads are always fresh, at the price of waiting for more replicas." : `With R + W ≤ N, the read can land only on replicas that haven't caught up. ${at < 400 ? "Wait longer and it converges." : "By now every replica has it: eventually consistent."}`}>
              <Slider label="W (write acks)" accent={ACCENT} value={w} min={1} max={3} step={1} format={String} onChange={setW} />
              <Slider label="R (replicas read)" accent={ACCENT} value={r} min={1} max={3} step={1} format={String} onChange={setR} />
              <Slider label="Read time" accent={ACCENT} value={at} min={0} max={500} step={20} format={(v) => `${v} ms`} onChange={setAt} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Replicas converge, eventually" what="Without coordination, copies agree once updates stop arriving. Meanwhile, readers may see old values." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Usually milliseconds; sometimes much longer.</p></FlowStep>
              <FlowArrow label="tune it" accent={ACCENT} />
              <FlowStep n={2} title="R + W > N means overlap" what="Some replica is in both sets, so the read sees the write. N=3 with R=2, W=2 is the classic choice." accent={ACCENT} active={x.overlap}><p className="text-sm text-[var(--muted)]">Cassandra: QUORUM reads and writes.</p></FlowStep>
              <FlowArrow label="trade-off" accent={ACCENT} />
              <FlowStep n={3} title="Fewer acks, more speed" what="W=1 writes and R=1 reads are fastest and most available, and the most likely to be stale." accent={ACCENT} active={!x.overlap}><p className="text-sm text-[var(--muted)]">Fine for likes and view counts.</p></FlowStep>
              <FlowArrow label="repair" accent={ACCENT} />
              <FlowStep n={4} title="Read repair and anti-entropy" what="When a read sees disagreeing replicas, it fixes the stale ones; background jobs compare Merkle trees to catch the rest." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Conflicts need a rule: last-write-wins, vector clocks, CRDTs.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
