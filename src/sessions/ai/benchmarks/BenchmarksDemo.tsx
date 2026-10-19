"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { BENCHES, MODELS, SIZES, leaderboard, margin, pct, separablePairs, type BenchId } from "@/lib/benchmarks";

const ACCENT = "var(--ai)";

export default function BenchmarksDemo() {
  const [benchId, setBenchId] = useState<BenchId>("saturated");
  const [n, setN] = useState(BENCHES[1].questions);
  const [rephrased, setRephrased] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const bench = BENCHES.find((b) => b.id === benchId)!;
  const showRephrased = rephrased && !!bench.rephrased;
  const rows = leaderboard(bench, n, showRephrased);
  const original = leaderboard(bench, n);
  const { apart, pairs } = separablePairs(rows);
  const at = (i: number) => stage === i;
  const top = rows[0];

  const pick = (id: BenchId) => {
    setBenchId(id);
    setN(BENCHES.find((b) => b.id === id)!.questions);
    setRephrased(false);
  };

  // Zoom the axis so close scores are visible, but always show where 100% is.
  const lo = Math.max(0, Math.floor((Math.min(...rows.map((r) => r.lo), ...original.map((r) => r.lo)) - 0.03) * 20) / 20);
  const x = (v: number) => `${((Math.min(1, Math.max(lo, v)) - lo) / (1 - lo)) * 100}%`;

  const captions = [
    `Step 1: ${bench.label.toLowerCase()}, ${bench.questions.toLocaleString("en-US")} questions.`,
    `Step 2: ${top.model} scores highest, ${pct(top.score, 1)}.`,
    `Step 3: with ${n.toLocaleString("en-US")} questions each score is ±${pct(margin(top.score, n), 1)}. ${apart} of ${pairs} pairs can be told apart.`,
    bench.leaked ? `Step 4: ${showRephrased ? `rephrased, ${bench.leaked} drops ${pct(bench.scores[bench.leaked] - bench.rephrased![bench.leaked], 0)} and falls to #${rows.findIndex((r) => r.model === bench.leaked) + 1}.` : "rephrase the questions and see who drops."}` : "Step 4: no sign of contamination on this one.",
    `Step 5: ${apart === pairs ? "every pair is clearly apart" : apart === 0 ? "no pair can be told apart: the ranking is noise" : `only ${apart} of ${pairs} pairs differ by more than the noise`}.`,
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : bench.id === "saturated"
        ? `Everyone is near ${pct(bench.ceiling!, 1)}, the most the labels allow. Even with all ${bench.questions.toLocaleString("en-US")} questions, ${apart} of ${pairs} pairs can be told apart.`
        : bench.id === "leaked"
          ? showRephrased
            ? `Rephrased, ${bench.leaked} falls from #1 to #${rows.findIndex((r) => r.model === bench.leaked) + 1}. The others barely move: they had learned the skill, ${bench.leaked} had learned the answers.`
            : `${bench.leaked} leads by ${Math.round((rows[0].score - rows[1].score) * 100)} points. Turn on “rephrase the questions” in step 4.`
          : `${apart} of ${pairs} pairs can be told apart with ${n.toLocaleString("en-US")} questions. Drop to 200 and most of the ranking turns into ties.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Benchmarks"
        blurb="A benchmark is a fixed set of questions with known answers, and a leaderboard is everyone's score on it. Five models on three benchmarks: a fresh one, an old one everyone has maxed out, and one that leaked into a model's training data. See when the ranking means something."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={`Leaderboard on the ${bench.label.toLowerCase()} benchmark`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {bench.label} · {n.toLocaleString("en-US")} questions{showRephrased ? " · rephrased" : ""}
                </p>
                <p className="font-mono text-xs text-[var(--muted)]">
                  {apart}/{pairs} pairs apart
                </p>
              </div>
              <ol className="mt-4 space-y-3">
                {rows.map((r) => {
                  const before = original.find((o) => o.model === r.model)!;
                  const leaked = bench.leaked === r.model;
                  return (
                    <li key={r.model} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-sm">
                      <span className="font-mono text-xs">
                        <span className="text-[var(--faint)]">#{r.rank}</span> {r.model.replace("Model ", "")}
                        {leaked && <span style={{ color: "var(--bad)" }}> ⚠</span>}
                      </span>
                      <span className="relative h-5 rounded bg-[var(--track)]">
                        {showRephrased && <span className="absolute inset-y-1 left-0 rounded opacity-30" style={{ width: x(before.score), background: leaked ? "var(--bad)" : ACCENT }} />}
                        <span className="absolute inset-y-1 left-0 rounded transition-[width] duration-500" style={{ width: x(r.score), background: leaked && !showRephrased ? "var(--bad)" : ACCENT }} />
                        <span className="absolute top-0 h-full border-x-2 border-[var(--text)] opacity-70" style={{ left: x(r.lo), width: `calc(${x(r.hi)} - ${x(r.lo)})` }} />
                        {bench.ceiling && <span className="absolute inset-y-0 border-r-2 border-dashed border-[var(--good)]" style={{ left: x(bench.ceiling) }} />}
                      </span>
                      <span className="text-right font-mono text-xs">{pct(r.score, 1)}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-2 flex justify-between pl-[5rem] pr-[4rem] font-mono text-[10px] text-[var(--faint)]">
                <span>{pct(lo)}</span>
                <span>100%</span>
              </div>
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                <span>|—| 95% interval</span>
                {bench.ceiling && <span style={{ color: "var(--good)" }}>┊ best possible ({pct(bench.ceiling, 1)}: label errors)</span>}
                {bench.leaked && <span style={{ color: "var(--bad)" }}>⚠ trained on the test</span>}
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Benchmark" accent={ACCENT} value={bench.id} onChange={pick} options={BENCHES.map((b) => ({ id: b.id, label: b.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Scoring…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Fix a set of questions" what="Same questions, same answers, same grading for every model. That's what makes scores comparable, and also what lets them leak and go stale." accent={ACCENT} active={at(0)}>
                <p className="text-sm">{bench.what}</p>
                <p className="mt-1 font-mono text-xs text-[var(--faint)]">{bench.questions.toLocaleString("en-US")} questions</p>
              </FlowStep>
              <FlowArrow label="every model, same questions" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Run every model and score it" what="Usually the share of questions answered correctly. Prompt format, few-shot examples and answer parsing all move the number, so compare only scores run the same way." accent={ACCENT} active={at(1)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {MODELS.map((m) => (
                    <li key={m}>
                      {m}: {pct(bench.scores[m], 1)}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="5 scores" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Put error bars on them" what="A score from n questions is an estimate. Its 95% interval is about ±1.96·√(p(1−p)/n). When two intervals overlap, the ranking between them is a coin toss." accent={ACCENT} active={at(2)}>
                <Choices label="Questions in the test" accent={ACCENT} value={String(n)} onChange={(v) => setN(Number(v))} options={SIZES.map((s) => ({ id: String(s), label: s.toLocaleString("en-US") }))} />
                <p className="mt-2 font-mono text-sm">
                  ±{pct(margin(top.score, n), 1)} · {apart} of {pairs} pairs apart
                </p>
              </FlowStep>
              <FlowArrow label="scores with intervals" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Check for contamination" what="If test questions were on the web, they may be in the training data, and the model recalls answers instead of working them out. Rephrase the questions: a real skill survives, a memorized answer doesn't." accent={ACCENT} active={at(3)}>
                {bench.rephrased ? (
                  <>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" checked={rephrased} onChange={(e) => setRephrased(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                      Rephrase the questions
                    </label>
                    <ul className="space-y-0.5 font-mono text-xs">
                      {MODELS.map((m) => {
                        const drop = bench.scores[m] - bench.rephrased![m];
                        return (
                          <li key={m} style={{ color: drop > 0.05 ? "var(--bad)" : "var(--text)" }}>
                            {m}: {pct(bench.scores[m], 1)} → {pct(bench.rephrased![m], 1)} ({drop > 0 ? "−" : "+"}
                            {pct(Math.abs(drop), 1)})
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-[var(--muted)]">Pick “Leaked into training” to try it.</p>
                )}
              </FlowStep>
              <FlowArrow label="a ranking you can trust, or not" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Read the ranking with care" what="A benchmark stops meaning much once every model is near its ceiling or has seen its questions. New, harder sets replace it, and the cycle starts again." accent={ACCENT} active={at(4)}>
                <p className="text-sm">
                  {bench.ceiling
                    ? `About 6.5% of MMLU's questions have wrong or unclear answers (Gema et al. 2024), so ~${pct(bench.ceiling, 1)} is the real top. Models within a point of each other are tied.`
                    : bench.leaked
                      ? "Labs now check for overlap between training data and test sets, and publish private or rephrased variants for exactly this reason."
                      : "A fresh, private, hard test is the useful kind, until it is published and starts to leak."}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">For your own product, a few hundred of your real tasks graded your way beats any public leaderboard.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
