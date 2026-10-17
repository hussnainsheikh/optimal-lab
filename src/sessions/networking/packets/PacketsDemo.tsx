"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState } from "@/components/system/SystemMap";
import { PlaybackControls, Slider, usePlayback } from "@/components/session/ui";
import { ETH_FCS, ETH_HEADER, IP_HEADER, MSS, NODES, PER_PACKET, TCP_HEADER, frames, packetsFor, type Header, type NodeId } from "@/lib/packets";

const ACCENT = "var(--net)";
const COLOR: Record<Header["id"], string> = { eth: "var(--c2)", ip: "var(--c1)", tcp: "var(--c3)", data: "var(--muted)" };

export default function PacketsDemo() {
  const [bytes, setBytes] = useState(500);
  const list = frames(bytes);
  const playback = usePlayback(list.length, 1900);
  const f = list[playback.i];
  const p = packetsFor(bytes);
  const order: NodeId[] = ["laptop", "r1", "r2", "server"];
  const state = (id: NodeId): NodeState => (f.at === id ? "active" : order.indexOf(id) < order.indexOf(f.at) ? "idle" : "dim");
  const sub: Record<NodeId, string> = { laptop: NODES[0].ip, r1: f.at === "r1" ? "TTL 64 → 63" : "router", r2: f.at === "r2" ? "TTL 63 → 62" : "router", server: NODES[3].ip };
  const wire = f.headers.reduce((s, h) => s + h.bytes, 0);

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="Packets and encapsulation"
        blurb="Your data never travels alone. Each layer puts its own header in front, like envelopes inside envelopes. Routers open only the outer two, rewrite the outermost one and send it on. Follow one packet from a laptop to a server."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-4">
              <SystemMap
                chrome="split"
                title="Laptop, two routers and a server"
                accent={ACCENT}
                nodes={NODES.map((n, i) => ({
                  id: n.id,
                  label: n.label,
                  sub: sub[n.id],
                  at: ([[12, 28], [38, 72], [62, 28], [88, 72]] as [number, number][])[i],
                  mobileAt: ([[25, 14], [75, 38], [25, 62], [75, 86]] as [number, number][])[i],
                  state: state(n.id),
                }))}
                links={[
                  { from: "laptop", to: "r1", label: "Ethernet" },
                  { from: "r1", to: "r2", label: "fibre" },
                  { from: "r2", to: "server", label: "fibre" },
                ]}
                packets={f.move ? hops(`p${playback.i}-${bytes}`, f.move, { label: `${wire} B`, step: 0.8 }) : []}
                aspect={2.4}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The packet's headers right now">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">At the {NODES.find((n) => n.id === f.at)!.label.toLowerCase()}</p>
                  <p className="font-mono text-xs text-[var(--muted)]">{wire} bytes</p>
                </div>
                <div className="mt-2 flex h-6 w-full overflow-hidden rounded" aria-hidden>
                  {f.headers.map((h) => (
                    <div key={h.id} className="h-full border-r border-[var(--panel)]" style={{ width: `${(h.bytes / wire) * 100}%`, minWidth: h.id === "data" ? 0 : "1.25rem", background: COLOR[h.id], opacity: h.id === "data" ? 0.35 : 0.9 }} />
                  ))}
                </div>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {f.headers.map((h) => (
                    <li key={h.id} className="min-w-0 rounded-lg border bg-[var(--inset)] p-2" style={{ borderColor: h.changed ? ACCENT : "var(--line)" }}>
                      <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                        <span className="font-semibold" style={{ color: COLOR[h.id] }}>{h.name}</span>
                        <span className="font-mono text-[var(--faint)]">{h.bytes} B{h.changed ? " · rewritten" : ""}</span>
                      </p>
                      <dl className="mt-1 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 font-mono text-[11px]">
                        {h.fields.map(([k, v]) => (
                          <div key={k} className="contents"><dt className="text-[var(--faint)]">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={f.text}>
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next" status={`${playback.i + 1} of ${list.length}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Hand the data to TCP" what="The browser has bytes to send. It doesn't add addresses; it gives them to the operating system." accent={ACCENT} active={f.step === 0}>
                <Slider label="Request size" accent={ACCENT} value={bytes} min={100} max={4000} step={100} format={(v) => `${v} B`} onChange={(v) => { setBytes(v); playback.reset(); }} />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {p.count === 1 ? `Fits in one packet (up to ${MSS} bytes each).` : `Too big for one packet: split into ${p.count} packets of up to ${MSS} bytes.`}
                </p>
              </FlowStep>
              <FlowArrow label={`${p.first} bytes of data`} accent={ACCENT} active={f.step === 1} />
              <FlowStep n={2} title="Add the TCP header" what="20 bytes: source and destination port, plus a sequence number so the receiver can put the bytes back in order." accent={ACCENT} active={f.step === 1}>
                <p className="font-mono text-xs">{TCP_HEADER} + {p.first} = {TCP_HEADER + p.first} B</p>
              </FlowStep>
              <FlowArrow label="a TCP segment" accent={ACCENT} active={f.step === 2} />
              <FlowStep n={3} title="Add the IP header" what="20 bytes: source and destination IP address, and a TTL that each router lowers by one." accent={ACCENT} active={f.step === 2}>
                <p className="font-mono text-xs">{IP_HEADER} + {TCP_HEADER + p.first} = {IP_HEADER + TCP_HEADER + p.first} B (limit 1500)</p>
              </FlowStep>
              <FlowArrow label="an IP packet" accent={ACCENT} active={f.step === 3} />
              <FlowStep n={4} title="Wrap it in an Ethernet frame" what="14 bytes in front with the next box's MAC address, 4 bytes behind to catch damage. Only valid for this one hop." accent={ACCENT} active={f.step === 3}>
                <p className="font-mono text-xs">{ETH_HEADER} + {IP_HEADER + TCP_HEADER + p.first} + {ETH_FCS} = {p.first + PER_PACKET} B on the wire</p>
              </FlowStep>
              <FlowArrow label="a frame, one hop" accent={ACCENT} active={f.step === 4} />
              <FlowStep n={5} title="Re-wrap at every router" what="Each router strips the frame, reads the IP destination, lowers the TTL and builds a new frame. Ports and data are untouched." accent={ACCENT} active={f.step === 4}>
                <p className="text-xs text-[var(--muted)]">MAC addresses change every hop. IP addresses stay the same end to end (unless a NAT router rewrites them).</p>
              </FlowStep>
              <FlowArrow label="the same IP packet, TTL 62" accent={ACCENT} active={f.step === 5} />
              <FlowStep n={6} title="Unwrap at the server" what="The server peels each header off in reverse order and hands only the data to the program on port 443. Its reply is wrapped the same way." accent={ACCENT} active={f.step === 5}>
                <p className="font-mono text-xs">
                  {bytes} B of data · {p.count} packet{p.count > 1 ? "s" : ""} · {p.wire} B on the wire · {(p.overhead * 100).toFixed(1)}% headers
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
