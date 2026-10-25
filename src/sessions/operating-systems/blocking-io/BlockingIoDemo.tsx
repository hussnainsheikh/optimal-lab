"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { CONNS, CPU, DISK, MODELS, MODEL_LABEL, simulate, type Model, type Seg } from "@/lib/blockingIo";

const ACCENT = "var(--os)";
const SEG: Record<Seg["what"], { color: string; label: string }> = {
  socket: { color: "var(--c2)", label: "asleep in read(), waiting for a socket" },
  disk: { color: "var(--bad)", label: "asleep in read(), waiting for the disk" },
  spin: { color: "var(--c5)", label: "spinning on EAGAIN" },
  cpu: { color: ACCENT, label: "computing a reply" },
  idle: { color: "transparent", label: "asleep until something is ready" },
};

export default function BlockingIoDemo() {
  const [model, setModel] = useState<Model>("blocking");
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const all = MODELS.map((m) => ({ m, r: simulate(m) }));
  const r = all.find((a) => a.m === model)!.r;
  const span = Math.max(...all.map((a) => a.r.end));
  const worst = r.served.reduce((a, b) => (b.latency > a.latency ? b : a));
  const spin = r.segs.filter((s) => s.what === "spin").reduce((t, s) => t + s.to - s.from, 0);
  const queueLabel = model === "uring" ? "Completion queue" : model === "epoll" ? "epoll ready list" : "No readiness info";

  const nodes: MapNode[] = [
    { id: "clients", label: "4 clients", sub: "A 0 · C 2 · B 20 · D 25 ms", at: [12, 25], mobileAt: [28, 10], state: on(0) ? "active" : "idle" },
    { id: "kernel", label: "Kernel", sub: "socket buffers", at: [46, 25], mobileAt: [72, 10], state: on(1) ? "active" : "idle" },
    { id: "thread", label: "Server thread", sub: `${r.syscalls.toLocaleString("en-US")} syscalls · ${r.cpuMs} ms CPU`, at: [83, 25], mobileAt: [28, 45], state: spin ? "bad" : on(2) || on(4) ? "active" : "idle" },
    { id: "disk", label: "Disk", sub: `${DISK} ms per file read`, at: [46, 78], mobileAt: [72, 45], state: on(3) ? (model === "uring" ? "good" : "bad") : "idle" },
    { id: "queue", label: queueLabel, sub: model === "uring" ? "results arrive here" : model === "epoll" ? "which sockets are readable" : "ask each socket", at: [83, 78], mobileAt: [50, 84], state: model === "epoll" || model === "uring" ? (on(2) ? "active" : "good") : "dim" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["clients", "kernel"], { label: "request bytes" })
    : stage === 1 ? (model === "blocking" ? hops("b", ["thread", "kernel"], { label: "read(B): sleep", tone: "bad" }) : model === "polling" ? hops("b", ["thread", "kernel", "thread"], { label: "EAGAIN", tone: "bad" }) : hops("b", ["kernel", "queue"], { label: model === "uring" ? "read done" : "C readable" }))
    : stage === 2 ? (model === "epoll" || model === "uring" ? hops("c", ["queue", "thread"], { label: model === "uring" ? "completion" : "ready: C", tone: "good" }) : hops("c", ["thread", "kernel"], { label: model === "polling" ? "read? read? read?" : "next read()" }))
    : stage === 3 ? (model === "uring" ? hops("d", ["disk", "queue"], { label: "file done", tone: "good" }) : hops("d", ["thread", "disk", "thread"], { label: `blocked ${DISK} ms`, tone: "bad" }))
    : stage === 4 ? hops("e", ["thread", "kernel", "clients"], { label: "reply" })
    : [];

  const captions = [
    "Step 1: four clients send requests at 0, 2, 20 and 25 ms. The bytes land in each socket's buffer in the kernel.",
    model === "blocking" ? "Step 2: read() on an empty socket puts the thread to sleep until that socket has data, whatever the others are doing." : model === "polling" ? "Step 2: with O_NONBLOCK, read() on an empty socket returns EAGAIN at once, so the thread can try another." : model === "epoll" ? "Step 2: the kernel notes which sockets have data on epoll's ready list." : "Step 2: the reads were queued up front; the kernel finishes them and posts the results.",
    model === "blocking" ? "Step 3: the thread only learns a socket is ready by blocking on it, in accept order." : model === "polling" ? `Step 3: the thread asks every socket again and again: ${r.syscalls.toLocaleString("en-US")} syscalls and ${spin} ms of CPU spent spinning.` : model === "epoll" ? "Step 3: one epoll_wait sleeps until any socket is readable and returns just those." : "Step 3: the thread waits once for any completion and handles whichever finished.",
    model === "uring" ? `Step 4: file reads are queued too, so the four ${DISK} ms disk reads overlap and the thread never blocks on the disk.` : `Step 4: regular files are always "ready", so each file read still blocks the thread for ${DISK} ms: ${r.blockedOnDisk} ms in all.`,
    `Step 5: the slowest request (${worst.id}) took ${worst.latency} ms; all four were answered by ${r.end} ms.`,
  ];
  const caption = stage !== null ? captions[stage] : `${MODEL_LABEL[model]}: answers in ${r.served.map((s) => `${s.id} ${s.latency} ms`).join(", ")}; ${r.syscalls.toLocaleString("en-US")} syscalls.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Blocking vs non-blocking I/O"
        blurb="A read can wait: for a client to send something, or for a disk. One server thread, four connections whose requests arrive at different times, and four ways to wait: sleep in each read, poll without sleeping, ask the kernel what's ready (epoll), or hand the kernel the reads and collect the results (io_uring)."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Clients send to sockets in the kernel; one server thread reads them and reads files from disk"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "clients", to: "kernel", label: "packets" },
                  { from: "kernel", to: "thread", label: "read()" },
                  { from: "disk", to: "kernel", label: "file data" },
                  { from: "kernel", to: "queue", label: "ready / done", dim: model === "blocking" || model === "polling" },
                  { from: "queue", to: "thread", label: "wake", dim: model === "blocking" || model === "polling" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="What the server thread did, under each model">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">The server thread, 0 to {span} ms</p>
                <div className="mt-2 space-y-1.5">
                  {all.map(({ m, r: x }) => (
                    <div key={m}>
                      <p className="text-[11px]" style={{ color: m === model ? "var(--text)" : "var(--muted)" }}>{MODEL_LABEL[m]}</p>
                      <div className="relative h-4 overflow-hidden rounded-sm border bg-[var(--inset)]" style={{ borderColor: m === model ? ACCENT : "var(--line)" }}>
                        {x.segs.map((s, i) => (
                          <span key={i} className="absolute top-0 h-full border-r border-[var(--panel)]" style={{ left: `${(s.from / span) * 100}%`, width: `${((s.to - s.from) / span) * 100}%`, background: SEG[s.what].color }} title={`${s.from}–${s.to} ms: ${SEG[s.what].label}${s.conn ? ` (${s.conn})` : ""}`} />
                        ))}
                        {CONNS.map((c) => (
                          <span key={c.id} className="absolute top-0 h-full w-px bg-[var(--text)] opacity-40" style={{ left: `${(c.arrive / span) * 100}%` }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                  {(Object.keys(SEG) as Seg["what"][]).map((k) => (
                    <span key={k}>
                      <span className="mr-1 inline-block h-2 w-3 rounded-sm border border-[var(--line)] align-middle" style={{ background: SEG[k].color }} />
                      {SEG[k].label}
                    </span>
                  ))}
                  <span>thin lines: a request arrives</span>
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setModel("blocking")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Block in each read
                </button>
                <button type="button" onClick={() => setModel("uring")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Collect completions
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Reading…">
                Walk the requests
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Ask a socket for data" what="A request arrives as bytes in a socket's buffer inside the kernel. The program gets them with read(). The question is what read() does when nothing has arrived yet." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<Model> accent={ACCENT} value={model} onChange={setModel} options={MODELS.map((id) => ({ id, label: MODEL_LABEL[id] }))} />
                  <p className="font-mono text-xs">Requests arrive: {[...CONNS].sort((a, b) => a.arrive - b.arrive).map((c) => `${c.id} at ${c.arrive} ms`).join(" · ")}. Each needs a {DISK} ms file read and {CPU} ms of work.</p>
                </div>
              </FlowStep>
              <FlowArrow label="nothing there yet" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Nothing there: sleep, or return at once" what="A blocking read() puts the thread to sleep until that socket has data. A non-blocking one (O_NONBLOCK) returns EAGAIN straight away, leaving the thread free to do something else, but it now has to find out later when to try again." accent={ACCENT} active={on(1)}>
                <p className="text-sm">
                  {model === "blocking"
                    ? `The thread blocks on B from 9 to 20 ms, while C has been waiting since 2 ms. C is answered after ${r.served.find((s) => s.id === "C")!.latency} ms.`
                    : model === "polling"
                      ? "Every empty socket answers EAGAIN, so the thread moves on to the next one and serves whichever is ready first."
                      : model === "epoll"
                        ? "The sockets are non-blocking, but the thread never asks an empty one: it waits for the kernel to say which are ready."
                        : "The thread doesn't call read() on sockets at all; it submits the reads and the kernel completes them."}
                </p>
              </FlowStep>
              <FlowArrow label="which one is ready?" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Find out what's ready" what="Readiness: epoll_wait sleeps until any of thousands of sockets can be read, then names them (kqueue on BSD and macOS does the same). Completion: io_uring (or Windows IOCP) does the read itself and tells you it's done. Polling without either burns a core asking." accent={ACCENT} active={on(2)}>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <p><span className="block text-[var(--faint)]">Syscalls</span><span className="font-mono" style={{ color: r.syscalls > 1000 ? "var(--bad)" : "var(--text)" }}>{r.syscalls.toLocaleString("en-US")}</span></p>
                  <p><span className="block text-[var(--faint)]">CPU used</span><span className="font-mono">{r.cpuMs} ms</span></p>
                  <p><span className="block text-[var(--faint)]">Spinning</span><span className="font-mono">{spin} ms</span></p>
                </div>
              </FlowStep>
              <FlowArrow label="then read a file" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Files don't wait the same way" what="A regular file is always “ready” to epoll and ignores O_NONBLOCK, so reading it still blocks the thread until the disk answers. That's why event loops hand file reads to a thread pool (libuv does), or use io_uring, which can do file reads asynchronously too." accent={ACCENT} active={on(3)}>
                <p className="font-mono text-xs" style={{ color: r.blockedOnDisk ? "var(--bad)" : "var(--good)" }}>
                  {r.blockedOnDisk ? `${r.blockedOnDisk} ms of the thread's time blocked on the disk` : "0 ms blocked on the disk: the four file reads overlapped"}
                </p>
              </FlowStep>
              <FlowArrow label="replies" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Compare the four" what="Same requests, same work. Only the way the thread waits changes, and with it who gets stuck behind whom and how much CPU is wasted." accent={ACCENT} active={on(4)}>
                <div className="space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[22rem] text-xs">
                      <thead>
                        <tr className="text-[var(--faint)]">
                          <th className="py-1 pr-2 text-left font-normal">Model</th>
                          {["A", "B", "C", "D"].map((id) => <th key={id} className="py-1 pr-2 text-right font-normal">{id}</th>)}
                          <th className="py-1 pr-2 text-right font-normal">Syscalls</th>
                          <th className="py-1 text-right font-normal">CPU</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {all.map(({ m, r: x }) => (
                          <tr key={m} className="border-t border-[var(--line)]" style={{ color: m === model ? "var(--text)" : "var(--muted)" }}>
                            <td className="py-1 pr-2 font-sans">{MODEL_LABEL[m]}</td>
                            {x.served.map((s) => <td key={s.id} className="py-1 pr-2 text-right" style={{ color: s.latency > 20 ? "var(--bad)" : undefined }}>{s.latency}</td>)}
                            <td className="py-1 pr-2 text-right">{x.syscalls.toLocaleString("en-US")}</td>
                            <td className="py-1 text-right">{x.cpuMs} ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-[var(--muted)]">Milliseconds from each request arriving to its reply. Disk and compute times are illustrative; the order of events and the syscall counts follow from each model.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
