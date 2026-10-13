"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { frames, type Mode } from "@/lib/backgroundJobs";

const ACCENT = "var(--sys)";
const COLOR = { queued: "var(--muted)", running: ACCENT, retry: "var(--auto)", done: "var(--good)", dead: "var(--bad)", "—": "var(--faint)" };

export default function BackgroundJobsDemo() {
  const [mode, setMode] = useState<Mode>("inline");
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Background jobs" blurb="Signing up triggers a welcome email, an avatar resize and a CRM sync. Doing them inside the request makes sign-up slow and fragile. Putting them on a queue lets the request finish at once and lets failures retry on their own." />
      <div className="mt-6"><Run key={mode} mode={mode} setMode={setMode} /></div>
    </SessionPage>
  );
}

function Run({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const fr = frames(mode);
  const playback = usePlayback(fr.length, 1700);
  const f = fr[playback.i];
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Request and jobs">
          <div className="rounded-lg border-2 p-3" style={{ borderColor: f.bad ? "var(--bad)" : "var(--line)" }}><p className="text-xs text-[var(--muted)]">POST /signup</p><p className="font-mono text-sm" style={{ color: f.response.startsWith("5") ? "var(--bad)" : f.response.startsWith("2") ? "var(--good)" : undefined }}>{f.response}</p></div>
          <ul className="mt-3 space-y-1.5">{f.jobs.map((j) => <li key={j.name} className="flex items-center justify-between rounded-md bg-[var(--inset)] px-2 py-1.5 text-sm"><span>{j.name}</span><span className="font-mono text-xs" style={{ color: COLOR[j.state] }}>{j.state === "dead" && mode === "queue" ? "dead-letter queue" : j.state}{j.tries ? ` · try ${j.tries}` : ""}</span></li>)}</ul>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="Where the work runs" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "inline", label: "Inside the request" }, { id: "queue", label: "Queue + workers" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${fr.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Keep requests short" what="Anything slow or unreliable that the user doesn't need to wait for goes to a queue." accent={ACCENT} active={mode === "inline"}><p className="text-sm text-[var(--muted)]">Emails, images, webhooks, reports.</p></FlowStep>
          <FlowArrow label="enqueue" accent={ACCENT} />
          <FlowStep n={2} title="Workers pull and process" what="Scale workers separately from web servers. Jobs survive web server restarts." accent={ACCENT} active={mode === "queue"}><p className="text-sm text-[var(--muted)]">Enqueue in the same transaction (outbox) to avoid lost jobs.</p></FlowStep>
          <FlowArrow label="failures" accent={ACCENT} />
          <FlowStep n={3} title="Retry with backoff, then dead-letter" what="Transient errors retry; permanent ones land in a dead-letter queue for a person to inspect and replay." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Jobs must be idempotent.</p></FlowStep>
          <FlowArrow label="scheduling" accent={ACCENT} />
          <FlowStep n={4} title="Delayed and recurring jobs" what="Send a reminder in 3 days; run a report every night. Use one scheduler so a job doesn't run once per server." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Sidekiq, BullMQ, Celery, SQS.</p></FlowStep>
        </>
      }
    />
  );
}
