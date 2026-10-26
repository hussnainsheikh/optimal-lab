"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { TASKS, WORKLOAD, amdahl, schedule, type Result, type Workload } from "@/lib/concPar";

const ACCENT = "var(--os)";
const TASK_COLOR = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c5)"];
const CORE_CHOICES = [1, 2, 4];
const AMDAHL_CORES = [1, 2, 4, 8, 16, 64];

function Gantt({ r, span }: { r: Result; span: number }) {
  const lane = "relative h-5 overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--inset)]";
  return (
    <div className="space-y-1">
      {r.cores.map((segs, c) => (
        <div key={c} className="flex items-center gap-2">
          <span className="w-14 shrink-0 font-mono text-[10px] text-[var(--faint)]">core {c + 1}</span>
          <div className={`${lane} flex-1`}>
            {segs.filter((s) => s.what !== "idle").map((s, i) => (
              <span
                key={i}
                className="absolute top-0 grid h-full place-items-center font-mono text-[9px] text-[var(--text)]"
                style={{ left: `${(s.from / span) * 100}%`, width: `${((s.to - s.from) / span) * 100}%`, background: s.what === "cpu" ? TASK_COLOR[s.task] : `repeating-linear-gradient(135deg, color-mix(in srgb, ${TASK_COLOR[s.task]} 35%, transparent) 0 4px, transparent 4px 8px)` }}
              >
                {s.to - s.from >= span * 0.06 ? `T${s.task + 1}` : ""}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 font-mono text-[10px] text-[var(--faint)]">network</span>
        <div className={`${lane} flex-1`}>
          {r.waits.map((w, i) => (
            <span key={i} className="absolute h-1" style={{ top: `${2 + w.task * 4}px`, left: `${(w.from / span) * 100}%`, width: `${((w.to - w.from) / span) * 100}%`, background: TASK_COLOR[w.task] }} />
          ))}
        </div>
      </div>
      <div className="flex justify-between pl-16 font-mono text-[10px] text-[var(--faint)]">
        <span>0</span><span>{Math.round(span / 2)} ms</span><span>{span} ms</span>
      </div>
    </div>
  );
}

export default function ConcurrencyParallelismDemo() {
  const [w, setW] = useState<Workload>("io");
  const [cores, setCores] = useState(1);
  const [concurrent, setConcurrent] = useState(false);
  const [p, setP] = useState(0.9);
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const r = schedule(w, cores, concurrent);
  const base = schedule(w, 1, false);
  const grid = CORE_CHOICES.map((k) => ({ k, off: schedule(w, k, false).makespan, on: schedule(w, k, true).makespan }));
  const span = base.makespan;
  const W = WORKLOAD[w];
  const waits = W.phases.some((ph) => !ph.cpu);

  const nodes: MapNode[] = [
    { id: "tasks", label: `${TASKS} tasks`, sub: W.label, at: [12, 25], mobileAt: [28, 10], state: on(0) ? "active" : "idle" },
    { id: "sched", label: "Scheduler", sub: concurrent ? "switches on every wait" : "one task per core to the end", at: [46, 25], mobileAt: [72, 10], state: on(2) ? "active" : "idle" },
    { id: "cores", label: `${cores} core${cores === 1 ? "" : "s"}`, sub: `${Math.round(r.busy * 100)}% busy`, at: [83, 25], mobileAt: [28, 45], state: on(3) ? "active" : r.busy < 0.6 ? "wait" : "good" },
    { id: "net", label: "Network", sub: waits ? "60 ms per call" : "not used", at: [46, 78], mobileAt: [72, 45], state: waits ? (on(1) ? "active" : "idle") : "dim" },
    { id: "done", label: "All done", sub: `${r.makespan} ms`, at: [83, 78], mobileAt: [50, 84], state: r.makespan < base.makespan ? "good" : "idle" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["tasks", "sched"], { label: `${TASKS} tasks` })
    : stage === 1 ? (waits ? hops("b", ["cores", "net"], { label: "wait 60 ms", tone: concurrent ? undefined : "bad" }) : hops("b", ["sched", "cores"], { label: "T1 runs" }))
    : stage === 2 ? hops("c", ["sched", "cores"], { label: concurrent ? "switch to T2" : "core idles", tone: concurrent ? "good" : "bad" })
    : stage === 3 ? hops("d", ["sched", "cores"], { label: `${cores} at once` })
    : stage === 4 ? hops("e", ["cores", "done"], { label: `${r.makespan} ms`, tone: "good" })
    : [];

  const captions = [
    `Step 1: ${TASKS} tasks. ${W.blurb}`,
    waits ? `Step 2: one core, one task at a time: while a task waits on the network, its core does nothing. ${base.makespan} ms in total, the core busy ${Math.round(base.busy * 100)}% of it.` : `Step 2: one core, one task at a time: ${base.makespan} ms, and the core is busy the whole time.`,
    waits ? (concurrent ? `Step 3: with concurrency, a core switches to another task while one waits: ${schedule(w, 1, true).makespan} ms on one core.` : "Step 3: concurrency is off, so the core sits idle through every wait. Turn it on.") : "Step 3: nothing ever waits, so switching between tasks can't help: one core is still one core.",
    `Step 4: ${cores} core${cores === 1 ? "" : "s"} run${cores === 1 ? "s" : ""} ${cores === 1 ? "one task" : `${cores} tasks at the same instant`}: ${r.makespan} ms.`,
    `Step 5: ${r.makespan} ms instead of ${base.makespan} ms (${(base.makespan / r.makespan).toFixed(1)}× faster). With ${Math.round((1 - p) * 100)}% of a job serial, no number of cores beats ${(1 / (1 - p)).toFixed(0)}×.`,
  ];
  const caption = stage !== null ? captions[stage] : `${cores} core${cores === 1 ? "" : "s"}, concurrency ${concurrent ? "on" : "off"}: all ${TASKS} tasks done in ${r.makespan} ms (one at a time: ${base.makespan} ms).`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Concurrency vs parallelism"
        blurb="Concurrency is dealing with many things at once: switching to another task while one waits. Parallelism is doing many things at the same instant, on more cores. They're independent: one core can be concurrent, and four cores can still sit idle. Four tasks, scheduled millisecond by millisecond."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Tasks go to a scheduler that runs them on cores; some wait on the network"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "tasks", to: "sched", label: "ready" },
                  { from: "sched", to: "cores", label: "run" },
                  { from: "cores", to: "net", label: "wait", dim: !waits },
                  { from: "cores", to: "done", label: "finish" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Which task each core ran, millisecond by millisecond">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">What each core did</p>
                <div className="mt-2">
                  <Gantt r={r} span={span} />
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                  {TASK_COLOR.map((c, i) => (
                    <span key={i}><span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: c }} />T{i + 1} computing</span>
                  ))}
                  <span>striped: the core is held, idle, while its task waits</span>
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => { setW("io"); setCores(1); setConcurrent(true); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Concurrent on one core
                </button>
                <button type="button" onClick={() => { setW("cpu"); setCores(4); setConcurrent(false); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Parallel on four
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Scheduling…">
                Walk the schedule
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Lay out the work" what="What a task spends its time on decides what helps. Computing needs a core. Waiting for the network or a disk doesn't need anything, as long as someone notices when it's done." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<Workload> accent={ACCENT} value={w} onChange={setW} options={(Object.keys(WORKLOAD) as Workload[]).map((id) => ({ id, label: WORKLOAD[id].label }))} />
                  <p className="font-mono text-xs">{W.phases.map((ph) => `${ph.cpu ? "compute" : "wait"} ${ph.ms} ms`).join(" → ")}, × {TASKS} tasks</p>
                </div>
              </FlowStep>
              <FlowArrow label="one core" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="One core, one task at a time" what="The simplest schedule: run a task to the end, then the next. Every wait is dead time for the core. This is how a single-threaded program with blocking calls behaves." accent={ACCENT} active={on(1)}>
                <p className="font-mono text-xs">{base.makespan} ms in total · core busy {Math.round(base.busy * 100)}% of the time</p>
              </FlowStep>
              <FlowArrow label="switch on a wait" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Concurrency: switch while one waits" what="Start the next task while the first waits for the network: threads, an event loop and coroutines all do this. It needs no extra cores. It helps only when tasks wait; it can't make computing faster." accent={ACCENT} active={on(2)}>
                <div className="space-y-2">
                  <Choices<"off" | "on"> accent={ACCENT} value={concurrent ? "on" : "off"} onChange={(v) => setConcurrent(v === "on")} options={[{ id: "off", label: "One task per core" }, { id: "on", label: "Switch on every wait" }]} />
                  <p className="font-mono text-xs">On one core: {schedule(w, 1, false).makespan} ms → {schedule(w, 1, true).makespan} ms</p>
                </div>
              </FlowStep>
              <FlowArrow label="more cores" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Parallelism: more cores at the same instant" what="More cores run more tasks at literally the same time. That speeds up computing, which concurrency can't, but a core whose task is waiting is still wasted unless the schedule is concurrent too." accent={ACCENT} active={on(3)}>
                <div className="space-y-3">
                  <Choices<string> label="Cores" accent={ACCENT} value={String(cores)} onChange={(v) => setCores(Number(v))} options={CORE_CHOICES.map((k) => ({ id: String(k), label: `${k} core${k === 1 ? "" : "s"}` }))} />
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[18rem] text-xs">
                      <thead>
                        <tr className="text-[var(--faint)]">
                          <th className="py-1 pr-2 text-left font-normal">Cores</th>
                          <th className="py-1 pr-2 text-right font-normal">One task per core</th>
                          <th className="py-1 text-right font-normal">Switch on waits</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {grid.map((g) => (
                          <tr key={g.k} className="border-t border-[var(--line)]" style={{ color: g.k === cores ? "var(--text)" : "var(--muted)" }}>
                            <td className="py-1 pr-2">{g.k}</td>
                            <td className="py-1 pr-2 text-right" style={{ fontWeight: g.k === cores && !concurrent ? 700 : undefined }}>{g.off} ms</td>
                            <td className="py-1 text-right" style={{ fontWeight: g.k === cores && concurrent ? 700 : undefined }}>{g.on} ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </FlowStep>
              <FlowArrow label="the limit" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="The part that can't be split caps the speedup" what="Real jobs have a serial part: reading the input, merging results, holding one lock. Amdahl's law: on n cores the speedup is 1 ÷ ((1 − p) + p ÷ n), where p is the share that runs in parallel. Past a point, more cores barely help." accent={ACCENT} active={on(4)}>
                <div className="space-y-3">
                  <Slider label="Share that runs in parallel" value={p} min={0.5} max={0.99} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={setP} accent={ACCENT} />
                  <div className="flex items-end gap-1" role="img" aria-label={`Speedup by core count, capped at ${(1 / (1 - p)).toFixed(0)} times`}>
                    {AMDAHL_CORES.map((k) => {
                      const s = amdahl(p, k);
                      return (
                        <div key={k} className="flex-1 text-center">
                          <div className="mx-auto w-full rounded-t-sm" style={{ height: `${Math.max(4, (s / (1 / (1 - p))) * 72)}px`, background: ACCENT }} />
                          <p className="font-mono text-[10px]">{s.toFixed(1)}×</p>
                          <p className="font-mono text-[10px] text-[var(--faint)]">{k} core{k === 1 ? "" : "s"}</p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-[var(--muted)]">The ceiling is 1 ÷ (1 − p) = {(1 / (1 - p)).toFixed(1)}×, however many cores you add. The task schedules above are simulated per millisecond; the phase lengths are illustrative.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
