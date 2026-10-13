"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { MESSAGES, MODES, run, type Mode } from "@/lib/delivery";

const ACCENT = "var(--sys)";
const KIND = { ok: "var(--good)", crash: "var(--bad)", dup: "var(--bad)", skip: "var(--auto)", lost: "var(--bad)", info: "var(--faint)" };

export default function DeliveryDemo() {
  const [mode, setMode] = useState<Mode>("at-least-once");
  const r = run(mode);
  const caption = mode === "at-most-once" ? `The offset was saved before the work, so after the crash pay-3 is skipped. Customers were charged ${r.total}, not ${r.expected}.`
    : mode === "at-least-once" ? `Nothing is lost, but pay-3 is processed twice after the restart: charged ${r.total} instead of ${r.expected}.`
    : "Redelivery still happens, but the consumer records processed ids and skips repeats. Exactly the right total.";
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Delivery guarantees and duplicates" blurb="A consumer reads five payment messages from a queue and saves its position (the offset) as it goes. It crashes once, right after charging pay-3. When it saves its position decides whether a message is lost or done twice." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Consumer log">
              <ol className="flex flex-wrap gap-1.5">
                {MESSAGES.map((m) => { const n = r.applied.filter((x) => x === m.id).length; return <li key={m.id} className="rounded-md border px-2 py-1 font-mono text-xs" style={{ borderColor: n === 1 ? "var(--good)" : "var(--bad)" }}>{m.id} ×{n}</li>; })}
              </ol>
              <ol className="mt-3 space-y-1 font-mono text-xs">
                {r.events.map((e, i) => <li key={i} className="flex gap-2"><span className="w-5 text-right text-[var(--faint)]">{i + 1}</span><span style={{ color: KIND[e.kind] }}>{e.text}</span></li>)}
              </ol>
              <p className="mt-3 font-mono text-sm" style={{ color: r.total === r.expected ? "var(--good)" : "var(--bad)" }}>Charged {r.total} · should be {r.expected}</p>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Choices label="Consumer" accent={ACCENT} value={mode} onChange={setMode} options={MODES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="At-most-once" what="Save progress first. A crash loses whatever was in flight, but nothing repeats." accent={ACCENT} active={mode === "at-most-once"}><p className="text-sm text-[var(--muted)]">OK for metrics; never for money.</p></FlowStep>
              <FlowArrow label="flip the order" accent={ACCENT} />
              <FlowStep n={2} title="At-least-once" what="Do the work, then save progress. A crash in between means the message comes again. This is the default for most queues." accent={ACCENT} active={mode === "at-least-once"}><p className="text-sm text-[var(--muted)]">Duplicates are guaranteed, eventually.</p></FlowStep>
              <FlowArrow label="make repeats harmless" accent={ACCENT} />
              <FlowStep n={3} title="Effectively once" what="Give each message an id and store processed ids in the same transaction as the work. Repeats become no-ops." accent={ACCENT} active={mode === "idempotent"}><p className="font-mono text-xs">INSERT … ON CONFLICT (message_id) DO NOTHING</p></FlowStep>
              <FlowArrow label="and ordering" accent={ACCENT} />
              <FlowStep n={4} title="Order is per key, not global" what="Kafka keeps order within a partition. Send all events for one account to the same partition by keying on the account id." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Retries can reorder; version numbers help.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
