"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { BUDGETS, LEVELS, PRICE, ROUTED, ROUTER_ACCURACY, SPEED, accuracy, pct, run, secs, totals, usd, type Difficulty, type Mode } from "@/lib/reasoningBudget";

const ACCENT = "var(--ai)";
const DIFF_COLOR: Record<Difficulty, string> = { easy: "var(--good)", medium: "var(--c3)", hard: "var(--bad)" };

export default function ReasoningModelsDemo() {
  const [budget, setBudget] = useState(8000);
  const [mode, setMode] = useState<Mode>("fixed");
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const rows = run(mode, budget);
  const t = totals(rows);
  const fixed = totals(run("fixed", budget));
  const at = (i: number) => stage === i;
  const maxThink = Math.max(...rows.map((r) => r.thinking), 1);

  const captions = [
    `Step 1: ${rows.length} requests, four each of easy, medium and hard.`,
    mode === "fixed" ? `Step 2: every request may think up to ${budget.toLocaleString("en-US")} tokens.` : "Step 2: a router guesses each request's difficulty and sets its budget.",
    `Step 3: easy ${pct(accuracy("easy", budget))}, medium ${pct(accuracy("medium", budget))}, hard ${pct(accuracy("hard", budget))} at this budget.`,
    `Step 4: ${t.thinking.toLocaleString("en-US")} thinking tokens, ${usd(t.cost)} for the queue, slowest answer ${secs(t.max)}.`,
    mode === "routed" ? `Step 5: routed, ${pct(t.accuracy)} for ${usd(t.cost)}; a flat ${budget.toLocaleString("en-US")} budget gave ${pct(fixed.accuracy)} for ${usd(fixed.cost)}.` : "Step 5: switch to routing to spend the budget where it helps.",
  ];
  const caption = stage !== null ? captions[stage] : `${pct(t.accuracy)} of the queue right for ${usd(t.cost)}; median answer in ${secs(t.p50)}, slowest ${secs(t.max)}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Reasoning models and thinking budgets"
        blurb="A reasoning model thinks in hidden tokens before it answers, and you set how many it may use. More thinking lifts hard questions and does nothing for easy ones, and every thinking token is billed and waited for. Run a mixed queue of requests under one budget, then give each request its own."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Each request's thinking tokens, chance of a right answer, cost and time">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {mode === "fixed" ? `budget ${budget.toLocaleString("en-US")} for all` : "budget per request"}
                </p>
                <p className="font-mono text-sm">
                  {pct(t.accuracy)} · {usd(t.cost)}
                </p>
              </div>
              <ul className="mt-3 space-y-1">
                {rows.map((r) => (
                  <li key={r.request.id} className="grid grid-cols-[minmax(0,1fr)_4.5rem_2.5rem_3.25rem] items-center gap-2 text-xs sm:grid-cols-[minmax(0,1fr)_6rem_2.75rem_3.5rem]">
                    <span className="min-w-0 truncate" title={r.request.text}>
                      <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: DIFF_COLOR[r.request.difficulty] }} aria-label={r.request.difficulty} />
                      {r.request.text}
                    </span>
                    <span className="h-2.5 rounded bg-[var(--track)]" title={`${r.thinking.toLocaleString("en-US")} thinking tokens`}>
                      <span className="block h-full rounded transition-[width] duration-300" style={{ width: `${(r.thinking / maxThink) * 100}%`, background: ACCENT }} />
                    </span>
                    <span className="text-right font-mono" style={{ color: r.accuracy >= 0.8 ? "var(--good)" : r.accuracy >= 0.5 ? "var(--text)" : "var(--bad)" }}>
                      {pct(r.accuracy)}
                    </span>
                    <span className="text-right font-mono text-[var(--muted)]">{secs(r.latency)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-[var(--muted)]">
                {(Object.keys(LEVELS) as Difficulty[]).map((d) => (
                  <span key={d} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: DIFF_COLOR[d] }} />
                    {d}
                  </span>
                ))}
                <span>bar: thinking tokens · then chance right · time to answer</span>
              </p>
              <Curves budget={budget} />
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Budget" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "fixed", label: "One budget for all" }, { id: "routed", label: "Route per request" }]} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Thinking…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Look at the queue" what="Real traffic mixes trivia with puzzles. A fact needs no thinking; a proof or a scheduling problem needs thousands of tokens of it." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {(Object.keys(LEVELS) as Difficulty[]).map((d) => `${d}: ${pct(LEVELS[d].base)} with no thinking, up to ${pct(LEVELS[d].max)}`).join(" · ")}
                </p>
              </FlowStep>
              <FlowArrow label="requests" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Set the thinking budget" what="The cap on hidden tokens before the answer. The model uses what it needs, plus some of whatever is left to check itself, so a big budget is spent even on easy questions." accent={ACCENT} active={at(1)}>
                <Choices label="Thinking tokens per request" accent={ACCENT} value={String(budget)} onChange={(v) => setBudget(Number(v))} options={BUDGETS.map((b) => ({ id: String(b), label: b ? b.toLocaleString("en-US") : "none" }))} />
                {mode === "routed" && <p className="mt-2 text-xs text-[var(--muted)]">Routing is on, so this budget only sets the comparison line in step 5.</p>}
              </FlowStep>
              <FlowArrow label="thinking, then the answer" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="See what it buys" what="Hard questions keep improving for thousands of tokens. Easy ones were already right, and a very long budget lets the model talk itself out of a right answer." accent={ACCENT} active={at(2)}>
                <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-x-2 gap-y-0.5 font-mono text-xs">
                  <span className="text-[var(--faint)]">budget</span>
                  {BUDGETS.map((b) => (
                    <span key={b} className="text-right text-[var(--faint)]" style={{ fontWeight: b === budget ? 700 : 400 }}>
                      {b ? (b >= 1000 ? `${b / 1000}k` : b) : "0"}
                    </span>
                  ))}
                  {(Object.keys(LEVELS) as Difficulty[]).map((d) => (
                    <Row key={d} d={d} values={BUDGETS.map((b) => accuracy(d, b))} />
                  ))}
                </div>
              </FlowStep>
              <FlowArrow label="tokens" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Pay for it, and wait for it" what={`Thinking tokens are output tokens: $${PRICE.output} per million here, written at about ${SPEED} a second. A 20,000-token think is minutes of waiting and most of the bill.`} accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs">
                  {t.thinking.toLocaleString("en-US")} thinking tokens · {usd(t.cost)} for {rows.length} requests · median {secs(t.p50)} · slowest {secs(t.max)}
                </p>
              </FlowStep>
              <FlowArrow label="spend it where it helps" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Give each request its own budget" what={`A small, cheap classifier guesses the difficulty (right ${pct(ROUTER_ACCURACY)} of the time here) and picks a budget: none for easy, ${ROUTED.medium.toLocaleString("en-US")} for medium, ${ROUTED.hard.toLocaleString("en-US")} for hard. Misjudged requests get the wrong budget.`} accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">right</span>
                  <span className="text-right text-[var(--faint)]">cost</span>
                  <span className="text-right text-[var(--faint)]">slowest</span>
                  {BUDGETS.map((b) => {
                    const f = totals(run("fixed", b));
                    return (
                      <Totals key={b} label={`flat ${b ? b.toLocaleString("en-US") : "none"}`} acc={f.accuracy} cost={f.cost} max={f.max} bold={mode === "fixed" && b === budget} />
                    );
                  })}
                  {(() => {
                    const f = totals(run("routed", 0));
                    return <Totals label="routed" acc={f.accuracy} cost={f.cost} max={f.max} bold={mode === "routed"} />;
                  })()}
                </div>
                <p className="mt-2 text-xs text-[var(--faint)]">Providers expose this as a thinking budget or a reasoning-effort setting. The accuracy curves are a teaching model; the costs and times follow from the tokens.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ d, values }: { d: Difficulty; values: number[] }) {
  return (
    <>
      <span style={{ color: DIFF_COLOR[d] }}>{d}</span>
      {values.map((v, i) => (
        <span key={i} className="text-right">
          {pct(v)}
        </span>
      ))}
    </>
  );
}

function Totals({ label, acc, cost, max, bold }: { label: string; acc: number; cost: number; max: number; bold: boolean }) {
  const w = bold ? 700 : 400;
  return (
    <>
      <span className="font-sans" style={{ fontWeight: w }}>
        {label}
      </span>
      <span className="text-right" style={{ fontWeight: w }}>
        {pct(acc)}
      </span>
      <span className="text-right" style={{ fontWeight: w }}>
        {usd(cost)}
      </span>
      <span className="text-right" style={{ fontWeight: w }}>
        {secs(max)}
      </span>
    </>
  );
}

function Curves({ budget }: { budget: number }) {
  const W = 320;
  const H = 130;
  const pad = { l: 34, r: 10, t: 8, b: 24 };
  const xs = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000];
  const x = (b: number) => pad.l + (Math.log2(b / 100 + 1) / Math.log2(321)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b);
  return (
    <figure className="mx-auto mt-4 max-w-lg">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Chance of a right answer against the thinking budget, for easy, medium and hard requests">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={0.6} />
            <text x={pad.l - 5} y={y(v) + 3} textAnchor="end" fontSize={8} fill="var(--faint)">
              {pct(v)}
            </text>
          </g>
        ))}
        {[0, 500, 2000, 8000, 32000].map((b) => (
          <text key={b} x={x(b)} y={H - 12} textAnchor="middle" fontSize={8} fill={b === budget ? "var(--text)" : "var(--faint)"} fontWeight={b === budget ? 700 : 400}>
            {b >= 1000 ? `${b / 1000}k` : b}
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--faint)">
          thinking budget (tokens)
        </text>
        <line x1={x(budget)} x2={x(budget)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" strokeDasharray="2 2" strokeWidth={0.8} />
        {(Object.keys(LEVELS) as Difficulty[]).map((d) => (
          <polyline key={d} points={xs.map((b) => `${x(b)},${y(accuracy(d, b))}`).join(" ")} fill="none" stroke={DIFF_COLOR[d]} strokeWidth={1.8} />
        ))}
      </svg>
    </figure>
  );
}
