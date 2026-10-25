"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { FALLBACK_LABEL, FILE_MB, STRATEGY_LABEL, SWITCH_AT, VISIT_LABEL, bytesOf, fallback, firstByte, migrate, quicPacket, tcpSegment, visibleBytes, type Fallback, type Field, type Move, type Strategy, type Visit } from "@/lib/quic";

const ACCENT = "var(--net)";

type View = "tcp" | "quic";
type Opts = { visit: Visit; rtt: number; view: View; move: Move; strategy: Strategy; blocked: boolean; fallback: Fallback };
const H2: Opts = { visit: "first", rtt: 60, view: "tcp", move: "walk", strategy: "restart", blocked: false, fallback: "race" };
const H3: Opts = { visit: "repeat", rtt: 60, view: "quic", move: "walk", strategy: "quic", blocked: false, fallback: "race" };

const STRATS: Strategy[] = ["restart", "range", "quic"];
const LINE: Record<Strategy, string> = { restart: "var(--bad)", range: "var(--c2)", quic: ACCENT };

function Bytes({ fields }: { fields: Field[] }) {
  return (
    <div className="space-y-1">
      {fields.map((f) => (
        <div key={f.name} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-2 text-[11px]">
          <span className="text-[var(--muted)]">{f.name}</span>
          <span className="min-w-0 break-words font-mono" style={{ color: f.visible ? "var(--text)" : "var(--faint)" }}>
            {f.hex.split(" ").length > 12 ? `${f.hex.split(" ").slice(0, 12).join(" ")} … (${f.value})` : f.hex}
            {f.visible && f.hex.split(" ").length <= 12 && <span className="ml-1 font-sans" style={{ color: "var(--good)" }}>= {f.value}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Http3QuicDemo() {
  const [o, setO] = useState<Opts>(H2);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const fb = firstByte(o.visit);
  const fields = o.view === "tcp" ? tcpSegment() : quicPacket(false);
  const moved = quicPacket(true);
  const runs = STRATS.map((s) => ({ s, r: migrate(o.move, s) }));
  const mine = runs.find((x) => x.s === o.strategy)!.r;
  const fall = fallback(o.blocked, o.fallback, o.rtt);
  const tMax = Math.max(...runs.map((x) => x.r.done)) * 1.03;
  const net = o.move === "walk" ? "cell" : "wifi";

  const nodes: MapNode[] = [
    { id: "phone", label: "Phone", sub: (stage ?? 0) >= 2 && o.move === "walk" ? "on 5G now" : "on Wi-Fi", at: [12, 50], mobileAt: [50, 7], state: "active" },
    { id: "wifi", label: "Café Wi-Fi", sub: o.move === "walk" && (stage ?? 0) >= 2 ? "out of range" : "NAT · port 51514", at: [38, 18], mobileAt: [20, 33], state: o.move === "walk" && (stage ?? 0) >= 2 ? "dim" : "active" },
    { id: "cell", label: "5G network", sub: "new address", at: [38, 82], mobileAt: [80, 33], state: o.move === "walk" && (stage ?? 0) >= 2 ? "active" : "idle" },
    { id: "fw", label: "Firewall", sub: o.blocked ? "blocks UDP 443" : `reads ${visibleBytes(fields)} bytes`, at: [63, 50], mobileAt: [50, 62], state: o.blocked && stage === 4 ? "bad" : "active" },
    { id: "server", label: "Server", sub: o.view === "quic" || o.strategy === "quic" ? "HTTP/3" : "HTTP/2", at: [88, 50], mobileAt: [50, 90], state: "active" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("h", ["phone", "wifi", "fw", "server"], { label: fb.setup === 2 ? "SYN" : fb.setup === 1 ? "Initial + ClientHello" : "ClientHello + GET" })
    : stage === 1 ? hops("v", ["phone", "wifi", "fw"], { label: `${visibleBytes(fields)} of ${bytesOf(fields)} bytes readable` })
    : stage === 2 ? hops("m", ["phone", net, "fw", "server"], { label: o.strategy === "quic" ? "same connection, new ID" : "connection reset", tone: o.strategy === "quic" ? "good" : "bad" })
    : stage === 3 ? hops("d", ["server", "fw", net, "phone"], { label: `${FILE_MB} MB in ${mine.done.toFixed(1)} s`, tone: o.strategy === "quic" ? "good" : "accent" })
    : stage === 4 ? (o.blocked ? [...hops("u", ["phone", "wifi", "fw"], { label: "UDP ✕", tone: "bad" }), ...(o.fallback === "quicOnly" ? [] : hops("t", ["phone", "wifi", "fw", "server"], { label: "TCP", start: o.fallback === "race" ? 0 : 0.9 }))] : hops("u", ["phone", "wifi", "fw", "server"], { label: "UDP 443", tone: "good" }))
    : [];

  const captions = [
    `Step 1: ${VISIT_LABEL[o.visit]}: ${fb.proto}, ${fb.total} round trip${fb.total === 1 ? "" : "s"} to the first byte (${fb.total * o.rtt} ms at ${o.rtt} ms).`,
    o.view === "tcp" ? `Step 2: of the ${bytesOf(fields)} bytes of a TCP segment, ${visibleBytes(fields)} are readable on the path: ports, sequence and ack numbers, flags, window. Boxes in the middle can track and even rewrite them.` : `Step 2: of the ${bytesOf(fields)} bytes of a QUIC packet, only ${visibleBytes(fields)} are readable: UDP ports, a flags byte and the connection ID. Everything else, even packet numbers, is encrypted.`,
    o.strategy === "quic" ? `Step 3: the phone's address ${o.move === "walk" ? "changed to 5G" : "port changed at the NAT"}, but QUIC connections are named by connection ID, so the server checks the new path and carries on.` : `Step 3: a TCP connection is named by its two addresses and ports. ${o.move === "walk" ? "The phone's address changed" : "The NAT changed the port"}, so this connection is dead.`,
    `Step 4: ${STRATEGY_LABEL[o.strategy]}: the ${FILE_MB} MB file finishes at ${mine.done.toFixed(1)} s, stalled ${mine.stall.toFixed(2)} s, ${mine.wastedMb.toFixed(1)} MB sent twice.`,
    fall.ms === null ? "Step 5: UDP 443 is blocked and the client only tries QUIC: no connection at all." : `Step 5: ${fall.proto}, first byte after ${fall.ms} ms.`,
  ];
  const caption = stage !== null ? captions[stage] : `${fb.proto}: ${fb.total * o.rtt} ms to the first byte. Moving networks mid-download with ${STRATEGY_LABEL[o.strategy]}: done at ${mine.done.toFixed(1)} s.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="HTTP/3 and QUIC"
        blurb="HTTP/3 runs over QUIC, a transport built on UDP that brings its own encryption, streams and loss recovery. Find out how a browser discovers it, what a firewall on the path can still read, and what happens to a download when your phone walks off the café Wi-Fi."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A phone reaches a server through café Wi-Fi or a 5G network and a firewall"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "phone", to: "wifi", label: "Wi-Fi", dim: o.move === "walk" && (stage ?? 0) >= 2 },
                  { from: "phone", to: "cell", label: "5G", dim: !(o.move === "walk" && (stage ?? 0) >= 2) },
                  { from: "wifi", to: "fw", label: "internet" },
                  { from: "cell", to: "fw", label: "internet" },
                  { from: "fw", to: "server", label: o.blocked ? "TCP only" : "UDP + TCP" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.8}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Download progress after switching networks">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{FILE_MB} MB download, network change at {SWITCH_AT} s</p>
                <svg viewBox="0 0 280 110" className="mt-2 w-full" role="img" aria-label={`Megabytes received over time for three strategies; ${STRATEGY_LABEL[o.strategy]} finishes at ${mine.done.toFixed(1)} s`}>
                  <line x1={(SWITCH_AT / tMax) * 280} x2={(SWITCH_AT / tMax) * 280} y1={0} y2={96} stroke="var(--line-strong)" strokeDasharray="3 3" />
                  {runs.map(({ s, r }) => (
                    <polyline key={s} points={r.points.map(([t, mb]) => `${((t / tMax) * 280).toFixed(1)},${(96 - (mb / FILE_MB) * 90).toFixed(1)}`).join(" ")} fill="none" stroke={LINE[s]} strokeWidth={s === o.strategy ? 2.2 : 1} opacity={s === o.strategy ? 1 : 0.55} />
                  ))}
                  <text x={0} y={108} fontSize={8} fill="var(--faint)">0 s</text>
                  <text x={280} y={108} fontSize={8} fill="var(--faint)" textAnchor="end">{tMax.toFixed(0)} s</text>
                </svg>
                <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-[var(--muted)]">
                  {STRATS.map((s) => (
                    <span key={s}>
                      <span style={{ color: LINE[s] }}>━</span> {STRATEGY_LABEL[s]}
                    </span>
                  ))}
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(H2)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  HTTP/2 over TCP
                </button>
                <button type="button" onClick={() => setO(H3)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  HTTP/3 over QUIC
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Connecting…">
                Connect and download
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Find out the server speaks HTTP/3" what="A browser can't assume UDP works, so the first visit usually goes over TCP and the response advertises HTTP/3 in an Alt-Svc header. An HTTPS record in DNS can advertise it before the first connection." accent={ACCENT} active={at(0)}>
                <Choices<Visit> accent={ACCENT} value={o.visit} onChange={(v) => set({ visit: v })} options={(Object.keys(VISIT_LABEL) as Visit[]).map((id) => ({ id, label: VISIT_LABEL[id] }))} />
                <Slider label="Round trip" value={o.rtt} min={10} max={250} step={10} format={(v) => `${v} ms`} onChange={(v) => set({ rtt: v })} accent={ACCENT} />
                <p className="text-xs text-[var(--muted)]">{fb.how}</p>
                <p className="font-mono text-xs">
                  {fb.setup} setup + 1 request = {fb.total} round trip{fb.total === 1 ? "" : "s"} = {fb.total * o.rtt} ms
                </p>
              </FlowStep>
              <FlowArrow label="packets on the wire" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="See what the network can read" what="TLS over TCP encrypts the data but not the TCP header, so firewalls and carrier boxes have long read and even rewritten it, which made TCP almost impossible to change. QUIC encrypts nearly everything, including packet numbers and acknowledgements." accent={ACCENT} active={at(1)}>
                <Choices<View> accent={ACCENT} value={o.view} onChange={(v) => set({ view: v })} options={[{ id: "tcp", label: "TCP + TLS segment" }, { id: "quic", label: "QUIC packet" }]} />
                <Bytes fields={fields} />
                <p className="font-mono text-xs">{visibleBytes(fields)} of {bytesOf(fields)} bytes readable (plus the IP header)</p>
              </FlowStep>
              <FlowArrow label="the phone changes network" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Change networks" what="TCP names a connection by four numbers: both addresses and both ports. Change any of them and it's a stranger. QUIC names it by a connection ID, so the server can accept packets from a new address, check the path with a challenge, and carry on. The client switches to a fresh ID so nobody watching can link the two paths." accent={ACCENT} active={at(2)}>
                <Choices<Move> accent={ACCENT} value={o.move} onChange={(v) => set({ move: v })} options={[{ id: "walk", label: "Walk out of Wi-Fi onto 5G" }, { id: "nat", label: "The NAT changes your port" }]} />
                <p className="text-xs text-[var(--muted)]">The QUIC packet after the move:</p>
                <Bytes fields={moved.filter((f) => f.visible)} />
              </FlowStep>
              <FlowArrow label="the rest of the file" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Finish the download" what="After the move, TCP needs a new connection and handshakes. The app then either starts over or, if it and the server support it, asks for the remaining bytes with a Range header. QUIC keeps the same connection and streams, and only the congestion window starts again on a new path." accent={ACCENT} active={at(3)}>
                <Choices<Strategy> accent={ACCENT} value={o.strategy} onChange={(v) => set({ strategy: v })} options={STRATS.map((id) => ({ id, label: STRATEGY_LABEL[id] }))} />
                <ol className="list-decimal space-y-0.5 pl-4 text-xs text-[var(--muted)]">
                  {mine.events.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ol>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[16rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">strategy</th>
                        <th className="py-1 text-right font-normal">stalled</th>
                        <th className="py-1 text-right font-normal">sent twice</th>
                        <th className="py-1 text-right font-normal">done</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {runs.map(({ s, r }) => (
                        <tr key={s} className="border-t border-[var(--line)]" style={{ fontWeight: s === o.strategy ? 600 : 400 }}>
                          <td className="py-1 font-sans text-[var(--muted)]">{STRATEGY_LABEL[s]}</td>
                          <td className="py-1 text-right">{r.stall.toFixed(2)} s</td>
                          <td className="py-1 text-right" style={{ color: r.wastedMb > 1 ? "var(--bad)" : undefined }}>{r.wastedMb.toFixed(1)} MB</td>
                          <td className="py-1 text-right">{r.done.toFixed(1)} s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FlowStep>
              <FlowArrow label="next network: UDP blocked?" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Fall back when UDP is blocked" what="Some company and hotel networks block UDP on port 443. Browsers start QUIC and TCP side by side and use whichever connects, then remember that QUIC is broken on this network. A client that waits for QUIC to time out pays for it on every connection." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.blocked} onChange={(e) => set({ blocked: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The firewall blocks UDP 443
                </label>
                <Choices<Fallback> accent={ACCENT} value={o.fallback} onChange={(v) => set({ fallback: v })} options={(Object.keys(FALLBACK_LABEL) as Fallback[]).map((id) => ({ id, label: FALLBACK_LABEL[id] }))} />
                <p className="font-mono text-xs" style={{ color: fall.ms === null ? "var(--bad)" : fall.ms > 1000 ? "var(--bad)" : "var(--good)" }}>
                  {fall.ms === null ? "✕ no connection" : `${fall.proto}: first byte after ${fall.ms} ms`}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The header bytes follow RFC 9293 (TCP) and RFC 9000 (QUIC). Path speeds (50 Mbps Wi-Fi, 30 Mbps 5G), the 1 s fallback timeout and slow start from a 10-packet window are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
