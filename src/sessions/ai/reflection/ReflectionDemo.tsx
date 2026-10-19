"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DRAFT_PASSING, MAX_ROUNDS, MODES, TESTS, expectedCurve, passing, run, type Mode } from "@/lib/reflection";

const ACCENT = "var(--ai)";
const LINE: Record<Mode, string> = { self: "var(--bad)", tests: "var(--ai)", errors: "var(--good)" };
const q = (s: string) => `“${s}”`;

export default function ReflectionDemo() {
  const [mode, setMode] = useState<Mode>("self");
  const [rounds, setRounds] = useState(3);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const m = MODES.find((x) => x.id === mode)!;
  const history = run(mode).slice(0, rounds + 1);
  const last = history[history.length - 1];
  const first = history[1] ?? history[0];
  const fixed = TESTS.filter((_, i) => !history[0][i] && first[i]).length;
  const broke = TESTS.filter((_, i) => history[0][i] && !first[i]).length;
  const stoppedAt = mode === "self" ? null : history.findIndex((row) => row.every(Boolean));
  const at = (n: number) => stage === n;

  const captions = [
    `Step 1: the first draft passes ${DRAFT_PASSING} of ${TESTS.length} tests.`,
    mode === "self" ? "Step 2: no outside feedback. The model only has its own answer to look at." : `Step 2: the harness runs the tests${mode === "errors" ? " and keeps the expected and actual output" : ""}.`,
    `Step 3: the critique. ${mode === "self" ? "It sounds thoughtful, but it can't see which cases fail." : "It names the failing cases."}`,
    `Step 4: round 1 fixed ${fixed} and broke ${broke}.`,
    `Step 5: after ${rounds} ${rounds === 1 ? "round" : "rounds"}, ${passing(last)} of ${TESTS.length} pass.`,
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : mode === "self"
        ? `Self-critique: ${DRAFT_PASSING} → ${passing(last)} passing. Without a signal from outside, revising is mostly reshuffling.`
        : `${m.label}: ${DRAFT_PASSING} → ${passing(last)} passing${stoppedAt !== null && stoppedAt > 0 ? `, all green after round ${stoppedAt}` : ""}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Reflection and self-correction"
        blurb="Ask a model to check its work and try again, and it will. Whether the second try is better depends on what it checks against. Revise a function against eight tests with only self-critique, with the test results, and with the error output."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Which tests pass after each round of revision">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">slugify: 8 tests · {m.label}</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[18rem] border-separate border-spacing-y-1 text-xs">
                  <thead>
                    <tr className="text-[var(--faint)]">
                      <th className="text-left font-normal">input → expected</th>
                      {history.map((_, r) => (
                        <th key={r} className="w-10 text-center font-mono font-normal">
                          {r === 0 ? "draft" : `r${r}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TESTS.map((t, i) => (
                      <tr key={i}>
                        <td className="whitespace-pre-wrap break-words pr-2 font-mono">
                          {q(t.input)} → {q(t.expected)}
                        </td>
                        {history.map((row, r) => {
                          const changed = r > 0 && row[i] !== history[r - 1][i];
                          return (
                            <td key={r} className="text-center">
                              <span
                                className="inline-grid h-6 w-6 place-items-center rounded font-mono"
                                style={{
                                  background: `color-mix(in srgb, ${row[i] ? "var(--good)" : "var(--bad)"} ${changed ? 40 : 16}%, transparent)`,
                                  color: row[i] ? "var(--good)" : "var(--bad)",
                                  outline: changed ? "1.5px solid currentColor" : undefined,
                                }}
                              >
                                {row[i] ? "✓" : "✗"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="font-mono">
                      <td className="pt-1 text-[var(--muted)]">passing</td>
                      {history.map((row, r) => (
                        <td key={r} className="pt-1 text-center">
                          {passing(row)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[11px] text-[var(--faint)]">A ringed cell changed in that round.</p>
              <CurveChart mode={mode} />
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Feedback each round" accent={ACCENT} value={mode} onChange={setMode} options={MODES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Revising…">
                Walk through a round
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Write a first draft" what="The model writes a function that turns a title into a URL slug. It looks right and passes the easy cases." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {TESTS.map((t, i) => (
                    <li key={i} className="whitespace-pre-wrap" style={{ color: t.draft === t.expected ? "var(--muted)" : "var(--bad)" }}>
                      {q(t.input)} gave {q(t.draft)}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="the draft" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Get feedback" what="The feedback decides everything. Re-reading your own work finds little; running it against tests finds exactly what's wrong." accent={ACCENT} active={at(1)}>
                <ul className="space-y-1 text-sm">
                  <li style={{ fontWeight: mode === "self" ? 600 : 400 }}>Self-critique: “check your answer and improve it”.</li>
                  <li style={{ fontWeight: mode === "tests" ? 600 : 400 }}>Run the tests: which of the 8 fail.</li>
                  <li style={{ fontWeight: mode === "errors" ? 600 : 400 }}>Tests + error output: each failing input, with expected and actual output.</li>
                </ul>
              </FlowStep>
              <FlowArrow label="feedback" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Critique the draft" what="The model writes down what it thinks is wrong. This is the reflection: only as good as the evidence in front of it." accent={ACCENT} active={at(2)}>
                <p className="border-l-2 pl-3 text-sm italic" style={{ borderColor: LINE[mode] }}>
                  {m.critique}
                </p>
              </FlowStep>
              <FlowArrow label="critique" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Revise" what="It rewrites the function. Each failing case may get fixed; each passing case may get broken by the change." accent={ACCENT} active={at(3)}>
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-y-1 text-sm">
                  <dt className="text-[var(--muted)]">Chance a failing test gets fixed</dt>
                  <dd className="font-mono">{Math.round(m.fix * 100)}%</dd>
                  <dt className="text-[var(--muted)]">Chance a passing test gets broken</dt>
                  <dd className="font-mono">{Math.round(m.brk * 100)}%</dd>
                  <dt className="text-[var(--muted)]">This run, round 1</dt>
                  <dd className="font-mono">
                    +{fixed} fixed, −{broke} broken
                  </dd>
                </dl>
              </FlowStep>
              <FlowArrow label="new version, back to step 2" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Repeat, then stop" what="Loop until the tests pass or a round limit is hit. With no outside check there is no clear point to stop, and more rounds can make it worse." accent={ACCENT} active={at(4)}>
                <Choices label="Rounds" accent={ACCENT} value={String(rounds)} onChange={(v) => setRounds(Number(v))} options={Array.from({ length: MAX_ROUNDS + 1 }, (_, i) => ({ id: String(i), label: String(i) }))} />
                <p className="mt-2 font-mono text-sm">
                  {DRAFT_PASSING} → {passing(last)} of {TESTS.length} passing
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Huang et al. (2023) found models can&rsquo;t reliably correct their own reasoning without outside feedback. Reflexion (Shinn et al. 2023) and coding agents work because the tests, the compiler or a tool supply it.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function CurveChart({ mode }: { mode: Mode }) {
  const W = 320;
  const H = 130;
  const pad = { l: 26, r: 10, t: 8, b: 24 };
  const x = (r: number) => pad.l + (r / MAX_ROUNDS) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / TESTS.length) * (H - pad.t - pad.b);
  return (
    <figure className="mx-auto mt-4 max-w-lg">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Expected tests passing after each round, for each kind of feedback">
        {[0, 4, 8].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={0.6} />
            <text x={pad.l - 5} y={y(t) + 3} textAnchor="end" fontSize={8} fill="var(--faint)">
              {t}
            </text>
          </g>
        ))}
        {Array.from({ length: MAX_ROUNDS + 1 }, (_, r) => (
          <text key={r} x={x(r)} y={H - 12} textAnchor="middle" fontSize={8} fill="var(--faint)">
            {r === 0 ? "draft" : r}
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--faint)">
          round · average over many runs
        </text>
        {MODES.map((m) => (
          <polyline key={m.id} points={expectedCurve(m.id).map((v, r) => `${x(r)},${y(v)}`).join(" ")} fill="none" stroke={LINE[m.id]} strokeWidth={m.id === mode ? 2 : 1.1} opacity={m.id === mode ? 1 : 0.5} />
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        {MODES.map((m) => (
          <span key={m.id} className="flex items-center gap-1.5" style={{ fontWeight: m.id === mode ? 600 : 400 }}>
            <span className="h-0.5 w-4" style={{ background: LINE[m.id] }} />
            {m.label} {expectedCurve(m.id)[MAX_ROUNDS].toFixed(1)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
