"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { at, HOPS, MODES, TIMES, TOKENS, type Mode } from "@/lib/streamHops";

const ACCENT = "var(--sys)";

export default function StreamHopsDemo() {
  const [mode, setMode] = useState<Mode>("proxy-buffers");
  const playback = usePlayback(TIMES.length, 600);
  const t = TIMES[playback.i];
  const s = at(mode, t);
  const caption = mode === "none" ? `The server waits for the whole answer, so the user stares at a spinner for ${s.firstSeen} s.`
    : mode === "proxy-buffers" ? `The API streams, but the proxy collects the whole response before passing it on. The user still waits ${s.firstSeen} s.`
    : `Every hop forwards each chunk as it arrives. First words appear after ${s.firstSeen} s.`;
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Streaming responses" blurb="A model answer takes several seconds to generate. Streaming only helps if every hop between the model and the browser passes chunks on immediately. One buffering proxy undoes it all." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Tokens at each hop">
              <p className="font-mono text-xs text-[var(--faint)]">t = {t.toFixed(1)} s</p>
              <ol className="mt-2 grid gap-2 sm:grid-cols-4">
                {HOPS.map((h, i) => (
                  <li key={h} className="rounded-lg border p-2.5" style={{ borderColor: mode === "proxy-buffers" && i === 2 ? "var(--bad)" : "var(--line)", background: "var(--inset)" }}>
                    <p className="text-sm font-medium">{h}</p>
                    <span className="mt-2 block h-2 rounded bg-[var(--track)]"><span className="block h-full rounded" style={{ width: `${(s.counts[i] / TOKENS.length) * 100}%`, background: ACCENT }} /></span>
                    <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">{s.counts[i]}/{TOKENS.length} tokens</p>
                  </li>
                ))}
              </ol>
              <div className="mt-3 min-h-20 rounded-lg border border-[var(--line)] p-3 text-sm">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">User&apos;s screen</p>
                <p className="mt-1">{s.text || <span className="text-[var(--faint)]">…</span>}</p>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Setup" accent={ACCENT} value={mode} onChange={setMode} options={MODES} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next 0.5 s" status={`${t.toFixed(1)} s`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="The model emits tokens one by one" what="The first token arrives in well under a second; the full answer takes many seconds." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Ask the provider API for stream: true.</p></FlowStep>
              <FlowArrow label="forward each chunk" accent={ACCENT} />
              <FlowStep n={2} title="Your server forwards, not collects" what="Send chunks to the client as they arrive, over Server-Sent Events or a chunked HTTP response." accent={ACCENT} active={mode === "none"}><p className="font-mono text-xs">Content-Type: text/event-stream</p></FlowStep>
              <FlowArrow label="through every hop" accent={ACCENT} />
              <FlowStep n={3} title="Turn off buffering in proxies" what="Nginx, some load balancers, CDNs and compression middleware wait for the whole body by default. Disable it for streaming routes." accent={ACCENT} active={mode === "proxy-buffers"}><p className="font-mono text-xs">X-Accel-Buffering: no</p></FlowStep>
              <FlowArrow label="and clean up" accent={ACCENT} />
              <FlowStep n={4} title="Handle disconnects and timeouts" what="If the user leaves, cancel the model call so you stop paying for it. Raise idle timeouts or send heartbeats on long streams." accent={ACCENT} active={mode === "end-to-end"}><p className="text-sm text-[var(--muted)]">Long-lived connections need different limits.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
