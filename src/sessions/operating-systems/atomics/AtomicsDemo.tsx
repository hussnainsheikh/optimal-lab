"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { METHODS, METHOD_CODE, METHOD_LABEL, aba, count, mops, stackList, type CostMethod, type Method } from "@/lib/atomics";

const ACCENT = "var(--os)";
const EACH = 1000;
const COST: CostMethod[] = ["fetchAdd", "cas", "lock", "sharded"];
const COST_LABEL: Record<CostMethod, string> = { ...METHOD_LABEL, sharded: "Per-thread counters" };
const THREAD_COUNTS = [1, 2, 4, 8, 16];

export default function AtomicsDemo() {
  const [method, setMethod] = useState<Method>("plain");
  const [threads, setThreads] = useState(2);
  const [tagged, setTagged] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const big = count(method, threads, EACH);
  const small = count(method, 2, 3, 3, 18);
  const all = METHODS.map((m) => ({ m, r: count(m, threads, EACH) }));
  const abaSteps = aba(tagged);
  const end = abaSteps[abaSteps.length - 1];
  const maxMops = Math.max(...COST.map((m) => mops(m, 16)));

  const nodes: MapNode[] = [
    { id: "t1", label: "Thread 1", sub: "core 1", at: [13, 25], mobileAt: [28, 10], state: on(0) || on(1) ? "active" : "idle" },
    { id: "t2", label: threads > 2 ? `Threads 2–${threads}` : "Thread 2", sub: threads > 2 ? `cores 2–${threads}` : "core 2", at: [13, 75], mobileAt: [72, 10], state: on(0) || on(2) ? "active" : "idle" },
    { id: "c1", label: "Core 1 cache", sub: method === "plain" ? "its own copy of x" : "owns the line, then gives it up", at: [47, 25], mobileAt: [28, 45], state: on(1) ? "active" : "idle" },
    { id: "c2", label: "Other caches", sub: method === "plain" ? "their own copies" : "wait for the line", at: [47, 75], mobileAt: [72, 45], state: on(2) ? "active" : "idle" },
    { id: "x", label: "x in memory", sub: `${big.final.toLocaleString("en-US")} of ${big.expected.toLocaleString("en-US")}`, at: [84, 50], mobileAt: [50, 84], state: big.lost ? "bad" : "good" },
  ];
  const packets: Packet[] =
    stage === 0 ? [...hops("a", ["t1", "c1"], { label: METHOD_CODE[method][0].split(" ")[0] }), ...hops("b", ["t2", "c2"], { label: METHOD_CODE[method][0].split(" ")[0] })]
    : stage === 1 ? hops("c", ["x", "c1", "x"], { label: method === "plain" ? "x = 5" : "line → core 1", tone: method === "plain" ? "bad" : "good" })
    : stage === 2 ? hops("d", ["x", "c2", "x"], { label: method === "plain" ? "x = 5 again" : method === "cas" ? "CAS retry" : "line → core 2", tone: method === "plain" ? "bad" : undefined })
    : stage === 3 ? hops("e", ["t1", "c1", "x"], { label: tagged ? "CAS (A, v3)?" : "CAS A → B", tone: tagged ? "good" : "bad" })
    : stage === 4 ? hops("f", ["x", "c1", "c2"], { label: "line ping-pong" })
    : [];

  const captions = [
    `Step 1: ${threads} threads each add 1 to x, ${EACH.toLocaleString("en-US")} times, with ${METHOD_LABEL[method]}.`,
    method === "plain" ? "Step 2: thread 1 loads x into a register. Before it stores x + 1, another thread loads the same value." : `Step 2: ${METHOD_LABEL[method]} makes core 1 own x's cache line while it updates it; nobody else can read it halfway.`,
    method === "plain" ? `Step 3: both store the same value + 1, so one increment vanishes: ${big.lost.toLocaleString("en-US")} lost in all.` : method === "cas" ? `Step 3: when another core got there first, the CAS fails and the thread retries: ${big.retries.toLocaleString("en-US")} retries.` : method === "lock" ? `Step 3: other threads spin on the lock word: ${big.spins.toLocaleString("en-US")} failed tries.` : "Step 3: the other cores wait a few nanoseconds for the line, then do their own atomic add.",
    tagged ? "Step 4: the stack's top is A again, but its version moved on, so the stale CAS fails and retries." : "Step 4: the top is A again, so the stale CAS succeeds and installs a freed node: the ABA problem.",
    "Step 5: every atomic update needs x's cache line on its own core, so the line bounces between cores; per-thread counters never share one.",
  ];
  const caption = stage !== null ? captions[stage] : `${METHOD_LABEL[method]}, ${threads} threads × ${EACH.toLocaleString("en-US")}: x ends at ${big.final.toLocaleString("en-US")}${big.lost ? `, ${big.lost.toLocaleString("en-US")} increments lost` : ", exactly right"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Atomics and lock-free code"
        blurb="x = x + 1 looks like one step, but the CPU does it as three: load, add, store. Two threads can interleave those and lose an update. Atomic instructions make the whole update indivisible, and compare-and-swap lets you build bigger lock-free updates, with one famous trap. The interleavings here really run."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Threads on different cores update one shared counter; its cache line moves between the cores"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "t1", to: "c1", label: "load / store" },
                  { from: "t2", to: "c2", label: "load / store" },
                  { from: "c1", to: "x", label: "cache line" },
                  { from: "c2", to: "x", label: "cache line" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Two threads, three increments each, instruction by instruction">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">2 threads × 3 increments, one instruction at a time</p>
                <ol className="mt-2 space-y-0.5 font-mono text-[11px]">
                  {small.trace.map((s, i) => (
                    <li key={i} className="grid grid-cols-[1.5rem_1fr_1fr_3.5rem] gap-1" style={{ color: s.bad ? "var(--bad)" : "var(--text)" }}>
                      <span className="text-[var(--faint)]">{i + 1}</span>
                      <span>{s.thread === 0 ? s.text : ""}</span>
                      <span>{s.thread === 1 ? s.text : ""}</span>
                      <span className="text-right text-[var(--muted)]">x = {s.x}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Left: thread 1 · right: thread 2. {small.trace.length < small.instructions ? `First ${small.trace.length} of ${small.instructions} instructions; ` : ""}x ends at {small.final} of 6.
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setMethod("plain")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Lose updates
                </button>
                <button type="button" onClick={() => setMethod("cas")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Retry with CAS
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Updating…">
                Walk the update
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Read, add, write back" what="A plain increment compiles to three instructions: load x into a register, add 1, store it back. Between the load and the store, another core can do the same thing. Pick how the increment is written." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<Method> accent={ACCENT} value={method} onChange={setMethod} options={METHODS.map((id) => ({ id, label: METHOD_LABEL[id] }))} />
                  <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">{METHOD_CODE[method].map((l, i) => `${i + 1}  ${l}`).join("\n")}</pre>
                  <Choices<"2" | "4"> label="Threads" accent={ACCENT} value={String(threads) as "2" | "4"} onChange={(v) => setThreads(Number(v))} options={[{ id: "2", label: "2 threads" }, { id: "4", label: "4 threads" }]} />
                </div>
              </FlowStep>
              <FlowArrow label="interleaved instructions" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Make the update one instruction" what="An atomic read-modify-write (fetch_add: LOCK XADD on x86, LDADD on ARM) holds x's cache line exclusively for the whole update, so no other core can read the old value in between. Every language exposes these: atomics in C++, Rust, Go and Java, Interlocked in .NET." accent={ACCENT} active={on(1)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[20rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 pr-2 text-left font-normal">Increment</th>
                        <th className="py-1 pr-2 text-right font-normal">x at the end</th>
                        <th className="py-1 pr-2 text-right font-normal">Lost</th>
                        <th className="py-1 text-right font-normal">Instructions</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {all.map(({ m, r }) => (
                        <tr key={m} className="border-t border-[var(--line)]" style={{ color: m === method ? "var(--text)" : "var(--muted)" }}>
                          <td className="py-1 pr-2">{METHOD_LABEL[m]}</td>
                          <td className="py-1 pr-2 text-right">{r.final.toLocaleString("en-US")} / {r.expected.toLocaleString("en-US")}</td>
                          <td className="py-1 pr-2 text-right" style={{ color: r.lost ? "var(--bad)" : "var(--good)" }}>{r.lost.toLocaleString("en-US")}</td>
                          <td className="py-1 text-right">{r.instructions.toLocaleString("en-US")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FlowStep>
              <FlowArrow label="bigger updates" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Compare and swap, retry on change" what="Not every update has an instruction. Compare-and-swap writes a new value only if memory still holds the value you read; otherwise it fails and you read again. That loop builds lock-free versions of any update: push to a stack, swap a pointer, take the max." accent={ACCENT} active={on(2)}>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <p><span className="block text-[var(--faint)]">CAS retries</span><span className="font-mono">{all.find((a) => a.m === "cas")!.r.retries.toLocaleString("en-US")}</span></p>
                  <p><span className="block text-[var(--faint)]">Lock spins</span><span className="font-mono">{all.find((a) => a.m === "lock")!.r.spins.toLocaleString("en-US")}</span></p>
                  <p><span className="block text-[var(--faint)]">Wasted work</span><span className="font-mono">{Math.round((1 - (2 * threads * EACH) / all.find((a) => a.m === "cas")!.r.instructions) * 100)}% of CAS-loop steps</span></p>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">Lock-free means some thread always makes progress, even if another is paused mid-update. It doesn&rsquo;t mean free: under contention, retries pile up.</p>
              </FlowStep>
              <FlowArrow label="a value that changed back" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Watch out for ABA" what="CAS only checks the value, not its history. In a lock-free stack, a thread reads top = A, gets preempted, and meanwhile A is popped, B is popped and freed, and A's memory is pushed back. The CAS sees A and succeeds. Tagging the pointer with a version (or hazard pointers, or garbage collection) fixes it." accent={ACCENT} active={on(3)}>
                <div className="space-y-3">
                  <Choices<"plain" | "tagged"> accent={ACCENT} value={tagged ? "tagged" : "plain"} onChange={(v) => setTagged(v === "tagged")} options={[{ id: "plain", label: "CAS on the pointer" }, { id: "tagged", label: "Pointer + version" }]} />
                  <ol className="space-y-1 text-xs">
                    {abaSteps.map((s, i) => (
                      <li key={i} className="grid grid-cols-[2rem_1fr] gap-2" style={{ color: s.bad ? "var(--bad)" : s.good ? "var(--good)" : "var(--text)" }}>
                        <span className="font-mono text-[var(--faint)]">{s.who}</span>
                        <span>
                          {s.text}
                          <span className="ml-2 font-mono text-[11px] text-[var(--muted)]">stack: {stackList(s.stack).join(" → ") || "empty"}{s.stack.freed.length ? ` · freed: ${s.stack.freed.join(", ")}` : ""}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="font-mono text-xs" style={{ color: end.bad ? "var(--bad)" : "var(--good)" }}>
                    {end.bad ? `The top points at freed memory (${end.stack.top}).` : `Correct: the stack is ${stackList(end.stack).join(" → ")}.`}
                  </p>
                </div>
              </FlowStep>
              <FlowArrow label="the cost" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Count the cost of sharing one line" what="Atomics are correct but not free. Only one core can own a cache line at a time, so every update on a shared counter moves the line across cores (tens of nanoseconds). Adding threads doesn't add throughput. Per-thread counters, summed when someone reads them, never share a line and scale with cores." accent={ACCENT} active={on(4)}>
                <div className="space-y-2">
                  {COST.map((m) => (
                    <div key={m}>
                      <p className="text-xs">{COST_LABEL[m]}</p>
                      <div className="mt-0.5 flex items-end gap-1">
                        {THREAD_COUNTS.map((t) => {
                          const v = mops(m, t);
                          return (
                            <div key={t} className="flex-1">
                              <div className="h-2 rounded-sm" style={{ width: `${Math.max(2, (Math.log10(v + 1) / Math.log10(maxMops + 1)) * 100)}%`, background: m === "sharded" ? "var(--good)" : ACCENT }} />
                              <p className="font-mono text-[10px] text-[var(--faint)]">{t}t: {v < 10 ? v.toFixed(1) : Math.round(v)}M/s</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-[var(--faint)]">Millions of increments per second by thread count, log scale. The cache-line costs are illustrative orders of magnitude; the interleavings, lost updates, retries and the ABA trace above are simulated exactly.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
