"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { CONN_STEPS, CORES, CPU_MS, EVERY_S, MODELS, MODEL_LABEL, PER_CONN_KB, PREEMPTIVE, RAM_GB, SLICE, SWITCHES_PER_REQ, SWITCH_US, WAIT_MS, cost, stall, type Model } from "@/lib/asyncThreads";

const ACCENT = "var(--os)";
const n = (x: number) => x.toLocaleString("en-US");
const gb = (x: number) => (x >= 10 ? `${Math.round(x)} GB` : `${x.toFixed(1)} GB`);

export default function AsyncVsThreadsDemo() {
  const [model, setModel] = useState<Model>("threads");
  const [step, setStep] = useState(4);
  const [hog, setHog] = useState(true);
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const conns = CONN_STEPS[step];
  const all = MODELS.map((m) => ({ m, c: cost(m, conns), s: stall(PREEMPTIVE[m], hog) }));
  const me = all.find((a) => a.m === model)!;
  const top = Math.max(RAM_GB * 1.15, ...all.map((a) => Math.min(a.c.memGB, RAM_GB * 2)));
  const switchUs = SWITCHES_PER_REQ * SWITCH_US[model];

  const nodes: MapNode[] = [
    { id: "clients", label: `${n(conns)} connections`, sub: `a message every ${EVERY_S} s each`, at: [12, 25], mobileAt: [28, 10], state: on(0) ? "active" : "idle" },
    { id: "server", label: MODEL_LABEL[model], sub: model === "threads" ? `${n(conns)} OS threads` : model === "async" ? `${CORES} event loops` : `${n(conns)} green threads on ${CORES} OS threads`, at: [46, 25], mobileAt: [72, 10], state: me.c.fits ? (on(2) ? "active" : "idle") : "bad" },
    { id: "db", label: "Database", sub: `${WAIT_MS} ms per query`, at: [83, 25], mobileAt: [72, 45], state: on(1) ? "active" : "idle" },
    { id: "ram", label: `${RAM_GB} GB RAM`, sub: `${gb(me.c.memGB)} needed`, at: [46, 78], mobileAt: [28, 45], state: me.c.fits ? "good" : "bad" },
    { id: "cpu", label: `${CORES} cores`, sub: hog ? `p99 ${me.s.p99} ms with a 200 ms handler` : `${(me.c.cpuShare * 100).toFixed(1)}% busy`, at: [83, 78], mobileAt: [50, 84], state: hog && me.s.p99 > 20 ? "bad" : "idle" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["clients", "server"], { label: "message" })
    : stage === 1 ? [...hops("b", ["server", "db"], { label: "query" }), ...hops("b2", ["server", "ram"], { label: model === "threads" ? "stack held" : "task parked", tone: me.c.fits ? undefined : "bad", start: 0.2 })]
    : stage === 2 ? hops("c", ["db", "server", "cpu"], { label: model === "threads" ? "kernel switch" : "resume task" })
    : stage === 3 ? hops("d", ["cpu", "server", "clients"], { label: hog ? `p99 ${me.s.p99} ms` : "1 ms", tone: hog && me.s.p99 > 20 ? "bad" : "good" })
    : stage === 4 ? hops("e", ["server", "ram"], { label: me.c.fits ? "fits" : "out of memory", tone: me.c.fits ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: ${n(conns)} open connections, each sending a message every ${EVERY_S} s: ${n(Math.round(me.c.perSec))} messages a second.`,
    model === "threads" ? `Step 2: each waiting thread sleeps in the kernel, but keeps its stack and kernel structures: ~${PER_CONN_KB.threads} KB each, ${gb(me.c.memGB)} in all.` : `Step 2: a waiting ${model === "async" ? "task is a small object in the loop's list" : "green thread keeps only a small, growable stack"}: ~${PER_CONN_KB[model]} KB each, ${gb(me.c.memGB)} in all.`,
    `Step 3: when the database answers, ${model === "threads" ? `the kernel switches threads (~${SWITCH_US.threads} µs)` : `the runtime resumes the task in user space (~${SWITCH_US[model]} µs)`}: ${switchUs.toFixed(1)} µs of switching per message.`,
    hog ? `Step 4: one handler computes for 200 ms. ${PREEMPTIVE[model] ? `The scheduler preempts it every ${SLICE} ms, so other requests still take ${me.s.p99} ms at p99.` : `The event loop can't preempt it, so ${me.s.delayed} of ${me.s.total} requests wait behind it (p99 ${me.s.p99} ms).`}` : "Step 4: no handler runs long, so nobody waits behind anybody.",
    me.c.fits ? `Step 5: ${gb(me.c.memGB)} of ${RAM_GB} GB; this model tops out around ${n(me.c.maxConns)} connections.` : `Step 5: ${gb(me.c.memGB)} needed, more than the ${RAM_GB} GB there is. Threads top out around ${n(me.c.maxConns)} connections.`,
  ];
  const caption = stage !== null ? captions[stage] : `${MODEL_LABEL[model]} at ${n(conns)} connections: ${gb(me.c.memGB)} of memory${me.c.fits ? "" : " (doesn't fit)"}${hog ? `, p99 ${me.s.p99} ms with one slow handler` : ""}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Async vs threads"
        blurb="A server with many connections spends most of its time waiting. Give each connection an OS thread and the waiting is easy to write but heavy to hold. Run them as async tasks on an event loop and waiting is nearly free, but one slow handler blocks everyone. Green threads sit in between. Grow the connections and find each model's limit."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Many client connections reach a server that waits on a database; memory and cores limit it"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "clients", to: "server", label: "messages" },
                  { from: "server", to: "db", label: "query" },
                  { from: "server", to: "ram", label: "per connection" },
                  { from: "server", to: "cpu", label: "run" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Memory needed by each model">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Memory for {n(conns)} connections</p>
                <div className="mt-2 space-y-2">
                  {all.map(({ m, c }) => (
                    <div key={m}>
                      <p className="flex justify-between text-xs" style={{ color: m === model ? "var(--text)" : "var(--muted)" }}>
                        <span>{MODEL_LABEL[m]}</span>
                        <span className="font-mono" style={{ color: c.fits ? undefined : "var(--bad)" }}>{gb(c.memGB)}</span>
                      </p>
                      <div className="relative mt-0.5 h-3 rounded-sm bg-[var(--inset)]">
                        <div className="h-full rounded-sm" style={{ width: `${Math.min(100, (c.memGB / top) * 100)}%`, background: c.fits ? ACCENT : "var(--bad)" }} />
                        <span className="absolute top-[-2px] h-4 w-0.5 bg-[var(--bad)]" style={{ left: `${(RAM_GB / top) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-[var(--faint)]">Red line: {RAM_GB} GB of RAM.</p>
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => { setModel("threads"); setStep(5); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  250k threads
                </button>
                <button type="button" onClick={() => { setModel("async"); setHog(true); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Async + a slow handler
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Serving…">
                Walk one message
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Accept many connections" what="Chat apps, live feeds and APIs behind a load balancer hold thousands of connections open, and most are quiet at any moment. The question is what each quiet connection costs." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<Model> accent={ACCENT} value={model} onChange={setModel} options={MODELS.map((id) => ({ id, label: MODEL_LABEL[id] }))} />
                  <Slider label="Open connections" value={step} min={0} max={CONN_STEPS.length - 1} step={1} format={(v) => n(CONN_STEPS[v])} onChange={setStep} accent={ACCENT} hint={`Each sends a message every ${EVERY_S} s: ${CPU_MS} ms of work, then ${WAIT_MS} ms waiting on the database.`} />
                </div>
              </FlowStep>
              <FlowArrow label="wait for the database" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Wait without holding much" what="A blocked OS thread sleeps in the kernel, but its stack and kernel bookkeeping stay allocated the whole time. An async task that's waiting is just a small object with its state; a green thread keeps a small stack that grows only when needed." accent={ACCENT} active={on(1)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[20rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 pr-2 text-left font-normal">Model</th>
                        <th className="py-1 pr-2 text-right font-normal">Per connection</th>
                        <th className="py-1 pr-2 text-right font-normal">At {n(conns)}</th>
                        <th className="py-1 text-right font-normal">Max in {RAM_GB} GB</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {all.map(({ m, c }) => (
                        <tr key={m} className="border-t border-[var(--line)]" style={{ color: m === model ? "var(--text)" : "var(--muted)" }}>
                          <td className="py-1 pr-2 font-sans">{MODEL_LABEL[m]}</td>
                          <td className="py-1 pr-2 text-right">~{PER_CONN_KB[m]} KB</td>
                          <td className="py-1 pr-2 text-right" style={{ color: c.fits ? undefined : "var(--bad)" }}>{gb(c.memGB)}</td>
                          <td className="py-1 text-right">{n(c.maxConns)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FlowStep>
              <FlowArrow label="the answer comes back" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Switch to whoever is ready" what="Every message parks its handler once (waiting on the database) and resumes it once. For OS threads that's a trip through the kernel scheduler, a few microseconds each. For async tasks and green threads it's a jump in user space, a fraction of a microsecond." accent={ACCENT} active={on(2)}>
                <div className="space-y-1">
                  {MODELS.map((m) => {
                    const us = SWITCHES_PER_REQ * SWITCH_US[m];
                    return (
                      <p key={m} className="font-mono text-xs" style={{ color: m === model ? "var(--text)" : "var(--muted)" }}>
                        {MODEL_LABEL[m]}: {us.toFixed(1)} µs switching per {CPU_MS * 1000} µs of work ({Math.round((us / (CPU_MS * 1000)) * 100)}% extra)
                      </p>
                    );
                  })}
                </div>
              </FlowStep>
              <FlowArrow label="one handler runs long" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="One handler hogs the CPU" what={`An event loop is cooperative: a task runs until it awaits. A handler that computes for 200 ms (parsing a huge file, a slow regex) blocks every other connection on that loop. OS threads and green threads like goroutines are preempted every few milliseconds, so the rest keep moving. Simulated on one core, a request every 5 ms.`} accent={ACCENT} active={on(3)}>
                <div className="space-y-3">
                  <Choices<"on" | "off"> accent={ACCENT} value={hog ? "on" : "off"} onChange={(v) => setHog(v === "on")} options={[{ id: "on", label: "Add a 200 ms handler" }, { id: "off", label: "All handlers short" }]} />
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {all.map(({ m, s }) => (
                      <p key={m} style={{ color: m === model ? "var(--text)" : "var(--muted)" }}>
                        <span className="block text-[var(--faint)]">{MODEL_LABEL[m]}</span>
                        <span className="font-mono" style={{ color: s.p99 > 20 ? "var(--bad)" : "var(--good)" }}>p99 {s.p99} ms</span>
                        <span className="block font-mono text-[11px]">{s.delayed} of {s.total} late</span>
                      </p>
                    ))}
                  </div>
                </div>
              </FlowStep>
              <FlowArrow label="the trade-off" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Pick for the workload" what="Many mostly-idle connections favour async or green threads: memory per connection is what runs out first. CPU-heavy handlers favour preemption, or moving the heavy work off the event loop to a worker pool. Threads stay the simplest code when connections number in the hundreds or low thousands." accent={ACCENT} active={on(4)}>
                <div className="space-y-2">
                  <p className="font-mono text-xs" style={{ color: me.c.fits ? "var(--good)" : "var(--bad)" }}>
                    {MODEL_LABEL[model]} at {n(conns)} connections: {gb(me.c.memGB)} of {RAM_GB} GB{me.c.fits ? "" : ", out of memory"}; a 200 ms handler makes p99 {stall(PREEMPTIVE[model], true).p99} ms.
                  </p>
                  <p className="text-[11px] text-[var(--faint)]">Memory per connection and switch costs are illustrative orders of magnitude (a thread&rsquo;s resident stack, an async task&rsquo;s state, a goroutine&rsquo;s starting stack). The scheduling in step 4 is simulated exactly, with a {SLICE} ms slice.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
