"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DISTANCES, SETUPS, roundTrips, timeToFirstByte } from "@/lib/handshake";

const ACCENT = "var(--net)";
const PHASE_COLOR = { tcp: "var(--c3)", tls: "var(--c5)", http: "var(--net)" } as const;
const PHASE_NAME = { tcp: "TCP", tls: "TLS", http: "HTTP" } as const;

export default function HandshakeDemo() {
  const [setupId, setSetupId] = useState("tls12");
  const [distId, setDistId] = useState("country");
  const setup = SETUPS.find((s) => s.id === setupId)!;
  const dist = DISTANCES.find((d) => d.id === distId)!;
  const playback = usePlayback(setup.msgs.length, 900);
  const shown = playback.i + 1;
  const elapsed = (shown * dist.rtt) / 2;
  const msg = setup.msgs[playback.i];
  const rows = setup.msgs.length;
  const ROW = 13;
  const H = 14 + rows * ROW;

  const caption = `${msg.from === "client" ? "Browser → server" : "Server → browser"}: ${msg.label}. ${elapsed} ms so far${playback.atEnd ? `: the page starts arriving after ${roundTrips(setup)} round trips.` : "."}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="The TCP and TLS handshakes"
        blurb="Before a single byte of the page arrives, the browser and the server trade several messages, and each one has to cross the distance between them. Count the round trips, then move the server further away."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Messages between the browser and the server">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{setup.label}</p>
                <p className="font-mono text-xs text-[var(--muted)]">
                  round trip {dist.rtt} ms · {elapsed} ms elapsed
                </p>
              </div>
              <svg viewBox={`0 0 100 ${H}`} className="mt-3 h-auto w-full" role="img" aria-label={caption}>
                <text x={14} y={6} fontSize={3.2} textAnchor="middle" style={{ fill: "var(--muted)" }}>Browser</text>
                <text x={86} y={6} fontSize={3.2} textAnchor="middle" style={{ fill: "var(--muted)" }}>Server</text>
                <line x1={14} y1={8} x2={14} y2={H} strokeWidth={0.5} style={{ stroke: "var(--line-strong)" }} />
                <line x1={86} y1={8} x2={86} y2={H} strokeWidth={0.5} style={{ stroke: "var(--line-strong)" }} />
                {setup.msgs.map((m, i) => {
                  if (i >= shown) return null;
                  const top = 9 + i * ROW;
                  const y1 = top + 3.5; // arrow start
                  const y2 = top + 12; // arrow end, half a round trip later
                  const [x1, x2] = m.from === "client" ? [14, 86] : [86, 14];
                  const color = PHASE_COLOR[m.phase];
                  const head = m.from === "client" ? `${x2 - 2},${y2 - 1.6} ${x2},${y2} ${x2 - 2.6},${y2 + 0.4}` : `${x2 + 2},${y2 - 1.6} ${x2},${y2} ${x2 + 2.6},${y2 + 0.4}`;
                  return (
                    <g key={i} style={{ opacity: i === playback.i ? 1 : 0.65 }}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={0.7} style={{ stroke: color }} />
                      <polyline points={head} fill="none" strokeWidth={0.7} style={{ stroke: color }} />
                      <text x={50} y={top + 3} fontSize={3} textAnchor="middle" style={{ fill: "var(--text)" }}>{m.label}</text>
                      <text x={m.from === "client" ? 12 : 88} y={y1 + 1} fontSize={2.6} textAnchor={m.from === "client" ? "end" : "start"} style={{ fill: "var(--faint)" }}>{(i * dist.rtt) / 2}ms</text>
                    </g>
                  );
                })}
              </svg>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                {(["tcp", "tls", "http"] as const).map((p) => (
                  <span key={p} className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-4" style={{ background: PHASE_COLOR[p] }} /> {PHASE_NAME[p]}
                  </span>
                ))}
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Protocol" accent={ACCENT} value={setupId} onChange={(v) => { setSetupId(v); playback.reset(); }} options={SETUPS.map((s) => ({ id: s.id, label: s.label }))} />
              <Choices label="How far away is the server?" accent={ACCENT} value={distId} onChange={setDistId} options={DISTANCES.map((d) => ({ id: d.id, label: `${d.label} (${d.rtt} ms)` }))} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next message" status={`${shown} of ${rows} messages`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Open a TCP connection" what="SYN, SYN-ACK, ACK: both sides agree to talk and pick starting sequence numbers. One full round trip before anything else." accent={ACCENT} active={msg.phase === "tcp"}>
                <p className="text-sm text-[var(--muted)]">{setup.msgs.some((m) => m.phase === "tcp") ? "1 round trip." : "Skipped: QUIC has no separate TCP handshake."}</p>
              </FlowStep>
              <FlowArrow label="a connection" accent={ACCENT} />

              <FlowStep n={2} title="Agree on encryption keys (TLS)" what="The server proves who it is with its certificate, and both sides derive the same keys. TLS 1.2 needs two round trips; TLS 1.3 needs one." accent={ACCENT} active={msg.phase === "tls"}>
                <p className="text-sm text-[var(--muted)]">{setup.note}</p>
              </FlowStep>
              <FlowArrow label="an encrypted channel" accent={ACCENT} />

              <FlowStep n={3} title="Send the request, get the page" what="Only now does GET / go out. One more round trip until the first byte of the page comes back." accent={ACCENT} active={msg.phase === "http"}>
                <p className="font-mono text-sm">{setup.msgs.filter((m) => m.phase === "http").map((m) => m.label).join(" → ")}</p>
              </FlowStep>
              <FlowArrow label="time to first byte" accent={ACCENT} />

              <FlowStep n={4} title="Round trips × distance" what="Bandwidth doesn't help here: each step waits for the reply. Fewer round trips, or a server closer to the user (a CDN), is what makes this faster." accent={ACCENT} active={playback.atEnd}>
                <ul className="space-y-1 text-sm">
                  {SETUPS.map((s) => (
                    <li key={s.id} className="flex justify-between gap-3" style={{ color: s.id === setupId ? "var(--text)" : "var(--muted)" }}>
                      <span>{s.label}</span>
                      <span className="font-mono">
                        {roundTrips(s)} RTT · {timeToFirstByte(s, dist.rtt)} ms
                      </span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
