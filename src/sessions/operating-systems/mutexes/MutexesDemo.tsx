"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { KINDS, KIND_LABEL, QUANTUM, STRIPES, TRACE, WAKE, ceilingPerMs, simulate, type Cell, type Kind, type Result } from "@/lib/mutexes";

const ACCENT = "var(--os)";
const CORES = 4;
const WORK = 10;
const CELL: Record<Cell, { color: string; label: string }> = {
  work: { color: "color-mix(in srgb, var(--c1) 45%, transparent)", label: "own work" },
  crit: { color: ACCENT, label: "holds the lock" },
  overlap: { color: "var(--bad)", label: "inside with another thread" },
  spin: { color: "var(--c2)", label: "spinning" },
  switch: { color: "var(--c5)", label: "switching" },
  ready: { color: "var(--line)", label: "waiting for a core" },
  sleep: { color: "transparent", label: "asleep" },
};
const LEGEND: Cell[] = ["work", "crit", "spin", "switch", "ready", "sleep", "overlap"];

function Timeline({ res }: { res: Result }) {
  return (
    <div className="space-y-1" role="img" aria-label={`Timeline of the first ${TRACE} microseconds for ${res.timeline.length} threads`}>
      {res.timeline.map((segs, t) => (
        <div key={t} className="flex items-center gap-2">
          <span className="w-6 shrink-0 font-mono text-[10px] text-[var(--faint)]">T{t + 1}</span>
          <div className="relative h-3.5 flex-1 overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--inset)]">
            {segs.map((s, i) => (
              <span key={i} className="absolute top-0 h-full" style={{ left: `${(s.from / TRACE) * 100}%`, width: `${((s.to - s.from) / TRACE) * 100}%`, background: CELL[s.cell].color }} />
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-between pl-8 font-mono text-[10px] text-[var(--faint)]">
        <span>0 µs</span><span>{TRACE / 2} µs</span><span>{TRACE} µs</span>
      </div>
    </div>
  );
}

export default function MutexesDemo() {
  const [kind, setKind] = useState<Kind>("spin");
  const [threads, setThreads] = useState(8);
  const [crit, setCrit] = useState(5);
  const [striped, setStriped] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const res = simulate({ kind, threads, cores: CORES, crit, work: WORK, striped });
  const compare = KINDS.map((k) => ({ k, r: k === kind ? res : simulate({ kind: k, threads, cores: CORES, crit, work: WORK, striped }) }));
  const busyCpu = res.cpu.work + res.cpu.crit + res.cpu.spin + res.cpu.switch + res.cpu.idle;
  const demand = (threads * crit) / (crit + WORK) / (striped ? STRIPES : 1);
  const over = threads > CORES;

  const preset = (k: Kind, t: number, c: number, s: boolean) => {
    setKind(k);
    setThreads(t);
    setCrit(c);
    setStriped(s);
  };

  const nodes: MapNode[] = [
    { id: "threads", label: `${threads} threads`, sub: `on ${CORES} cores`, at: [13, 28], mobileAt: [28, 10], state: on(0) ? "active" : over ? "wait" : "idle" },
    { id: "lock", label: striped ? `${STRIPES} locks` : "The lock", sub: kind === "none" ? "none: anyone walks in" : `${res.avgWait.toFixed(1)} µs avg wait`, at: [47, 28], mobileAt: [28, 42], state: kind === "none" ? "bad" : on(1) || on(3) ? "active" : "idle" },
    { id: "data", label: "Shared data", sub: res.lost ? `${res.lost.toLocaleString("en-US")} updates lost` : `${res.perMs.toFixed(0)} updates/ms`, at: [82, 28], mobileAt: [72, 42], state: res.lost ? "bad" : "good" },
    { id: "kernel", label: "Kernel", sub: kind === "mutex" ? `${res.sleeps.toLocaleString("en-US")} futex sleeps` : "not involved", at: [47, 78], mobileAt: [28, 80], state: kind === "mutex" ? (on(2) || on(3) ? "active" : "wait") : "dim" },
    { id: "cpu", label: "Cores", sub: `${Math.round((res.cpu.spin / busyCpu) * 100)}% spinning · ${Math.round((res.cpu.idle / busyCpu) * 100)}% idle`, at: [82, 78], mobileAt: [72, 80], state: res.cpu.spin / busyCpu > 0.25 ? "bad" : "idle" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["threads", "lock"], { label: "lock()" })
    : stage === 1 ? hops("b", ["lock", "data"], { label: kind === "none" ? "no check" : "CAS: got it", tone: kind === "none" ? "bad" : "good" })
    : stage === 2 ? (kind === "spin" ? hops("c", ["threads", "lock", "threads"], { label: "retry, retry", tone: "bad" }) : kind === "mutex" ? hops("c", ["lock", "kernel"], { label: "futex_wait" }) : hops("c", ["threads", "data"], { label: "two inside", tone: "bad" }))
    : stage === 3 ? (kind === "mutex" ? hops("d", ["kernel", "threads"], { label: `wake (${WAKE} µs)` }) : hops("d", ["lock", "threads"], { label: kind === "none" ? "overwrite" : "free", tone: kind === "none" ? "bad" : "good" }))
    : stage === 4 ? hops("e", ["data", "cpu"], { label: `${res.perMs.toFixed(0)}/ms`, tone: res.lost ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: ${threads} threads each do ~${WORK} µs of their own work, then need ~${crit} µs inside the critical section.`,
    kind === "none" ? "Step 2: there is no lock, so a thread walks straight in, even if another is already inside." : "Step 2: if the lock is free, one atomic compare-and-swap in user space takes it. No kernel, a few nanoseconds.",
    kind === "spin" ? `Step 3: a waiter spins on its core: ${res.cpu.spin.toLocaleString("en-US")} core-µs burned${res.holderPreempted ? `, ${res.holderPreempted.toLocaleString("en-US")} µs of it while the holder wasn't even running` : ""}.` : kind === "mutex" ? `Step 3: a waiter sleeps in the kernel and frees its core: ${res.sleeps.toLocaleString("en-US")} sleeps.` : `Step 3: nothing makes anyone wait, so critical sections overlap.`,
    kind === "mutex" ? `Step 4: unlock wakes one sleeper, which needs ~${WAKE} µs and a core before it can try again.` : kind === "spin" ? "Step 4: unlock is a single store; a spinner sees it on its next try." : `Step 4: two threads read the same value and both write back +1: ${res.lost.toLocaleString("en-US")} updates lost.`,
    `Step 5: ${res.perMs.toFixed(0)} updates per ms${res.lost ? `, but ${res.lost.toLocaleString("en-US")} were lost` : ""}. One lock can never do more than ${ceilingPerMs(crit).toFixed(0)}/ms at ${crit} µs each.`,
  ];
  const caption = stage !== null ? captions[stage] : `${KIND_LABEL[kind]}, ${threads} threads on ${CORES} cores, ${crit} µs critical sections: ${res.perMs.toFixed(0)} updates/ms${res.lost ? `, ${res.lost.toLocaleString("en-US")} lost` : ""}${kind === "spin" ? `, ${Math.round((res.cpu.spin / busyCpu) * 100)}% of the CPU spent spinning` : ""}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Mutexes and critical sections"
        blurb="A mutex lets one thread at a time into the code that touches shared data. That makes it correct, and it also makes that code a queue. How the waiting is done, spinning on a core or sleeping in the kernel, decides how much the queue costs. Simulated microsecond by microsecond on four cores."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Threads take a lock before touching shared data; waiting threads spin on a core or sleep in the kernel"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "threads", to: "lock", label: "lock()" },
                  { from: "lock", to: "data", label: "enter" },
                  { from: "lock", to: "kernel", label: "futex", dim: kind !== "mutex" },
                  { from: "threads", to: "kernel", label: "wake", dim: kind !== "mutex" },
                  { from: "data", to: "cpu", label: "throughput" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="What each thread did">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">The first {TRACE} microseconds, thread by thread</p>
                <div className="mt-2">
                  <Timeline res={res} />
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                  {LEGEND.filter((c) => c !== "overlap" || kind === "none").map((c) => (
                    <span key={c}>
                      <span className="mr-1 inline-block h-2 w-3 rounded-sm border border-[var(--line)] align-middle" style={{ background: CELL[c].color }} />
                      {CELL[c].label}
                    </span>
                  ))}
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => preset("spin", 8, 5, false)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Spinning, too many threads
                </button>
                <button type="button" onClick={() => preset("none", 4, 5, false)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  No lock at all
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Locking…">
                Walk one update
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Reach the critical section" what="The critical section is the few lines that read and write shared data: a counter, a map, a list. Everything else a thread does is its own business. The more threads want the same lock, and the longer they hold it, the more they queue." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<"4" | "8"> label="Threads" accent={ACCENT} value={String(threads) as "4" | "8"} onChange={(v) => setThreads(Number(v))} options={[{ id: "4", label: "4 threads, 4 cores" }, { id: "8", label: "8 threads, 4 cores" }]} />
                  <Slider label="Time inside the critical section" value={crit} min={1} max={30} step={1} format={(v) => `${v} µs`} onChange={setCrit} accent={ACCENT} hint={`Each thread also does ~${WORK} µs of its own work between updates.`} />
                  <p className="font-mono text-xs" style={{ color: demand > 1 ? "var(--bad)" : "var(--text)" }}>
                    Demand on {striped ? "each lock" : "the lock"}: {demand.toFixed(2)} {demand > 1 ? "(more than one thread wants it at a time: a queue forms)" : "(usually free)"}
                  </p>
                </div>
              </FlowStep>
              <FlowArrow label="lock()" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Take the lock if it's free" what="A lock is one word of memory. Taking a free lock is a single atomic compare-and-swap from 0 to 1, done in user space: no system call. Most lock operations in a healthy program take this fast path." accent={ACCENT} active={on(1)}>
                <div className="space-y-3">
                  <Choices<Kind> accent={ACCENT} value={kind} onChange={setKind} options={KINDS.map((id) => ({ id, label: KIND_LABEL[id] }))} />
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <p><span className="block text-[var(--faint)]">Avg wait</span><span className="font-mono">{res.avgWait.toFixed(1)} µs</span></p>
                    <p><span className="block text-[var(--faint)]">Worst wait</span><span className="font-mono">{res.maxWait} µs</span></p>
                    <p><span className="block text-[var(--faint)]">Lost updates</span><span className="font-mono" style={{ color: res.lost ? "var(--bad)" : "var(--good)" }}>{res.lost.toLocaleString("en-US")}</span></p>
                  </div>
                </div>
              </FlowStep>
              <FlowArrow label="it's taken" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Wait: spin or sleep" what="A spinlock keeps retrying on its core: the hand-over is instant, but the core does nothing useful, and if the holder gets preempted the spinners burn whole time slices. A mutex asks the kernel to put the thread to sleep (futex_wait on Linux) and gives the core to someone else." accent={ACCENT} active={on(2)}>
                <div className="space-y-3">
                  <div className="flex h-4 overflow-hidden rounded" role="img" aria-label="How the cores spent their time">
                    {(["work", "crit", "spin", "switch", "idle"] as const).map((k) => (
                      <span key={k} className="h-full" style={{ width: `${(res.cpu[k] / busyCpu) * 100}%`, background: k === "idle" ? "var(--inset)" : CELL[k === "crit" ? "crit" : k].color }} />
                    ))}
                  </div>
                  <p className="flex flex-wrap gap-x-3 font-mono text-[11px] text-[var(--muted)]">
                    <span>work {Math.round((res.cpu.work / busyCpu) * 100)}%</span>
                    <span>locked {Math.round((res.cpu.crit / busyCpu) * 100)}%</span>
                    <span style={{ color: res.cpu.spin ? "var(--c2)" : undefined }}>spin {Math.round((res.cpu.spin / busyCpu) * 100)}%</span>
                    <span>switch {Math.round((res.cpu.switch / busyCpu) * 100)}%</span>
                    <span>idle {Math.round((res.cpu.idle / busyCpu) * 100)}%</span>
                  </p>
                  {kind === "spin" && res.holderPreempted > 0 && (
                    <p className="text-xs text-[var(--bad)]">The holder sat off-core for {res.holderPreempted.toLocaleString("en-US")} µs while others spun waiting for it: with more threads than cores, a {QUANTUM} µs slice can expire mid-critical-section.</p>
                  )}
                </div>
              </FlowStep>
              <FlowArrow label="unlock()" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Release and hand over" what="Unlock stores 0. With sleepers, it also asks the kernel to wake one (futex_wake). The sleeper needs a few microseconds and a free core before it can try again, and a thread that just arrived can grab the lock first. That gap is why a sleeping mutex is slower when the lock changes hands constantly." accent={ACCENT} active={on(3)}>
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <p><span className="block text-[var(--faint)]">Sleeps</span><span className="font-mono">{res.sleeps.toLocaleString("en-US")}</span></p>
                    <p><span className="block text-[var(--faint)]">Core switches</span><span className="font-mono">{res.switches.toLocaleString("en-US")}</span></p>
                    <p><span className="block text-[var(--faint)]">Wake delay</span><span className="font-mono">{WAKE} µs</span></p>
                  </div>
                  {kind === "none" && <p className="text-xs text-[var(--bad)]">Without the lock, two threads read the same value and both write it back +1. Red in the timeline is a thread inside alongside another.</p>}
                </div>
              </FlowStep>
              <FlowArrow label="updates per ms" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Keep critical sections short, and split the lock" what="One lock lets one thread in at a time, so it caps throughput at 1 ÷ the time inside, however many cores you add. Hold it for less time, or split it: a lock per bucket of a hash map means threads only queue when they touch the same bucket." accent={ACCENT} active={on(4)}>
                <div className="space-y-3">
                  <Choices<"one" | "striped"> accent={ACCENT} value={striped ? "striped" : "one"} onChange={(v) => setStriped(v === "striped")} options={[{ id: "one", label: "One lock" }, { id: "striped", label: `${STRIPES} locks (striped)` }]} />
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[20rem] text-xs">
                      <thead>
                        <tr className="text-[var(--faint)]">
                          <th className="py-1 pr-2 text-left font-normal">Waiting</th>
                          <th className="py-1 pr-2 text-right font-normal">Updates/ms</th>
                          <th className="py-1 pr-2 text-right font-normal">Lost</th>
                          <th className="py-1 pr-2 text-right font-normal">CPU spinning</th>
                          <th className="py-1 text-right font-normal">CPU idle</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {compare.map(({ k, r }) => {
                          const tot = r.cpu.work + r.cpu.crit + r.cpu.spin + r.cpu.switch + r.cpu.idle;
                          return (
                            <tr key={k} className="border-t border-[var(--line)]" style={{ color: k === kind ? "var(--text)" : "var(--muted)" }}>
                              <td className="py-1 pr-2 font-sans">{KIND_LABEL[k]}</td>
                              <td className="py-1 pr-2 text-right">{r.perMs.toFixed(0)}</td>
                              <td className="py-1 pr-2 text-right" style={{ color: r.lost ? "var(--bad)" : undefined }}>{r.lost.toLocaleString("en-US")}</td>
                              <td className="py-1 pr-2 text-right">{Math.round((r.cpu.spin / tot) * 100)}%</td>
                              <td className="py-1 text-right">{Math.round((r.cpu.idle / tot) * 100)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    Ceiling for one lock at {crit} µs: {ceilingPerMs(crit).toFixed(0)} updates/ms. {over ? "With more threads than cores, spinning loses: spinners take the cores the holder needs." : "With a core per thread, spinning wins short waits; that's why real mutexes spin briefly before sleeping."}
                  </p>
                  <p className="text-[11px] text-[var(--faint)]">Wake delay, switch cost and time slice are illustrative (real slices are milliseconds). The scheduling, the locking and the lost updates are simulated exactly.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
