"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { at, LATENCY, TIMES, type Mode, type Outcome } from "@/lib/optimistic";

const ACCENT = "var(--web)";

export default function OptimisticDemo() {
  const [m, setM] = useState<Mode>("optimistic");
  const [o, setO] = useState<Outcome>("ok");
  const playback = usePlayback(TIMES.length, 900);
  const t = TIMES[playback.i];
  const s = at(m, o, t);
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Optimistic updates" blurb={`You tap Like. The server takes ${LATENCY} ms to confirm. Waiting feels sluggish; updating the screen immediately and assuming success feels instant, but you need a plan for when the server says no.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Like button over time">
              <p className="font-mono text-xs text-[var(--faint)]">t = {t} ms {t >= LATENCY ? `· server answered ${o === "ok" ? "200" : "500"}` : t > 0 ? "· waiting for the server" : "· tap"}</p>
              <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--inset)] p-4">
                <p className="text-sm">Post by Ada: “Shipped the new dashboard!”</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="grid min-h-11 place-items-center rounded-full border px-4 text-sm" style={{ borderColor: s.liked ? "var(--bad)" : "var(--line)", color: s.liked ? "var(--bad)" : undefined }}>{s.pending ? "…" : s.liked ? "♥ Liked" : "♡ Like"}</span>
                  <span className="font-mono text-sm">{s.count}</span>
                </div>
                {s.error && <p className="mt-2 text-xs text-[var(--bad)]">Couldn&apos;t save your like. Try again.</p>}
              </div>
              <ol className="mt-3 flex flex-wrap gap-1 font-mono text-[10px]">{TIMES.map((x, i) => <li key={x} className="rounded px-1.5 py-0.5" style={{ background: i === playback.i ? ACCENT : "var(--inset)", color: i === playback.i ? "var(--on-accent)" : undefined }}>{x}ms</li>)}</ol>
            </section>
          }
          panel={
            <SystemMapPanel caption={m === "wait" ? (t < LATENCY ? "The button shows a spinner for most of a second. The app feels slow even though nothing is wrong." : o === "ok" ? "Finally updated." : "Nothing changed, plus an error.") : t < LATENCY ? "The heart fills instantly. The request runs in the background." : o === "ok" ? "The server agreed: nothing to do." : "The server failed, so the UI rolls back to the previous state and explains why."}>
              <Choices label="Approach" accent={ACCENT} value={m} onChange={setM} options={[{ id: "wait", label: "Wait for the server" }, { id: "optimistic", label: "Optimistic" }]} />
              <Choices label="Server responds" accent={ACCENT} value={o} onChange={setO} options={[{ id: "ok", label: "Success" }, { id: "fail", label: "Failure" }]} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next moment" status={`${t} ms`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Most actions succeed" what="Likes, checkboxes and reordering almost never fail. Make them feel instant." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Perceived speed matters more than measured speed.</p></FlowStep>
              <FlowArrow label="apply locally" accent={ACCENT} />
              <FlowStep n={2} title="Update now, remember the old state" what="Change the UI immediately and keep a snapshot to restore." accent={ACCENT} active={m === "optimistic" && t < LATENCY}><p className="font-mono text-xs">useOptimistic(likes, (s, n) =&gt; s + n)</p></FlowStep>
              <FlowArrow label="on failure" accent={ACCENT} />
              <FlowStep n={3} title="Roll back and tell the user" what="Restore the snapshot and show a clear, retryable error." accent={ACCENT} active={m === "optimistic" && o === "fail" && t >= LATENCY}><p className="text-sm text-[var(--muted)]">Silent rollbacks confuse people.</p></FlowStep>
              <FlowArrow label="but not for" accent={ACCENT} />
              <FlowStep n={4} title="Not for risky or irreversible actions" what="Payments, deletes and anything that often fails should wait for confirmation." accent={ACCENT}><p className="text-sm text-[var(--muted)]">TanStack Query and SWR support this pattern.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
