"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { SCHEDULES, run, stress, type Thread } from "@/lib/raceCondition";

const ACCENT = "var(--os)";
const THREAD_COLOR: Record<Thread, string> = { A: "var(--c1)", B: "var(--c2)" };
const STRESS = { open: stress(1000, false), locked: stress(1000, true) };

export default function RaceDemo() {
  const [scheduleId, setScheduleId] = useState("interleaved");
  const schedule = SCHEDULES.find((s) => s.id === scheduleId)!;
  const frames = run(schedule);
  const playback = usePlayback(frames.length, 1100);
  const f = frames[playback.i];
  const done = playback.atEnd;
  const wrong = done && f.counter !== 2;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Race conditions"
        blurb="counter = counter + 1 looks like one step. To the CPU it's three: read, add, write. When two threads do it at once and the scheduler switches between them at the wrong moment, an update disappears."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Two threads and one shared counter">
              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                <ThreadBox t="A" reg={f.reg.A} active={f.step?.thread === "A"} holds={f.lockedBy === "A"} />
                <div className="flex flex-col items-center gap-2 pt-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">shared memory</p>
                  <div className="grid h-16 w-20 place-items-center rounded-lg border-2 font-mono text-2xl tabular-nums" style={{ borderColor: wrong ? "var(--bad)" : done ? "var(--good)" : ACCENT }}>
                    {f.counter}
                  </div>
                  <p className="font-mono text-[11px] text-[var(--faint)]">counter</p>
                  {schedule.locked && (
                    <p className="rounded-full border px-2 py-0.5 font-mono text-[11px]" style={{ borderColor: f.lockedBy ? THREAD_COLOR[f.lockedBy] : "var(--line)" }}>
                      lock: {f.lockedBy ? `held by ${f.lockedBy}` : "free"}
                    </p>
                  )}
                </div>
                <ThreadBox t="B" reg={f.reg.B} active={f.step?.thread === "B"} holds={f.lockedBy === "B"} />
              </div>

              <ol className="mt-4 space-y-1">
                {schedule.steps.map((s, i) => {
                  const now = i === playback.i - 1;
                  const past = i < playback.i;
                  return (
                    <li key={i} className="flex items-center gap-2 font-mono text-xs" style={{ opacity: past ? 1 : 0.4, marginLeft: s.thread === "B" ? "50%" : 0 }}>
                      <span className="inline-block w-5 rounded text-center" style={{ background: THREAD_COLOR[s.thread], color: "var(--on-accent)" }}>{s.thread}</span>
                      <span style={{ fontWeight: now ? 700 : 400 }}>{s.op}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          }
          panel={
            <SystemMapPanel caption={f.note}>
              <Choices label="How the scheduler runs them" accent={ACCENT} value={scheduleId} onChange={(v) => { setScheduleId(v); playback.reset(); }} options={SCHEDULES.map((s) => ({ id: s.id, label: s.label }))} />
              <p className="w-full text-xs text-[var(--muted)]">{schedule.note}</p>
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={done ? `final: ${f.counter} (expected 2)` : `step ${playback.i} of ${frames.length - 1}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Read the shared value" what="The thread copies counter from memory into its own register." accent={ACCENT} active={f.step?.op === "read"}>
                <p className="font-mono text-sm">register ← counter</p>
              </FlowStep>
              <FlowArrow label="a private copy" accent={ACCENT} />

              <FlowStep n={2} title="Add one to the copy" what="The other thread can't see this. If it also read the old value, both copies now hold the same number." accent={ACCENT} active={f.step?.op === "add"}>
                <p className="font-mono text-sm">register ← register + 1</p>
              </FlowStep>
              <FlowArrow label="the new value" accent={ACCENT} />

              <FlowStep n={3} title="Write it back" what="The second write replaces the first. Two increments, but the counter only went up by one." accent={ACCENT} active={f.step?.op === "write"}>
                <p className="text-sm" style={{ color: wrong ? "var(--bad)" : undefined }}>{done ? `Ended at ${f.counter}, expected 2.` : "counter ← register"}</p>
              </FlowStep>
              <FlowArrow label="make it one unit" accent={ACCENT} />

              <FlowStep n={4} title="A mutex makes the three steps one unit" what="Only the thread holding the lock may run the critical section; the other waits. Correct every time, at the cost of waiting." accent={ACCENT} active={schedule.locked || done}>
                <p className="text-sm">
                  1,000 increments per thread with random switching: <span className="font-mono">{STRESS.open.counter.toLocaleString()}</span> of 2,000 without a lock ({STRESS.open.lost} lost), <span className="font-mono">{STRESS.locked.counter.toLocaleString()}</span> with one.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function ThreadBox({ t, reg, active, holds }: { t: Thread; reg: number | null; active: boolean; holds: boolean }) {
  return (
    <div className="rounded-lg border p-3 text-center" style={{ borderColor: active ? THREAD_COLOR[t] : "var(--line)", background: "var(--inset)" }}>
      <p className="font-mono text-sm" style={{ color: THREAD_COLOR[t] }}>Thread {t}{holds ? " · has lock" : ""}</p>
      <p className="mt-2 font-mono text-[11px] text-[var(--faint)]">register</p>
      <p className="font-mono text-xl tabular-nums">{reg ?? "–"}</p>
    </div>
  );
}
