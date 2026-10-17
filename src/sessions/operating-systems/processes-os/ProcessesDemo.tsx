"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { EVENTS, MEMORY, PS_LETTER, START, allowed, apply, type EventId, type Proc, type State } from "@/lib/processState";

const ACCENT = "var(--os)";
const STATES: { id: State; label: string }[] = [
  { id: "new", label: "New" },
  { id: "ready", label: "Ready" },
  { id: "running", label: "Running" },
  { id: "blocked", label: "Blocked" },
  { id: "zombie", label: "Zombie" },
  { id: "gone", label: "Gone" },
];
const STEP: Record<State, number> = { new: 0, ready: 1, running: 2, blocked: 3, zombie: 4, gone: 4 };
const FIRST = "fork() has just made PID 4121. It exists, but the kernel is still setting it up. Press an event.";

export default function ProcessesDemo() {
  const [p, setP] = useState<Proc>(START);
  const [log, setLog] = useState<string[]>([FIRST]);
  const step = STEP[p.state];
  const gone = p.state === "gone";

  function send(e: EventId) {
    const r = apply(p, e);
    setP(r.p);
    setLog((l) => [r.text, ...l].slice(0, 4));
  }
  function reset() {
    setP(START);
    setLog([FIRST]);
  }
  const btn = (e: EventId) => {
    const ev = EVENTS.find((x) => x.id === e)!;
    const ok = allowed(p, e);
    return (
      <button
        key={e}
        type="button"
        disabled={!ok}
        onClick={() => send(e)}
        className="min-h-11 rounded-md border px-3 text-sm transition-colors disabled:opacity-35"
        style={ok ? { borderColor: ACCENT, background: `color-mix(in srgb, ${ACCENT} 14%, transparent)` } : { borderColor: "var(--line)" }}
      >
        {ev.label}
      </button>
    );
  };

  const heapMb = (p.heapKb / 1024).toFixed(1);

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Processes"
        blurb="A process is a program while it runs: its own memory, its open files, its saved registers and a state the kernel keeps track of. Send it events and watch the kernel's record of it change."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The kernel's record of one process">
              <ol className="flex flex-wrap items-center gap-1.5" aria-label="States">
                {STATES.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-1.5">
                    <span
                      className="rounded-full border px-2.5 py-1 font-mono text-xs transition-colors"
                      style={p.state === s.id ? { borderColor: s.id === "zombie" ? "var(--bad)" : ACCENT, background: `color-mix(in srgb, ${s.id === "zombie" ? "var(--bad)" : ACCENT} 18%, transparent)` } : { borderColor: "var(--line)", color: "var(--faint)" }}
                    >
                      {s.label}
                    </span>
                    {i < STATES.length - 1 && <span aria-hidden className="text-xs text-[var(--faint)]">→</span>}
                  </li>
                ))}
              </ol>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="min-w-0 rounded-lg bg-[var(--inset)] p-3" style={{ opacity: gone ? 0.4 : 1 }}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Process record</p>
                  <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-xs">
                    <dt className="text-[var(--faint)]">PID</dt><dd>{p.pid} <span className="text-[var(--faint)]">(parent {p.ppid})</span></dd>
                    <dt className="text-[var(--faint)]">State</dt><dd>{PS_LETTER[p.state]}</dd>
                    <dt className="text-[var(--faint)]">PC</dt><dd>0x{p.pc.toString(16)}</dd>
                    <dt className="text-[var(--faint)]">CPU time</dt><dd>{p.cpuMs} ms</dd>
                    <dt className="text-[var(--faint)]">Taken off CPU</dt><dd>{p.switches}×</dd>
                    <dt className="text-[var(--faint)]">Exit code</dt><dd>{p.exitCode ?? "—"}</dd>
                  </dl>
                </div>
                <div className="min-w-0 rounded-lg bg-[var(--inset)] p-3" style={{ opacity: p.state === "zombie" || gone ? 0.4 : 1 }}>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Memory</p>
                  <ul className="mt-2 space-y-1 font-mono text-xs">
                    <li>code   {MEMORY.text} KB</li>
                    <li>data   {MEMORY.data} KB</li>
                    <li>heap   {p.heapKb >= 1024 ? `${heapMb} MB` : `${p.heapKb} KB`}</li>
                    <li>stack  {p.state === "zombie" || gone ? 0 : MEMORY.stack} KB</li>
                  </ul>
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Open files</p>
                  <ul className="mt-1 space-y-0.5 font-mono text-xs">
                    {p.fds.length === 0 ? <li className="text-[var(--faint)]">none</li> : p.fds.map((f) => <li key={f.fd} className="truncate">{f.fd} → {f.what}</li>)}
                  </ul>
                </div>
              </div>

              {log.length > 1 && (
                <>
                  <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Before that</p>
                  <ol className="mt-1 space-y-1 text-xs text-[var(--muted)]">
                    {log.slice(1).map((t, i) => (
                      <li key={`${log.length}-${i}`}>{t}</li>
                    ))}
                  </ol>
                </>
              )}
            </section>
          }
          panel={
            <SystemMapPanel caption={log[0]}>
              {EVENTS.filter((e) => allowed(p, e.id)).map((e) => btn(e.id))}
              <button type="button" onClick={reset} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">Start over</button>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Create the process" what="fork() asks the kernel for a new process. It gets a PID, a page table, a stack and copies of the parent's open files: 0, 1 and 2." accent={ACCENT} active={step === 0}>
                <div className="flex flex-wrap gap-2">{btn("admit")}</div>
              </FlowStep>
              <FlowArrow label="joins the run queue" accent={ACCENT} />
              <FlowStep n={2} title="Wait for a CPU" what="Ready means it could run right now, but every core is busy. The scheduler decides who goes next." accent={ACCENT} active={step === 1}>
                <div className="flex flex-wrap gap-2">{btn("dispatch")}</div>
              </FlowStep>
              <FlowArrow label="registers loaded" accent={ACCENT} />
              <FlowStep n={3} title="Run instructions" what="Only now does the CPU run its code. While running it can open files and grow its heap, and the kernel can take the CPU back when its time slice ends." accent={ACCENT} active={step === 2}>
                <div className="flex flex-wrap gap-2">{(["open", "malloc", "read", "preempt", "exit"] as EventId[]).map(btn)}</div>
              </FlowStep>
              <FlowArrow label="waits for the disk" accent={ACCENT} />
              <FlowStep n={4} title="Block on I/O" what="Calling read() on a file that isn't in memory means waiting for the disk, which takes milliseconds: time for millions of instructions. The process sleeps and uses no CPU until the disk answers, then goes back to ready." accent={ACCENT} active={step === 3}>
                <div className="flex flex-wrap gap-2">{btn("ioDone")}</div>
              </FlowStep>
              <FlowArrow label="exit code" accent={ACCENT} />
              <FlowStep n={5} title="Exit and get reaped" what="exit() frees its memory and files at once. A tiny record stays (a zombie) until the parent calls wait() to read the exit code." accent={ACCENT} active={step === 4}>
                <div className="flex flex-wrap gap-2">{btn("reap")}</div>
                {gone && <p className="mt-2 text-xs text-[var(--good)]">PID {p.pid} is free to reuse. Press Start over to run it again.</p>}
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
