"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { CAPTURE, EXAMPLES, apply, stream, type Pkt } from "@/lib/packetCapture";

const ACCENT = "var(--net)";

type Opts = { filter: string; followStream: number | null; selected: number };
const START: Opts = { filter: "", followStream: null, selected: 8 };

const PROTO_COLOR: Record<Pkt["proto"], string> = { ARP: "var(--c5)", DNS: "var(--c2)", TCP: "var(--c1)", TLS: ACCENT };

export default function PacketCaptureDemo() {
  const [o, setO] = useState<Opts>(START);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const res = apply(o.filter);
  const followed = o.followStream !== null ? new Set(stream(o.followStream).map((p) => p.no)) : null;
  const visible = CAPTURE.filter((p) => (o.filter ? res.matches.has(p.no) : true) && (followed ? followed.has(p.no) : true));
  const sel = CAPTURE.find((p) => p.no === o.selected) ?? CAPTURE[0];
  const encryptedCount = CAPTURE.filter((p) => p.encrypted).length;

  const nodes: MapNode[] = [
    { id: "laptop", label: "Your laptop", sub: "tcpdump / Wireshark", at: [12, 50], mobileAt: [50, 8], state: "active" },
    { id: "nic", label: "Network card", sub: "promiscuous mode", at: [38, 50], mobileAt: [50, 34], state: "active" },
    { id: "gw", label: "Router", sub: "192.168.1.1", at: [64, 22], mobileAt: [22, 66], state: "idle" },
    { id: "server", label: "Server", sub: "203.0.113.42:443", at: [88, 50], mobileAt: [50, 92], state: "active" },
  ];
  const packets: Packet[] =
    stage === 0 ? [...hops("a", ["laptop", "nic", "server"], { label: "every packet" }), ...hops("b", ["server", "nic", "laptop"], { label: "copied", tone: "good", start: 0.6 })]
    : stage === 1 ? hops("f", ["nic", "laptop"], { label: `${visible.length} match`, tone: "accent" })
    : stage === 2 ? hops("s", ["nic", "laptop"], { label: `stream ${sel.stream ?? "—"}`, tone: "good" })
    : stage === 3 ? hops("h", ["laptop", "server"], { label: "SYN / Hello", tone: "good" })
    : stage === 4 ? hops("e", ["laptop", "server"], { label: sel.encrypted ? "ciphertext" : sel.info.slice(0, 14), tone: sel.encrypted ? "bad" : "good" })
    : [];

  const captions = [
    "Step 1: with the card in promiscuous mode, the capture tool copies every frame on the wire, including ones not meant for you on a shared network.",
    o.filter ? (res.error ? `Step 2: the filter won't parse: ${res.error}.` : `Step 2: the filter keeps ${res.matches.size} of ${CAPTURE.length} packets.`) : "Step 2: no filter yet, so all 12 packets show. A display filter narrows it to what you're chasing.",
    `Step 3: packet ${sel.no} is part of ${sel.stream !== null ? `TCP stream ${sel.stream}` : "no TCP stream"}; following it collects the whole conversation.`,
    `Step 4: the start of the connection is all readable: the handshake, and the site name in the Client Hello.`,
    `Step 5: once TLS is up, ${encryptedCount} packets are Application Data — just ciphertext. You see that a request happened and how big it was, not what it said.`,
  ];
  const caption = stage !== null ? captions[stage] : `${visible.length} of ${CAPTURE.length} packets shown. Packet ${sel.no}: ${sel.readable}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="Packet capture with Wireshark"
        blurb="When the request-level tools don't explain it, you look at the actual packets. A capture records every frame; a display filter narrows it; following a stream pulls out one conversation. Filter a short capture, follow the TCP stream, and see exactly where the readable part ends and the ciphertext begins."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A laptop captures every packet on the network between it and a server"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "laptop", to: "nic", label: "capture" },
                  { from: "nic", to: "gw", label: "LAN", dim: true },
                  { from: "nic", to: "server", label: "traffic" },
                ]}
                packets={packets}
                aspect={2}
                mobileAspect={0.8}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The capture">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {visible.length} of {CAPTURE.length} packets{o.followStream !== null ? ` · stream ${o.followStream}` : ""}
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[20rem] text-[11px]">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 pr-2 text-left font-normal">no</th>
                        <th className="py-1 pr-2 text-left font-normal">time</th>
                        <th className="py-1 pr-2 text-left font-normal">proto</th>
                        <th className="py-1 pr-2 text-right font-normal">len</th>
                        <th className="py-1 text-left font-normal">info</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {visible.map((p) => (
                        <tr key={p.no} onClick={() => set({ selected: p.no })} className="cursor-pointer border-t border-[var(--line)]" style={{ background: p.no === o.selected ? "color-mix(in srgb, var(--net) 14%, transparent)" : undefined }}>
                          <td className="py-1 pr-2">{p.no}</td>
                          <td className="py-1 pr-2 text-[var(--muted)]">{p.t.toFixed(3)}</td>
                          <td className="py-1 pr-2" style={{ color: PROTO_COLOR[p.proto] }}>{p.proto}</td>
                          <td className="py-1 pr-2 text-right">{p.len}</td>
                          <td className="py-1" style={{ color: p.encrypted ? "var(--bad)" : undefined }}>{p.info}</td>
                        </tr>
                      ))}
                      {visible.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-3 text-center text-[var(--faint)]">no packets match</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(START)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Clear
                </button>
                <button type="button" onClick={() => set({ filter: "tls", followStream: null })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Show TLS
                </button>
                <button type="button" onClick={() => set({ followStream: o.followStream === 0 ? null : 0, filter: "" })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  {o.followStream === 0 ? "Unfollow" : "Follow stream 0"}
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Reading…">
                Read the capture
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Capture every frame" what="Normally a card ignores frames not addressed to it. Promiscuous mode keeps them all, so the tool records the whole conversation, including retransmits and the other side's packets. tcpdump writes a .pcap; Wireshark reads it live or from the file." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-[11px] text-[var(--muted)]">$ tcpdump -i en0 -w capture.pcap</p>
                <p className="text-xs text-[var(--muted)]">This capture has {CAPTURE.length} packets: an ARP lookup, a DNS query and answer, and one HTTPS connection.</p>
              </FlowStep>
              <FlowArrow label="a display filter" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Filter to what you're chasing" what="A display filter is an expression over packet fields: protocols (tls, dns, arp), ports (tcp.port == 443), flags (tcp.flags.syn == 1), sizes (frame.len > 1000), combined with && and ||. It hides everything else without deleting it." accent={ACCENT} active={at(1)}>
                <label className="block text-sm">
                  <span className="font-medium">Display filter</span>
                  <input type="text" value={o.filter} onChange={(e) => set({ filter: e.target.value, followStream: null })} placeholder="e.g. tcp.port == 443 && tcp.flags.syn == 1" className="mt-1 min-h-11 w-full rounded-md border bg-[var(--inset)] px-3 font-mono text-sm" style={{ borderColor: res.error ? "var(--bad)" : "var(--line)" }} />
                </label>
                {res.error ? <p className="font-mono text-xs text-[var(--bad)]">{res.error}</p> : o.filter && <p className="font-mono text-xs text-[var(--good)]">{res.matches.size} packet{res.matches.size === 1 ? "" : "s"} match</p>}
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((e) => (
                    <button key={e} type="button" onClick={() => set({ filter: e, followStream: null })} className="rounded border border-[var(--line)] px-2 py-1 font-mono text-[11px] text-[var(--muted)]">
                      {e}
                    </button>
                  ))}
                </div>
              </FlowStep>
              <FlowArrow label="one conversation" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Follow the stream" what="One connection's packets are scattered among everyone else's. 'Follow TCP stream' filters to a single connection — matched by the two addresses and ports — so you read it start to finish: SYN, handshake, data, FIN." accent={ACCENT} active={at(2)}>
                <Choices<string> label="Follow" accent={ACCENT} value={o.followStream === null ? "none" : "0"} onChange={(v) => set({ followStream: v === "none" ? null : 0, filter: "" })} options={[{ id: "none", label: "All packets" }, { id: "0", label: "TCP stream 0 (the HTTPS connection)" }]} />
                <p className="font-mono text-xs text-[var(--muted)]">Selected packet {sel.no} is in {sel.stream !== null ? `stream ${sel.stream}` : "no stream"}.</p>
              </FlowStep>
              <FlowArrow label="the readable part" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Read one packet" what="Click a packet to see what it carries. The TCP handshake and the TLS Client Hello are in the clear: ports, sequence numbers, flags, the TLS version, and the site name (SNI). That's enough to see which site, and that a connection was made." accent={ACCENT} active={at(3)}>
                <div className="rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">
                  <div className="text-[var(--faint)]">Packet {sel.no} · {sel.proto} · {sel.len} bytes</div>
                  <div>{sel.src} → {sel.dst}</div>
                  <div>{sel.info}</div>
                  <div className="mt-1" style={{ color: sel.encrypted ? "var(--bad)" : "var(--good)" }}>readable: {sel.readable}</div>
                </div>
              </FlowStep>
              <FlowArrow label="where it goes dark" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="See where the ciphertext starts" what="After the handshake, every packet is 'Application Data': encrypted. The capture proves a request happened, to which server, and how big it was, but not its contents. This is why capturing your own traffic to debug an HTTPS API needs the session keys, not just the packets." accent={ACCENT} active={at(4)}>
                <ul className="space-y-1 text-xs">
                  {stream(0).map((p) => (
                    <li key={p.no} className="flex items-center gap-2">
                      <span className="w-6 font-mono text-[var(--faint)]">#{p.no}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded bg-[var(--inset)]">
                        <span className="block h-full" style={{ width: `${Math.min(100, (p.len / 1500) * 100)}%`, background: p.encrypted ? "var(--bad)" : "var(--good)", opacity: 0.8 }} />
                      </span>
                      <span className="w-32 truncate text-[11px]" style={{ color: p.encrypted ? "var(--bad)" : "var(--muted)" }}>{p.encrypted ? "encrypted" : p.info.split("(")[0].slice(0, 20)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The display filter is a working subset of Wireshark&rsquo;s grammar and runs against the capture here. The packet list is a hand-built example exchange; byte counts and timestamps are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
