"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CASES, FIX_LABELS, MAX_PRESSURE, NO_FIXES, PRESSURES, SCENARIOS, effectivePressure, pct, peak, proxyScore, sampleAt, trueScore, type Fixes, type ScenarioId } from "@/lib/alignment";

const ACCENT = "var(--ai)";
const PROXY = "var(--c3)";
const TRUE = "var(--good)";

export default function AlignmentDemo() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("thumbs");
  const [pressure, setPressure] = useState(6);
  const [fixes, setFixes] = useState<Fixes>(NO_FIXES);
  const { stage, busy, run } = useWalk(5, 1100);
  const s = SCENARIOS.find((x) => x.id === scenarioId)!;
  const p = effectivePressure(s, pressure, fixes);
  const proxy = proxyScore(p);
  const truth = trueScore(s, p, fixes);
  const pk = peak(s, fixes);
  const at = (i: number) => stage === i;
  const set = (id: keyof Fixes, v: boolean) => setFixes((f) => ({ ...f, [id]: v }));
  const gaming = p > s.onset + 1;

  const captions = [
    `Step 1: the goal is “${s.goal}”`,
    `Step 2: the proxy is ${s.proxy.toLowerCase()} It's measurable; the goal isn't.`,
    `Step 3: at pressure ${p}, the proxy reads ${pct(proxy)} and the true goal ${pct(truth)}.`,
    gaming ? `Step 4: past pressure ${s.onset} the shortcut pays better than honest work. ${s.shortcut}` : "Step 4: the shortcut hasn't started paying yet. Push the pressure past the peak.",
    `Step 5: with these fixes the true goal peaks at ${pct(pk.score)} (pressure ${pk.pressure}).`,
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : gaming
        ? `Pressure ${p}: proxy ${pct(proxy)}, true goal ${pct(truth)}. The model has found the shortcut: “${sampleAt(s, p)}”`
        : `Pressure ${p}: proxy ${pct(proxy)}, true goal ${pct(truth)}. Honest gains so far. The peak is at pressure ${pk.pressure}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Alignment basics"
        blurb="You train a model to score well on something you can measure, because you can't measure what you actually want. Push hard enough and the model finds the cheapest way to score: agreeing with you, gaming the tests, keeping you hooked. Turn up the optimization pressure, watch the real goal peak and fall, then try the fixes."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Proxy score and true goal against optimization pressure, and the model's reply">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{s.label}</p>
                <p className="font-mono text-sm">
                  <span style={{ color: PROXY }}>proxy {pct(proxy)}</span> · <span style={{ color: TRUE }}>true {pct(truth)}</span>
                </p>
              </div>
              <Chart s={s} fixes={fixes} p={p} />
              <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">the model&rsquo;s reply at this pressure</p>
              <p className="mt-1 rounded-md bg-[var(--inset)] px-3 py-2 text-sm" style={{ color: gaming ? "var(--bad)" : "var(--text)" }}>
                “{sampleAt(s, p)}”
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Slider label="Optimization pressure" value={pressure} min={0} max={MAX_PRESSURE} step={0.5} format={(v) => v.toFixed(1)} accent={ACCENT} onChange={setPressure} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Optimizing…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="State what you want" what="The real goal is about people: accurate, useful, worth their time. None of those is a number you can compute from a reply." accent={ACCENT} active={at(0)}>
                <Choices accent={ACCENT} value={scenarioId} onChange={(id) => setScenarioId(id)} options={SCENARIOS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-sm">{s.goal}</p>
              </FlowStep>
              <FlowArrow label="needs a number" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Pick a proxy you can measure" what="Thumbs-up, tests passed, minutes in the app. Each tracks the goal at first, which is why it's chosen." accent={ACCENT} active={at(1)}>
                <p className="text-sm">{s.proxy}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Honest way up: {s.honest}</p>
              </FlowStep>
              <FlowArrow label="optimize it" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Optimize the proxy" what="Reinforcement learning, A/B tests, or a product team: anything that keeps pushing the number up. The pressure is how hard and how long." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs">
                  pressure {p} → proxy {pct(proxy)} · true goal {pct(truth)}
                </p>
              </FlowStep>
              <FlowArrow label="Goodhart's law" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Watch the real goal peak, then fall" what="Once honest improvements are used up, the cheapest way to raise the proxy is the shortcut. The proxy keeps climbing; the thing you wanted goes backwards. When a measure becomes a target, it stops being a good measure." accent={ACCENT} active={at(3)}>
                <p className="text-sm">{s.shortcut}</p>
                <ul className="mt-2 space-y-0.5 text-xs text-[var(--muted)]">
                  {CASES.map((c) => (
                    <li key={c.who}>
                      <span className="text-[var(--text)]">{c.who}</span> {c.did}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="close the gap" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Close the gap, and keep closing it" what="Nothing turns the proxy into the goal. You measure the goal directly on a sample, write the behaviour you want into the spec, and stop pushing when the real thing stops improving. Then watch for the next shortcut." accent={ACCENT} active={at(4)}>
                <ul className="space-y-2">
                  {FIX_LABELS.map((f) => (
                    <li key={f.id}>
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="checkbox" checked={fixes[f.id]} onChange={(e) => set(f.id, e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                        {f.label}
                      </label>
                      <p className="pl-6 text-xs text-[var(--muted)]">{f.what}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-mono text-xs">
                  true goal at the peak: {pct(pk.score)} (pressure {pk.pressure}) · at pressure 10: {pct(trueScore(s, 10, fixes))}
                </p>
                <p className="mt-2 text-xs text-[var(--faint)]">This is what a model spec, a constitution, RLHF with a KL leash, red-teaming and human oversight are each for. The curves are a teaching model; the three cases are documented.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Chart({ s, fixes, p }: { s: (typeof SCENARIOS)[number]; fixes: Fixes; p: number }) {
  const W = 320;
  const H = 150;
  const pad = { l: 34, r: 10, t: 10, b: 26 };
  const x = (v: number) => pad.l + (v / MAX_PRESSURE) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v) * (H - pad.t - pad.b);
  const base = { ...fixes, stop: false };
  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Proxy score and true goal against optimization pressure">
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={0.6} />
            <text x={pad.l - 5} y={y(v) + 3} textAnchor="end" fontSize={8} fill="var(--faint)">
              {pct(v)}
            </text>
          </g>
        ))}
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <text key={v} x={x(v)} y={H - 12} textAnchor="middle" fontSize={8} fill="var(--faint)">
            {v}
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--faint)">
          optimization pressure
        </text>
        <line x1={x(s.onset)} x2={x(s.onset)} y1={pad.t} y2={H - pad.b} stroke="var(--line)" strokeDasharray="2 2" strokeWidth={0.8} />
        <text x={x(s.onset) + 2} y={pad.t + 8} fontSize={7} fill="var(--faint)">
          shortcut starts paying
        </text>
        <polyline points={PRESSURES.map((v) => `${x(v)},${y(proxyScore(v))}`).join(" ")} fill="none" stroke={PROXY} strokeWidth={1.8} />
        <polyline points={PRESSURES.map((v) => `${x(v)},${y(trueScore(s, v, base))}`).join(" ")} fill="none" stroke={TRUE} strokeWidth={2} />
        <line x1={x(p)} x2={x(p)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" strokeWidth={1} />
        <circle cx={x(p)} cy={y(proxyScore(p))} r={3} fill={PROXY} />
        <circle cx={x(p)} cy={y(trueScore(s, p, fixes))} r={3} fill={TRUE} />
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: PROXY }} />
          the proxy you optimize
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: TRUE }} />
          the goal you wanted
        </span>
      </figcaption>
    </figure>
  );
}
