"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { KAPPA, PERMIT_CHOICES, SERVICE_MS, SIGMA, TIMEOUT_MS, bestN, run, sweep, throughput, type Result } from "@/lib/semaphore";

const ACCENT = "var(--os)";
const ms = (x: number) => `${Math.round(x)} ms`;
const permitLabel = (p: number, jobs: number) => (p >= jobs ? "No limit" : `${p}`);

function Jobs({ r, span }: { r: Result; span: number }) {
  const W = 600, row = 5, H = r.jobs.length * row;
  const x = (t: number) => (t / span) * W;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${r.jobs.length} jobs: ${r.timedOut} timed out, the last finished at ${ms(r.makespan)}`}>
        <rect x="0" y="0" width={W} height={H} fill="var(--inset)" />
        <line x1={x(TIMEOUT_MS)} x2={x(TIMEOUT_MS)} y1="0" y2={H} stroke="var(--bad)" strokeDasharray="4 3" />
        {r.jobs.map((j) => (
          <g key={j.id}>
            {j.start > 0 && <rect x="0" y={j.id * row + 1} width={x(j.start)} height={row - 2} fill="var(--line-strong)" opacity="0.6" />}
            <rect x={x(j.start)} y={j.id * row + 1} width={Math.max(1, x(j.end - j.start))} height={row - 2} fill={j.timedOut ? "var(--bad)" : ACCENT} />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]">
        <span>0</span>
        <span className="text-[var(--bad)]">{TIMEOUT_MS} ms: callers give up</span>
        <span>{ms(span)}</span>
      </div>
    </div>
  );
}

export default function SemaphoresDemo() {
  const [jobs, setJobs] = useState(48);
  const [permits, setPermits] = useState(48);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const r = run(permits, jobs);
  const table = sweep(jobs);
  const span = Math.max(...table.map((t) => t.makespan));
  const inside = Math.min(permits, jobs);
  const best = bestN();
  const firstWake = r.events.find((e) => e.kind === "V wakes");
  const curve = Array.from({ length: 48 }, (_, i) => throughput(i + 1));
  const top = Math.max(...curve);

  const nodes: MapNode[] = [
    { id: "callers", label: `${jobs} callers`, sub: "all at once", at: [12, 28], mobileAt: [28, 10], state: on(0) ? "active" : "idle" },
    { id: "sem", label: "Semaphore", sub: permits >= jobs ? "no limit" : `count starts at ${permits}`, at: [47, 28], mobileAt: [28, 42], state: on(0) || on(3) ? "active" : "idle" },
    { id: "queue", label: "Wait queue", sub: `${Math.max(0, jobs - permits)} blocked at first`, at: [47, 78], mobileAt: [28, 80], state: jobs > permits ? (on(1) ? "active" : "wait") : "dim" },
    { id: "db", label: "Backend", sub: `${inside} inside · ${throughput(inside).toFixed(1)}× one alone`, at: [83, 28], mobileAt: [72, 42], state: inside > best * 1.5 ? "bad" : on(2) ? "active" : "good" },
    { id: "out", label: "Results", sub: r.timedOut ? `${r.timedOut} timed out` : `all done by ${ms(r.makespan)}`, at: [83, 78], mobileAt: [72, 80], state: r.timedOut ? "bad" : "good" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["callers", "sem"], { label: "wait()" })
    : stage === 1 ? (jobs > permits ? hops("b", ["sem", "queue"], { label: `${jobs - permits} blocked` }) : hops("b", ["sem", "db"], { label: "all in", tone: "bad" }))
    : stage === 2 ? hops("c", ["sem", "db"], { label: `${inside} inside` })
    : stage === 3 ? (jobs > permits ? hops("d", ["db", "sem", "queue"], { label: "signal()" }) : hops("d", ["db", "sem"], { label: "signal()" }))
    : stage === 4 ? hops("e", ["db", "out"], { label: r.timedOut ? `${r.timedOut} too late` : `p95 ${ms(r.p95)}`, tone: r.timedOut ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: ${jobs} callers arrive at once. Each calls wait(): if the count is above zero, it subtracts one and goes in.`,
    jobs > permits ? `Step 2: after ${permits} callers the count is 0, so the other ${jobs - permits} block in the wait queue, using no CPU.` : `Step 2: the count never reaches 0, so all ${jobs} go straight in.`,
    `Step 3: with ${inside} inside, the backend does ${throughput(inside).toFixed(2)}× the work of one job alone, shared ${inside} ways${inside > best ? `; past ${best} they get in each other's way` : ""}.`,
    firstWake ? `Step 4: at ${ms(firstWake.t)} a job finishes and calls signal(); the first blocked caller is woken and takes its place.` : "Step 4: each finished job calls signal() and the count goes back up; nobody was waiting.",
    `Step 5: median ${ms(r.p50)}, p95 ${ms(r.p95)}, ${r.timedOut ? `${r.timedOut} of ${jobs} callers gave up at ${TIMEOUT_MS} ms` : "every caller answered in time"}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${permitLabel(permits, jobs)} permit${permits === 1 ? "" : "s"}, ${jobs} callers: median ${ms(r.p50)}, last done at ${ms(r.makespan)}, ${r.timedOut} timed out.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Semaphores"
        blurb="A mutex lets one thread in; a semaphore lets up to N in. It's a counter with two operations: wait() takes one and blocks at zero, signal() gives one back and wakes a waiter. Put one in front of a backend that slows down when crowded, and choosing N decides whether a burst finishes fast or times out."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Callers pass a semaphore before using a backend; extra callers wait in a queue"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "callers", to: "sem", label: "wait()" },
                  { from: "sem", to: "queue", label: "count is 0", dim: jobs <= permits },
                  { from: "sem", to: "db", label: "go in" },
                  { from: "db", to: "out", label: "answer" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Every caller's wait and service time">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Each caller: waiting, then inside</p>
                <div className="mt-2">
                  <Jobs r={r} span={span} />
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                  <span><span className="mr-1 inline-block h-2 w-3 align-middle opacity-60" style={{ background: "var(--line-strong)" }} />blocked in wait()</span>
                  <span><span className="mr-1 inline-block h-2 w-3 align-middle" style={{ background: ACCENT }} />using the backend</span>
                  <span><span className="mr-1 inline-block h-2 w-3 align-middle" style={{ background: "var(--bad)" }} />finished after the caller gave up</span>
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setPermits(jobs)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Let everyone in
                </button>
                <button type="button" onClick={() => setPermits(best)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  {best} permits
                </button>
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Waiting…">
                Walk the burst
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Call wait() before going in" what="The semaphore holds a count of free permits. wait() (also called P, acquire or down) checks the count: above zero, it subtracts one and returns at once. With a count of 1 it's a mutex." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<string> label="Permits" accent={ACCENT} value={String(permits >= jobs ? 48 : permits)} onChange={(v) => setPermits(Number(v))} options={PERMIT_CHOICES.filter((p) => p < jobs || p === 48).map((p) => ({ id: String(p), label: p === 48 ? "No limit" : String(p) }))} />
                  <ol className="space-y-0.5 font-mono text-[11px]">
                    {r.events.filter((e) => e.kind === "P ok").slice(0, 3).map((e) => (
                      <li key={e.job}>job {e.job + 1}: wait() → count {e.count + 1} → {e.count}, goes in</li>
                    ))}
                  </ol>
                </div>
              </FlowStep>
              <FlowArrow label={jobs > permits ? "count reaches 0" : "count stays above 0"} accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Block when the count is zero" what="When no permits are left, wait() puts the thread to sleep in the semaphore's queue. It uses no CPU while it waits, and it's woken in order when a permit comes back." accent={ACCENT} active={on(1)}>
                <div className="space-y-3">
                  <ol className="space-y-0.5 font-mono text-[11px]">
                    {r.events.filter((e) => e.kind === "P blocks").slice(0, 3).map((e) => (
                      <li key={e.job}>job {e.job + 1}: wait() → count 0, blocks · {e.queued} in the queue</li>
                    ))}
                    {jobs <= permits && <li>Nobody blocks: the count never reaches 0.</li>}
                  </ol>
                  <p className="text-xs text-[var(--muted)]">{jobs > permits ? `${jobs - permits} callers wait their turn instead of crowding the backend.` : "Every caller is inside the backend at once."}</p>
                </div>
              </FlowStep>
              <FlowArrow label={`${inside} jobs inside`} accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Use the backend" what={`Backends don't scale forever. A database or API serves more at once up to a point, then jobs compete for locks, disk and memory and it does less in total. This one follows the Universal Scalability Law, peaking at ${best} jobs inside.`} accent={ACCENT} active={on(2)}>
                <div className="space-y-3">
                  <div className="flex h-20 items-end gap-px" role="img" aria-label={`Backend throughput by jobs inside, peaking at ${best}`}>
                    {curve.map((v, i) => (
                      <span key={i} className="flex-1 rounded-t-sm" style={{ height: `${(v / top) * 100}%`, background: i + 1 === inside ? "var(--text)" : i + 1 === best ? "var(--good)" : `color-mix(in srgb, ${ACCENT} 45%, transparent)` }} />
                    ))}
                  </div>
                  <p className="flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>1 inside</span><span>48 inside</span></p>
                  <p className="font-mono text-xs">{inside} inside → {throughput(inside).toFixed(2)}× one job alone ({(SERVICE_MS * inside / throughput(inside)).toFixed(0)} ms each)</p>
                </div>
              </FlowStep>
              <FlowArrow label="signal()" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="signal() lets the next one in" what="When a job finishes it calls signal() (V, release or up). If someone is waiting, the permit goes straight to the first waiter, which wakes up; otherwise the count goes up by one. Forgetting signal() on an error path leaks a permit, until nobody gets in." accent={ACCENT} active={on(3)}>
                <ol className="space-y-0.5 font-mono text-[11px]">
                  {r.events.filter((e) => e.kind !== "P ok" && e.kind !== "P blocks").slice(0, 4).map((e, i) => (
                    <li key={i}>
                      {ms(e.t)}: job {e.job + 1} signal() → {e.kind === "V wakes" ? `wakes job ${(e.woke ?? 0) + 1}` : `count ${e.count}`}
                    </li>
                  ))}
                </ol>
              </FlowStep>
              <FlowArrow label="the burst, finished" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Pick N from the backend, not the callers" what="Too few permits leave the backend idle; too many push it past its peak, so everyone is slow and the late ones time out. The best N is where the backend does the most work, which is a property of the backend." accent={ACCENT} active={on(4)}>
                <div className="space-y-3">
                  <Choices<"24" | "48"> label="Burst" accent={ACCENT} value={String(jobs) as "24" | "48"} onChange={(v) => setJobs(Number(v))} options={[{ id: "24", label: "24 callers" }, { id: "48", label: "48 callers" }]} />
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[20rem] text-xs">
                      <thead>
                        <tr className="text-[var(--faint)]">
                          <th className="py-1 pr-2 text-left font-normal">Permits</th>
                          <th className="py-1 pr-2 text-right font-normal">Median</th>
                          <th className="py-1 pr-2 text-right font-normal">p95</th>
                          <th className="py-1 pr-2 text-right font-normal">All done</th>
                          <th className="py-1 text-right font-normal">Timed out</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {table.filter((t) => t.permits < jobs || t.permits === 48).map((t) => (
                          <tr key={t.permits} className="border-t border-[var(--line)]" style={{ color: t.permits === permits || (t.permits === 48 && permits >= jobs) ? "var(--text)" : "var(--muted)" }}>
                            <td className="py-1 pr-2">{permitLabel(t.permits, jobs)}</td>
                            <td className="py-1 pr-2 text-right">{ms(t.p50)}</td>
                            <td className="py-1 pr-2 text-right">{ms(t.p95)}</td>
                            <td className="py-1 pr-2 text-right">{ms(t.makespan)}</td>
                            <td className="py-1 text-right" style={{ color: t.timedOut ? "var(--bad)" : "var(--good)" }}>{t.timedOut}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-[var(--faint)]">The backend follows X(n) = n ÷ (1 + σ(n−1) + κ·n(n−1)) with σ = {SIGMA}, κ = {KAPPA} and {SERVICE_MS} ms per job alone: illustrative numbers. The semaphore, queue and timings are simulated exactly.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
