"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState, type Packet } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { BUFFERS, CALLS, SYSCALL_NS, TOTAL_BYTES, buffering, type CallId } from "@/lib/systemCalls";

const ACCENT = "var(--os)";
const STEPS = 6;

export default function SystemCallsDemo() {
  const [id, setId] = useState<CallId>("write");
  const [buffer, setBuffer] = useState(4096);
  const walk = useWalk(STEPS, 1100);
  const c = CALLS.find((x) => x.id === id)!;
  const st = walk.stage;
  const at = (k: number) => st === k;
  const runId = `${id}-${st}`;
  const buf = buffering(buffer);

  const packets: Packet[] =
    st === 0 ? hops(runId, ["prog", "libc"], { label: c.name + "()" })
    : st === 2 ? hops(runId, ["libc", "kernel"], { label: `syscall ${c.nr}` })
    : st === 4 && c.device ? hops(runId, ["kernel", "dev"], { label: c.id === "write" ? "3 bytes" : "lookup" })
    : st === 5 ? hops(runId, ["kernel", "libc", "prog"], { label: c.ret, tone: c.ok ? "good" : "bad" })
    : [];

  const node = (k: number[], fallback: NodeState = "idle"): NodeState => (st !== null && k.includes(st) ? "active" : fallback);

  const caption =
    st === null ? `Pick a call and press Run. strace would print: ${c.strace}`
    : st === 0 ? `Your program calls ${c.code} It's an ordinary function call into the C library.`
    : st === 1 ? `libc puts ${c.nr} (${c.name}) in rax${c.args.length ? ` and the arguments in ${c.args.map((a) => a.reg).join(", ")}` : ""}.`
    : st === 2 ? "The syscall instruction switches the CPU into kernel mode and jumps to the kernel's entry point. The program can't choose where it lands."
    : st === 3 ? (c.ok ? `The kernel checks: ${c.check}` : `The kernel checks and fails: ${c.check}`)
    : st === 4 ? (c.device ? c.work : `${c.work} Nothing reaches a device.`)
    : `The kernel puts ${c.ret} in rax and returns to user mode. The program sees: ${c.result}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="System calls"
        blurb="A program can't touch the disk, the screen or the network itself. It has to ask the kernel with a system call: put a number in a register, trap into kernel mode, and wait for the answer. Pick a call and follow it down and back."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <SystemMap
              title="Your program, the C library, the kernel and the device"
              accent={ACCENT}
              chrome="split"
              nodes={[
                { id: "prog", label: "Your program", sub: "user mode", at: [12, 50], mobileAt: [50, 11], state: node([0, 5], st === 5 ? (c.ok ? "good" : "bad") : "idle") },
                { id: "libc", label: "C library", sub: st !== null && st >= 1 ? `rax = ${st === 5 ? c.ret : c.nr}` : "libc", at: [37, 50], mobileAt: [50, 37], state: node([1, 2]) },
                { id: "kernel", label: "Kernel", sub: "kernel mode", at: [63, 50], mobileAt: [50, 63], state: st === 3 && !c.ok ? "bad" : node([2, 3, 4]) },
                { id: "dev", label: c.device ?? "No device", sub: c.device === "Disk" ? "notes.txt" : c.device ? "fd 1" : "not needed", at: [88, 50], mobileAt: [50, 89], state: c.device ? node([4]) : "dim" },
              ]}
              links={[
                { from: "prog", to: "libc", label: "function call" },
                { from: "libc", to: "kernel", label: "syscall" },
                { from: "kernel", to: "dev", label: "driver", dim: !c.device },
              ]}
              packets={packets}
              aspect={3}
              mobileAspect={0.75}
            />
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Call" accent={ACCENT} value={id} options={CALLS.map(({ id: v, label }) => ({ id: v, label }))} onChange={(v) => { if (!walk.busy) setId(v); }} />
              <div className="flex w-full flex-wrap items-center gap-3 pt-1">
                <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT}>Run the call</RunButton>
                <code className="min-w-0 break-all font-mono text-xs text-[var(--muted)]">$ strace: {c.strace}</code>
              </div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Call a library function" what="Your code calls printf or open like any other function. The C library (libc) does the setup, and often buffers output so it needs fewer system calls." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">{c.code}</p>
                {id === "write" && (
                  <div className="mt-3">
                    <Choices label={`Print ${TOTAL_BYTES.toLocaleString("en-US")} bytes with a buffer of`} accent={ACCENT} value={String(buffer)} options={BUFFERS.map((b) => ({ id: String(b), label: `${b} B` }))} onChange={(v) => setBuffer(Number(v))} />
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {buf.calls.toLocaleString("en-US")} write() calls × ~{SYSCALL_NS} ns = {buf.overheadUs.toLocaleString("en-US")} µs just crossing into the kernel.
                    </p>
                  </div>
                )}
              </FlowStep>
              <FlowArrow label={`${c.name}(…)`} accent={ACCENT} active={at(1)} />
              <FlowStep n={2} title="Load the call number" what="Every system call has a number. On x86-64 Linux, libc puts it in the rax register and the arguments in rdi, rsi, rdx." accent={ACCENT} active={at(1)}>
                <ul className="space-y-1 font-mono text-xs">
                  <li>rax = {c.nr} <span className="text-[var(--faint)]">({c.name})</span></li>
                  {c.args.map((a) => (
                    <li key={a.reg}>{a.reg} = {a.value} <span className="text-[var(--faint)]">{a.means}</span></li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="syscall instruction" accent={ACCENT} active={at(2)} />
              <FlowStep n={3} title="Trap into the kernel" what="The syscall instruction flips the CPU from user mode to kernel mode and jumps to one fixed kernel entry point. Only kernel mode may touch hardware." accent={ACCENT} active={at(2)}>
                <p className="text-xs text-[var(--muted)]">This switch, and the way back, costs roughly {SYSCALL_NS} ns: about a hundred times an ordinary function call.</p>
              </FlowStep>
              <FlowArrow label="kernel mode" accent={ACCENT} active={at(3)} />
              <FlowStep n={4} title="Check the request" what="The kernel never trusts the program. It checks the file descriptor, the permissions and that every pointer is inside the program's memory." accent={ACCENT} active={at(3)}>
                <p className="text-xs" style={{ color: c.ok ? "var(--text)" : "var(--bad)" }}>{c.check}</p>
              </FlowStep>
              <FlowArrow label={c.device ? "to the driver" : "no device"} accent={ACCENT} active={at(4)} />
              <FlowStep n={5} title="Do the work" what="Only the kernel talks to devices, through their drivers. Some calls, like getpid, never need a device at all." accent={ACCENT} active={at(4)}>
                <p className="text-xs text-[var(--muted)]">{c.work}</p>
              </FlowStep>
              <FlowArrow label={`rax = ${c.ret}`} accent={ACCENT} active={at(5)} />
              <FlowStep n={6} title="Return a number" what="The kernel puts the result in rax and drops back to user mode. A negative number is an error code; libc turns it into −1 and sets errno." accent={ACCENT} active={at(5)}>
                <p className="font-mono text-xs" style={{ color: c.ok ? "var(--good)" : "var(--bad)" }}>{c.result}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
