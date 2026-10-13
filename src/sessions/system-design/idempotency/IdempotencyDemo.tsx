"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { KEY, runPayment, type Actor } from "@/lib/idempotency";

const ACCENT = "var(--sys)";
const LANES: { id: Actor; label: string }[] = [
  { id: "client", label: "Client" },
  { id: "network", label: "Network" },
  { id: "server", label: "Payment server" },
];

export default function IdempotencyDemo() {
  const [mode, setMode] = useState<"none" | "key">("none");
  const withKey = mode === "key";
  const frames = runPayment(withKey);
  const playback = usePlayback(frames.length, 1300);
  const f = frames[playback.i];
  const done = playback.atEnd;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System Design · interactive"
        title="Idempotency and request deduplication"
        blurb="Networks lose responses. When that happens the client can't know whether the payment went through, so it retries. Without a way to spot the retry, the customer pays twice."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The request, the lost response and the retry">
              <div className="grid grid-cols-3 gap-2 text-center">
                {LANES.map((l) => (
                  <p key={l.id} className="rounded-md border px-2 py-1.5 text-sm" style={{ borderColor: f.actor === l.id ? ACCENT : "var(--line)", background: f.actor === l.id ? "color-mix(in srgb, var(--sys) 16%, transparent)" : "var(--inset)" }}>
                    {l.label}
                  </p>
                ))}
              </div>
              <ol className="mt-3 space-y-1.5">
                {frames.slice(0, playback.i + 1).map((x, i) => (
                  <li key={i} className="rounded-md border px-2.5 py-1.5 text-sm" style={{ borderColor: i === playback.i ? ACCENT : "var(--line)", background: "var(--inset)", marginLeft: x.actor === "client" ? 0 : x.actor === "network" ? "16%" : "32%", marginRight: x.actor === "server" ? 0 : x.actor === "network" ? "16%" : "32%" }}>
                    <span className="font-mono text-[11px] text-[var(--faint)]">{x.actor}</span>
                    <p style={{ color: x.actor === "network" ? "var(--bad)" : undefined }}>{x.text}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-[var(--inset)] p-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Card statement</p>
                  <ul className="mt-1 space-y-0.5 font-mono text-sm">
                    {Array.from({ length: f.charges }, (_, i) => (
                      <li key={i} style={{ color: i > 0 ? "var(--bad)" : undefined }}>charge #{i + 1}: $50.00</li>
                    ))}
                    {f.charges === 0 && <li className="text-[var(--faint)]">nothing yet</li>}
                  </ul>
                </div>
                <div className="rounded-lg bg-[var(--inset)] p-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Idempotency keys stored</p>
                  <ul className="mt-1 space-y-0.5 font-mono text-xs">
                    {f.keys.length ? f.keys.map((k) => <li key={k}>{k}</li>) : <li className="text-[var(--faint)]">{withKey ? "none yet" : "not used"}</li>}
                  </ul>
                </div>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={`${f.text} The client sees: ${f.clientSees}`}>
              <Choices label="Request" accent={ACCENT} value={mode} onChange={(v) => { setMode(v); playback.reset(); }} options={[{ id: "none", label: "No key" }, { id: "key", label: "With an idempotency key" }]} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next" status={done ? `${f.charges} ${f.charges === 1 ? "charge" : "charges"} for one purchase` : `step ${playback.i + 1} of ${frames.length}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="The client sends a unique key with the request" what="A random id made once per purchase, not once per attempt. Retries reuse it." accent={ACCENT} active={playback.i === 0}>
                <p className="font-mono text-sm">{withKey ? `Idempotency-Key: ${KEY}` : "No key sent."}</p>
              </FlowStep>
              <FlowArrow label="the request" accent={ACCENT} />

              <FlowStep n={2} title="The server records the key with the result" what="Store the key and the outcome in the same transaction as the charge, so the two can't disagree." accent={ACCENT} active={playback.i === 1}>
                <p className="text-sm text-[var(--muted)]">{withKey ? "Key saved with “charge #1, success”." : "Nothing is recorded that identifies this attempt."}</p>
              </FlowStep>
              <FlowArrow label="the response is lost" accent={ACCENT} />

              <FlowStep n={3} title="The client retries with the same key" what="Timeouts are ambiguous: the request may or may not have run. Retrying is right, as long as it's safe to repeat." accent={ACCENT} active={playback.i === 2 || playback.i === 3}>
                <p className="text-sm text-[var(--muted)]">Retry with exponential backoff, and the same key every time.</p>
              </FlowStep>
              <FlowArrow label="the retry" accent={ACCENT} />

              <FlowStep n={4} title="A seen key returns the saved result" what="The server does no new work: it replays the first response. The operation becomes idempotent: doing it twice equals doing it once." accent={ACCENT} active={done}>
                <p className="text-sm" style={{ color: done ? (f.charges === 1 ? "var(--good)" : "var(--bad)") : undefined }}>
                  {done ? (f.charges === 1 ? "Charged once. The retry was harmless." : "Charged twice for one purchase.") : "Keep stepping."}
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
