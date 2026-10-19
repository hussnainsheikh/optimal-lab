"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { KS, RUNS, STAGE_LABEL, START, diagnose, metrics, type Settings, type Stage } from "@/lib/answerQuality";

const ACCENT = "var(--sys)";
const STAGE_COLOR: Record<Stage, string> = { ok: "var(--good)", retrieval: "var(--bad)", ranking: "var(--c4)", "generation-ignored": "var(--c3)", "generation-added": "var(--c1)" };
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function AnswerQualityDemo() {
  const [s, setS] = useState<Settings>(START);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (patch: Partial<Settings>) => setS((cur) => ({ ...cur, ...patch }));
  const m = metrics(s);

  const captions = [
    `Step 1: ${RUNS.length} questions, each with a known answer and the chunk that contains it.`,
    `Step 2: retrieval puts the right chunk in the top ${s.k} for ${pct(m.recallAtK)} of questions.`,
    `Step 3: when it does, the answer sticks to the context ${pct(m.faithfulness)} of the time.`,
    `Step 4: ${m.byStage.ok} of ${RUNS.length} answers are correct; ${RUNS.length - m.byStage.ok} fail at a specific stage.`,
    `Step 5: fix the stage with the most failures first.`,
  ];
  const caption = stage !== null ? captions[stage] : `${m.byStage.ok} of ${RUNS.length} correct · recall@${s.k} ${pct(m.recallAtK)} · faithfulness ${pct(m.faithfulness)} · failures: ${(Object.keys(m.byStage) as Stage[]).filter((k) => k !== "ok" && m.byStage[k]).map((k) => `${m.byStage[k]} ${k.split("-")[0]}`).join(", ") || "none"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Retrieval quality vs answer quality"
        blurb={`A docs assistant gets ${RUNS.length} questions with known answers. When an answer is wrong, the fix depends on where it went wrong: the search never found the right page, found it but ranked it too low, or the model had it and ignored it or added things. Measure each stage separately, then try the fix for each.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Each question, where the right chunk ranked, and which stage failed">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">eval set · top {s.k} to the model</p>
                <p className="font-mono text-xs" style={{ color: m.byStage.ok === RUNS.length ? "var(--good)" : "var(--text)" }}>
                  {m.byStage.ok}/{RUNS.length} correct
                </p>
              </div>
              <ul className="mt-3 space-y-1.5">
                {RUNS.map((r) => {
                  const d = diagnose(r, s);
                  return (
                    <li key={r.q} className="grid grid-cols-[minmax(0,1fr)_3rem] items-baseline gap-2 text-xs">
                      <span className="min-w-0">
                        <span className="block">{r.q}</span>
                        <span className="font-mono text-[11px]" style={{ color: STAGE_COLOR[d.stage] }}>
                          {STAGE_LABEL[d.stage]}
                        </span>
                      </span>
                      <span className="text-right font-mono text-[11px] text-[var(--muted)]">{d.rank ? `#${d.rank}` : "–"}</span>
                    </li>
                  );
                })}
              </ul>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <Stat label={`recall@${s.k}`} value={pct(m.recallAtK)} />
                <Stat label={`precision@${s.k}`} value={pct(m.precisionAtK)} />
                <Stat label="faithfulness" value={pct(m.faithfulness)} />
                <Stat label="correct" value={pct(m.correctness)} />
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Evaluating…">
                Run the eval
              </RunButton>
              <button type="button" onClick={() => setS(START)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                Reset
              </button>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Label the right chunk for each question" what="An eval set for RAG needs more than question and answer: it needs which chunk (or document) holds the answer. That's what lets you score retrieval on its own." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">{RUNS.length} questions · 1 relevant chunk each</p>
              </FlowStep>
              <FlowArrow label="score retrieval" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Score retrieval: is the chunk found, and how high?" what="Recall@k: the share of questions whose chunk is in the top k sent to the model. A chunk outside the top 10 is a retrieval problem (chunking, embeddings, query). Inside the 10 but below k is a ranking problem." accent={ACCENT} active={at(1)}>
                <Choices label="Chunks sent to the model (k)" accent={ACCENT} value={String(s.k)} onChange={(v) => set({ k: Number(v) })} options={KS.map((k) => ({ id: String(k), label: String(k) }))} />
                <Toggle checked={s.rerank} onChange={(v) => set({ rerank: v })} label="Rerank the top 10 with a cross-encoder" />
                <Toggle checked={s.chunking} onChange={(v) => set({ chunking: v })} label="Re-chunk the export and account pages" />
                <p className="font-mono text-xs">
                  recall@{s.k} {pct(m.recallAtK)} · not found {m.byStage.retrieval} · ranked too low {m.byStage.ranking}
                </p>
              </FlowStep>
              <FlowArrow label="score generation" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Score generation: faithful to the context?" what="Given the right chunk, does the answer use it, and only it? Faithfulness is the share of answers whose claims are all supported by the context; an LLM judge or an entailment model checks each claim." accent={ACCENT} active={at(2)}>
                <Toggle checked={s.strict} onChange={(v) => set({ strict: v })} label="Prompt: answer only from the context, cite each claim" />
                <p className="font-mono text-xs">
                  faithfulness {pct(m.faithfulness)} · ignored the context {m.byStage["generation-ignored"]} · added claims {m.byStage["generation-added"]}
                </p>
              </FlowStep>
              <FlowArrow label="end to end" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Attribute each failure to one stage" what="An overall “correct” score says how bad things are, not where. Classify every wrong answer by the first stage that failed, and the next fix is obvious." accent={ACCENT} active={at(3)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {(Object.keys(m.byStage) as Stage[]).map((k) => (
                    <li key={k} style={{ color: STAGE_COLOR[k] }}>
                      {STAGE_LABEL[k]}: {m.byStage[k]}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="fix in order" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Fix the biggest bucket, then re-run" what="More context (a bigger k) finds more but buries the answer and makes the model wander. A reranker moves the right chunk up without sending more. A strict prompt fixes generation; chunking fixes what retrieval can't find at all." accent={ACCENT} active={at(4)}>
                <p className="text-xs">
                  Try: rerank at k = 3, then the strict prompt, then re-chunking. Each change moves questions out of one bucket.
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The retrieval lists and model behaviour are fixed inputs; every metric and diagnosis is computed from them.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
}
