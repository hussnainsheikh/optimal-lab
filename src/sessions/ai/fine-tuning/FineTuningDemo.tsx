"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { EPOCH_COUNTS, EXAMPLE_COUNTS, GENERAL_BASE, GOALS, PRICE, TOKENS, generalScore, lossCurves, pct, servingCost, taskScore, trainingCost, usd, type GoalId } from "@/lib/fineTuning";

const ACCENT = "var(--ai)";

export default function FineTuningDemo() {
  const [goalId, setGoalId] = useState<GoalId>("format");
  const [n, setN] = useState(200);
  const [epochs, setEpochs] = useState(3);
  const [mix, setMix] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const goal = GOALS.find((g) => g.id === goalId)!;
  const task = taskScore(goal, n, epochs);
  const general = generalScore(epochs, mix);
  const curves = lossCurves(goal, n);
  const at = (i: number) => stage === i;
  const methods = [
    { id: "prompt", label: "Instructions only", short: "Instructions", score: goal.prompt, cost: servingCost("prompt") },
    { id: "fewShot", label: "Few-shot prompt", short: "Few-shot", score: goal.fewShot, cost: servingCost("fewShot") },
    { id: "rag", label: "RAG", short: "RAG", score: goal.rag, cost: servingCost("rag") },
    { id: "tuned", label: "Fine-tuned", short: "Fine-tuned", score: task, cost: servingCost("tuned") },
  ];
  const best = methods.reduce((a, b) => (b.score > a.score ? b : a));
  const overfitting = curves.held[epochs - 1] > curves.held[Math.max(0, epochs - 2)] + 0.02 && epochs > 1;

  const captions = [
    `Step 1: the goal is “${goal.label.toLowerCase()}”. ${goal.what}`,
    `Step 2: ${n.toLocaleString("en-US")} examples of the input and the answer you want.`,
    `Step 3: ${epochs} ${epochs === 1 ? "pass" : "passes"} over them. Training loss ${curves.train[epochs - 1].toFixed(2)}, held-out loss ${curves.held[epochs - 1].toFixed(2)}${overfitting ? ": the held-out loss is rising, so it is memorizing." : "."}`,
    `Step 4: ${pct(task)} on the task, and general ability ${pct(general)} (was ${pct(GENERAL_BASE)}).`,
    `Step 5: ${best.label} wins for this goal at ${pct(best.score)}.`,
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : best.id === "tuned"
        ? `Fine-tuning wins for this goal: ${pct(task)} against ${pct(Math.max(goal.prompt, goal.fewShot, goal.rag))} for the best prompt or RAG.${overfitting ? " Fewer epochs would do as well with less forgetting." : ""}`
        : `${best.label} wins for this goal at ${pct(best.score)}; fine-tuning reaches ${pct(task)}. ${goal.id === "facts" ? "Facts change, and a fine-tuned model can't say where it learned one." : "More examples would help: see step 2."}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Fine-tuning"
        blurb="Fine-tuning keeps training a model on your own examples. It is the best way to lock in a format or a voice, a slow way to teach a new skill, and the wrong way to add facts. Pick a goal, choose how many examples and how many passes, and compare the result with a good prompt and with retrieval."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Task score and general ability for each approach, and the training curves">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                {goal.label} · {n.toLocaleString("en-US")} examples × {epochs} {epochs === 1 ? "epoch" : "epochs"}
              </p>
              <ul className="mt-3 space-y-2">
                {methods.map((m) => (
                  <li key={m.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.75rem] items-center gap-2 text-sm">
                    <span className="truncate" style={{ fontWeight: m.id === "tuned" ? 600 : 400 }}>
                      {m.short}
                    </span>
                    <span className="h-3 rounded bg-[var(--track)]">
                      <span className="block h-full rounded transition-[width] duration-300" style={{ width: `${m.score * 100}%`, background: m.id === best.id ? "var(--good)" : ACCENT }} />
                    </span>
                    <span className="text-right font-mono text-xs">{pct(m.score)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
                  <dt className="text-[11px] text-[var(--muted)]">on your task</dt>
                  <dd className="font-mono text-base">{pct(task)}</dd>
                </div>
                <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
                  <dt className="text-[11px] text-[var(--muted)]">general ability (was {pct(GENERAL_BASE)})</dt>
                  <dd className="font-mono text-base" style={{ color: general < 0.85 ? "var(--bad)" : "var(--text)" }}>
                    {pct(general)}
                  </dd>
                </div>
              </dl>
              <LossChart curves={curves} epochs={epochs} />
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Goal" accent={ACCENT} value={goalId} onChange={setGoalId} options={GOALS.map((g) => ({ id: g.id, label: g.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Training…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Decide what should change" what="Fine-tuning changes how the model answers, not what it knows. Format, tone and a narrow skill are good goals; a changing body of facts is not." accent={ACCENT} active={at(0)}>
                <p className="text-sm">{goal.what}</p>
              </FlowStep>
              <FlowArrow label="the goal" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Collect examples" what="Each example is an input and the exact answer you want. A format needs tens; a style, hundreds; a skill, thousands. Quality matters more than count: the model copies mistakes too." accent={ACCENT} active={at(1)}>
                <Choices label="Examples" accent={ACCENT} value={String(n)} onChange={(v) => setN(Number(v))} options={EXAMPLE_COUNTS.map((c) => ({ id: String(c), label: c.toLocaleString("en-US") }))} />
                <p className="mt-2 font-mono text-xs">
                  most of the way there by about {goal.n0.toLocaleString("en-US")} examples for this goal
                </p>
              </FlowStep>
              <FlowArrow label={`${n.toLocaleString("en-US")} examples`} accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Train for a few epochs" what="One epoch is one pass over the examples. Watch the held-out loss: when it starts rising while training loss keeps falling, the model is memorizing your examples instead of learning from them." accent={ACCENT} active={at(2)}>
                <Choices label="Epochs" accent={ACCENT} value={String(epochs)} onChange={(v) => setEpochs(Number(v))} options={EPOCH_COUNTS.map((e) => ({ id: String(e), label: String(e) }))} />
                <p className="mt-2 font-mono text-xs">
                  {n.toLocaleString("en-US")} × {epochs} × {TOKENS.example} tokens at ${PRICE.train}/M = {usd(trainingCost(n, epochs))} to train
                </p>
              </FlowStep>
              <FlowArrow label="a fine-tuned model" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Check the task, and everything else" what="Score it on held-out examples of your task. Then score it on a general benchmark: narrow training pushes other abilities down a little with every epoch (catastrophic forgetting)." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={mix} onChange={(e) => setMix(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Mix general examples into the training set
                </label>
                <p className="font-mono text-xs">
                  task {pct(task)} · general {pct(GENERAL_BASE)} → {pct(general)}
                </p>
              </FlowStep>
              <FlowArrow label="compare" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Compare with prompting and RAG" what="Always try a good prompt first: it needs no training and changes in a minute. RAG beats fine-tuning on facts. Fine-tuning pays off when it wins on quality, or when it lets you drop a long prompt from every request." accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">score</span>
                  <span className="text-right text-[var(--faint)]">per 1M requests</span>
                  {methods.map((m) => (
                    <Row key={m.id} label={m.label} score={pct(m.score)} cost={usd(m.cost)} bold={m.id === best.id} />
                  ))}
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  The few-shot prompt carries {TOKENS.fewShot} extra tokens on every request and RAG {TOKENS.rag.toLocaleString("en-US")}; the fine-tuned model carries none, but costs a little more per token.
                </p>
                <p className="mt-1 text-xs text-[var(--faint)]">Scores are a teaching model of the usual pattern; prices are typical hosted rates.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ label, score, cost, bold }: { label: string; score: string; cost: string; bold: boolean }) {
  const w = bold ? 700 : 400;
  return (
    <>
      <span className="font-sans" style={{ fontWeight: w }}>
        {label}
      </span>
      <span className="text-right" style={{ fontWeight: w }}>
        {score}
      </span>
      <span className="text-right" style={{ fontWeight: w }}>
        {cost}
      </span>
    </>
  );
}

function LossChart({ curves, epochs }: { curves: { train: number[]; held: number[] }; epochs: number }) {
  const W = 320;
  const H = 130;
  const pad = { l: 30, r: 10, t: 8, b: 24 };
  const max = 2.6;
  const x = (e: number) => pad.l + ((e - 1) / 9) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - Math.min(max, v) / max) * (H - pad.t - pad.b);
  const line = (vs: number[]) => vs.map((v, i) => `${x(i + 1)},${y(v)}`).join(" ");
  return (
    <figure className="mx-auto mt-4 max-w-lg">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Training and held-out loss by epoch">
        {[0, 1, 2].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={0.6} />
            <text x={pad.l - 5} y={y(t) + 3} textAnchor="end" fontSize={8} fill="var(--faint)">
              {t}
            </text>
          </g>
        ))}
        {[1, 3, 5, 10].map((e) => (
          <text key={e} x={x(e)} y={H - 12} textAnchor="middle" fontSize={8} fill={e === epochs ? "var(--text)" : "var(--faint)"} fontWeight={e === epochs ? 700 : 400}>
            {e}
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--faint)">
          epochs
        </text>
        <line x1={x(epochs)} x2={x(epochs)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" strokeDasharray="2 2" strokeWidth={0.8} />
        <polyline points={line(curves.train)} fill="none" stroke={ACCENT} strokeWidth={1.8} />
        <polyline points={line(curves.held)} fill="none" stroke="var(--bad)" strokeWidth={1.8} />
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: ACCENT }} />
          training loss {curves.train[epochs - 1].toFixed(2)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[var(--bad)]" />
          held-out loss {curves.held[epochs - 1].toFixed(2)}
        </span>
      </figcaption>
    </figure>
  );
}
