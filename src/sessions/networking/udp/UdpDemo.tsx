"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, type Packet } from "@/components/system/SystemMap";
import { Choices, PlaybackControls, Slider, usePlayback } from "@/components/session/ui";
import { COUNT, DST_PORT, HEADER_BYTES, INTERVAL, ONE_WAY, PAYLOAD_BYTES, header, run } from "@/lib/udp";

const ACCENT = "var(--net)";

export default function UdpDemo() {
  const [loss, setLoss] = useState(20);
  const [reorder, setReorder] = useState<"off" | "on">("on");
  const list = run(loss, reorder === "on");
  const playback = usePlayback(COUNT, 1100);
  const d = list[playback.i];
  const seen = list.slice(0, playback.i + 1);
  const used = seen.filter((x) => x.fate === "used").length;
  const lost = seen.filter((x) => x.fate === "lost").length;
  const stale = seen.filter((x) => x.fate === "stale").length;
  const active = playback.atEnd ? 3 : d.fate !== "used" ? 2 : playback.i === 0 ? 0 : 1;

  const packets: Packet[] =
    d.fate === "lost"
      ? [{ id: `u${playback.i}-${loss}-${reorder}`, from: "client", to: "net", label: `#${d.n}`, tone: "bad", duration: 0.5 }]
      : [
          { id: `u${playback.i}-${loss}-${reorder}-a`, from: "client", to: "net", label: `#${d.n}`, duration: 0.45 },
          { id: `u${playback.i}-${loss}-${reorder}-b`, from: "net", to: "server", label: `#${d.n}`, delay: d.arrive! - d.sent > ONE_WAY ? 0.9 : 0.45, duration: 0.45, tone: d.fate === "stale" ? "bad" : "good" },
        ];

  const caption =
    d.fate === "lost"
      ? `Update #${d.n} (sent at ${d.sent} ms) is lost. Nobody notices and nobody resends it. The next update is already on its way.`
      : d.fate === "stale"
        ? `Update #${d.n} was delayed and arrives at ${d.arrive} ms, after a newer one. The game throws it away: old positions are useless.`
        : `Update #${d.n} leaves at ${d.sent} ms and arrives at ${d.arrive} ms. No setup, no reply.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="UDP"
        blurb="UDP adds just 8 bytes to your data and sends it. No handshake first, no acknowledgement, no resending, no ordering. That sounds worse than TCP, but for a game sending its position 20 times a second it's exactly right: a late update is worse than a missing one."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-4">
              <SystemMap
                chrome="split"
                title="A game client sending updates to a game server"
                accent={ACCENT}
                nodes={[
                  { id: "client", label: "Game client", sub: `#${d.n} at ${d.sent} ms`, at: [14, 50], mobileAt: [50, 14], state: "active" },
                  { id: "net", label: "Internet", sub: `${loss}% loss`, at: [50, 50], mobileAt: [50, 50], state: d.fate === "lost" ? "bad" : "idle" },
                  { id: "server", label: "Game server", sub: `port ${DST_PORT}`, at: [86, 50], mobileAt: [50, 86], state: d.fate === "used" ? "good" : d.fate === "stale" ? "bad" : "wait" },
                ]}
                links={[
                  { from: "client", to: "net", label: "UDP" },
                  { from: "net", to: "server", label: "UDP", dim: d.fate === "lost" },
                ]}
                packets={packets}
                aspect={2.8}
                mobileAspect={1.1}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="What the server received">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Server side</p>
                  <p className="font-mono text-xs text-[var(--muted)]">used {used} · lost {lost} · stale {stale}</p>
                </div>
                <ol className="mt-2 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
                  {list.map((x, i) => {
                    const show = i <= playback.i;
                    const color = !show ? "var(--line)" : x.fate === "used" ? "var(--good)" : "var(--bad)";
                    return (
                      <li key={x.n} className="rounded border px-1 py-1 text-center font-mono text-[10px]" style={{ borderColor: color, color: show ? color : "var(--faint)", outline: i === playback.i ? `1px solid ${ACCENT}` : undefined }}>
                        #{x.n}
                        <span className="block">{!show ? "·" : x.fate === "lost" ? "✗" : x.fate === "stale" ? "old" : `${x.arrive}`}</span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next update" status={`update ${d.n} of ${COUNT}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Put an 8-byte header in front" what="Two ports, a length and a checksum. That's all UDP adds. TCP's header is at least 20 bytes." accent={ACCENT} active={active === 0}>
                <dl className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-[11px]">
                  {header().map((h) => (
                    <div key={h.name} className="contents"><dt className="text-[var(--faint)]">{h.name}</dt><dd>{h.value}</dd><dd className="text-[var(--muted)]">{h.hex}</dd></div>
                  ))}
                </dl>
                <p className="mt-2 text-xs text-[var(--muted)]">{HEADER_BYTES} + {PAYLOAD_BYTES} bytes of position data = {HEADER_BYTES + PAYLOAD_BYTES} bytes.</p>
              </FlowStep>
              <FlowArrow label="a datagram" accent={ACCENT} active={active === 1} />
              <FlowStep n={2} title="Send it with no handshake" what={`No setup round trip: the first update leaves at 0 ms. One every ${INTERVAL} ms, whether or not the last one arrived.`} accent={ACCENT} active={active === 1}>
                <p className="font-mono text-xs">{d.arrive !== null ? `#${d.n}: sent ${d.sent} ms → arrives ${d.arrive} ms` : `#${d.n}: sent ${d.sent} ms → never arrives`}</p>
              </FlowStep>
              <FlowArrow label="best effort" accent={ACCENT} active={active === 2} />
              <FlowStep n={3} title="Lose or reorder some on the way" what="The network gives no promises. UDP doesn't notice a loss and doesn't fix the order." accent={ACCENT} active={active === 2}>
                <Slider label="Packet loss" accent={ACCENT} value={loss} min={0} max={50} step={10} format={(v) => `${v}%`} onChange={(v) => { setLoss(v); playback.reset(); }} />
                <Choices label="Delay update #6 by 60 ms" accent={ACCENT} value={reorder} onChange={(v) => { setReorder(v); playback.reset(); }} options={[{ id: "off", label: "No" }, { id: "on", label: "Yes" }]} />
              </FlowStep>
              <FlowArrow label="whatever arrived" accent={ACCENT} active={active === 3} />
              <FlowStep n={4} title="Let the app decide" what="Anything reliable is the app's job. A game uses the newest position and skips the rest. DNS asks again after a timeout. A video call hides the gap." accent={ACCENT} active={active === 3}>
                <p className="text-xs text-[var(--muted)]">TCP would hold every later update until the lost one was resent, about a round trip later. By then the position is stale anyway.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
