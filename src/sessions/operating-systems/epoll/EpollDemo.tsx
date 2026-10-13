"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { MODELS, run, type Model } from "@/lib/epoll";

const ACCENT = "var(--os)";
const SPAN = 140;

export default function EpollDemo() {
  const [m, setM] = useState<Model>("blocking");
  const r = run(m);
  const caption = m === "blocking" ? `The thread blocks reading connection 1, which sends nothing until 60 ms. Connections 2, 3 and 5 sit waiting with data ready: up to ${r.maxWait} ms.`
    : m === "threads" ? "Each connection gets its own thread, so nobody waits. But 10,000 connections means 10,000 threads, ~80 GB of stacks and constant context switching."
    : "One thread asks the kernel “which of these sockets are ready?” and only reads those. No waiting, one thread, thousands of connections.";
  return (
    <SessionPage>
      <SessionHeader kicker="Operating systems · interactive" title="Blocking I/O vs epoll" blurb="A server has five open connections. Each client sends its request at a different moment. How quickly each gets served depends on how the server waits for data." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Connections over time">
              <ul className="space-y-1.5">
                {r.rows.map((x) => (
                  <li key={x.conn} className="grid grid-cols-[3.5rem_minmax(0,1fr)_4rem] items-center gap-2 text-xs">
                    <span className="font-mono">conn {x.conn}</span>
                    <span className="relative h-4 rounded bg-[var(--track)]">
                      <span className="absolute inset-y-0 rounded" style={{ left: `${(x.arrive / SPAN) * 100}%`, width: `${Math.max(1, (x.wait / SPAN) * 100)}%`, background: x.wait > 5 ? "var(--bad)" : "var(--good)" }} />
                      <span className="absolute inset-y-0 w-0.5 bg-[var(--text)]" style={{ left: `${(x.arrive / SPAN) * 100}%` }} />
                    </span>
                    <span className="text-right font-mono" style={{ color: x.wait > 5 ? "var(--bad)" : undefined }}>{x.wait} ms</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-[var(--muted)]">Line: request arrives. Bar: time until the server handles it.</p>
              <p className="mt-3 font-mono text-sm">{r.threads} thread{r.threads > 1 ? "s" : ""} · ~{r.memoryMb} MB of stacks</p>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Choices label="Server model" accent={ACCENT} value={m} onChange={setM} options={MODELS} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="A blocking read waits" what="read() on a socket with no data puts the thread to sleep until data arrives. Fine for one connection." accent={ACCENT} active={m === "blocking"}><p className="text-sm text-[var(--muted)]">One slow client stalls everyone.</p></FlowStep>
              <FlowArrow label="more threads" accent={ACCENT} />
              <FlowStep n={2} title="Thread per connection" what="Simple code, and it works for hundreds. Each thread costs memory and scheduling, so it falls over at tens of thousands." accent={ACCENT} active={m === "threads"}><p className="text-sm text-[var(--muted)]">The C10K problem.</p></FlowStep>
              <FlowArrow label="ask what's ready" accent={ACCENT} />
              <FlowStep n={3} title="epoll / kqueue" what="Register sockets once, then epoll_wait returns only those with data. Non-blocking reads never stall." accent={ACCENT} active={m === "epoll"}><p className="font-mono text-xs">epoll_wait(fd, events, 64, -1)</p></FlowStep>
              <FlowArrow label="you already use it" accent={ACCENT} />
              <FlowStep n={4} title="The event loop is built on this" what="Node.js (libuv), Nginx, Redis and Go's netpoller all sit on epoll. Keep each handler short, or the one thread blocks everyone again." accent={ACCENT}><p className="text-sm text-[var(--muted)]">io_uring is the newer Linux interface.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
