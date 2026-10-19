"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { FINDINGS, SAMPLING, SPANS, TYPICAL_COST, TYPICAL_MS, spanCost, storagePerDay, totalCost, type View } from "@/lib/agentTracing";

const ACCENT = "var(--sys)";
const KIND_COLOR = { agent: "var(--muted)", llm: "var(--c1)", tool: "var(--c4)", retrieval: "var(--c3)" } as const;
const VIEWS: { id: View; label: string }[] = [
  { id: "logs", label: "What logs show" },
  { id: "trace", label: "The trace" },
];

export default function AgentTracingDemo() {
  const [view, setView] = useState<View>("logs");
  const [finding, setFinding] = useState<string | null>(null);
  const [sampling, setSampling] = useState<(typeof SAMPLING)[number]["id"]>("tail");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const root = SPANS[0];
  const total = totalCost();
  const lit = finding ? FINDINGS.find((f) => f.id === finding)!.spans : stage === 3 ? FINDINGS.flatMap((f) => f.spans) : [];
  const sampleSel = SAMPLING.find((x) => x.id === sampling)!;
  const storage = storagePerDay(sampleSel.rate, sampleSel.errorsAlways);
  const shown: View = stage !== null && stage >= 1 ? "trace" : view;

  const captions = [
    `Step 1: ticket #4471 took ${(root.ms / 1000).toFixed(1)} s and $${total.toFixed(2)}; a typical one takes ${TYPICAL_MS / 1000} s and $${TYPICAL_COST.toFixed(2)}.`,
    `Step 2: the trace has ${SPANS.length - 1} spans under one root: every model call, tool call and retrieval.`,
    "Step 3: errors, retries and the slowest spans stand out in the waterfall.",
    `Step 4: three causes: ${FINDINGS.map((f) => f.label.toLowerCase()).join("; ")}.`,
    `Step 5: ${sampleSel.label.toLowerCase()}: ${storage.gb.toFixed(1)} GB a day, and a run like this one is kept ${storage.keepsThisRun}.`,
  ];
  const caption = stage !== null ? captions[stage] : finding ? `${FINDINGS.find((f) => f.id === finding)!.label}. Fix: ${FINDINGS.find((f) => f.id === finding)!.fix}` : `One run: ${(root.ms / 1000).toFixed(1)} s, $${total.toFixed(2)}, ${SPANS.filter((s) => s.status === "error").length} failed tool calls. ${view === "logs" ? "The logs show only the start, the end and three timeouts." : "Click a finding to light its spans."}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Tracing and debugging agents"
        blurb={`A support agent usually answers in ${TYPICAL_MS / 1000} seconds for about $${TYPICAL_COST.toFixed(2)}. Ticket #4471 took ${(root.ms / 1000).toFixed(0)} seconds and cost $${total.toFixed(2)}, and the answer was fine. Logs say little about why. A trace records every model call and tool call as a span, and the waterfall shows three separate problems at once.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={shown === "logs" ? "The run as log lines" : "The run as a trace waterfall"}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{shown === "logs" ? "application logs" : `trace · ${SPANS.length} spans`}</p>
                <p className="font-mono text-xs" style={{ color: "var(--bad)" }}>
                  {(root.ms / 1000).toFixed(1)} s · ${total.toFixed(2)}
                </p>
              </div>
              {shown === "logs" ? (
                <pre className="mt-3 overflow-x-auto rounded bg-[var(--inset)] px-2 py-1.5 font-mono text-[11px] leading-relaxed">{`14:02:11 INFO  ticket 4471 received
14:02:16 WARN  get_order timeout
14:02:23 WARN  get_order timeout
14:02:30 WARN  get_order timeout
14:02:52 INFO  ticket 4471 answered (41.2 s)`}</pre>
              ) : (
                <ul className="mt-3 space-y-1">
                  {SPANS.map((s) => {
                    const on = lit.includes(s.id);
                    return (
                      <li key={s.id} className="grid grid-cols-[8.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-[11px] sm:grid-cols-[12rem_minmax(0,1fr)_3.5rem]">
                        <span className="truncate font-mono" style={{ paddingLeft: s.parent ? "0.75rem" : 0, color: s.status === "error" ? "var(--bad)" : "var(--text)", fontWeight: on ? 700 : 400 }}>
                          {s.name}
                        </span>
                        <span className="relative h-3.5 rounded bg-[var(--track)]">
                          <span
                            className="absolute inset-y-0 rounded"
                            style={{
                              left: `${(s.start / root.ms) * 100}%`,
                              width: `${Math.max(0.6, (s.ms / root.ms) * 100)}%`,
                              background: s.status === "error" ? "var(--bad)" : KIND_COLOR[s.kind],
                              outline: on ? "2px solid var(--text)" : "none",
                              opacity: lit.length && !on && s.parent ? 0.35 : 1,
                            }}
                          />
                        </span>
                        <span className="text-right font-mono text-[var(--muted)]">{(s.ms / 1000).toFixed(1)}s</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {shown === "trace" && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                  {(["llm", "tool", "retrieval"] as const).map((k) => (
                    <span key={k} className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLOR[k] }} />
                      {k}
                    </span>
                  ))}
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--bad)" }} />
                    error
                  </span>
                </div>
              )}
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="View" accent={ACCENT} value={view} onChange={setView} options={VIEWS} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Tracing…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Notice the run that's off" what="Track latency and cost per run, not just averages. This one is four times slower and five times more expensive than usual, with a correct answer, so no user complaint will ever point at it." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {(root.ms / 1000).toFixed(1)} s vs {TYPICAL_MS / 1000} s typical · ${total.toFixed(2)} vs ${TYPICAL_COST.toFixed(2)}
                </p>
              </FlowStep>
              <FlowArrow label="open the trace" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Record every step as a span" what="Each model call, tool call and retrieval becomes a span: name, parent, start, duration, status, and for model calls the tokens in and out. Prompts and outputs are attached, truncated, so you can read what the model saw." accent={ACCENT} active={at(1)}>
                <Choices label="View" accent={ACCENT} value={view} onChange={setView} options={VIEWS} />
              </FlowStep>
              <FlowArrow label="read the waterfall" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Read time and cost per span" what="The waterfall shows where the seconds went; token counts show where the money went. They're different spans here: the time is in tool calls, the cost is in one huge prompt." accent={ACCENT} active={at(2)}>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {[...SPANS].filter((s) => s.parent).sort((a, b) => spanCost(b) - spanCost(a)).slice(0, 3).map((s) => (
                    <li key={s.id}>
                      {s.name}: ${spanCost(s).toFixed(3)} · {(s.tokensIn ?? 0).toLocaleString("en-US")} tokens in
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="find the causes" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Turn spans into fixes" what="Each finding points at specific spans and a specific change. Logs showed the timeouts; only the trace shows the slow fallback and the bloated prompt that followed them." accent={ACCENT} active={at(3)}>
                <div className="space-y-1">
                  {FINDINGS.map((f) => (
                    <button key={f.id} type="button" onClick={() => setFinding(finding === f.id ? null : f.id)} className="block min-h-11 w-full rounded-md border px-3 py-2 text-left text-xs" style={{ borderColor: finding === f.id ? ACCENT : "var(--line)" }}>
                      <span className="font-semibold">{f.label}</span>
                      <span className="block text-[var(--muted)]">{f.fix}</span>
                    </button>
                  ))}
                </div>
              </FlowStep>
              <FlowArrow label="at scale" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Keep the traces that matter" what="Keeping every trace is expensive; keeping a random 10% loses most of the runs you need. Tail sampling decides after the run: keep a small share of normal runs and every slow, costly or failed one." accent={ACCENT} active={at(4)}>
                <Choices label="Sampling" accent={ACCENT} value={sampling} onChange={setSampling} options={SAMPLING.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 font-mono text-xs">
                  {storage.gb.toFixed(1)} GB a day · a run like #4471 kept {storage.keepsThisRun}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The spans are one illustrative run; cost and storage are computed from them.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
