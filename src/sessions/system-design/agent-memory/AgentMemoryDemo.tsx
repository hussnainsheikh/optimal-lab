"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CONTEXT_LIMIT, FACTS, QUESTIONS, SESSION_TOKENS, STRATEGIES, SUMMARY_TOKENS, answer, factName, score, type Strategy } from "@/lib/agentMemory";

const ACCENT = "var(--sys)";

export default function AgentMemoryDemo() {
  const [s, setS] = useState<Strategy>("none");
  const [qi, setQi] = useState(0);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const a = answer(s, qi);
  const sc = score(s);

  const captions = [
    `Step 1: over ${SESSION_TOKENS.length} sessions Sara mentions ${FACTS.length} things worth remembering.`,
    "Step 2: within a session, the conversation itself is the working memory.",
    `Step 3: ${STRATEGIES.find((x) => x.id === s)!.label.toLowerCase()}: ${a.tokens.toLocaleString("en-US")} tokens of memory in the prompt.`,
    `Step 4: “${a.q}” ${a.ok ? "is answered with what's needed" : `is missing: ${a.missing.map(factName).join("; ")}`}.`,
    `Step 5: ${sc.ok} of ${QUESTIONS.length} questions answered, ${sc.tokens.toLocaleString("en-US")} memory tokens on average.`,
  ];
  const caption = stage !== null ? captions[stage] : `${STRATEGIES.find((x) => x.id === s)!.label}: ${sc.ok} of ${QUESTIONS.length} later questions answered, with ${sc.tokens.toLocaleString("en-US")} tokens of memory per question.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Short-term and long-term memory"
        blurb={`A personal assistant talks with Sara in ${SESSION_TOKENS.length} sessions over a month: her diet, her children, a flight, an allergy, a budget, a hotel she didn't like. In session seven she asks things that need all of it. Four ways to remember, the same four questions, and what each costs in the prompt.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="What the assistant remembers for this question">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">session 7 · “{a.q}”</p>
                <p className="font-mono text-xs" style={{ color: a.ok ? "var(--good)" : "var(--bad)" }}>
                  {a.ok ? "answerable" : "missing memory"}
                </p>
              </div>
              <ul className="mt-3 space-y-1 text-xs">
                {FACTS.map((f) => {
                  const needed = QUESTIONS[qi].needs.includes(f.id);
                  const has = a.recalled.includes(f.id);
                  return (
                    <li key={f.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_5rem] gap-2" style={{ opacity: needed ? 1 : 0.45 }}>
                      <span className="font-mono text-[var(--faint)]">session {f.session}</span>
                      <span>
                        {f.text} <span className="text-[var(--faint)]">({f.kind})</span>
                      </span>
                      <span className="text-right font-mono" style={{ color: !needed ? "var(--muted)" : has ? "var(--good)" : "var(--bad)" }}>
                        {!needed ? "not needed" : has ? "recalled" : "forgotten"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 font-mono text-xs">memory in the prompt: {a.tokens.toLocaleString("en-US")} tokens</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Memory" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <div className="w-full">
                <Choices label="Question" accent={ACCENT} value={String(qi)} onChange={(v) => setQi(Number(v))} options={QUESTIONS.map((q, i) => ({ id: String(i), label: q.text }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Remembering…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Know the kinds of memory" what="Working memory is the current context. Long-term memory has two kinds worth keeping apart: facts about the user that stay true (semantic: she's vegetarian) and things that happened (episodic: she turned down Hotel Avenida)." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {FACTS.filter((f) => f.kind === "semantic").length} facts · {FACTS.filter((f) => f.kind === "episodic").length} episodes
                </p>
              </FlowStep>
              <FlowArrow label="within a session" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Working memory is the context window" what={`Inside one session the conversation is enough. Between sessions, nothing carries over unless you put it back in the prompt, and replaying old transcripts runs into the limit you set: ${CONTEXT_LIMIT.toLocaleString("en-US")} tokens here.`} accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  past transcripts: {SESSION_TOKENS.map((t) => (t / 1000).toFixed(1) + "k").join(" + ")} = {(SESSION_TOKENS.reduce((x, y) => x + y, 0) / 1000).toFixed(1)}k tokens
                </p>
              </FlowStep>
              <FlowArrow label="carry it over" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Choose what to carry over" what={`Replaying transcripts is exact but expensive, and the oldest fall off first. Summaries (${SUMMARY_TOKENS} tokens a session) are cheap and keep the gist but drop specifics like a seat number. Extracting facts and episodes into a store, then retrieving the relevant ones, keeps specifics at a few dozen tokens each.`} accent={ACCENT} active={at(2)}>
                <Choices label="Memory" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{STRATEGIES.find((x) => x.id === s)!.one}</p>
              </FlowStep>
              <FlowArrow label="recall it" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Retrieve what this request needs" what="A dinner booking needs the diet and the children; a medicine question needs the allergy. Retrieval picks memories that match the request, so the prompt holds what's relevant instead of everything." accent={ACCENT} active={at(3)}>
                <ul className="space-y-0.5 text-xs">
                  {QUESTIONS.map((q, i) => {
                    const x = answer(s, i);
                    return (
                      <li key={i} style={{ color: x.ok ? "var(--good)" : "var(--bad)", fontWeight: i === qi ? 700 : 400 }}>
                        {x.ok ? "✓" : "✗"} {q.text}
                        {!x.ok && <span className="text-[var(--muted)]"> (missing {x.missing.map(factName).join("; ").toLowerCase()})</span>}
                      </li>
                    );
                  })}
                </ul>
              </FlowStep>
              <FlowArrow label="compare" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Weigh recall against tokens" what="The right design remembers what matters at the lowest cost per turn, and can say where each memory came from. Keep the transcripts too, for audit and for re-extracting when your extraction improves." accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">answered</span>
                  <span className="text-right text-[var(--faint)]">tokens</span>
                  {STRATEGIES.map((x) => {
                    const y = score(x.id);
                    return <Row key={x.id} cells={[x.label, `${y.ok}/${QUESTIONS.length}`, y.tokens.toLocaleString("en-US")]} bold={x.id === s} good={y.ok === QUESTIONS.length} />;
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Retrieval here matches keywords; a real system uses embeddings. Which facts survive which design is what the comparison shows.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, bold, good }: { cells: string[]; bold: boolean; good: boolean }) {
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
