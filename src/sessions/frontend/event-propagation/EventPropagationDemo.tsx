"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState, type ReactNode } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { OPTS, PATH, run, type Opt } from "@/lib/eventPropagation";

const ACCENT = "var(--web)";

export default function EventPropagationDemo() {
  const [o, setO] = useState<Opt>("normal");
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Event propagation" blurb="A click on a button doesn't just happen on the button. The event travels down from the window to it (capture), fires on it (target), then travels back up (bubble). Every ancestor gets a chance to react." />
      <div className="mt-6"><Run key={o} o={o} setO={setO} /></div>
    </SessionPage>
  );
}

function Run({ o, setO }: { o: Opt; setO: (v: Opt) => void }) {
  const steps = run(o);
  const playback = usePlayback(steps.length, 1000);
  const s = steps[playback.i];
  const log = steps.slice(0, playback.i + 1).filter((x) => x.ran);
  const depth = (el: string) => PATH.indexOf(el);
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Nested elements">
          {(() => {
            const box = (i: number): ReactNode => {
              const el = PATH[i];
              const hot = s.el === el;
              return (
                <div className="rounded-lg border-2 p-3" style={{ borderColor: hot ? (s.ran ? ACCENT : "var(--faint)") : "var(--line)", background: hot ? "var(--inset)" : undefined }}>
                  <p className="font-mono text-xs">{el === "button" ? "<button>" : el === "card" ? "<section class=card>" : "<div id=page>"}{hot ? <span style={{ color: s.ran ? ACCENT : "var(--faint)" }}> · {s.phase}{s.ran ? "" : " (no listener runs)"}</span> : null}</p>
                  {i < PATH.length - 1 ? <div className="mt-2">{box(i + 1)}</div> : <span className="mt-2 inline-block rounded px-3 py-1 text-sm" style={{ background: ACCENT, color: "var(--on-accent)" }}>Buy</span>}
                </div>
              );
            };
            return box(0);
          })()}
          <p className="mt-3 text-xs text-[var(--muted)]">{s.phase === "capture" ? "↓ going down" : s.phase === "target" ? "• at the target" : "↑ bubbling up"} · depth {depth(s.el)}</p>
          <ol className="mt-2 space-y-0.5 font-mono text-xs">{log.map((x, i) => <li key={i}>{i + 1}. {x.el} ({x.phase}){x.note ? <span style={{ color: "var(--auto)" }}> {x.note}</span> : null}</li>)}</ol>
        </section>
      }
      panel={
        <SystemMapPanel caption={o === "stop" && s.el === "page" && s.phase === "bubble" ? "card stopped propagation, so page's bubble listener never runs." : o === "delegate" ? "Only page has a listener. It receives the bubbled click and checks event.target to see what was clicked: one listener for any number of buttons." : `${s.el}: ${s.phase} phase.`}>
          <Choices label="Listeners" accent={ACCENT} value={o} onChange={setO} options={OPTS} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next phase" status={`${playback.i + 1} of ${steps.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Capture: window down to the target" what="Listeners added with { capture: true } run on the way down. Rarely needed, but useful to intercept first." accent={ACCENT} active={s.phase === "capture"}><p className="font-mono text-xs">addEventListener(&quot;click&quot;, fn, true)</p></FlowStep>
          <FlowArrow label="arrive" accent={ACCENT} />
          <FlowStep n={2} title="Target" what="Listeners on the clicked element itself run." accent={ACCENT} active={s.phase === "target"}><p className="text-sm text-[var(--muted)]">event.target is always the button.</p></FlowStep>
          <FlowArrow label="back up" accent={ACCENT} />
          <FlowStep n={3} title="Bubble: back up to the window" what="Normal listeners run on each ancestor. stopPropagation() ends the trip; preventDefault() is different, it cancels the browser's default action." accent={ACCENT} active={s.phase === "bubble"}><p className="text-sm text-[var(--muted)]">event.currentTarget is the element whose listener is running.</p></FlowStep>
          <FlowArrow label="use it" accent={ACCENT} />
          <FlowStep n={4} title="Event delegation" what="Put one listener on a container instead of hundreds on its children. It also works for elements added later." accent={ACCENT} active={o === "delegate"}><p className="font-mono text-xs">e.target.closest(&quot;button&quot;)</p></FlowStep>
        </>
      }
    />
  );
}
