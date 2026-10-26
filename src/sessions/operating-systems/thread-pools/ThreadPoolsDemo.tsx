"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { CORES, MAX_THREADS, POOL_SIZES, STACK_MB, UNLIMITED, WORKLOAD, capacityPerSec, simulate, suggested, sweep, type Workload } from "@/lib/workerPool";

const ACCENT = "var(--os)";
const ms = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(1)} s` : `${Math.round(x)} ms`);
const n = (x: number) => x.toLocaleString("en-US");
const pct = (x: number) => `${Math.round(x * 100)}%`;
type QueueBound = "unbounded" | "50";

export default function ThreadPoolsDemo() {
  const [workload, setWorkload] = useState<Workload>("io");
  const [rate, setRate] = useState(300);
  const [pool, setPool] = useState(8);
  const [bound, setBound] = useState<QueueBound>("unbounded");
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const queue = bound === "unbounded" ? Infinity : 50;
  const r = simulate({ workload, rate, pool, queue });
  const table = sweep(workload, rate, queue);
  const perTask = simulate({ workload, rate, pool: UNLIMITED, queue: Infinity });
  const W = WORKLOAD[workload];
  const goetz = suggested(workload);
  const cap = capacityPerSec(workload);
  const unlimited = pool === UNLIMITED;
  const bestRow = table.reduce((b, t) => (t.done > b.done || (t.done === b.done && t.p99 < b.p99) ? t : b));
  const healthy = !r.crashedAt && r.rejected === 0 && r.unfinished === 0 && r.p99 < 4 * (W.cpu + W.io);
  const maxP99 = Math.max(...table.map((t) => t.p99), 1);

  const preset = (w: Workload, rt: number, p: number, b: QueueBound) => {
    setWorkload(w);
    setRate(rt);
    setPool(p);
    setBound(b);
  };

  const nodes: MapNode[] = [
    { id: "in", label: "Requests", sub: `${rate}/s for 5 s`, at: [12, 28], mobileAt: [28, 10], state: on(0) ? "active" : "idle" },
    { id: "queue", label: "Task queue", sub: unlimited ? "none" : `peak ${n(r.peakQueue)}${bound === "50" ? " of 50" : ""}`, at: [42, 28], mobileAt: [72, 10], state: unlimited ? "dim" : r.rejected ? "bad" : r.peakQueue > 100 ? "wait" : "idle" },
    { id: "pool", label: unlimited ? "Thread per task" : `Pool of ${pool}`, sub: unlimited ? `${n(r.peakThreads)} threads at peak` : `${pool} threads`, at: [74, 28], mobileAt: [28, 45], state: r.crashedAt ? "bad" : on(2) ? "active" : "idle" },
    { id: "cpu", label: `${CORES} cores`, sub: `${pct(r.cpuUse)} busy`, at: [42, 80], mobileAt: [28, 82], state: r.cpuUse > 0.95 ? "bad" : on(2) ? "active" : "idle" },
    { id: "api", label: W.io ? "API / database" : "No I/O", sub: W.io ? `${W.io} ms per call` : "pure compute", at: [74, 80], mobileAt: [72, 82], state: W.io ? (on(2) ? "active" : "idle") : "dim" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["in", unlimited ? "pool" : "queue"], { label: "submit" })
    : stage === 1 ? (unlimited ? hops("b", ["in", "pool"], { label: "new thread" }) : hops("b", ["queue", "pool"], { label: "take()" }))
    : stage === 2 ? (W.io ? [...hops("c", ["pool", "cpu"], { label: `${W.cpu} ms CPU` }), ...hops("d", ["pool", "api"], { label: `wait ${W.io} ms`, start: 0.9 })] : hops("c", ["pool", "cpu"], { label: `${W.cpu} ms CPU` }))
    : stage === 3 ? (r.crashedAt ? hops("e", ["in", "pool"], { label: "out of memory", tone: "bad" }) : r.rejected ? hops("e", ["in", "queue"], { label: `${n(r.rejected)} rejected`, tone: "bad" }) : hops("e", ["queue", "pool"], { label: "keeps up", tone: "good" }))
    : stage === 4 ? hops("f", ["pool", "in"], { label: `p99 ${ms(r.p99)}`, tone: healthy ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: ${rate} tasks a second arrive. ${unlimited ? "Each one gets a brand-new thread." : "Each is put on the queue for the pool."}`,
    unlimited ? "Step 2: no queue: a thread is created on the spot, so nothing waits to start." : `Step 2: an idle worker takes the next task; when all ${pool} are busy, tasks wait (up to ${n(r.peakQueue)} at once).`,
    `Step 3: a worker computes for ${W.cpu} ms${W.io ? ` then waits ${W.io} ms on I/O, holding its thread but not a core` : ""}. The cores were ${pct(r.cpuUse)} busy.`,
    r.crashedAt ? `Step 4: thread stacks hit ${MAX_THREADS * STACK_MB} MB at ${ms(r.crashedAt)} and the process died, taking ${n(r.unfinished)} tasks with it.` : r.rejected ? `Step 4: the queue was full ${n(r.rejected)} times, so those tasks were rejected right away.` : r.unfinished ? `Step 4: the queue never stopped growing: ${n(r.unfinished)} tasks were still waiting when we stopped.` : "Step 4: the queue never filled; nothing was rejected.",
    `Step 5: ${n(r.done)} done, median ${ms(r.p50)}, p99 ${ms(r.p99)}. For this work, ${goetz} threads keep all ${CORES} cores busy.`,
  ];
  const caption = stage !== null ? captions[stage] : `${unlimited ? "A thread per task" : `${pool} workers`}, ${rate}/s: ${r.crashedAt ? `crashed at ${ms(r.crashedAt)}` : `${n(r.done)} done, p99 ${ms(r.p99)}${r.rejected ? `, ${n(r.rejected)} rejected` : ""}${r.unfinished ? `, ${n(r.unfinished)} still queued` : ""}`}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Thread pools"
        blurb="Creating a thread per request is simple until traffic spikes and you have thousands. A thread pool keeps a fixed set of workers that pull tasks from a queue instead. Its size and the queue's bound decide whether a spike makes you slow, makes you reject work, or kills the process. Simulated millisecond by millisecond on four cores."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Requests go on a queue; a fixed pool of worker threads takes them, computes on the cores and waits on an API"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "in", to: "queue", label: "submit", dim: unlimited },
                  { from: "queue", to: "pool", label: "take", dim: unlimited },
                  { from: "pool", to: "cpu", label: "compute" },
                  { from: "pool", to: "api", label: "wait", dim: !W.io },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Results for this run">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">5 seconds of traffic</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <p><span className="block text-[var(--faint)]">Done</span><span className="font-mono">{n(r.done)} of {n(r.arrived)}</span></p>
                  <p><span className="block text-[var(--faint)]">Median / p99</span><span className="font-mono">{ms(r.p50)} / {ms(r.p99)}</span></p>
                  <p><span className="block text-[var(--faint)]">Rejected / stuck</span><span className="font-mono" style={{ color: r.rejected || r.unfinished ? "var(--bad)" : "var(--text)" }}>{n(r.rejected)} / {n(r.unfinished)}</span></p>
                  <p><span className="block text-[var(--faint)]">Threads · memory</span><span className="font-mono">{n(r.peakThreads)} · {n(r.memMB)} MB</span></p>
                </div>
                {r.crashedAt !== null && <p className="mt-2 font-mono text-xs text-[var(--bad)]">Crashed at {ms(r.crashedAt)}: could not create thread {MAX_THREADS + 1}.</p>}
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => preset("cpu", 250, UNLIMITED, "unbounded")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Thread per task, overloaded
                </button>
                <button type="button" onClick={() => preset("io", 300, 8, "unbounded")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Pool too small for I/O
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Working…">
                Walk one task
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Submit a task" what="A server turns each request into a task: a function to run. Instead of starting a thread for it, it hands the task to the pool and returns. What the task does decides everything else: compute, or wait." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<Workload> accent={ACCENT} value={workload} onChange={setWorkload} options={(Object.keys(WORKLOAD) as Workload[]).map((id) => ({ id, label: WORKLOAD[id].label }))} />
                  <p className="text-xs text-[var(--muted)]">{W.blurb} {CORES} cores can compute at most {n(cap)} of these a second.</p>
                  <Slider label="Arrival rate" value={rate} min={50} max={1000} step={50} format={(v) => `${v}/s`} onChange={setRate} accent={ACCENT} hint={rate > cap ? "More than the cores can ever compute: something has to give." : undefined} />
                </div>
              </FlowStep>
              <FlowArrow label="onto the queue" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Wait for a free worker" what="Workers loop forever: take a task from the queue, run it, take the next. When every worker is busy, tasks wait in the queue. An unbounded queue never says no, so under overload it just gets longer, and so does every task's wait." accent={ACCENT} active={on(1)}>
                <div className="space-y-3">
                  <Choices<QueueBound> label="Queue" accent={ACCENT} value={bound} onChange={setBound} options={[{ id: "unbounded", label: "Unbounded" }, { id: "50", label: "At most 50 waiting" }]} />
                  <p className="font-mono text-xs">Peak queue: {unlimited ? "no queue" : n(r.peakQueue)} · median wait to finish: {ms(r.p50)}</p>
                </div>
              </FlowStep>
              <FlowArrow label="a worker runs it" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Compute, then wait on I/O" what="While a task computes it needs a core; while it waits for an API or a database it still holds its thread, but the core is free for another thread. So I/O-bound work needs more threads than cores to keep the cores busy, and CPU-bound work gains nothing past one thread per core." accent={ACCENT} active={on(2)}>
                <div className="space-y-3">
                  <Choices<string> label="Pool size" accent={ACCENT} value={String(pool)} onChange={(v) => setPool(Number(v))} options={[...POOL_SIZES.map((p) => ({ id: String(p), label: String(p) })), { id: String(UNLIMITED), label: "Thread per task" }]} />
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <p><span className="block text-[var(--faint)]">Cores busy</span><span className="font-mono">{pct(r.cpuUse)}</span></p>
                    <p><span className="block text-[var(--faint)]">Done per second</span><span className="font-mono">{n(Math.round(r.perSec))}</span></p>
                    <p><span className="block text-[var(--faint)]">Peak threads</span><span className="font-mono">{n(r.peakThreads)}</span></p>
                  </div>
                </div>
              </FlowStep>
              <FlowArrow label="when it can't keep up" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Decide what happens when it's full" what="Something has to give when work arrives faster than it can be done. A bounded queue rejects at once (or makes the caller run it, or blocks the submitter), which is backpressure the caller can see. A thread per task never refuses, so it piles up threads, each with its own stack, until memory runs out." accent={ACCENT} active={on(3)}>
                <div className="space-y-2 text-xs">
                  <p className="font-mono">This setup: {r.crashedAt ? <span className="text-[var(--bad)]">crashed at {ms(r.crashedAt)}</span> : r.rejected ? <span className="text-[var(--bad)]">{n(r.rejected)} rejected, the rest answered in under {ms(r.p99)}</span> : r.unfinished ? <span className="text-[var(--bad)]">{n(r.unfinished)} still queued at the end</span> : <span className="text-[var(--good)]">kept up</span>}</p>
                  <p className="font-mono text-[var(--muted)]">A thread per task at {rate}/s: {perTask.crashedAt ? <span className="text-[var(--bad)]">{n(perTask.peakThreads)} threads, crashed at {ms(perTask.crashedAt)}</span> : `${n(perTask.peakThreads)} threads at peak, p99 ${ms(perTask.p99)}`}</p>
                </div>
              </FlowStep>
              <FlowArrow label="the right size" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Size the pool for the work" what="A good starting point: threads = cores × (1 + wait time ÷ compute time). That keeps every core busy without piling up threads. Past it, more threads only add switching and memory. Then measure, because real tasks vary." accent={ACCENT} active={on(4)}>
                <div className="space-y-3">
                  <p className="font-mono text-xs">
                    {CORES} × (1 + {W.io} ÷ {W.cpu}) = <span style={{ color: "var(--good)" }}>{goetz} threads</span>
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[20rem] text-xs">
                      <thead>
                        <tr className="text-[var(--faint)]">
                          <th className="py-1 pr-2 text-left font-normal">Pool</th>
                          <th className="py-1 pr-2 text-right font-normal">Done</th>
                          <th className="py-1 pr-2 text-right font-normal">Rejected / stuck</th>
                          <th className="py-1 pr-2 text-left font-normal">p99</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {table.map((t) => (
                          <tr key={t.pool} className="border-t border-[var(--line)]" style={{ color: t.pool === pool ? "var(--text)" : "var(--muted)" }}>
                            <td className="py-1 pr-2">{t.pool}{t.pool === bestRow.pool ? " ✓" : ""}</td>
                            <td className="py-1 pr-2 text-right">{n(t.done)}</td>
                            <td className="py-1 pr-2 text-right" style={{ color: t.rejected + t.unfinished ? "var(--bad)" : undefined }}>{n(t.rejected + t.unfinished)}</td>
                            <td className="py-1 pr-2">
                              <span className="inline-block h-2 rounded-sm align-middle" style={{ width: `${Math.max(2, (t.p99 / maxP99) * 60)}px`, background: ACCENT }} /> {ms(t.p99)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-[var(--faint)]">✓ finishes the most tasks with the lowest p99. Switching overhead, thread memory ({STACK_MB} MB each, {MAX_THREADS} max) and the workloads are illustrative; queueing, sharing the cores and rejections are simulated exactly.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
