"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CANARY_HOURS, CANARY_SHARE, CONVERSATIONS_PER_HOUR, EVAL_CASES_PER_SLICE, GATE_MIN_PASS, PRACTICES, PROMPT_V1, PROMPT_V2, SLICES, average, run, runWithoutRefundCases, type Practice } from "@/lib/promptVersioning";

const ACCENT = "var(--sys)";
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function PromptVersioningDemo() {
  const [p, setP] = useState<Practice>("inPlace");
  const [coverage, setCoverage] = useState(true);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const r = coverage ? run(p) : runWithoutRefundCases(p);
  const label = PRACTICES.find((x) => x.id === p)!.label;
  const all = (x: Practice) => (coverage ? run(x) : runWithoutRefundCases(x));

  const captions = [
    "Step 1: v2 asks for short bullet points, and drops the line about the 30-day refund rule.",
    `Step 2: the eval suite: ${SLICES.length} slices × ${EVAL_CASES_PER_SLICE} cases. Average ${pct(average("v1"))} → ${pct(average("v2"))}.`,
    `Step 3: per slice, refunds fall from ${pct(SLICES.find((s) => s.id === "refunds")!.v1)} to ${pct(SLICES.find((s) => s.id === "refunds")!.v2)}.`,
    r.shipped ? `Step 4: v2 ships; caught by ${r.caughtBy}.` : `Step 4: v2 is blocked by ${r.caughtBy}.`,
    r.shipped ? `Step 5: ${r.badConversations.toLocaleString("en-US")} refund conversations go wrong before it's undone in ${r.rollbackMinutes} min.` : "Step 5: no customer ever sees v2.",
  ];
  const caption = stage !== null ? captions[stage] : `${label}: ${r.shipped ? `${r.badConversations.toLocaleString("en-US")} refund conversations answered wrongly; caught by ${r.caughtBy}` : `blocked by ${r.caughtBy}`}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Prompt templates and versioning"
        blurb={`A support assistant handles ${CONVERSATIONS_PER_HOUR.toLocaleString("en-US")} conversations an hour. Someone improves its prompt: answers get shorter and better formatted, and the average eval score goes up. The same edit quietly drops the refund rule. Ship it four ways and count the customers who get a wrong refund answer.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Pass rate per slice for v1 and v2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">eval · v1 vs v2</p>
                <p className="font-mono text-xs">
                  average {pct(average("v1"))} → <span style={{ color: "var(--good)" }}>{pct(average("v2"))}</span>
                </p>
              </div>
              <ul className="mt-3 space-y-2">
                {SLICES.map((s) => (
                  <li key={s.id} className="text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <span>
                        {s.label} <span className="text-[var(--faint)]">({pct(s.share)} of traffic{!coverage && s.id === "refunds" ? ", not in the eval" : ""})</span>
                      </span>
                      <span className="font-mono" style={{ color: s.v2 < GATE_MIN_PASS ? "var(--bad)" : "var(--text)" }}>
                        {pct(s.v1)} → {pct(s.v2)}
                      </span>
                    </div>
                    <div className="relative mt-1 h-3 rounded bg-[var(--track)]">
                      <span className="absolute inset-y-0 left-0 rounded opacity-40" style={{ width: pct(s.v1), background: ACCENT }} />
                      <span className="absolute inset-y-0 left-0 h-1.5 translate-y-[3px] rounded" style={{ width: pct(s.v2), background: s.v2 < GATE_MIN_PASS ? "var(--bad)" : ACCENT }} />
                      <span className="absolute inset-y-0 w-px" style={{ left: pct(GATE_MIN_PASS), background: "var(--text)" }} />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-[var(--muted)]">Faded: v1. Solid: v2. Line: the {pct(GATE_MIN_PASS)} bar per slice.</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="How it ships" accent={ACCENT} value={p} onChange={setP} options={PRACTICES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Shipping…">
                Ship v2
              </RunButton>
              <p className="w-full font-mono text-sm" style={{ color: r.badConversations ? "var(--bad)" : "var(--good)" }}>
                {r.badConversations.toLocaleString("en-US")} wrong refund answers
              </p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Keep prompts as versioned templates" what="A prompt is code: it changes behaviour for every user. Keep it in a file or registry with a version, variables filled in at run time, and a diff for every change. Then the app asks for prompt@v2, and v1 still exists." accent={ACCENT} active={at(0)}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[["support@v1", PROMPT_V1], ["support@v2", PROMPT_V2]].map(([k, v]) => (
                    <div key={k}>
                      <p className="font-mono text-[11px] text-[var(--faint)]">{k}</p>
                      <pre className="mt-1 whitespace-pre-wrap rounded bg-[var(--inset)] px-2 py-1.5 font-mono text-[11px] leading-snug">{v}</pre>
                    </div>
                  ))}
                </div>
              </FlowStep>
              <FlowArrow label="test it" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Run the eval suite on every change" what={`A fixed set of real conversations with known good answers, ${EVAL_CASES_PER_SLICE} per kind of question, graded the same way each time. It runs in CI when the prompt file changes.`} accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={coverage} onChange={(e) => setCoverage(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The eval set includes refund conversations
                </label>
                <p className="font-mono text-xs">
                  average: v1 {pct(average("v1"))}, v2 {pct(average("v2"))}
                </p>
              </FlowStep>
              <FlowArrow label="look closer" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Gate on every slice, not the average" what={`The average went up because the common questions improved. Refunds, ${pct(SLICES.find((s) => s.id === "refunds")!.share)} of traffic, collapsed. A gate that needs every slice above ${pct(GATE_MIN_PASS)} catches what the average hides, if the eval has that slice at all.`} accent={ACCENT} active={at(2)}>
                <Choices label="How it ships" accent={ACCENT} value={p} onChange={setP} options={PRACTICES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{PRACTICES.find((x) => x.id === p)!.one}</p>
              </FlowStep>
              <FlowArrow label="real traffic" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Canary the new version" what={`Evals miss things. Send ${pct(CANARY_SHARE)} of conversations to v2 and watch an online signal (escalations to a human, thumbs down) for long enough to see a change, about ${CANARY_HOURS} h here. Only then move everyone.`} accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs" style={{ color: r.shipped ? "var(--text)" : "var(--good)" }}>
                  {r.shipped ? `shipped · caught by ${r.caughtBy}` : `blocked · ${r.caughtBy}`}
                </p>
              </FlowStep>
              <FlowArrow label="when it's wrong" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Roll back by switching the version" what="Rolling back means pointing the app at prompt@v1 again: one config change, seconds. Edited in place, someone has to remember what the old text said." accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">wrong answers</span>
                  <span className="text-right text-[var(--faint)]">rollback</span>
                  {PRACTICES.map((x) => {
                    const y = all(x.id);
                    return <Row key={x.id} cells={[x.label, y.badConversations.toLocaleString("en-US"), y.rollbackMinutes === null ? "–" : `${y.rollbackMinutes} min`]} bad={y.badConversations > 0} bold={x.id === p} />;
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Pass rates are given, not measured; the arithmetic of who sees what, and when, is computed.</p>
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
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: bold ? 700 : 400, color: i === 1 ? (bad ? "var(--bad)" : "var(--good)") : "var(--text)" }}>
          {c}
        </span>
      ))}
    </>
  );
}
