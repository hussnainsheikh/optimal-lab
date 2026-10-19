"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { LENGTHS, MAX_BATCH, MAX_TOKENS_PER_SEC, MODES, RATES, SIM_SECONDS, STEP_BASE_MS, STEP_PER_SEQ_MS, simulate, type Mode } from "@/lib/inferenceBatching";

const ACCENT = "var(--sys)";
const avgLen = LENGTHS.reduce((a, b) => a + b, 0) / LENGTHS.length;

export default function InferenceBatchingDemo() {
  const [mode, setMode] = useState<Mode>("none");
  const [rate, setRate] = useState(2);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const r = simulate(mode, rate);
  const all = Object.fromEntries(MODES.map((m) => [m.id, simulate(m.id, rate)])) as Record<Mode, ReturnType<typeof simulate>>;
  const demand = rate * avgLen;

  const captions = [
    `Step 1: one decode step reads the whole model from memory: ${STEP_BASE_MS} ms, plus ${STEP_PER_SEQ_MS} ms per sequence in the batch.`,
    `Step 2: ${rate} requests a second × about ${Math.round(avgLen)} tokens each = ${Math.round(demand)} tokens a second of demand.`,
    `Step 3: ${MODES.find((m) => m.id === mode)!.label.toLowerCase()}: ${Math.round(r.tokensPerSec)} tokens a second, average batch ${r.avgBatch.toFixed(1)}.`,
    mode === "static" ? `Step 4: ${Math.round(r.paddingShare * 100)}% of batch slots are padding: finished answers waiting for the longest one.` : `Step 4: no padding: a finished sequence frees its slot at the next step.`,
    `Step 5: half of requests finish within ${r.p50.toFixed(1)} s, 95% within ${r.p95.toFixed(1)} s; ${r.queueAtEnd} still waiting after a minute.`,
  ];
  const caption = stage !== null ? captions[stage] : `${MODES.find((m) => m.id === mode)!.label} at ${rate} requests a second: ${Math.round(r.tokensPerSec)} tokens/s, p50 ${r.p50.toFixed(1)} s, p95 ${r.p95.toFixed(1)} s, ${r.queueAtEnd} left waiting.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="GPU capacity, batching and queueing"
        blurb={`One GPU serves a chat model. Generating a token means reading every weight from memory, and that costs nearly the same for one sequence as for thirty-two. Batching is how a GPU earns its price. A minute of traffic is simulated step by step under three schedulers; throughput, waiting and wasted slots come out of the simulation.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Throughput and latency for each scheduler at this request rate">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                {rate} requests/s · demand {Math.round(demand)} tokens/s · GPU max {Math.round(MAX_TOKENS_PER_SEC)}
              </p>
              <ul className="mt-3 space-y-3">
                {MODES.map((m) => {
                  const y = all[m.id];
                  return (
                    <li key={m.id} className="text-xs">
                      <div className="flex items-baseline justify-between gap-2">
                        <span style={{ fontWeight: m.id === mode ? 700 : 400 }}>{m.label}</span>
                        <span className="font-mono">{Math.round(y.tokensPerSec)} tok/s</span>
                      </div>
                      <div className="mt-1 h-3 overflow-hidden rounded bg-[var(--track)]">
                        <div className="h-full rounded" style={{ width: `${Math.min(100, (y.tokensPerSec / MAX_TOKENS_PER_SEC) * 100)}%`, background: y.queueAtEnd > 10 ? "var(--bad)" : ACCENT }} />
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
                        p50 {y.p50.toFixed(1)} s · p95 {y.p95.toFixed(1)} s · batch {y.avgBatch.toFixed(1)} · padding {Math.round(y.paddingShare * 100)}% · {y.queueAtEnd} waiting
                      </p>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px] text-[var(--muted)]">Red bar: the scheduler can&rsquo;t keep up, and requests are still waiting after a minute.</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Requests a second" accent={ACCENT} value={String(rate)} onChange={(v) => setRate(Number(v))} options={RATES.map((x) => ({ id: String(x), label: String(x) }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Serving…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Know what a decode step costs" what={`Each new token needs one pass over all the weights. For a big model that pass is limited by memory bandwidth, not arithmetic, so serving 32 sequences in the same pass costs ${STEP_BASE_MS + STEP_PER_SEQ_MS * MAX_BATCH} ms instead of ${STEP_BASE_MS + STEP_PER_SEQ_MS} ms: 32 times the tokens for under twice the time.`} accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  batch 1: {Math.round(1000 / (STEP_BASE_MS + STEP_PER_SEQ_MS))} tok/s · batch {MAX_BATCH}: {Math.round(MAX_TOKENS_PER_SEC)} tok/s
                </p>
              </FlowStep>
              <FlowArrow label="requests arrive" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Compare demand with capacity" what={`Answers vary from ${Math.min(...LENGTHS)} to ${Math.max(...LENGTHS)} tokens. Demand is requests a second times average length; if the scheduler can't produce that many tokens a second, the queue grows for as long as the traffic lasts.`} accent={ACCENT} active={at(1)}>
                <Choices label="Requests a second" accent={ACCENT} value={String(rate)} onChange={(v) => setRate(Number(v))} options={RATES.map((x) => ({ id: String(x), label: String(x) }))} />
                <p className="mt-2 font-mono text-xs">
                  demand {Math.round(demand)} tok/s · one at a time {Math.round(all.none.tokensPerSec)} · best case {Math.round(MAX_TOKENS_PER_SEC)}
                </p>
              </FlowStep>
              <FlowArrow label="group them" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Batch requests together" what="Static batching waits for a group, runs it to the end, then takes the next group. Continuous batching (in-flight batching) changes the batch every step: a finished sequence leaves, a waiting one joins." accent={ACCENT} active={at(2)}>
                <Choices label="Scheduler" accent={ACCENT} value={mode} onChange={setMode} options={MODES.map((m) => ({ id: m.id, label: m.label }))} />
                <p className="mt-2 text-xs">{MODES.find((m) => m.id === mode)!.one}</p>
              </FlowStep>
              <FlowArrow label="wasted slots" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Stop paying for padding" what="In a static batch a 40-token answer finishes early and then sits in the batch, doing nothing, until the 500-token one is done. Those idle slots are throughput you paid for and didn't get." accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs" style={{ color: r.paddingShare > 0.3 ? "var(--bad)" : "var(--good)" }}>
                  padding {Math.round(r.paddingShare * 100)}% of batch slots · average live batch {r.avgBatch.toFixed(1)}
                </p>
              </FlowStep>
              <FlowArrow label="what users feel" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Watch latency, not just throughput" what="Bigger batches make each step slower, so a single answer streams a little slower; that's the trade. Past capacity no scheduler helps: add GPUs, shorten answers, or shed load. The KV cache is what limits how many sequences fit at once." accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">done</span>
                  <span className="text-right text-[var(--faint)]">p95</span>
                  <span className="text-right text-[var(--faint)]">waiting</span>
                  {MODES.map((m) => {
                    const y = all[m.id];
                    return <Row key={m.id} cells={[m.label, String(y.completed), `${y.p95.toFixed(1)} s`, String(y.queueAtEnd)]} bad={y.queueAtEnd > 10} bold={m.id === mode} />;
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  {SIM_SECONDS} s simulated. Step times are round numbers in the range of a large model on one GPU; the shape of each curve is what holds.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, bad, bold }: { cells: string[]; bad: boolean; bold: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: bold ? 700 : 400, color: i === 3 && bad ? "var(--bad)" : "var(--text)" }}>
          {c}
        </span>
      ))}
    </>
  );
}
