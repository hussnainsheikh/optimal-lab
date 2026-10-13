"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { MSGS, run, TRANSPORTS, type T } from "@/lib/realtimeTransports";

const ACCENT = "var(--sys)";

export default function RealtimeDemo() {
  const [t, setT] = useState<T>("poll");
  const r = run(t);
  const avg = r.delays.reduce((a, b) => a + b, 0) / r.delays.length;
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Real-time: polling, SSE and WebSockets" blurb={`Four chat messages arrive on the server at ${MSGS.join(", ")} seconds. How quickly does each reach the browser, and how many requests does that cost over a minute?`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Timeline">
              <div className="relative h-16 rounded bg-[var(--inset)]">
                {t === "poll" && [10, 20, 30, 40, 50, 60].map((s) => <span key={s} className="absolute inset-y-0 w-px" style={{ left: `${(s / 60) * 100}%`, background: "var(--muted)" }} />)}
                {MSGS.map((m, i) => (
                  <span key={i}>
                    <span className="absolute top-2 h-3 w-3 -translate-x-1/2 rounded-full" style={{ left: `${(m / 60) * 100}%`, background: "var(--auto)" }} />
                    <span className="absolute bottom-2 h-3 -translate-x-0 rounded" style={{ left: `${(m / 60) * 100}%`, width: `${Math.max(0.8, (r.delays[i] / 60) * 100)}%`, background: ACCENT }} />
                  </span>
                ))}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>0 s</span><span>60 s</span></div>
              <p className="mt-1 text-xs text-[var(--muted)]">Amber: message arrives at the server. Bar: wait until the browser has it.{t === "poll" ? " Lines: polls." : ""}</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[["Avg delay", `${avg.toFixed(avg < 1 ? 2 : 1)} s`], ["Requests/min", String(r.requests)], ["Connection", r.connections], ["Direction", r.twoWay]].map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="text-sm">{v}</dd></div>)}
              </dl>
            </section>
          }
          panel={<SystemMapPanel caption={r.note}><Choices label="Transport" accent={ACCENT} value={t} onChange={setT} options={TRANSPORTS} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Polling: ask on a timer" what="Easy, but there's a trade-off between delay and wasted requests." accent={ACCENT} active={t === "poll"}><p className="text-sm text-[var(--muted)]">Fine for things that change every few minutes.</p></FlowStep>
              <FlowArrow label="hold it open" accent={ACCENT} />
              <FlowStep n={2} title="Long polling" what="The server waits to answer until there's news, then the client asks again." accent={ACCENT} active={t === "long"}><p className="text-sm text-[var(--muted)]">Works through every proxy.</p></FlowStep>
              <FlowArrow label="stream" accent={ACCENT} />
              <FlowStep n={3} title="SSE for one-way, WebSockets for two-way" what="SSE is plain HTTP with built-in reconnects. WebSockets allow either side to send at any time." accent={ACCENT} active={t === "sse" || t === "ws"}><p className="text-sm text-[var(--muted)]">Both hold a connection per user.</p></FlowStep>
              <FlowArrow label="at scale" accent={ACCENT} />
              <FlowStep n={4} title="Fan-out and presence" what="Servers subscribe to a pub/sub channel (Redis, NATS) so a message reaches users connected to other servers. Heartbeats track who's online." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Pusher, Ably, Socket.IO.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
