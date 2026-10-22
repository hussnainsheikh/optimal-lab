"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, type NodeState, type Packet } from "@/components/system/SystemMap";
import { ABORT_ERROR, ABORT_SECONDS, BLASTS, DURATION, FAULTS, FAULT_END, FAULT_START, FIXES, RPS, SLO_ERROR, START, STEADY_ERROR, pct, run, type FixId, type Settings } from "@/lib/chaosEngineering";

const ACCENT = "var(--sys)";
const FRAME_S = 5;

export default function ChaosDemo() {
  const [s, setS] = useState<Settings>(START);
  const key = JSON.stringify(s);
  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Chaos engineering"
        blurb={`A shop: a load balancer, three app instances in three zones, a Redis cache, Postgres, and a recommendations service on the product page. Three weak spots are hidden in it. State what normal looks like, inject a fault into part of the traffic, and watch the error rate second by second, with a rule that stops the experiment if it hurts too much.`}
      />
      <div className="mt-6">
        <Run key={key} s={s} setS={setS} />
      </div>
    </SessionPage>
  );
}

function Run({ s, setS }: { s: Settings; setS: (s: Settings) => void }) {
  const r = run(s);
  const frames = Math.floor(DURATION / FRAME_S) + 1;
  const playback = usePlayback(frames, 700);
  const t = playback.i * FRAME_S;
  const sec = r.seconds[t];
  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });
  const setFix = (id: FixId, v: boolean) => setS({ ...s, fixes: { ...s.fixes, [id]: v } });
  const fault = FAULTS.find((f) => f.id === s.fault)!;
  const active = sec.inFault;
  const started = playback.i > 0 || playback.playing;
  const phase = t < FAULT_START ? "before" : r.abortedAt !== null && t >= r.abortedAt ? "aborted" : t < FAULT_END ? "during" : "after";
  const failing = active && sec.cohort > SLO_ERROR;

  const nodeState = (id: string): NodeState => {
    if (!active) return id === "recs" || id === "cache" || id.startsWith("app") || id === "db" ? "idle" : "active";
    if (s.fault === "instance" && id === "appA") return "bad";
    if (s.fault === "latency" && id === "recs") return "wait";
    if (s.fault === "cache" && id === "cache") return "bad";
    if (s.fault === "cache" && id === "db" && !s.fixes.replica) return "bad";
    if (s.fault === "latency" && !s.fixes.timeout && id.startsWith("app")) return "bad";
    return "active";
  };
  const packets: Packet[] = !started
    ? []
    : [
        { id: `r-${t}-1`, from: "lb", to: s.fault === "instance" && active && !s.fixes.fastHealth ? "appA" : "appB", label: "GET /product", tone: failing ? "bad" : "accent", duration: 0.5 },
        { id: `r-${t}-2`, from: "appB", to: s.fault === "cache" && active ? "db" : "cache", label: s.fault === "cache" && active ? "miss" : "hit", tone: s.fault === "cache" && active && !s.fixes.replica ? "bad" : "accent", delay: 0.5, duration: 0.5 },
        { id: `r-${t}-3`, from: "appB", to: "recs", label: s.fault === "latency" && active ? (s.fixes.timeout ? "timeout 300 ms" : "waiting 2 s") : "recs", tone: s.fault === "latency" && active ? (s.fixes.timeout ? "good" : "bad") : "accent", delay: 0.5, duration: 0.6 },
      ];

  const caption =
    phase === "before"
      ? `${t} s: steady state. ${pct(STEADY_ERROR)} errors, within the ${pct(SLO_ERROR)} the hypothesis allows. The fault starts at ${FAULT_START} s.`
      : phase === "during"
        ? `${t} s: ${fault.does} ${Math.round(s.blast * 100)}% of traffic is in the experiment; ${pct(sec.cohort)} of it is failing, ${pct(sec.error)} overall.`
        : phase === "aborted"
          ? `${t} s: aborted at ${r.abortedAt} s after the cohort passed ${pct(ABORT_ERROR)} for ${ABORT_SECONDS} s. The fault is removed; the finding stays.`
          : `${t} s: the fault ended at ${FAULT_END} s. ${r.verdict}`;

  return (
    <SessionLayout
      visual={
        <div className="space-y-3">
          <SystemMap
            title="A load balancer (LB), three app instances in zones a, b and c, a Redis cache, Postgres and a recommendations service (Recs)"
            accent={ACCENT}
            chrome="split"
            nodes={[
              { id: "lb", label: "LB", sub: s.fixes.fastHealth ? "check 5 s" : "check 30 s", at: [11, 50], mobileAt: [50, 8], state: "active" },
              { id: "appA", label: "App a", sub: s.fault === "instance" && active ? "killed" : "up", at: [36, 15], mobileAt: [18, 34], state: nodeState("appA") },
              { id: "appB", label: "App b", sub: "up", at: [36, 50], mobileAt: [50, 34], state: nodeState("appB") },
              { id: "appC", label: "App c", sub: "up", at: [36, 85], mobileAt: [82, 34], state: nodeState("appC") },
              { id: "cache", label: "Redis", sub: s.fault === "cache" && active ? (s.fixes.replica ? "replica up" : "down") : s.fixes.replica ? "+ replica" : "one node", at: [66, 18], mobileAt: [22, 66], state: nodeState("cache") },
              { id: "db", label: "Postgres", sub: s.fault === "cache" && active && !s.fixes.replica ? "saturated" : "ok", at: [89, 50], mobileAt: [50, 92], state: nodeState("db") },
              { id: "recs", label: "Recs", sub: s.fault === "latency" && active ? "+2 s" : s.fixes.timeout ? "timeout 300 ms" : "no timeout", at: [66, 82], mobileAt: [80, 66], state: nodeState("recs") },
            ]}
            links={[
              { from: "lb", to: "appA", label: "⅓", dim: s.fault === "instance" && active && s.fixes.fastHealth },
              { from: "lb", to: "appB", label: "⅓" },
              { from: "lb", to: "appC", label: "⅓" },
              { from: "appB", to: "cache", label: "read" },
              { from: "cache", to: "db", label: "miss", dim: !(s.fault === "cache" && active) },
              { from: "appB", to: "db", label: "write", dashed: true },
              { from: "appB", to: "recs", label: "recs" },
            ]}
            packets={packets}
            aspect={1.5}
            mobileAspect={0.95}
          />
          <ErrorChart r={r} t={t} />
        </div>
      }
      panel={
        <SystemMapPanel caption={caption}>
          <div className="w-full">
            <Choices label="Fault" accent={ACCENT} value={s.fault} onChange={(v) => set({ fault: v })} options={FAULTS.map((f) => ({ id: f.id, label: f.label }))} />
          </div>
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel={`+${FRAME_S} s`} status={`${t} s of ${DURATION}`} />
          <p className="w-full font-mono text-xs" style={{ color: r.held ? "var(--good)" : "var(--bad)" }}>
            {r.held ? "hypothesis held" : "hypothesis broken"} · {Math.round(r.failed).toLocaleString("en-US")} failed requests{r.abortedAt !== null ? ` · aborted at ${r.abortedAt} s` : ""}
          </p>
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Define the steady state" what={`Pick a number users feel, measured all the time: here the share of requests that fail. Normal is ${pct(STEADY_ERROR)}. The experiment's hypothesis is that it stays under ${pct(SLO_ERROR)} whatever you break.`} accent={ACCENT} active={phase === "before"}>
            <p className="font-mono text-xs">
              {RPS.toLocaleString("en-US")} requests a second · {pct(STEADY_ERROR)} failing · hypothesis: under {pct(SLO_ERROR)}
            </p>
          </FlowStep>
          <FlowArrow label="pick a fault" accent={ACCENT} />

          <FlowStep n={2} title="Say what you expect, then break one thing" what="Each fault is something that will happen anyway: an instance dies, a dependency slows down, a cache node is lost. Write the hypothesis before running it; a surprise is the point." accent={ACCENT} active={phase === "during" && t < FAULT_START + 10}>
            <Choices label="Fault" accent={ACCENT} value={s.fault} onChange={(v) => set({ fault: v })} options={FAULTS.map((f) => ({ id: f.id, label: f.label }))} />
            <p className="mt-2 text-xs">
              <span className="font-semibold">Hypothesis: </span>
              {fault.hypothesis}
            </p>
          </FlowStep>
          <FlowArrow label="to some of the traffic" accent={ACCENT} />

          <FlowStep n={3} title="Limit the blast radius" what="Run the fault against a slice of traffic first (a cohort of users, one instance, one zone) and widen only when it holds. Everyone outside the cohort is unaffected, so a wrong hypothesis is cheap." accent={ACCENT} active={phase === "during" && t >= FAULT_START + 10}>
            <Choices label="Traffic in the experiment" accent={ACCENT} value={String(s.blast)} onChange={(v) => set({ blast: Number(v) })} options={BLASTS.map((b) => ({ id: String(b), label: `${Math.round(b * 100)}%` }))} />
            <p className="mt-2 font-mono text-xs">
              cohort peak {pct(r.peakCohort)} failing → {pct(STEADY_ERROR + s.blast * r.peakCohort)} overall
            </p>
          </FlowStep>
          <FlowArrow label="watch it" accent={ACCENT} />

          <FlowStep n={4} title="Stop automatically when it hurts" what={`An abort rule ends the experiment without a human: here, if the cohort's errors pass ${pct(ABORT_ERROR)} for ${ABORT_SECONDS} seconds in a row. The fault is removed; what you learned is kept.`} accent={ACCENT} active={phase === "aborted"}>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={s.abort} onChange={(e) => set({ abort: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
              Abort rule on
            </label>
            <p className="font-mono text-xs" style={{ color: r.abortedAt !== null ? "var(--bad)" : "var(--text)" }}>
              {r.abortedAt !== null ? `aborted at ${r.abortedAt} s · ${Math.round(r.failed).toLocaleString("en-US")} failed requests` : `ran to the end · ${Math.round(r.failed).toLocaleString("en-US")} failed requests`}
            </p>
          </FlowStep>
          <FlowArrow label="fix and run again" accent={ACCENT} />

          <FlowStep n={5} title="Fix the weakness, run it again" what="A broken hypothesis is a weak spot found on your schedule instead of at 3 a.m. Fix it and rerun the same experiment until it holds; then automate it so it keeps holding." accent={ACCENT} active={phase === "after"}>
            <div className="space-y-0">
              {FIXES.map((f) => (
                <label key={f.id} className="flex min-h-11 items-center gap-2 text-sm" style={{ fontWeight: f.for === s.fault ? 600 : 400 }}>
                  <input type="checkbox" checked={s.fixes[f.id]} onChange={(e) => setFix(f.id, e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  {f.label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs" style={{ color: r.held ? "var(--good)" : "var(--text)" }}>
              {r.verdict}
            </p>
            <p className="mt-2 text-[11px] text-[var(--faint)]">Error curves are a model of each failure, with round numbers; detection times and the pool-exhaustion ramp are the mechanisms that matter.</p>
          </FlowStep>
        </>
      }
    />
  );
}

function ErrorChart({ r, t }: { r: ReturnType<typeof run>; t: number }) {
  const max = Math.max(0.05, ...r.seconds.map((x) => x.error)) * 1.15;
  const W = 100;
  const H = 26;
  const x = (s: number) => (s / DURATION) * W;
  const y = (e: number) => H - 4 - (e / max) * (H - 7);
  const path = r.seconds.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(2)},${y(p.error).toFixed(2)}`).join(" ");
  const end = r.abortedAt ?? FAULT_END;
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Error rate across all traffic, second by second">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">errors, all traffic</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={`Errors stay at ${pct(STEADY_ERROR)} before the fault and peak at ${pct(Math.max(...r.seconds.map((s) => s.error)))}`}>
        <rect x={x(FAULT_START)} y={1} width={x(end) - x(FAULT_START)} height={H - 5} fill="var(--bad)" opacity={0.08} />
        <line x1={0} x2={W} y1={y(SLO_ERROR)} y2={y(SLO_ERROR)} stroke="var(--good)" strokeWidth={0.4} strokeDasharray="1 1" />
        <text x={W - 0.5} y={y(SLO_ERROR) - 0.8} textAnchor="end" fontSize={2.6} fill="var(--good)">
          hypothesis {pct(SLO_ERROR)}
        </text>
        <path d={path} fill="none" stroke={ACCENT} strokeWidth={0.7} />
        <line x1={x(t)} x2={x(t)} y1={1} y2={H - 4} stroke="var(--text)" strokeWidth={0.3} />
        <text x={x(FAULT_START) + 0.5} y={4} fontSize={2.6} fill="var(--bad)">
          fault{r.abortedAt !== null ? " (aborted)" : ""}
        </text>
        <text x={0} y={H - 0.5} fontSize={2.6} fill="var(--faint)">
          0 s
        </text>
        <text x={W} y={H - 0.5} textAnchor="end" fontSize={2.6} fill="var(--faint)">
          {DURATION} s
        </text>
      </svg>
    </section>
  );
}
