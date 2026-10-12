"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { LEARNING_RATES, POINTS, bestFit, descend, predict } from "@/lib/gradientDescent";

const ACCENT = "var(--ai)";
const BEST = bestFit();

// plot area: x 0–4.5, y 0–11 → a 100 × 64 box
const X0 = 8;
const X1 = 96;
const Y0 = 58;
const Y1 = 4;
const sx = (x: number) => X0 + (x / 4.5) * (X1 - X0);
const sy = (y: number) => Y0 - (y / 11) * (Y0 - Y1);
const fmt = (n: number) => (Math.abs(n) >= 1000 ? n.toExponential(1) : n.toFixed(2));

export default function TrainingDemo() {
  const [rateId, setRateId] = useState<(typeof LEARNING_RATES)[number]["id"]>("good");
  const rate = LEARNING_RATES.find((r) => r.id === rateId) ?? LEARNING_RATES[1];
  const frames = descend(rate.rate);
  const playback = usePlayback(frames.length, 450);
  const f = frames[playback.i];
  const next = frames[playback.i + 1];

  const caption = f.diverged
    ? `Step ${f.step}: the loss is ${fmt(f.loss)} and still growing. Each step overshoots further: the learning rate is too big.`
    : f.step === 0
      ? `Start with w = 0 and b = 0: a flat line. The loss is ${fmt(f.loss)}. Press Play to train.`
      : `Step ${f.step}: w = ${f.w.toFixed(2)}, b = ${f.b.toFixed(2)}, loss ${fmt(f.loss)}${playback.atEnd ? `. The best possible is ${BEST.loss.toFixed(2)}.` : "."}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Training: loss and gradient descent"
        blurb="Every model, from this line to a large language model, learns the same way: guess, measure how wrong the guess is, work out which way is downhill, and take a small step. Watch it fit a line, then change the step size."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The points, the model's line and the loss">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  Step {f.step} of {frames.length - 1}
                </p>
                <p className="font-mono text-xs text-[var(--muted)]">
                  y = {fmt(f.w)}·x + {fmt(f.b)}
                </p>
              </div>
              <svg viewBox="0 0 100 64" className="mt-3 h-auto w-full" role="img" aria-label={caption}>
                <defs>
                  <clipPath id="plot-area">
                    <rect x={X0} y={Y1} width={X1 - X0} height={Y0 - Y1} />
                  </clipPath>
                </defs>
                <line x1={X0} y1={Y0} x2={X1} y2={Y0} strokeWidth={0.3} style={{ stroke: "var(--line-strong)" }} />
                <line x1={X0} y1={Y0} x2={X0} y2={Y1} strokeWidth={0.3} style={{ stroke: "var(--line-strong)" }} />
                {[0, 5, 10].map((y) => (
                  <text key={y} x={X0 - 2} y={sy(y) + 1} fontSize={2.6} textAnchor="end" style={{ fill: "var(--faint)" }}>
                    {y}
                  </text>
                ))}
                <g clipPath="url(#plot-area)">
                  {/* the best possible line, for reference */}
                  <line x1={sx(0)} y1={sy(BEST.b)} x2={sx(4.5)} y2={sy(predict(BEST.w, BEST.b, 4.5))} strokeWidth={0.4} strokeDasharray="1.2 1.2" style={{ stroke: "var(--faint)" }} />
                  {/* errors: from each point to the line */}
                  {POINTS.map((p) => (
                    <line key={`e${p.x}`} x1={sx(p.x)} y1={sy(p.y)} x2={sx(p.x)} y2={sy(predict(f.w, f.b, p.x))} strokeWidth={0.4} style={{ stroke: "var(--bad)", opacity: 0.7 }} />
                  ))}
                  <line x1={sx(0)} y1={sy(f.b)} x2={sx(4.5)} y2={sy(predict(f.w, f.b, 4.5))} strokeWidth={0.9} style={{ stroke: ACCENT }} />
                </g>
                {POINTS.map((p) => (
                  <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={1.2} style={{ fill: "var(--text)" }} />
                ))}
              </svg>
              <LossChart frames={frames.map((x) => x.loss)} at={playback.i} />
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: ACCENT }} /> model</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-[var(--bad)]" /> error per point</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 border-t border-dashed border-[var(--faint)]" /> best possible line</span>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices
                label="Learning rate (step size)"
                accent={ACCENT}
                value={rateId}
                onChange={(id) => {
                  setRateId(id);
                  playback.reset();
                }}
                options={LEARNING_RATES.map((r) => ({ id: r.id, label: r.label }))}
              />
              <p className="w-full text-xs text-[var(--muted)]">{rate.note}</p>
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`loss ${fmt(f.loss)}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Predict with the current guess" what="The model is y = w·x + b. Two numbers, w and b, are all it can learn. A large language model has billions of them." accent={ACCENT} active={playback.i === 0}>
                <p className="font-mono text-sm">
                  w = {fmt(f.w)}, b = {fmt(f.b)}
                </p>
              </FlowStep>
              <FlowArrow label="a prediction per point" accent={ACCENT} />

              <FlowStep n={2} title="Measure the loss" what="Square each error (the red lines) and average them. One number that says how wrong the model is: lower is better." accent={ACCENT} active={playback.i > 0 && !playback.atEnd}>
                <p className="font-mono text-sm">
                  loss = {fmt(f.loss)} <span className="text-[var(--faint)]">(best possible {BEST.loss.toFixed(2)})</span>
                </p>
              </FlowStep>
              <FlowArrow label="one number" accent={ACCENT} />

              <FlowStep n={3} title="Find the downhill direction" what="The gradient says how the loss changes if you nudge w or b. Calculus does this exactly; in big models it's called backpropagation." accent={ACCENT}>
                <p className="font-mono text-sm">
                  ∂loss/∂w = {fmt(f.gradW)}, ∂loss/∂b = {fmt(f.gradB)}
                </p>
              </FlowStep>
              <FlowArrow label="the gradient" accent={ACCENT} />

              <FlowStep n={4} title="Take a step downhill, then repeat" what="Move each number against its gradient, scaled by the learning rate. Too small and training crawls. Too big and every step overshoots." accent={ACCENT} active={playback.atEnd}>
                {next ? (
                  <p className="font-mono text-sm">
                    w ← {fmt(f.w)} − {rate.rate} × {fmt(f.gradW)} = {fmt(next.w)}
                  </p>
                ) : (
                  <p className="text-sm">
                    {f.diverged
                      ? "Training blew up. Pick a smaller learning rate and play again."
                      : `Done after ${f.step} steps. Same loop, same idea, for every neural network.`}
                  </p>
                )}
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function LossChart({ frames, at }: { frames: number[]; at: number }) {
  // log scale, so a loss of 0.13 and 12,000 both fit
  const lo = Math.log10(0.1);
  const hi = Math.log10(Math.max(100, ...frames));
  const y = (l: number) => 26 - ((Math.log10(Math.max(l, 0.1)) - lo) / (hi - lo)) * 22;
  const x = (i: number) => 8 + (i / 40) * 88;
  const pts = frames.slice(0, at + 1).map((l, i) => `${x(i)},${y(l)}`).join(" ");
  return (
    <div className="mt-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Loss over steps (log scale)</p>
      <svg viewBox="0 0 100 30" className="mt-1 h-auto w-full" role="img" aria-label={`Loss after step ${at}: ${frames[at].toFixed(2)}`}>
        <line x1={8} y1={26} x2={96} y2={26} strokeWidth={0.3} style={{ stroke: "var(--line-strong)" }} />
        <line x1={8} y1={y(BEST.loss)} x2={96} y2={y(BEST.loss)} strokeWidth={0.3} strokeDasharray="1 1" style={{ stroke: "var(--faint)" }} />
        <polyline points={pts} fill="none" strokeWidth={0.7} style={{ stroke: ACCENT }} />
        <circle cx={x(at)} cy={y(frames[at])} r={1} style={{ fill: ACCENT }} />
      </svg>
    </div>
  );
}

