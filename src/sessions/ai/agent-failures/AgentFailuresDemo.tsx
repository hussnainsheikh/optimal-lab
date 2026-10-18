"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { FAILS, GUARDS, MAX_STEPS, NO_GUARDS, STEP_CHOICES, pct, simulate, stepOk, success, type Cell, type FailKind, type GuardId, type Guards } from "@/lib/agentFailures";

const ACCENT = "var(--ai)";
const FAIL_COLOR: Record<FailKind, string> = { tool: "var(--c1)", args: "var(--c2)", drift: "var(--c4)", loop: "var(--c5)" };

function cellStyle(c: Cell) {
  if (c === "ok") return { background: "color-mix(in srgb, var(--good) 45%, transparent)" };
  if (c === "caught") return { background: "var(--c3)" };
  if (c === "after") return { background: "var(--track)", opacity: 0.5 };
  return { background: FAIL_COLOR[c], outline: "1.5px solid var(--text)", outlineOffset: "-1.5px" };
}

export default function AgentFailuresDemo() {
  const [p, setP] = useState(0.95);
  const [n, setN] = useState(20);
  const [guards, setGuards] = useState<Guards>(NO_GUARDS);
  const { stage, busy, run } = useWalk(5, 1100);
  const runs = simulate(p, n, guards);
  const wins = runs.filter((r) => r.ok).length;
  const loopBurn = runs.reduce((s, r) => s + r.burned, 0);
  const at = (i: number) => stage === i;
  const anyGuard = Object.values(guards).some(Boolean);
  const set = (id: GuardId, v: boolean) => setGuards((g) => ({ ...g, [id]: v }));
  const byKind = FAILS.map((f) => ({ ...f, count: runs.filter((r) => r.kind === f.id).length }));

  const captions = [
    `Step 1: the task takes ${n} ${n === 1 ? "step" : "steps"}, and every one has to go right.`,
    `Step 2: each step works ${pct(p)} of the time. The other ${pct(1 - p)} slips in one of four ways.`,
    `Step 3: ${pct(p)} to the power of ${n} is ${pct(p ** n)}. ${n >= 10 ? "Good steps, bad run." : ""}`,
    anyGuard ? `Step 4: caught slips are redone, so a step now ends well ${pct(stepOk(p, guards))} of the time.` : "Step 4: no safeguards, so every slip ends the run.",
    `Step 5: ${wins} of ${runs.length} runs finished the task.${loopBurn ? ` Loops burned ${loopBurn} extra steps.` : ""}`,
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : `${wins} of ${runs.length} runs succeed (${pct(success(p, n, guards))} expected). ${anyGuard ? "" : "Turn on the safeguards in step 4."}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Why agents fail"
        blurb="An agent that gets each step right 95% of the time sounds reliable. Over 20 steps it finishes the task about a third of the time. Watch 20 runs of the same task, see how each one broke, and add the safeguards that catch each kind of slip."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={`Twenty agent runs of ${n} steps each`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">20 runs · {n} steps each</p>
                <p className="font-mono text-sm" style={{ color: wins >= 14 ? "var(--good)" : wins >= 8 ? "var(--text)" : "var(--bad)" }}>
                  {wins}/20 finished
                </p>
              </div>
              <ol className="mt-3 space-y-1">
                {runs.map((r, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-right font-mono text-[10px] text-[var(--faint)]">{i + 1}</span>
                    <span className="flex min-w-0 flex-1 gap-px">
                      {r.cells.map((c, j) => (
                        <span key={j} className="h-3 min-w-0 flex-1 rounded-[2px]" style={cellStyle(c)} title={c} />
                      ))}
                    </span>
                    <span className="w-4 shrink-0 text-center font-mono text-xs" style={{ color: r.ok ? "var(--good)" : "var(--bad)" }}>
                      {r.ok ? "✓" : "✗"}
                    </span>
                  </li>
                ))}
              </ol>
              <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                <li className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm" style={cellStyle("ok")} />
                  step ok
                </li>
                <li className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm" style={cellStyle("caught")} />
                  slip caught, redone
                </li>
                {FAILS.map((f) => (
                  <li key={f.id} className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: FAIL_COLOR[f.id] }} />
                    {f.label.toLowerCase()}
                  </li>
                ))}
              </ul>
              <SuccessChart p={p} n={n} guards={guards} />
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Slider label="Each step goes right" value={p} min={0.8} max={0.995} step={0.005} format={(v) => `${(v * 100).toFixed(1)}%`} accent={ACCENT} onChange={setP} />
              </div>
              <div className="w-full">
                <Choices label="Steps in the task" accent={ACCENT} value={String(n)} onChange={(v) => setN(Number(v))} options={STEP_CHOICES.map((x) => ({ id: String(x), label: String(x) }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Running…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Break the task into steps" what="Booking a trip is search, compare, pick, fill a form, pay, confirm. Each step is a model call and a tool call, and the run only succeeds if every step does." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-sm">
                  {n} {n === 1 ? "step" : "steps"} · all must succeed
                </p>
              </FlowStep>
              <FlowArrow label="one step at a time" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Every step can slip" what="Most steps work. The ones that don't fail in a few typical ways." accent={ACCENT} active={at(1)}>
                <ul className="space-y-1.5 text-sm">
                  {byKind.map((f) => (
                    <li key={f.id}>
                      <span className="font-medium" style={{ color: FAIL_COLOR[f.id] }}>
                        {f.label}
                      </span>{" "}
                      <span className="font-mono text-xs text-[var(--faint)]">
                        {pct(f.share)} of slips · {f.count} {f.count === 1 ? "run" : "runs"} here
                      </span>
                      <span className="block text-xs text-[var(--muted)]">{f.what}</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label={`${pct(p)} per step`} accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Small slips compound" what="The chance of getting every step right is the per-step chance multiplied by itself once per step. Long tasks need very reliable steps." accent={ACCENT} active={at(2)}>
                <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-x-2 gap-y-1 font-mono text-xs">
                  <span className="text-[var(--faint)]">steps</span>
                  {STEP_CHOICES.map((s) => (
                    <span key={s} className="text-right text-[var(--faint)]">
                      {s}
                    </span>
                  ))}
                  {[0.9, 0.95, 0.99].map((q) => (
                    <Row key={q} label={`${q * 100}%`} values={STEP_CHOICES.map((s) => q ** s)} bold={Math.abs(q - p) < 0.001} />
                  ))}
                </div>
              </FlowStep>
              <FlowArrow label="catch it, or the run fails" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Catch slips where they happen" what="Each safeguard catches one kind of slip some of the time. A caught slip costs a retry instead of the run." accent={ACCENT} active={at(3)}>
                <ul className="space-y-2">
                  {GUARDS.map((g) => (
                    <li key={g.id}>
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="checkbox" checked={guards[g.id]} onChange={(e) => set(g.id, e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                        {g.label}
                        <span className="font-mono text-xs text-[var(--faint)]">catches {pct(g.rate)}</span>
                      </label>
                      <p className="pl-6 text-xs text-[var(--muted)]">{g.what}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-mono text-xs">
                  each step ends well: {pct(p)} → {pct(stepOk(p, guards))}
                </p>
              </FlowStep>
              <FlowArrow label={`${runs.length} runs`} accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Cap the run, and count" what={`A loop with no cap runs until someone kills it: here, ${MAX_STEPS} steps of paid model calls. Cap steps and spend, and measure success over many runs, not one demo.`} accent={ACCENT} active={at(4)}>
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-y-1 text-sm">
                  <dt className="text-[var(--muted)]">Runs that finished</dt>
                  <dd className="font-mono">{wins} / 20</dd>
                  <dt className="text-[var(--muted)]">Expected over many runs</dt>
                  <dd className="font-mono">{pct(success(p, n, guards))}</dd>
                  <dt className="text-[var(--muted)]">Steps burned by loops</dt>
                  <dd className="font-mono">{loopBurn}</dd>
                </dl>
                <p className="mt-2 text-xs text-[var(--muted)]">Shorter tasks help as much as better steps: split a 30-step job into checked stages, or hand the risky step to a person.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ label, values, bold }: { label: string; values: number[]; bold: boolean }) {
  return (
    <>
      <span style={{ fontWeight: bold ? 700 : 400 }}>{label}</span>
      {values.map((v, i) => (
        <span key={i} className="text-right" style={{ fontWeight: bold ? 700 : 400, color: v < 0.5 ? "var(--bad)" : "var(--text)" }}>
          {pct(v)}
        </span>
      ))}
    </>
  );
}

function SuccessChart({ p, n, guards }: { p: number; n: number; guards: Guards }) {
  const W = 320;
  const H = 130;
  const pad = { l: 32, r: 10, t: 8, b: 24 };
  const max = 30;
  const x = (s: number) => pad.l + ((s - 1) / (max - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b);
  const xs = Array.from({ length: max }, (_, i) => i + 1);
  const line = (g: Guards) => xs.map((s) => `${x(s)},${y(success(p, s, g))}`).join(" ");
  const anyGuard = Object.values(guards).some(Boolean);

  return (
    <figure className="mx-auto mt-4 max-w-lg">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Chance the whole task succeeds against the number of steps">
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={0.6} />
            <text x={pad.l - 5} y={y(t) + 3} textAnchor="end" fontSize={8} fill="var(--faint)">
              {pct(t)}
            </text>
          </g>
        ))}
        {[1, 10, 20, 30].map((s) => (
          <text key={s} x={x(s)} y={H - 12} textAnchor="middle" fontSize={8} fill="var(--faint)">
            {s}
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--faint)">
          steps in the task
        </text>
        <line x1={x(n)} x2={x(n)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" strokeDasharray="2 2" strokeWidth={0.8} />
        <polyline points={line(NO_GUARDS)} fill="none" stroke="var(--bad)" strokeWidth={anyGuard ? 1.2 : 2} opacity={anyGuard ? 0.6 : 1} />
        {anyGuard && <polyline points={line(guards)} fill="none" stroke="var(--good)" strokeWidth={2} />}
        <circle cx={x(n)} cy={y(success(p, n, guards))} r={3.2} fill={anyGuard ? "var(--good)" : "var(--bad)"} />
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[var(--bad)]" />
          no safeguards {pct(success(p, n, NO_GUARDS))}
        </span>
        {anyGuard && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-[var(--good)]" />
            with safeguards {pct(success(p, n, guards))}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
