"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { fit, TRAIN, truthFn, VAL } from "@/lib/overfitting";

const ACCENT = "var(--ai)";
const X = (x: number) => 20 + ((x + 1.1) / 2.2) * 360;
const Y = (y: number) => 110 - Math.max(-1.8, Math.min(1.8, y)) * 55;

export default function OverfittingDemo() {
  const [deg, setDeg] = useState(3);
  const r = fit(deg);
  const path = (f: (x: number) => number) => Array.from({ length: 121 }, (_, i) => { const x = -1.05 + (2.1 * i) / 120; return `${i ? "L" : "M"}${X(x).toFixed(1)} ${Y(f(x)).toFixed(1)}`; }).join(" ");
  const all = Array.from({ length: 9 }, (_, i) => fit(i + 1));
  const mx = Math.max(...all.map((x) => Math.max(x.train, x.val)));
  return (
    <SessionPage>
      <SessionHeader kicker="AI · interactive" title="Overfitting" blurb="A model should learn the pattern, not memorise the examples. Fit curves of increasing flexibility to 10 noisy training points, then score them on 10 points they never saw." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Fit and errors">
              <svg viewBox="0 0 400 220" className="w-full">
                <path d={path(truthFn)} fill="none" stroke="var(--muted)" strokeDasharray="4 4" />
                <path d={path(r.f)} fill="none" stroke={ACCENT} strokeWidth="2.5" />
                {TRAIN.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r="4" fill={ACCENT} />)}
                {VAL.map((p, i) => <circle key={i} cx={X(p.x)} cy={Y(p.y)} r="4" fill="none" stroke="var(--good)" strokeWidth="1.5" />)}
              </svg>
              <p className="text-xs text-[var(--muted)]">Filled: training points. Rings: held-out points. Dashed: the true pattern.</p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Error by flexibility (degree 1–9)</p>
              <div className="mt-2 flex h-24 items-end gap-1">
                {all.map((x, i) => (
                  <span key={i} className="flex flex-1 items-end gap-0.5" style={{ height: "100%", outline: i + 1 === deg ? `1px solid ${ACCENT}` : undefined }}>
                    <span className="flex-1 rounded-t-sm" style={{ height: `${Math.max(2, (x.train / mx) * 100)}%`, background: ACCENT }} />
                    <span className="flex-1 rounded-t-sm" style={{ height: `${Math.max(2, (x.val / mx) * 100)}%`, background: "var(--good)" }} />
                  </span>
                ))}
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">Purple: training error. Green: held-out error.</p>
              <p className="mt-2 font-mono text-sm">train {r.train.toFixed(3)} · held-out <span style={{ color: r.val > 0.03 ? "var(--bad)" : "var(--good)" }}>{r.val.toFixed(3)}</span></p>
            </section>
          }
          panel={
            <SystemMapPanel caption={deg <= 1 ? "Too stiff to follow the curve: wrong on both sets. That's underfitting." : deg <= 4 ? "Flexible enough to follow the pattern, not the noise. Training and held-out errors are both low." : `Bends to pass through every training point, noise included. Training error keeps falling, held-out error rises: overfitting.`}>
              <Slider label="Model flexibility (polynomial degree)" accent={ACCENT} value={deg} min={1} max={9} step={1} format={String} onChange={setDeg} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Training error always falls" what="A flexible enough model can memorise any training set." accent={ACCENT}><p className="text-sm text-[var(--muted)]">So training error alone tells you little.</p></FlowStep>
              <FlowArrow label="hold some back" accent={ACCENT} />
              <FlowStep n={2} title="Measure on unseen data" what="Keep a validation set the model never trains on. That error is what users will experience." accent={ACCENT} active><p className="text-sm text-[var(--muted)]">And a final test set you look at once.</p></FlowStep>
              <FlowArrow label="the gap" accent={ACCENT} />
              <FlowStep n={3} title="A growing gap means memorising" what="When validation error rises while training error falls, the model is learning noise." accent={ACCENT} active={deg > 4}><p className="text-sm text-[var(--muted)]">Stop training there: early stopping.</p></FlowStep>
              <FlowArrow label="remedies" accent={ACCENT} />
              <FlowStep n={4} title="More data, less freedom" what="More examples, regularisation, dropout, smaller models. LLM fine-tunes overfit too: watch eval loss, not just training loss." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Same idea when you tune prompts on a few examples.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
