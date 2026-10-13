"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { COMPUTES, curve, fmt } from "@/lib/scalingLaws";

const ACCENT = "var(--ai)";
const LX = (N: number) => 30 + ((Math.log10(N) - 7) / 5.5) * 350;
const LY = (L: number) => 200 - ((L - 1.8) / 1.8) * 180;

export default function ScalingDemo() {
  const [ci, setCi] = useState(3);
  const all = COMPUTES.map((c) => curve(c));
  const cur = all[ci];
  const ratio = cur.best.D / cur.best.N;
  return (
    <SessionPage>
      <SessionHeader kicker="AI · interactive" title="Scaling laws" blurb="With a fixed training budget, you can train a bigger model on less data or a smaller one on more. Loss follows a predictable curve in both, so there's a best split. Each curve below is one budget; the dot is its sweet spot." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Loss vs model size">
              <svg viewBox="0 0 400 230" className="w-full">
                {[1e7, 1e8, 1e9, 1e10, 1e11, 1e12].map((n) => <g key={n}><line x1={LX(n)} x2={LX(n)} y1="15" y2="200" stroke="var(--line)" /><text x={LX(n)} y="215" fontSize="10" textAnchor="middle" fill="var(--faint)">{fmt(n)}</text></g>)}
                {all.map((c, i) => <path key={i} d={c.pts.filter((p) => p.L < 3.6).map((p, j) => `${j ? "L" : "M"}${LX(p.N).toFixed(1)} ${LY(p.L).toFixed(1)}`).join(" ")} fill="none" stroke={i === ci ? ACCENT : "var(--ghost)"} strokeWidth={i === ci ? 2.5 : 1.2} />)}
                {all.map((c, i) => <circle key={i} cx={LX(c.best.N)} cy={LY(c.best.L)} r={i === ci ? 5 : 3} fill={i === ci ? ACCENT : "var(--muted)"} />)}
              </svg>
              <p className="text-xs text-[var(--muted)]">x: parameters (log scale). y: loss, lower is better. Each curve is a valley; more compute moves it down.</p>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                {[["Best size", fmt(cur.best.N) + " params"], ["Training tokens", fmt(cur.best.D)], ["Loss", cur.best.L.toFixed(2)]].map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono">{v}</dd></div>)}
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={`With 10^${Math.log10(COMPUTES[ci])} FLOPs, the best model has about ${fmt(cur.best.N)} parameters trained on ${fmt(cur.best.D)} tokens: ~${Math.round(ratio)} tokens per parameter. Go bigger and it's undertrained; smaller and it can't absorb the data.`}>
              <Slider label="Training compute" accent={ACCENT} value={ci} min={0} max={COMPUTES.length - 1} step={1} format={(i) => `10^${Math.log10(COMPUTES[i])} FLOPs`} onChange={setCi} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Loss falls as a power law" what="Double the model or the data and loss drops by a predictable amount. Labs fit these curves on small runs to plan huge ones." accent={ACCENT}><p className="font-mono text-xs">L = E + A/N^α + B/D^β</p></FlowStep>
              <FlowArrow label="fixed budget" accent={ACCENT} />
              <FlowStep n={2} title="Compute = parameters × tokens" what="Training costs about 6 FLOPs per parameter per token. For a budget, more parameters means fewer tokens." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Each curve is one budget.</p></FlowStep>
              <FlowArrow label="balance" accent={ACCENT} />
              <FlowStep n={3} title="Compute-optimal: ~20 tokens per parameter" what="DeepMind's Chinchilla showed earlier models were too big for their data. Scale both together." accent={ACCENT} active><p className="text-sm text-[var(--muted)]">From the fitted constants in that paper.</p></FlowStep>
              <FlowArrow label="but" accent={ACCENT} />
              <FlowStep n={4} title="Inference changes the maths" what="A model is trained once but run billions of times, so labs often train smaller models on far more data than “optimal”. Loss also isn't the same as usefulness." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Llama 3 8B saw ~15T tokens.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
