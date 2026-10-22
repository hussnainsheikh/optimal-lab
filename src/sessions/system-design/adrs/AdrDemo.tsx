"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DEBATE_HOURS, DECISIONS, IN_THE_ROOM, PROPOSE_NO_RECORD, PROPOSE_WITH_RECORD, TEAM, TURNOVERS, retentionCurve, run, type DecisionId } from "@/lib/adrs";

const ACCENT = "var(--sys)";

export default function AdrDemo() {
  const [id, setId] = useState<DecisionId>("postgres");
  const [months, setMonths] = useState(18);
  const [turnover, setTurnover] = useState(0.2);
  const [recorded, setRecorded] = useState(false);
  const [holds, setHolds] = useState(true);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const d = DECISIONS.find((x) => x.id === id)!;
  const r = run(months, turnover, recorded, holds);
  const status = !holds && recorded ? "Superseded" : "Accepted";

  const captions = [
    `Step 1: the context. ${d.context}`,
    `Step 2: ${d.options.length} options, each with why it was or wasn't chosen.`,
    `Step 3: the decision. ${d.decision}`,
    `Step 4: the consequences, good and bad, including when to revisit.`,
    `Step 5: ${months} months later. ${r.action}`,
  ];
  const caption = stage !== null ? captions[stage] : `${months} months on, ${r.teamOriginal.toFixed(1)} of ${TEAM} people were there, and ${recorded ? "everyone can read why" : `${r.knowWhy.toFixed(1)} can say why`}. ${r.action}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Architecture decision records"
        blurb={`An ADR is a one-page note: the context, the options, the decision and its consequences, kept in the repo next to the code. Make a decision with ${IN_THE_ROOM} people in the room, let people leave and join, and see who can still say why ${months} months later, with and without the page.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The decision record and the team that has to live with it">
              <div className="rounded-md border border-[var(--line)] bg-[var(--inset)] p-3 text-xs" style={{ opacity: recorded ? 1 : 0.45 }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono font-semibold">{d.title}</p>
                  <span className="rounded px-1.5 font-mono text-[10px]" style={{ border: `1px solid ${status === "Superseded" ? "var(--bad)" : "var(--good)"}`, color: status === "Superseded" ? "var(--bad)" : "var(--good)" }}>
                    {recorded ? status : "not written"}
                  </span>
                </div>
                <p className="mt-2 text-[var(--muted)]">
                  <span className="font-semibold text-[var(--text)]">Context. </span>
                  {d.context}
                </p>
                <p className="mt-1 text-[var(--muted)]">
                  <span className="font-semibold text-[var(--text)]">Decision. </span>
                  {d.decision}
                </p>
                {recorded && !holds && <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--bad)" }}>→ {d.superseded}</p>}
              </div>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">the team at month {months}</p>
              <div className="mt-2 flex flex-wrap gap-1.5" aria-label={`${r.teamOriginal.toFixed(1)} of ${TEAM} people were there; ${r.originalsLeft.toFixed(1)} of the ${IN_THE_ROOM} who decided remain`}>
                {Array.from({ length: TEAM }, (_, i) => {
                  const original = i < Math.round(r.teamOriginal);
                  const decider = i < Math.round(r.originalsLeft);
                  const knows = recorded || decider;
                  return (
                    <span key={i} className="grid h-8 w-8 place-items-center rounded-full border font-mono text-[10px]" style={{ borderColor: knows ? "var(--good)" : "var(--line-strong)", background: decider ? "color-mix(in srgb, var(--good) 25%, transparent)" : "transparent", color: original ? "var(--text)" : "var(--faint)" }}>
                      {decider ? "D" : original ? "O" : "N"}
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-[var(--muted)]">D: in the room · O: here at the time · N: joined since · green ring: can say why</p>
              <Curve turnover={turnover} months={months} />
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Decision" accent={ACCENT} value={id} onChange={setId} options={DECISIONS.map((x) => ({ id: x.id, label: x.options.find((o) => o.chosen)!.name }))} />
              </div>
              <label className="flex min-h-11 w-full items-center gap-2 text-sm">
                <input type="checkbox" checked={recorded} onChange={(e) => setRecorded(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                Write the ADR
              </label>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Reading…">
                Read it top to bottom
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Write down the context" what="The facts and forces at the time: the requirement, the team, the deadline. This is the part that disappears first, and the part a newcomer needs to judge whether the decision still fits." accent={ACCENT} active={at(0)}>
                <p className="text-xs">{d.context}</p>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">rests on: {d.constraint}</p>
              </FlowStep>
              <FlowArrow label="what we considered" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="List the options you rejected" what="Saying why the alternatives lost answers the question every newcomer asks: “why didn't you just use X?”" accent={ACCENT} active={at(1)}>
                <ul className="space-y-1 text-xs">
                  {d.options.map((o) => (
                    <li key={o.name}>
                      <span className="font-semibold" style={{ color: o.chosen ? "var(--good)" : "var(--text)" }}>
                        {o.name}
                        {o.chosen ? " (chosen)" : ""}:
                      </span>{" "}
                      <span className="text-[var(--muted)]">{o.why}</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="what we chose" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="State the decision in one sentence" what="Active voice, specific, short enough to quote in a code review." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs">{d.decision}</p>
              </FlowStep>
              <FlowArrow label="what it costs" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Record the consequences, and when to revisit" what="The downsides you accepted and the signal that should reopen the question. That signal is what makes a later reversal a decision instead of an argument." accent={ACCENT} active={at(3)}>
                <ul className="space-y-0.5 text-xs">
                  {d.consequences.map((c) => (
                    <li key={c.text} style={{ color: c.good ? "var(--good)" : "var(--text)" }}>
                      {c.good ? "+ " : "− "}
                      {c.text}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="time passes" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Let time pass" what={`People leave; each newcomer who finds the decision odd may reopen it. Without the reasons the debate starts from zero, and sometimes undoes a decision that was still right. With them, the question is short: is the fact it rested on still true? If not, a new ADR supersedes the old one, and both stay in the repo.`} accent={ACCENT} active={at(4)}>
                <Slider label="Months later" value={months} min={0} max={36} step={1} format={(v) => `${v}`} onChange={setMonths} accent={ACCENT} />
                <Choices label="People leaving a year" accent={ACCENT} value={String(turnover)} onChange={(v) => setTurnover(Number(v))} options={TURNOVERS.map((t) => ({ id: String(t), label: `${Math.round(t * 100)}%` }))} />
                <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={holds} onChange={(e) => setHolds(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The reason still holds
                </label>
                {!holds && <p className="text-xs text-[var(--muted)]">What changed: {d.changed}</p>}
                <p className="mt-2 font-mono text-xs">
                  {r.newcomers.toFixed(1)} newcomers · {r.debates.toFixed(1)} debates ({r.hours.toFixed(0)} person-hours) · chance of wrongly undoing it {Math.round(r.wrongReversalChance * 100)}%
                </p>
                <p className="mt-1 text-xs" style={{ color: holds && !recorded ? "var(--bad)" : "var(--text)" }}>
                  {r.action}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  Who remains is arithmetic. How newcomers behave is illustrative: {Math.round(PROPOSE_NO_RECORD * 100)}% reopen a decision they can&rsquo;t explain, {Math.round(PROPOSE_WITH_RECORD * 100)}% after reading the ADR; a debate costs {DEBATE_HOURS} person-hours.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Curve({ turnover, months }: { turnover: number; months: number }) {
  const without = retentionCurve(turnover, false);
  const W = 100;
  const H = 30;
  const x = (m: number) => (m / 36) * W;
  const y = (k: number) => H - 3 - (k / TEAM) * (H - 6);
  const path = without.map((p, i) => `${i ? "L" : "M"}${x(p.month).toFixed(1)},${y(p.know).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full max-w-lg" role="img" aria-label="People who can explain the decision over 36 months: everyone with the ADR, a falling number without it">
      <line x1={0} x2={W} y1={y(TEAM)} y2={y(TEAM)} stroke="var(--good)" strokeWidth={0.8} />
      <text x={1} y={y(TEAM) + 3.5} fontSize={2.8} fill="var(--good)">
        with the ADR: all {TEAM}
      </text>
      <path d={path} fill="none" stroke="var(--bad)" strokeWidth={0.8} />
      <text x={W - 1} y={y(without[36].know) - 1.5} textAnchor="end" fontSize={2.8} fill="var(--bad)">
        without: {without[36].know.toFixed(1)} at 36 months
      </text>
      <line x1={x(months)} x2={x(months)} y1={2} y2={H - 2} stroke={ACCENT} strokeWidth={0.4} strokeDasharray="1 1" />
      <text x={0} y={H - 0.3} fontSize={2.6} fill="var(--faint)">
        0
      </text>
      <text x={W} y={H - 0.3} textAnchor="end" fontSize={2.6} fill="var(--faint)">
        36 months
      </text>
    </svg>
  );
}
