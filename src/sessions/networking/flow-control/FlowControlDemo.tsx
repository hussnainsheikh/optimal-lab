"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { BUF, BUSY, run } from "@/lib/flowControl";

const ACCENT = "var(--net)";

export default function FlowControlDemo() {
  const [rate, setRate] = useState(2);
  const r = run(rate);
  return (
    <SessionPage>
      <SessionHeader kicker="Networking · interactive" title="TCP flow control" blurb={`The receiver has room for ${BUF} segments. With every acknowledgement it tells the sender how much room is left (the receive window), and the sender never sends more than that. Here the receiving app gets busy for a few ticks.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Receive buffer over time">
              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_3.5rem_3rem] gap-x-2 gap-y-1 font-mono text-[11px]">
                <span className="text-[var(--faint)]">tick</span><span className="text-[var(--faint)]">receiver buffer</span><span className="text-[var(--faint)]">window</span><span className="text-right text-[var(--faint)]">sent</span>
                {r.ticks.map((t) => (
                  <span key={t.t} className="contents">
                    <span>{t.t}{t.busy ? <span className="text-[var(--auto)]"> busy</span> : null}</span>
                    <span className="flex gap-0.5">{Array.from({ length: BUF }, (_, i) => <span key={i} className="h-3.5 flex-1 rounded-sm" style={{ background: i < t.buffered ? (t.buffered === BUF ? "var(--bad)" : ACCENT) : "var(--track)" }} />)}</span>
                    <span style={{ color: t.advertised === 0 ? "var(--bad)" : undefined }}>{t.advertised}</span>
                    <span className="text-right">{t.send}</span>
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">“busy”: the app is busy (ticks {BUSY[0]}–{BUSY[1]}), reads nothing. The sender would like to send 4 a tick.</p>
              <p className="mt-1 font-mono text-sm">{r.zeroWindows} ticks with a zero window · {r.sent} sent · nothing dropped</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={r.zeroWindows ? `While the app is busy the buffer fills and the window shrinks to 0. The sender stops completely instead of overflowing the receiver, then resumes when the app reads.` : "The app reads fast enough that the buffer never fills."}>
              <Slider label="App reads per tick" accent={ACCENT} value={rate} min={1} max={4} step={1} format={(v) => `${v} segments`} onChange={setRate} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="The receiver has a buffer" what="Data waits there until the application reads it. A slow app means a filling buffer." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Kernel buffers are typically KB to MB.</p></FlowStep>
              <FlowArrow label="advertise the space" accent={ACCENT} />
              <FlowStep n={2} title="Every ACK carries the window" what="“I have room for N more bytes.” The sender keeps unacknowledged data within that." accent={ACCENT}><p className="font-mono text-xs">TCP header: window size</p></FlowStep>
              <FlowArrow label="full" accent={ACCENT} />
              <FlowStep n={3} title="Zero window: stop" what="The sender pauses and occasionally probes until the receiver opens the window again. Nothing is lost." accent={ACCENT} active={r.zeroWindows > 0}><p className="text-sm text-[var(--muted)]">This is backpressure at the transport level.</p></FlowStep>
              <FlowArrow label="not to be confused with" accent={ACCENT} />
              <FlowStep n={4} title="Flow control vs congestion control" what="Flow control protects the receiver; congestion control protects the network. The sender obeys whichever limit is smaller." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Window scaling allows windows above 64 KB.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
