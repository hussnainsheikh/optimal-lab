"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CAP, CONSUME, MODES, PRODUCE, run, type Mode } from "@/lib/queueBackpressure";

const ACCENT = "var(--sys)";
const MAXQ = 850;

export default function QueueBackpressureDemo() {
  const [m, setM] = useState<Mode>("unbounded");
  const r = run(m);
  const caption = m === "unbounded" ? `The queue grows by ${PRODUCE - CONSUME} a second forever. After 20 s it holds ${r.final.queue} messages and each waits ${r.final.latency.toFixed(1)} s. Eventually memory runs out.`
    : m === "drop" ? `The queue stops at ${CAP}, so latency stays bounded, but ${r.dropped} messages were thrown away.`
    : `When the queue is full the producer is told to slow down to ${CONSUME}/s. Nothing is lost and latency is bounded; the slowness moves upstream.`;
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Backpressure" blurb={`A producer sends ${PRODUCE} messages a second; the consumer can only handle ${CONSUME}. Something has to give: memory, messages, or the producer's speed.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Queue length over 20 seconds">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Queue length, 20 s</p>
              <div className="relative mt-2 flex h-36 items-end gap-1">
                {r.ticks.map((t) => <span key={t.t} className="flex-1 rounded-t-sm" title={`${t.t}s: ${t.queue} queued`} style={{ height: `${(t.queue / MAXQ) * 100}%`, background: t.queue > CAP ? "var(--bad)" : ACCENT }} />)}
                <span className="absolute inset-x-0 border-t border-dashed border-[var(--muted)]" style={{ bottom: `${(CAP / MAXQ) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">Dashed: a bound of {CAP}.</p>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                {[["Queued", r.final.queue], ["Wait", `${r.final.latency.toFixed(1)} s`], ["Dropped", r.dropped]].map(([k, v]) => <div key={String(k)} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono text-lg">{v}</dd></div>)}
              </dl>
              <p className="mt-2 font-mono text-xs text-[var(--muted)]">producer now sending {r.final.rate}/s</p>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Choices label="Queue" accent={ACCENT} value={m} onChange={setM} options={MODES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Unbounded queues hide the problem" what="Everything looks fine while the queue grows. Latency climbs, then the process runs out of memory." accent={ACCENT} active={m === "unbounded"}><p className="text-sm text-[var(--muted)]">A queue only absorbs bursts, not a sustained gap.</p></FlowStep>
              <FlowArrow label="bound it" accent={ACCENT} />
              <FlowStep n={2} title="Bound it and shed load" what="Reject or drop when full. Fine for metrics or best-effort work; return 429 or 503 to callers." accent={ACCENT} active={m === "drop"}><p className="text-sm text-[var(--muted)]">Drop oldest or newest depending on what&apos;s useful.</p></FlowStep>
              <FlowArrow label="or push back" accent={ACCENT} />
              <FlowStep n={3} title="Signal upstream to slow down" what="Blocking writes, TCP windows, reactive-stream demand and pull-based consumers all tell the producer to wait." accent={ACCENT} active={m === "backpressure"}><p className="font-mono text-xs">stream.write() returns false → wait for drain</p></FlowStep>
              <FlowArrow label="and fix the rate" accent={ACCENT} />
              <FlowStep n={4} title="Then add capacity" what="Backpressure buys time. If the gap is permanent, scale the consumer or reduce the work per message." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Alert on queue age, not just length.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
