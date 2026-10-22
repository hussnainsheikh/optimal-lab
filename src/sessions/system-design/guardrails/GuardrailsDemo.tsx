"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ALL, CHEAP, GUARDS, LAYERED, MESSAGES, NONE, run, type Guard } from "@/lib/guardrails";

const ACCENT = "var(--sys)";
const VERDICT_COLOR = { caught: "var(--good)", missed: "var(--bad)", "wrongly blocked": "var(--bad)", allowed: "var(--muted)" } as const;
const PRESETS: { label: string; on: Record<Guard, boolean> }[] = [
  { label: "None", on: NONE },
  { label: "Cheap checks", on: CHEAP },
  { label: "Layered", on: LAYERED },
  { label: "Everything", on: ALL },
];

export default function GuardrailsDemo() {
  const [on, setOn] = useState<Record<Guard, boolean>>(NONE);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (k: Guard, v: boolean) => setOn((cur) => ({ ...cur, [k]: v }));
  const r = run(on);
  const bad = MESSAGES.filter((m) => m.kind !== "ok").length;

  const captions = [
    `Step 1: ${MESSAGES.length} messages and answers: ${bad} should be stopped, ${MESSAGES.length - bad} should get through.`,
    `Step 2: cheap input checks run first, in ${GUARDS.filter((g) => on[g.id] && g.ms < 100 && g.where === "input").reduce((s, g) => s + g.ms, 0)} ms.`,
    `Step 3: ${on.judge ? "an LLM judge reads each message against the policy" : "no LLM judge"}.`,
    `Step 4: ${on.grounding ? "answers are checked against the retrieved policy" : "answers go out unchecked"}.`,
    `Step 5: ${r.blocked.length} caught, ${r.missed.length} missed, ${r.wrongly.length} real customers blocked, +${r.latencyMs} ms per exchange.`,
  ];
  const caption = stage !== null ? captions[stage] : `${r.blocked.length} of ${bad} problems caught · ${r.missed.length} missed · ${r.wrongly.length} real customers wrongly blocked · +${r.latencyMs} ms.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Guardrails and content moderation"
        blurb={`A bank's customer assistant. Twelve messages and answers, labelled: most are fine, some are off-topic, abusive, jailbreaks, carry a card number, or invent a policy. Guardrails before and after the model catch some of them, block some real customers by mistake, and add latency. Count all three.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Each message and what the guardrails did with it">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{MESSAGES.length} messages · +{r.latencyMs} ms</p>
                <p className="font-mono text-xs">
                  <span style={{ color: "var(--good)" }}>{r.blocked.length} caught</span> · <span style={{ color: "var(--bad)" }}>{r.missed.length} missed · {r.wrongly.length} wrong</span>
                </p>
              </div>
              <ul className="mt-3 space-y-1">
                {r.perMsg.map(({ m, by, verdict }, i) => (
                  <li key={i} className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2 text-[11px]">
                    <span className="min-w-0">
                      <span className="block truncate">{m.text}</span>
                      <span className="text-[var(--faint)]">
                        {m.where} · {m.kind === "ok" ? "fine" : m.kind}
                      </span>
                    </span>
                    <span className="text-right font-mono" style={{ color: VERDICT_COLOR[verdict] }}>
                      {verdict}
                      {by && <span className="block text-[10px] text-[var(--faint)]">{GUARDS.find((g) => g.id === by)!.label.split(" ")[0].toLowerCase()}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Checking…">
                Walk through it
              </RunButton>
              {PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => setOn(p.on)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-3 text-sm">
                  {p.label}
                </button>
              ))}
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Write the policy, then label examples" what="A guardrail enforces a policy: what this assistant is for, what it won't do, what it must never repeat. Turn it into labelled examples, including the hard ones: a stolen card reported in capitals, “kill” meaning cancel." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {bad} to stop · {MESSAGES.length - bad} to allow · {MESSAGES.filter((m) => m.tricky).length} tricky
                </p>
              </FlowStep>
              <FlowArrow label="cheap checks first" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Run fast checks on every input" what="Rules and small classifiers take milliseconds. They catch the obvious, and rules misfire on words out of context: “kill the standing order”." accent={ACCENT} active={at(1)}>
                {(["keywords", "classifier", "pii"] as Guard[]).map((g) => (
                  <Toggle key={g} g={g} on={on} set={set} />
                ))}
              </FlowStep>
              <FlowArrow label="hard cases" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Use a judge for what's ambiguous" what="An LLM that reads the policy catches role-play jailbreaks the classifier misses, at hundreds of milliseconds per call, and sometimes refuses a legitimate answer. Run it only where the cheap checks are unsure, or asynchronously." accent={ACCENT} active={at(2)}>
                <Toggle g="judge" on={on} set={set} />
              </FlowStep>
              <FlowArrow label="the answer" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Check the output too" what="Inputs aren't the only risk: the assistant can invent a refund policy that doesn't exist. Check policy claims in answers against the retrieved documents before sending." accent={ACCENT} active={at(3)}>
                <Toggle g="grounding" on={on} set={set} />
              </FlowStep>
              <FlowArrow label="the trade-off" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Measure misses, false blocks and latency together" what="Every guardrail trades one against the others. Blocking a customer whose card was stolen is a failure too. Track all three on the labelled set, and review blocked messages, not just missed ones." accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">missed</span>
                  <span className="text-right text-[var(--faint)]">wrong</span>
                  <span className="text-right text-[var(--faint)]">ms</span>
                  {PRESETS.map((p) => {
                    const y = run(p.on);
                    return <Row key={p.label} cells={[p.label, String(y.missed.length), String(y.wrongly.length), String(y.latencyMs)]} />;
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Which check catches which message is a model of how each kind of guard behaves; latencies are typical.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Toggle({ g, on, set }: { g: Guard; on: Record<Guard, boolean>; set: (k: Guard, v: boolean) => void }) {
  const x = GUARDS.find((y) => y.id === g)!;
  return (
    <>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={on[g]} onChange={(e) => set(g, e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
        {x.label} <span className="font-mono text-[11px] text-[var(--faint)]">+{x.ms} ms</span>
      </label>
      <p className="text-[11px] text-[var(--muted)]">{x.what}</p>
    </>
  );
}

function Row({ cells }: { cells: string[] }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"}>
          {c}
        </span>
      ))}
    </>
  );
}
