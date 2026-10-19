"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { BUDGETS, COMPACT_TOOL_TOKENS, FACTS, STRATEGIES, SUMMARY_TOKENS, TOTAL_TOKENS, TURNS, compress, factText, type Strategy } from "@/lib/contextCompression";

const ACCENT = "var(--sys)";
const KIND_COLOR = { user: "var(--c1)", assistant: "var(--c3)", tool: "var(--c4)" } as const;

export default function ContextCompressionDemo() {
  const [s, setS] = useState<Strategy>("truncate");
  const [budget, setBudget] = useState(16000);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const r = compress(s, budget);
  const label = STRATEGIES.find((x) => x.id === s)!.label;
  const keptFrom = TURNS.length - r.turnsKept;

  const captions = [
    `Step 1: 60 turns, ${(TOTAL_TOKENS / 1000).toFixed(1)}k tokens; the budget is ${(budget / 1000).toFixed(0)}k.`,
    `Step 2: tool output is ${Math.round((TURNS.filter((t) => t.kind === "tool").reduce((a, t) => a + t.tokens, 0) / TOTAL_TOKENS) * 100)}% of the tokens and almost none of the facts.`,
    `Step 3: ${label.toLowerCase()} fits ${(r.tokens / 1000).toFixed(1)}k tokens.`,
    `Step 4: kept ${r.kept.length} of ${FACTS.length} facts the agent needs at the end.`,
    r.lost.length ? `Step 5: lost: ${r.lost.map(factText).join("; ").toLowerCase()}.` : "Step 5: nothing the agent needs was lost.",
  ];
  const caption = stage !== null ? captions[stage] : `${label} at ${(budget / 1000).toFixed(0)}k: ${r.kept.length} of ${FACTS.length} key facts survive, ${(r.tokens / 1000).toFixed(1)}k tokens used.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Context selection and compression"
        blurb={`A coding agent works for 60 turns: ${(TOTAL_TOKENS / 1000).toFixed(1)}k tokens, mostly tool output. Six things said along the way matter at the end: the goal, a file path, a decision, the failing test, the user's deadline, the cause. Fit the history into the prompt four ways and see which of those six survive.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={`Which of the 60 turns are in the prompt, and which key facts survive`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">60 turns · {(budget / 1000).toFixed(0)}k budget</p>
                <p className="font-mono text-xs" style={{ color: r.lost.length ? "var(--bad)" : "var(--good)" }}>
                  {r.kept.length}/{FACTS.length} facts kept
                </p>
              </div>
              <div className="mt-3 grid grid-cols-[repeat(20,minmax(0,1fr))] gap-0.5">
                {TURNS.map((t, i) => {
                  const inPrompt = s === "compact" ? i >= keptFrom : s === "retrieve" ? i >= TURNS.length - r.turnsKept || (t.fact && r.kept.includes(t.fact.id)) : i >= keptFrom;
                  return (
                    <span
                      key={t.n}
                      title={`turn ${t.n}: ${t.kind}, ${t.tokens} tokens${t.fact ? ` · ${t.fact.text}` : ""}`}
                      className="h-5 rounded-sm"
                      style={{
                        background: inPrompt ? KIND_COLOR[t.kind] : "var(--track)",
                        opacity: inPrompt ? (s === "compact" && t.kind === "tool" && i < TURNS.length - 6 ? 0.35 : 1) : 1,
                        outline: t.fact ? `2px solid ${r.kept.includes(t.fact.id) ? "var(--good)" : "var(--bad)"}` : "none",
                        outlineOffset: -2,
                      }}
                    />
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                {(["user", "assistant", "tool"] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLOR[k] }} />
                    {k}
                  </span>
                ))}
                <span>grey: not in the prompt · outlined: a key fact</span>
                {s === "compact" && <span>faded: tool output shrunk to one line</span>}
              </div>
              <ul className="mt-3 space-y-0.5 text-xs">
                {FACTS.map((f) => (
                  <li key={f.id} style={{ color: r.kept.includes(f.id) ? "var(--good)" : "var(--bad)" }}>
                    {r.kept.includes(f.id) ? "✓" : "✗"} {f.text}
                  </li>
                ))}
              </ul>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Strategy" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <div className="w-full">
                <Choices label="Budget" accent={ACCENT} value={String(budget)} onChange={(v) => setBudget(Number(v))} options={BUDGETS.map((b) => ({ id: String(b), label: `${b / 1000}k` }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Compressing…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Set a budget below the window" what="A model with a huge context window still gets slower, costlier and worse at finding things as the prompt grows. Pick a budget for history and keep to it." accent={ACCENT} active={at(0)}>
                <Choices label="Budget" accent={ACCENT} value={String(budget)} onChange={(v) => setBudget(Number(v))} options={BUDGETS.map((b) => ({ id: String(b), label: `${b / 1000}k` }))} />
                <p className="mt-2 font-mono text-xs">history so far: {(TOTAL_TOKENS / 1000).toFixed(1)}k tokens</p>
              </FlowStep>
              <FlowArrow label="what's in it" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Look at what fills the context" what="In agent sessions, tool output (file contents, test logs, search results) is most of the tokens, and usually only its conclusion matters later. The few sentences that matter most (goals, decisions, constraints) are short and scattered." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  tool output {(TURNS.filter((t) => t.kind === "tool").reduce((a, t) => a + t.tokens, 0) / 1000).toFixed(1)}k of {(TOTAL_TOKENS / 1000).toFixed(1)}k tokens · {FACTS.length} key facts in {FACTS.length} turns
                </p>
              </FlowStep>
              <FlowArrow label="choose" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Pick what to keep" what={`Dropping the oldest turns loses the goal first. A rolling summary (${SUMMARY_TOKENS} tokens) keeps the gist and drops exact values. Retrieval brings back turns similar to the current request, which isn't always what matters. Compacting old tool output to a ${COMPACT_TOOL_TOKENS}-token line and pinning decisions keeps both.`} accent={ACCENT} active={at(2)}>
                <Choices label="Strategy" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{STRATEGIES.find((x) => x.id === s)!.one}</p>
              </FlowStep>
              <FlowArrow label="what survived" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Count what the agent still knows" what="Measure compression by the facts the agent needs later, not by tokens saved. A file path or an exact test value lost to a summary means the agent goes looking again, or guesses." accent={ACCENT} active={at(3)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">facts</span>
                  <span className="text-right text-[var(--faint)]">tokens</span>
                  {STRATEGIES.map((x) => {
                    const y = compress(x.id, budget);
                    return <Row key={x.id} cells={[x.label, `${y.kept.length}/${FACTS.length}`, `${(y.tokens / 1000).toFixed(1)}k`]} good={!y.lost.length} bold={x.id === s} />;
                  })}
                </div>
              </FlowStep>
              <FlowArrow label="make it explicit" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Write down what must not be lost" what="Pinning works only if the agent records goals, decisions and constraints as it goes, in a scratchpad or a task file it rereads. That habit beats any compression trick applied afterwards." accent={ACCENT} active={at(4)}>
                <p className="text-xs" style={{ color: r.lost.length ? "var(--bad)" : "var(--good)" }}>
                  {r.lost.length ? `Lost: ${r.lost.map(factText).join("; ")}.` : "All six facts are in the prompt."}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Turn sizes are typical of coding agents; which facts survive is computed from where they sit in the session.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, good, bold }: { cells: string[]; good: boolean; bold: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: bold ? 700 : 400, color: i === 1 ? (good ? "var(--good)" : "var(--bad)") : "var(--text)" }}>
          {c}
        </span>
      ))}
    </>
  );
}
