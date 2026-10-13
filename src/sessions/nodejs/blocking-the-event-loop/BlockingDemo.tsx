"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { REQUESTS, simulate, type Mode } from "@/lib/blockingLoop";

const ACCENT = "var(--node)";
const SPAN = 240; // ms shown on the timeline

export default function BlockingDemo() {
  const [mode, setMode] = useState<Mode>("main");
  const sim = simulate(mode);
  const x = (ms: number) => `${(Math.min(ms, SPAN) / SPAN) * 100}%`;

  const caption =
    mode === "main"
      ? `The 200 ms report holds the only main thread. The quick requests behind it wait up to ${sim.worstFast} ms for a 2 ms job.`
      : `The report runs on a worker thread. The main thread stays free, so every quick request finishes in ${sim.worstFast} ms.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Node.js · interactive"
        title="Don't block the event loop"
        blurb="Node runs all your JavaScript on one main thread. That's fast while each request does a little work and waits on I/O. One request that crunches numbers for 200 ms stops every other request until it's done."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Timeline of the main thread and the worker">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">What each thread is doing, 0–{SPAN} ms</p>
              {(["main", "worker"] as const).map((lane) => (
                <div key={lane} className="mt-3">
                  <p className="text-xs text-[var(--muted)]">{lane === "main" ? "Main thread (your JavaScript)" : "Worker thread"}</p>
                  <div className="relative mt-1 h-8 rounded bg-[var(--track)]">
                    {sim.slices
                      .filter((s) => s.lane === lane)
                      .map((s, i) => (
                        <span
                          key={i}
                          className="absolute inset-y-1 rounded-sm"
                          title={`#${s.req.id} ${s.req.kind}: ${s.from}–${s.to} ms`}
                          style={{ left: x(s.from), width: `max(2px, calc(${x(s.to)} - ${x(s.from)}))`, background: s.req.kind === "report" ? "var(--bad)" : ACCENT }}
                        />
                      ))}
                  </div>
                </div>
              ))}
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]">
                <span>0</span>
                <span>{SPAN / 2} ms</span>
                <span>{SPAN} ms</span>
              </div>

              <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Response time per request</p>
              <ol className="mt-2 space-y-1">
                {sim.done.map((d) => (
                  <li key={d.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs">
                    <span className="font-mono text-[var(--muted)]">
                      #{d.id} {d.kind === "report" ? "/report" : "/fast"}
                    </span>
                    <span className="h-2 rounded bg-[var(--track)]">
                      <span className="block h-full rounded" style={{ width: x(d.latency), background: d.kind === "report" ? "var(--bad)" : d.latency > 10 ? "var(--auto)" : ACCENT }} />
                    </span>
                    <span className="text-right font-mono">{d.latency} ms</span>
                  </li>
                ))}
              </ol>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Where the report runs" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "main", label: "On the main thread" }, { id: "worker", label: "On a worker thread" }]} />
              <p className="w-full font-mono text-sm">
                quick requests: avg {sim.avgFast.toFixed(0)} ms · worst {sim.worstFast} ms
              </p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Requests arrive every 20 ms" what={`${REQUESTS.filter((r) => r.kind === "fast").length} quick requests need 2 ms of JavaScript each. One /report request needs 200 ms of CPU, arriving at 15 ms.`} accent={ACCENT}>
                <p className="font-mono text-sm">One main thread runs them one at a time.</p>
              </FlowStep>
              <FlowArrow label="the report starts" accent={ACCENT} />

              <FlowStep n={2} title="A long task holds the thread" what="JavaScript runs to completion. While the report computes, the event loop can't pick up anything else: not requests, not timers, not I/O callbacks." accent={ACCENT} active={mode === "main"}>
                <p className="text-sm text-[var(--muted)]">{mode === "main" ? `Quick requests queue up behind it and wait up to ${sim.worstFast} ms.` : "Not here: the main thread only hands the work off."}</p>
              </FlowStep>
              <FlowArrow label="move it off the main thread" accent={ACCENT} />

              <FlowStep n={3} title="Hand heavy work to a worker thread" what="worker_threads runs JavaScript on another thread and messages the result back. The main thread spends 1 ms handing off and stays free." accent={ACCENT} active={mode === "worker"}>
                <p className="font-mono text-sm">new Worker(&quot;./report.js&quot;)</p>
              </FlowStep>
              <FlowArrow label="compare" accent={ACCENT} />

              <FlowStep n={4} title="Measure the slowest request, not the average" what="Users feel the worst cases. Event-loop delay is a metric worth alerting on; split big loops, or move CPU work to workers or another service." accent={ACCENT}>
                <p className="text-sm">
                  Worst quick request: <span className="font-mono">{simulate("main").worstFast} ms</span> on the main thread vs <span className="font-mono">{simulate("worker").worstFast} ms</span> with a worker. The report itself still takes about 200 ms either way.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
