"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { run, SCENARIOS, type Scenario } from "@/lib/webhooks";

const ACCENT = "var(--sys)";

export default function WebhooksDemo() {
  const [s, setS] = useState<Scenario>("timeout");
  const [verify, setVerify] = useState("no");
  const [dedupe, setDedupe] = useState("no");
  const r = run(s, verify === "yes", dedupe === "yes");
  const good = s === "forged" ? r.credits === 0 : r.credits === 1;
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Receiving webhooks safely" blurb="A payment provider calls your endpoint when a payment succeeds. Webhooks are retried until you answer 200, so the same event can arrive twice. And your URL is public, so anyone can call it. Turn on the two defences." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Delivery log">
              <ol className="space-y-1.5">{r.log.map((e, i) => <li key={i} className="grid grid-cols-[2.5rem_5rem_minmax(0,1fr)] gap-2 text-xs"><span className="font-mono text-[var(--faint)]">{e.t}</span><span className="font-mono" style={{ color: e.who === "attacker" ? "var(--bad)" : e.who === "you" ? ACCENT : "var(--muted)" }}>{e.who}</span><span style={{ color: e.kind === "bad" ? "var(--bad)" : undefined }}>{e.text}</span></li>)}</ol>
              <p className="mt-4 font-mono text-sm" style={{ color: good ? "var(--good)" : "var(--bad)" }}>Order credited {r.credits}× {good ? "(correct)" : s === "forged" ? "for a payment that never happened" : "(should be once)"}</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={s === "down" ? "Your endpoint was down, but the provider kept retrying with backoff, so nothing was lost." : s === "timeout" ? (dedupe === "yes" ? "The retry arrives, but you've stored evt_123 as processed, so it's a no-op." : "You processed it but answered too slowly. The provider retried, and you credited the order twice.") : s === "forged" ? (verify === "yes" ? "No valid HMAC signature, so the request is rejected." : "Without checking the signature, anyone who finds your URL can mark orders paid.") : "Delivered once, handled once."}>
              <Choices label="Scenario" accent={ACCENT} value={s} onChange={setS} options={SCENARIOS} />
              <Choices label="Verify signature" accent={ACCENT} value={verify} onChange={setVerify} options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes" }]} />
              <Choices label="Dedupe by event id" accent={ACCENT} value={dedupe} onChange={setDedupe} options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Verify the signature" what="The provider signs the raw body with a shared secret (HMAC). Recompute it, compare in constant time, and check the timestamp." accent={ACCENT} active={s === "forged"}><p className="font-mono text-xs">HMAC-SHA256(secret, timestamp + body)</p></FlowStep>
              <FlowArrow label="answer fast" accent={ACCENT} />
              <FlowStep n={2} title="Reply 200 quickly, work later" what="Store the event, return 200, and process it from a queue. Slow handlers cause timeouts and retries." accent={ACCENT} active={s === "timeout"}><p className="text-sm text-[var(--muted)]">Most providers time out in 5–30 s.</p></FlowStep>
              <FlowArrow label="expect repeats" accent={ACCENT} />
              <FlowStep n={3} title="Deduplicate by event id" what="At-least-once delivery means duplicates. Record processed ids in the same transaction as the effect." accent={ACCENT} active={dedupe === "yes"}><p className="text-sm text-[var(--muted)]">Events can also arrive out of order.</p></FlowStep>
              <FlowArrow label="and" accent={ACCENT} />
              <FlowStep n={4} title="Reconcile" what="If you were down longer than the retry window, fetch missed events from the provider's API." accent={ACCENT} active={s === "down"}><p className="text-sm text-[var(--muted)]">Webhooks are a hint; the API is the truth.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
