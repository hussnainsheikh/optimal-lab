"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, type NodeState, type Packet } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { MECHS, SIZES, fmtBytes, fmtTime, info, type Mech } from "@/lib/ipc";

const ACCENT = "var(--os)";

export default function IpcDemo() {
  const [m, setM] = useState<Mech>("pipe");
  const [size, setSize] = useState(4096);
  const walk = useWalk(5, 1200);
  const st = walk.stage;
  const at = (k: number) => st === k;
  const x = info(m, size);
  const shm = m === "shm";
  const sig = m === "signal";
  const id = `${m}-${size}-${st}`;
  const what = sig ? "SIGUSR1" : fmtBytes(size);

  const packets: Packet[] =
    st === 0 ? (shm ? [{ id: `${id}a`, from: "a", to: "shm", label: "mmap" }, { id: `${id}b`, from: "b", to: "shm", label: "mmap" }]
      : sig ? [{ id: `${id}b`, from: "b", to: "kernel", label: "handler" }]
      : [{ id: `${id}a`, from: "a", to: "kernel", label: m === "pipe" ? "fds[1]" : "connect" }, { id: `${id}b`, from: "b", to: "kernel", label: m === "pipe" ? "fds[0]" : "listen" }])
    : st === 1 ? [{ id, from: "a", to: shm ? "shm" : "kernel", label: what }]
    : st === 3 ? [{ id, from: shm ? "shm" : "kernel", to: "b", label: sig ? "run handler" : what }]
    : st === 4 && m === "socket" ? [{ id: `${id}r`, from: "b", to: "kernel", label: "reply" }, { id: `${id}s`, from: "kernel", to: "a", label: "reply", delay: 0.45 }]
    : [];
  const on = (ks: number[]): NodeState => (st !== null && ks.includes(st) ? "active" : "idle");

  const kernelSub = sig ? (at(2) ? "pending: SIGUSR1" : "signal bits") : shm ? "only for setup and locks" : m === "pipe" ? "64 KiB pipe buffer" : "socket buffers";
  const caption =
    st === null ? `${MECHS.find((v) => v.id === m)!.label}, ${sig ? "no data" : fmtBytes(size)}: ${x.copies} cop${x.copies === 1 ? "y" : "ies"}, ${x.syscalls.toLocaleString("en-US")} system call${x.syscalls === 1 ? "" : "s"}, about ${fmtTime(x.timeUs)}. Press Send.`
    : [x.setup, x.write, x.cross, x.read, x.limits][st];

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Inter-process communication"
        blurb="Processes can't read each other's memory. To pass data from one to another they go through the kernel (pipes, sockets, signals) or ask it to map the same memory into both (shared memory). Each choice trades speed, safety and what it can carry."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-4">
              <SystemMap
                title="Process A, the kernel, shared memory and process B"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "a", label: "Process A", sub: "sender", at: [12, 50], mobileAt: [22, 14], state: on([1]) },
                  { id: "kernel", label: "Kernel", sub: kernelSub, at: [50, 22], mobileAt: [50, 52], state: shm ? (at(3) ? "idle" : "dim") : on([0, 2]) },
                  { id: "shm", label: "Shared pages", sub: shm ? "mapped by A and B" : "not used", at: [50, 80], mobileAt: [50, 88], state: shm ? on([0, 2]) : "dim" },
                  { id: "b", label: "Process B", sub: sig ? "handler" : "receiver", at: [88, 50], mobileAt: [78, 14], state: on([3]) },
                ]}
                links={[
                  { from: "a", to: "kernel", label: sig ? "kill()" : m === "pipe" ? "write()" : "send()", dim: shm },
                  { from: "kernel", to: "b", label: sig ? "signal" : m === "pipe" ? "read()" : "recv()", dim: shm },
                  { from: "a", to: "shm", label: "plain writes", dim: !shm },
                  { from: "shm", to: "b", label: "plain reads", dim: !shm },
                ]}
                packets={packets}
                aspect={2.3}
                mobileAspect={1}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="All four, for the same message">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Sending {fmtBytes(size)} once</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[19rem] text-left font-mono text-xs">
                    <thead className="text-[var(--faint)]">
                      <tr><th className="py-1 font-normal">way</th><th className="font-normal">copies</th><th className="font-normal">syscalls</th><th className="font-normal">≈ time</th></tr>
                    </thead>
                    <tbody>
                      {MECHS.map((v) => {
                        const r = info(v.id, size);
                        return (
                          <tr key={v.id} style={{ color: v.id === m ? "var(--text)" : "var(--muted)", fontWeight: v.id === m ? 600 : 400 }}>
                            <td className="py-0.5">{v.label}</td>
                            <td>{r.copies}</td>
                            <td>{r.syscalls.toLocaleString("en-US")}</td>
                            <td>{v.id === "signal" ? "no data" : fmtTime(r.timeUs)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">Rough model: copying at 10 GB/s, ~0.1 µs per system call.</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Mechanism" accent={ACCENT} value={m} options={MECHS} onChange={(v) => { if (!walk.busy) setM(v); }} />
              <div className="w-full pt-1">
                <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT}>Send it</RunButton>
              </div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Set up the channel" what="Both sides first need something in common: a pair of file descriptors, a socket path, a shared memory name, or just B's PID." accent={ACCENT} active={at(0)}>
                <p className="text-xs text-[var(--muted)]">{x.setup}</p>
              </FlowStep>
              <FlowArrow label={shm ? "one mapping" : sig ? "B's PID" : "file descriptors"} accent={ACCENT} active={at(1)} />
              <FlowStep n={2} title="Send from A" what="A hands over the data. With a pipe or socket that is a system call that copies the bytes into the kernel." accent={ACCENT} active={at(1)}>
                <Choices label="Message size" accent={ACCENT} value={String(size)} options={SIZES.map((s) => ({ id: String(s), label: fmtBytes(s) }))} onChange={(v) => { if (!walk.busy) setSize(Number(v)); }} />
                <p className="mt-2 text-xs text-[var(--muted)]">{x.write}</p>
              </FlowStep>
              <FlowArrow label={what} accent={ACCENT} active={at(2)} />
              <FlowStep n={3} title="Cross the boundary" what="This is where the mechanisms differ most: a kernel buffer, a shared page, or a single pending bit." accent={ACCENT} active={at(2)}>
                <p className="text-xs text-[var(--muted)]">{x.cross}</p>
                {x.blocks > 0 && <p className="mt-1 font-mono text-xs">A blocked {x.blocks.toLocaleString("en-US")} time{x.blocks === 1 ? "" : "s"} on a full buffer</p>}
              </FlowStep>
              <FlowArrow label={sig ? "interrupt B" : "data for B"} accent={ACCENT} active={at(3)} />
              <FlowStep n={4} title="Receive in B" what="B gets the data with a read, by looking at the shared page, or by having its handler run." accent={ACCENT} active={at(3)}>
                <p className="text-xs text-[var(--muted)]">{x.read}</p>
              </FlowStep>
              <FlowArrow label={x.twoWay ? "can reply" : "one way"} accent={ACCENT} active={at(4)} />
              <FlowStep n={5} title="Know the limits" what="Pick by what you need to carry and how far: bytes or just a nudge, one way or both, this machine or the network." accent={ACCENT} active={at(4)}>
                <p className="text-xs text-[var(--muted)]">{x.limits}</p>
                <p className="mt-1 font-mono text-xs">carries: {x.carries}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
