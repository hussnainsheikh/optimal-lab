"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, type NodeState, type Packet } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { COST_US, KINDS, REGS, SLICES_MS, overhead, regsB, timeline, type Kind } from "@/lib/contextSwitch";

const ACCENT = "var(--os)";
const fmtMs = (ms: number) => (ms < 1 ? `${ms * 1000} µs` : `${ms} ms`);

export default function ContextSwitchDemo() {
  const [kind, setKind] = useState<Kind>("process");
  const [slice, setSlice] = useState(4);
  const walk = useWalk(6, 1100);
  const st = walk.stage;
  const at = (k: number) => st === k;
  const proc = kind === "process";
  const o = overhead(slice, kind);
  const bars = timeline(slice, kind, slice * 4);
  const span = slice * 4 * 1000;
  const regs = st !== null && st >= 4 ? regsB(kind) : REGS.A;
  const id = `${kind}-${st}`;

  const packets: Packet[] =
    st === 0 ? [{ id, from: "cpu", to: "kernel", label: "timer" }]
    : st === 1 ? [{ id, from: "cpu", to: "a", label: "A's registers" }]
    : st === 2 ? [{ id, from: "kernel", to: "b", label: "pick B" }]
    : st === 3 && proc ? [{ id, from: "kernel", to: "mmu", label: "B's page table" }]
    : st === 4 ? [{ id, from: "b", to: "cpu", label: "B's registers" }]
    : st === 5 ? [{ id, from: "cpu", to: "mmu", label: "misses", tone: "bad" }]
    : [];
  const s = (on: number[]): NodeState => (st !== null && on.includes(st) ? "active" : "idle");

  const caption =
    st === null ? `Each switch costs about ${o.cost} µs here. With ${fmtMs(slice)} slices that's ${o.perSecond.toLocaleString("en-US")} switches a second per core: ${o.pct.toFixed(2)}% of the CPU. Press Run to watch one.`
    : st === 0 ? `A has used its ${fmtMs(slice)} slice. The timer interrupt stops it between two instructions and enters the kernel.`
    : st === 1 ? `The kernel writes A's registers (PC ${REGS.A.pc}, SP ${REGS.A.sp}, rax ${REGS.A.rax}…) into A's task record in memory.`
    : st === 2 ? "The scheduler picks the next thread to run: B."
    : st === 3 ? (proc ? "B belongs to another process, so the kernel loads B's page table. Address translations cached in the TLB for A are now useless." : "B shares A's process, so the page table stays. This is the cheap case.")
    : st === 4 ? `B's saved registers go back into the CPU: PC ${regs.pc}, SP ${regs.sp}. B continues exactly where it stopped.`
    : "B runs, but the caches still hold A's data. B's first memory reads miss and go out to RAM. This hidden cost often outweighs the switch itself.";

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Context switching"
        blurb="One core runs one thread at a time. To share it, the kernel stops a thread, saves its registers, and loads another's, many times a second. Watch one switch and see what it costs at different time slices."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-4">
              <SystemMap
                title="A CPU core, the scheduler, two saved threads and the page table"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "cpu", label: "CPU core", sub: `PC ${regs.pc}`, at: [42, 20], mobileAt: [25, 14], state: st === 5 ? "bad" : s([0, 1, 4]) },
                  { id: "mmu", label: "TLB + caches", sub: st !== null && st >= (proc ? 3 : 5) ? "cold" : "warm for A", at: [84, 20], mobileAt: [75, 14], state: st === 5 ? "bad" : st === 3 && proc ? "active" : st === 3 ? "dim" : "idle" },
                  { id: "a", label: "Thread A", sub: st !== null && st >= 1 ? "saved · ready" : "running", at: [12, 74], mobileAt: [25, 50], state: s([1]) },
                  { id: "kernel", label: "Scheduler", sub: "kernel", at: [48, 80], mobileAt: [50, 86], state: s([0, 2, 3]) },
                  { id: "b", label: "Thread B", sub: st !== null && st >= 4 ? "running" : "saved · ready", at: [86, 74], mobileAt: [75, 50], state: s([2, 4]) },
                ]}
                links={[
                  { from: "cpu", to: "kernel", label: "interrupt" },
                  { from: "cpu", to: "a", label: "save" },
                  { from: "kernel", to: "b", label: "pick" },
                  { from: "kernel", to: "mmu", label: "switch tables", dim: !proc },
                  { from: "b", to: "cpu", label: "restore" },
                  { from: "cpu", to: "mmu", label: "cache misses" },
                ]}
                packets={packets}
                aspect={2.2}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Four time slices on one core">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">One core, {fmtMs(slice * 4)}</p>
                <div className="relative mt-2 h-7 overflow-hidden rounded bg-[var(--track)]">
                  {bars.map((b, i) => (
                    <span
                      key={i}
                      className="absolute inset-y-0 grid place-items-center font-mono text-[10px] text-[var(--on-accent)]"
                      style={{
                        left: `${(b.from / span) * 100}%`,
                        width: b.who === "switch" ? `max(2px, ${((b.to - b.from) / span) * 100}%)` : `${((b.to - b.from) / span) * 100}%`,
                        background: b.who === "A" ? "var(--c1)" : b.who === "B" ? "var(--c2)" : "var(--bad)",
                      }}
                    >
                      {b.who === "switch" ? "" : b.who}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">Red: switching, no useful work. {o.pct.toFixed(2)}% of the core, {o.lostMsPerSecond.toFixed(1)} ms lost every second.</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT}>Switch A → B</RunButton>
              <span className="font-mono text-xs text-[var(--faint)]">~{COST_US[kind]} µs per switch</span>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Stop A with a timer" what="A hardware timer interrupts the core when the thread's time slice is up. Shorter slices feel more responsive but switch more often." accent={ACCENT} active={at(0)}>
                <Choices label="Time slice" accent={ACCENT} value={String(slice)} options={SLICES_MS.map((v) => ({ id: String(v), label: fmtMs(v) }))} onChange={(v) => setSlice(Number(v))} />
                <p className="mt-2 font-mono text-xs">{o.perSecond.toLocaleString("en-US")} switches per second per core</p>
              </FlowStep>
              <FlowArrow label="into the kernel" accent={ACCENT} active={at(1)} />
              <FlowStep n={2} title="Save A's registers" what="The program counter, the stack pointer and every general register are copied into A's task record, so A can carry on later as if nothing happened." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">PC {REGS.A.pc} · SP {REGS.A.sp} · rax {REGS.A.rax}</p>
              </FlowStep>
              <FlowArrow label="A is now ready" accent={ACCENT} active={at(2)} />
              <FlowStep n={3} title="Pick the next thread" what="The scheduler chooses who runs next from the threads that are ready. Here there is only B." accent={ACCENT} active={at(2)} />
              <FlowArrow label="B's task record" accent={ACCENT} active={at(3)} />
              <FlowStep n={4} title="Switch address space" what="Threads of one process share memory, so nothing changes. A different process has its own page table, and switching to it makes the cached translations (TLB) useless." accent={ACCENT} active={at(3)}>
                <Choices accent={ACCENT} value={kind} options={KINDS} onChange={setKind} />
              </FlowStep>
              <FlowArrow label={proc ? "new page table" : "same page table"} accent={ACCENT} active={at(4)} />
              <FlowStep n={5} title="Load B's registers" what="B's saved PC and stack pointer go back into the CPU. The core now runs B's code from the exact instruction where B last stopped." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs">PC {regsB(kind).pc} · SP {regsB(kind).sp} · memory of {regsB(kind).table}</p>
              </FlowStep>
              <FlowArrow label="B runs" accent={ACCENT} active={at(5)} />
              <FlowStep n={6} title="Run B on cold caches" what="The caches are full of A's data, so B starts slowly until they refill. When B's slice ends, the cycle starts again at step 1." accent={ACCENT} active={at(5)}>
                <p className="text-xs text-[var(--muted)]">Too many runnable threads per core means more switches and colder caches: one reason thread pools stay small.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
