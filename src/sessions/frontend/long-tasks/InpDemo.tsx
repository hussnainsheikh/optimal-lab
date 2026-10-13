"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { MODES, rating, timeline, type Mode } from "@/lib/inp";

const ACCENT = "var(--web)";
const SPAN = 400;

export default function InpDemo() {
  const [m, setM] = useState<Mode>("block");
  const t = timeline(m);
  const r = rating(t.paint);
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Long tasks and INP" blurb="Interaction to Next Paint measures how long after a click the screen visibly responds. A click handler that filters 10,000 rows for 300 ms blocks the next frame, so the page feels frozen. You can't make the work disappear, but you can paint first." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Main thread after a click">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Main thread after the click</p>
              <div className="relative mt-2 h-8 rounded bg-[var(--inset)]">
                {t.blocks.map((b) => <span key={b.label} className="absolute inset-y-1 grid place-items-center overflow-hidden rounded font-mono text-[10px]" style={{ left: `${(b.from / SPAN) * 100}%`, width: `${((b.to - b.from) / SPAN) * 100}%`, background: b.to - b.from > 50 ? "var(--bad)" : ACCENT, color: "var(--on-accent)" }}>{b.label}</span>)}
                <span className="absolute inset-y-0 w-0.5 bg-[var(--good)]" style={{ left: `${(t.paint / SPAN) * 100}%` }} />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>click</span><span>{SPAN} ms</span></div>
              <p className="mt-1 text-xs text-[var(--muted)]">Green line: first paint after the click. Red: tasks over 50 ms.</p>
              <dl className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">INP</dt><dd className="font-mono text-lg" style={{ color: r === "good" ? "var(--good)" : "var(--bad)" }}>{t.paint} ms · {r}</dd></div>
                <div className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">Results ready</dt><dd className="font-mono text-lg">{t.done} ms</dd></div>
              </dl>
            </section>
          }
          panel={<SystemMapPanel caption={m === "block" ? "Nothing can paint until the 300 ms task ends. Users see no response and click again." : m === "yield" ? "Show a spinner and let the browser paint, then do the work in chunks, yielding between them so input and frames get through. Results take slightly longer; the page never feels frozen." : "The heavy work runs off the main thread. It paints at once and stays responsive the whole time."}><Choices label="Handler" accent={ACCENT} value={m} onChange={setM} options={MODES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Long tasks block everything" what="Anything over 50 ms on the main thread delays input handling and painting." accent={ACCENT} active={m === "block"}><p className="text-sm text-[var(--muted)]">DevTools marks them with red corners.</p></FlowStep>
              <FlowArrow label="INP" accent={ACCENT} />
              <FlowStep n={2} title="INP: click to next paint" what="A Core Web Vital. Good is under 200 ms for the slowest interactions a user has." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Replaced FID in 2024.</p></FlowStep>
              <FlowArrow label="fix" accent={ACCENT} />
              <FlowStep n={3} title="Update the UI, then yield" what="Do the visible change first, then split the rest into chunks and yield to the browser between them." accent={ACCENT} active={m === "yield"}><p className="font-mono text-xs">await scheduler.yield()</p></FlowStep>
              <FlowArrow label="or" accent={ACCENT} />
              <FlowStep n={4} title="Do less, or do it elsewhere" what="Virtualise long lists, debounce typing, and move heavy computation to a worker." accent={ACCENT} active={m === "worker"}><p className="text-sm text-[var(--muted)]">React&apos;s useTransition marks updates as interruptible.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
