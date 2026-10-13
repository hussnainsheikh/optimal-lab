"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { curve, EASINGS, PROPS } from "@/lib/easing";

const ACCENT = "var(--web)";

export default function AnimationsDemo() {
  const [e, setE] = useState("ease");
  const [prop, setProp] = useState("transform");
  const [on, setOn] = useState(false);
  const ez = EASINGS.find((x) => x.id === e)!;
  const pr = PROPS.find((x) => x.id === prop)!;
  const pts = curve(ez.p);
  const style = prop === "transform" ? { transform: on ? "translateX(240px)" : "translateX(0)", transition: `transform 1s ${ez.css}` } : prop === "left" ? { position: "relative" as const, left: on ? 240 : 0, transition: `left 1s ${ez.css}` } : { width: on ? 280 : 40, transition: `width 1s ${ez.css}` };
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="CSS transitions and animations" blurb="Easing decides how motion feels: linear looks mechanical, ease-out feels responsive, an overshoot feels springy. Which property you animate decides how expensive each frame is. This box is animated by your browser." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Animation">
              <div className="overflow-hidden rounded-lg bg-[var(--inset)] p-3" style={{ maxWidth: 320 }}><div className="h-10 w-10 rounded" style={{ background: ACCENT, ...style }} /></div>
              <button type="button" onClick={() => setOn((v) => !v)} className="mt-3 min-h-11 rounded-md px-4 text-sm" style={{ background: ACCENT, color: "var(--on-accent)" }}>{on ? "Move back" : "Move"}</button>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Easing curve</p>
                  <svg viewBox="-10 -40 140 180" className="mt-1 w-full max-w-[200px]"><rect x="0" y="0" width="120" height="120" fill="none" stroke="var(--line)" /><path d={pts.map((p, i) => `${i ? "L" : "M"}${(p.x * 120).toFixed(1)} ${(120 - p.y * 120).toFixed(1)}`).join(" ")} fill="none" stroke={ACCENT} strokeWidth="2.5" /><text x="0" y="135" fontSize="9" fill="var(--faint)">time →</text><text x="-8" y="-5" fontSize="9" fill="var(--faint)">progress</text></svg>
                  <p className="font-mono text-[11px]">{ez.css}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Work per frame</p>
                  <ol className="mt-1 space-y-1">{["layout", "paint", "composite"].map((s) => <li key={s} className="rounded px-2 py-1 text-xs" style={{ background: pr.stages.includes(s) ? (s === "composite" ? "var(--good)" : "var(--bad)") : "var(--inset)", color: pr.stages.includes(s) ? "var(--on-accent)" : "var(--faint)" }}>{s}</li>)}</ol>
                </div>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={pr.note}>
              <Choices label="Easing" accent={ACCENT} value={e} onChange={setE} options={EASINGS.map((x) => ({ id: x.id, label: x.id }))} />
              <Choices label="Animate" accent={ACCENT} value={prop} onChange={setProp} options={PROPS.map((x) => ({ id: x.id, label: x.label }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Transitions for state changes" what="When a property changes, interpolate over a duration with an easing curve." accent={ACCENT}><p className="font-mono text-xs">transition: transform 200ms ease-out</p></FlowStep>
              <FlowArrow label="feel" accent={ACCENT} />
              <FlowStep n={2} title="Pick easing on purpose" what="ease-out for things entering (fast start, gentle stop), ease-in for leaving, overshoot sparingly." accent={ACCENT}><p className="text-sm text-[var(--muted)]">UI motion: 150–300 ms.</p></FlowStep>
              <FlowArrow label="cost" accent={ACCENT} />
              <FlowStep n={3} title="Animate transform and opacity" what="They skip layout and paint and run on the compositor. Animating left, top or width relayouts every frame." accent={ACCENT} active={prop !== "transform"}><p className="text-sm text-[var(--muted)]">Check with DevTools&apos; Performance panel.</p></FlowStep>
              <FlowArrow label="respect users" accent={ACCENT} />
              <FlowStep n={4} title="prefers-reduced-motion" what="Some people get motion sick. Tone down or remove non-essential animation when they ask." accent={ACCENT}><p className="font-mono text-xs">@media (prefers-reduced-motion: reduce)</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
