"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, Slider, usePlayback } from "@/components/session/ui";
import { SLICE_MS, STACK_MB, WORK_MS, simulate } from "@/lib/threads";

const ACCENT = "var(--os)";
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];
const color = (t: number) => COLORS[t % COLORS.length];
// Stack pointers: the main thread's stack sits at the top; new thread stacks are mapped below it.
const sp = (t: number) => "0x" + (t === 0 ? 0x7ffd2a40 : 0x7f3a00000000 - (t - 1) * 0x801000).toString(16);

export default function ThreadsDemo() {
  const [threads, setThreads] = useState(4);
  const [cores, setCores] = useState(2);
  const [focus, setFocus] = useState(0);
  const sim = simulate(threads, cores);
  const playback = usePlayback(sim.ticks.length + 1, 700);
  const k = playback.i; // ticks finished
  const now = k === 0 ? null : sim.ticks[k - 1];
  const left = now ? now.left : Array.from({ length: threads }, () => sim.perThread);
  const t = now ? now.t1 : 0;
  const active = k > 0 ? 4 : focus;

  const caption =
    k === 0 ? `${threads} thread${threads > 1 ? "s" : ""} will split ${WORK_MS} ms of work, ${sim.perThread.toFixed(0)} ms each, on ${cores} core${cores > 1 ? "s" : ""}. Press Play.`
    : playback.atEnd ? `Done in ${sim.wall.toFixed(0)} ms instead of ${WORK_MS} ms: ${sim.speedup.toFixed(2)}× faster. ${threads > cores ? `Threads beyond ${cores} only take turns; they can't add cores.` : threads < cores ? `${cores - threads} core${cores - threads > 1 ? "s" : ""} sat idle: add threads to use them.` : "Every core was busy the whole time."}`
    : `At ${t.toFixed(0)} ms: core${cores > 1 ? "s" : ""} running ${now!.running.map((r) => (r < 0 ? "nothing" : `T${r + 1}`)).join(", ")}.`;

  const changeThreads = (v: number) => { setThreads(v); setFocus(1); playback.reset(); };
  const changeCores = (v: number) => { setCores(v); setFocus(4); playback.reset(); };

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Threads"
        blurb="A thread is one path through the code: its own registers and stack. A process can have many, all sharing the same memory and open files, so they can work on the same data at once on different cores."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="One process with several threads">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">One process · PID 4121</p>
              <div className="mt-2 rounded-lg border border-[var(--line)] p-3">
                <p className="text-xs font-semibold">Shared by every thread</p>
                <div className="mt-2 grid grid-cols-2 gap-1.5 font-mono text-[11px] sm:grid-cols-4">
                  {["code", "globals", "heap", "open files"].map((x) => (
                    <span key={x} className="rounded bg-[var(--inset)] px-2 py-1 text-center">{x}</span>
                  ))}
                </div>
                <p className="mt-3 text-xs font-semibold">Private to each thread</p>
                <ul className="mt-2 grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(4.75rem,1fr))]">
                  {Array.from({ length: threads }, (_, i) => {
                    const done = 1 - left[i] / sim.perThread;
                    const on = now?.running.includes(i);
                    return (
                      <li key={i} className="min-w-0 rounded border p-1.5 font-mono text-[10px]" style={{ borderColor: on ? color(i) : "var(--line)" }}>
                        <span className="font-semibold" style={{ color: color(i) }}>T{i + 1}{i === 0 ? " main" : ""}</span>
                        <span className="block truncate text-[var(--faint)]">SP {sp(i)}</span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded bg-[var(--track)]">
                          <span className="block h-full" style={{ width: `${done * 100}%`, background: color(i) }} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Cores over time · {SLICE_MS} ms slices</p>
              <div className="mt-2 space-y-1">
                {Array.from({ length: cores }, (_, c) => (
                  <div key={c} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
                    <span className="font-mono text-[11px] text-[var(--muted)]">core {c + 1}</span>
                    <div className="relative h-6 overflow-hidden rounded bg-[var(--track)]">
                      {sim.ticks.slice(0, k).map((tk, j) => {
                        const r = tk.running[c];
                        if (r < 0) return null;
                        return (
                          <span
                            key={j}
                            className="absolute inset-y-0 grid place-items-center overflow-hidden border-r border-[var(--panel)] font-mono text-[9px] text-[var(--on-accent)]"
                            style={{ left: `${(tk.t0 / WORK_MS) * 100}%`, width: `${((tk.t1 - tk.t0) / WORK_MS) * 100}%`, background: color(r) }}
                          >
                            {tk.t1 - tk.t0 >= 25 ? `T${r + 1}` : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>0 ms</span><span>{WORK_MS / 2} ms</span><span>{WORK_MS} ms</span></p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next slice" status={`${t.toFixed(0)} ms`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Start with one thread" what="Every process starts with one thread, the main thread: one program counter, one stack, one set of registers." accent={ACCENT} active={active === 0}>
                <p className="font-mono text-xs">T1 main · SP {sp(0)}</p>
              </FlowStep>
              <FlowArrow label="pthread_create" accent={ACCENT} />
              <FlowStep n={2} title="Create more threads" what="Asking for a thread is much cheaper than a new process: no new memory map, no copied file table. On Linux both are made by clone(); a thread just shares more." accent={ACCENT} active={active === 1}>
                <Slider label="Threads" value={threads} min={1} max={8} step={1} format={(v) => `${v}`} onChange={changeThreads} accent={ACCENT} hint={`${threads} × ${STACK_MB} MB of stack reserved (virtual; only the pages used take RAM).`} />
              </FlowStep>
              <FlowArrow label={`${threads} stacks`} accent={ACCENT} />
              <FlowStep n={3} title="Give each its own stack" what="Each thread has its own stack and registers, so local variables and the current position in the code are private to it." accent={ACCENT} active={active === 2}>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
                  {Array.from({ length: Math.min(threads, 4) }, (_, i) => <li key={i} style={{ color: color(i) }}>T{i + 1}: {sp(i)}</li>)}
                  {threads > 4 && <li className="text-[var(--faint)]">…</li>}
                </ul>
              </FlowStep>
              <FlowArrow label="same address space" accent={ACCENT} />
              <FlowStep n={4} title="Share everything else" what="The heap, globals and open files are the same for all threads. One thread's write is seen by the others at once: fast, but two threads changing one value can lose updates." accent={ACCENT} active={active === 3}>
                <p className="text-xs text-[var(--muted)]">That is why threads need locks: see Race conditions.</p>
              </FlowStep>
              <FlowArrow label={`${threads} runnable threads`} accent={ACCENT} />
              <FlowStep n={5} title="Run them on the cores" what="The scheduler puts one thread on each core and swaps them every time slice. Speed-up stops at the number of cores." accent={ACCENT} active={active === 4}>
                <Slider label="CPU cores" value={cores} min={1} max={4} step={1} format={(v) => `${v}`} onChange={changeCores} accent={ACCENT} />
                <p className="mt-2 font-mono text-xs">{WORK_MS} ms of work → {sim.wall.toFixed(0)} ms wall clock ({sim.speedup.toFixed(2)}×)</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
