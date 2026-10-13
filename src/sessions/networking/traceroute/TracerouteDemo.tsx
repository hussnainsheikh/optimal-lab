"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { frames, HOPS } from "@/lib/traceroute";

const ACCENT = "var(--net)";
const FRAMES = frames();

export default function TracerouteDemo() {
  const playback = usePlayback(FRAMES.length, 1600);
  const f = FRAMES[playback.i];
  return (
    <SessionPage>
      <SessionHeader kicker="Networking · interactive" title="traceroute: mapping the path" blurb="Every IP packet carries a TTL that each router decrements; at zero the packet is dropped and the router usually reports back. traceroute sends packets with TTL 1, 2, 3… so each router on the path reveals itself in turn." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Hops">
              <p className="font-mono text-xs text-[var(--faint)]">$ traceroute example.com</p>
              <ol className="mt-2 space-y-1">
                {HOPS.map((h, i) => {
                  const shown = i <= playback.i, cur = i === f.reached;
                  return (
                    <li key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 rounded px-2 py-1 font-mono text-xs" style={{ background: cur ? "var(--inset)" : undefined, outline: cur ? `1px solid ${ACCENT}` : undefined, opacity: shown ? 1 : 0.25 }}>
                      <span className="text-[var(--faint)]">{i + 1}</span>
                      <span className="truncate">{shown ? (h.name ? `${h.name} (${h.ip})` : "* * *") : "…"}</span>
                      <span className="text-right">{shown && h.rtt ? `${h.rtt} ms` : ""}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-4 flex items-center gap-1 overflow-hidden">
                <span className="text-xs">you</span>
                {HOPS.map((_, i) => <span key={i} className="flex flex-1 items-center gap-1"><span className="h-0.5 flex-1" style={{ background: i <= f.reached ? ACCENT : "var(--line)" }} /><span className="h-3 w-3 shrink-0 rounded-full" style={{ background: i === f.reached ? ACCENT : i < f.reached ? "var(--muted)" : "var(--line)" }} /></span>)}
              </div>
              <p className="mt-2 font-mono text-xs">TTL={f.ttl} → {f.reply}</p>
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next TTL" status={`TTL ${f.ttl}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="TTL stops loops" what="Every router subtracts one. At zero, the packet is dropped, so a routing loop can't circle forever." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Called hop limit in IPv6.</p></FlowStep>
              <FlowArrow label="use it on purpose" accent={ACCENT} />
              <FlowStep n={2} title="Raise TTL one at a time" what="TTL 1 dies at the first router, TTL 2 at the second… Each sends back ICMP Time Exceeded with its address." accent={ACCENT} active={!f.reply.includes("destination")}><p className="text-sm text-[var(--muted)]">Three probes per hop give three timings.</p></FlowStep>
              <FlowArrow label="read the numbers" accent={ACCENT} />
              <FlowStep n={3} title="Read the latency jumps" what="A big jump between two hops is distance (an ocean) or congestion. Stars just mean a router doesn't reply." accent={ACCENT} active={f.ttl >= 4}><p className="text-sm text-[var(--muted)]">Later hops answering normally means stars aren&apos;t a problem.</p></FlowStep>
              <FlowArrow label="tools" accent={ACCENT} />
              <FlowStep n={4} title="mtr for ongoing problems" what="mtr repeats traceroute continuously and shows loss per hop, which is better for intermittent issues." accent={ACCENT} active={playback.atEnd}><p className="font-mono text-xs">mtr -rwc 100 example.com</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
