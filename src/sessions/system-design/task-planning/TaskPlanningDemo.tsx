"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { MODES, TASKS, criticalPath, run, topoOrder, type Mode } from "@/lib/taskPlanning";

const ACCENT = "var(--sys)";

export default function TaskPlanningDemo() {
  const [mode, setMode] = useState<Mode>("reactive");
  const [fail, setFail] = useState(false);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const r = run(mode, fail);
  const all = Object.fromEntries(MODES.map((m) => [m.id, run(m.id, fail)])) as Record<Mode, ReturnType<typeof run>>;
  const crit = criticalPath();
  const total = Math.max(r.minutes, ...[...r.slots.values()].map((s) => s.end));
  const label = (id: string) => TASKS.find((t) => t.id === id)!.label;

  const captions = [
    `Step 1: “Organise a team offsite for 20 people in May” becomes ${TASKS.length} tasks.`,
    "Step 2: some tasks need others first: the venue needs dates and a budget; travel needs the venue.",
    `Step 3: ${MODES.find((m) => m.id === mode)!.label.toLowerCase()}: ${r.minutes} minutes, ${r.modelCalls} model calls.`,
    `Step 4: ${mode === "parallel" ? `dates, budget and agenda run together; the critical path (${crit.map(label).join(" → ").toLowerCase()}) sets the total` : "one task at a time"}.`,
    fail ? `Step 5: the venue is booked out. ${r.failureNote}` : "Step 5: turn on the failure to see the plan change.",
  ];
  const caption = stage !== null ? captions[stage] : `${MODES.find((m) => m.id === mode)!.label}: ${r.minutes} min, ${r.modelCalls} model calls${r.wasted.length ? `, ${r.wasted.length} wasted attempts` : ""}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Planning and task decomposition"
        blurb={`“Organise a team offsite for 20 people in May.” An agent can take it one step at a time, deciding what to do next after each, or write a plan first: tasks, what each needs, what can run at the same time. Then the venue turns out to be booked, and the plan has to change.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={`When each task runs: ${r.minutes} minutes in all`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{MODES.find((m) => m.id === mode)!.label}</p>
                <p className="font-mono text-xs">
                  {r.minutes} min · {r.modelCalls} calls
                </p>
              </div>
              <ul className="mt-3 space-y-1.5">
                {TASKS.map((t) => {
                  const s = r.slots.get(t.id);
                  return (
                    <li key={t.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2 text-[11px] sm:grid-cols-[10rem_minmax(0,1fr)]">
                      <span className="truncate" style={{ fontWeight: crit.includes(t.id) && mode === "parallel" ? 700 : 400 }}>
                        {t.label}
                      </span>
                      <span className="relative h-4 rounded bg-[var(--track)]">
                        {s && <span className="absolute inset-y-0 rounded" style={{ left: `${(s.start / total) * 100}%`, width: `${(t.minutes / total) * 100}%`, background: crit.includes(t.id) && mode === "parallel" ? "var(--c4)" : ACCENT }} />}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]">
                <span>0</span>
                <span>{total} min</span>
              </div>
              {r.wasted.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11px]" style={{ color: "var(--bad)" }}>
                  {r.wasted.map((w) => (
                    <li key={w}>✗ {w}</li>
                  ))}
                </ul>
              )}
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Approach" accent={ACCENT} value={mode} onChange={setMode} options={MODES.map((m) => ({ id: m.id, label: m.label }))} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Planning…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Break the goal into tasks" what="Ask the model to list the tasks before doing any of them. Each should be something one tool call or one person can finish and check." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 text-xs">
                  {TASKS.map((t) => (
                    <li key={t.id}>
                      {t.label} <span className="font-mono text-[var(--faint)]">({t.minutes} min)</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="what needs what" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Write down the dependencies" what="A task that needs another's result waits for it. With dependencies written down, the order is computed, not guessed (here with Kahn's algorithm), and a cycle is caught before anything runs." accent={ACCENT} active={at(1)}>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {TASKS.filter((t) => t.deps.length).map((t) => (
                    <li key={t.id}>
                      {t.id} ← {t.deps.join(", ")}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">order: {topoOrder(TASKS).join(" → ")}</p>
              </FlowStep>
              <FlowArrow label="run it" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Execute against the plan" what="Without a plan the model tends to reach for the obvious big task (book a venue) before its inputs exist, fail, and backtrack. With one, each task runs once, after what it needs." accent={ACCENT} active={at(2)}>
                <Choices label="Approach" accent={ACCENT} value={mode} onChange={setMode} options={MODES.map((m) => ({ id: m.id, label: m.label }))} />
                <p className="mt-2 text-xs">{MODES.find((m) => m.id === mode)!.one}</p>
              </FlowStep>
              <FlowArrow label="at the same time" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Run independent tasks in parallel" what={`Tasks with no path between them can run at once. The total is then the longest chain of dependent tasks, the critical path: ${crit.map(label).join(" → ").toLowerCase()}.`} accent={ACCENT} active={at(3)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">minutes</span>
                  <span className="text-right text-[var(--faint)]">calls</span>
                  {MODES.map((m) => (
                    <Row key={m.id} cells={[m.label, String(all[m.id].minutes), String(all[m.id].modelCalls)]} bold={m.id === mode} />
                  ))}
                </div>
              </FlowStep>
              <FlowArrow label="something fails" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Replan when a step fails" what="When the venue is booked out, a plan says exactly what's affected: the venue and everything downstream of it. Replace that part, keep the rest. Without one, the failure surfaces later, after other work was built on it." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The first venue is booked out
                </label>
                <p className="text-xs" style={{ color: r.wasted.length ? "var(--bad)" : "var(--text)" }}>
                  {r.failureNote}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Task times and the no-plan agent&rsquo;s order are illustrative; the ordering and critical path are computed from the graph.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, bold }: { cells: string[]; bold: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: bold ? 700 : 400 }}>
          {c}
        </span>
      ))}
    </>
  );
}
