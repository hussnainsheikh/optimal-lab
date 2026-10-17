"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, type NodeState, type Packet } from "@/components/system/SystemMap";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { BROADCAST, HOSTS, TARGETS, frames, type HostId, type TargetId } from "@/lib/macArp";

const ACCENT = "var(--net)";
const AT: Record<HostId | "switch", { at: [number, number]; mobileAt: [number, number] }> = {
  laptop: { at: [13, 22], mobileAt: [24, 12] },
  printer: { at: [87, 22], mobileAt: [76, 12] },
  phone: { at: [13, 78], mobileAt: [24, 88] },
  router: { at: [87, 78], mobileAt: [76, 88] },
  switch: { at: [50, 50], mobileAt: [50, 50] },
};

export default function MacArpDemo() {
  const [target, setTarget] = useState<TargetId>("printer");
  const [cache, setCache] = useState<"cold" | "warm">("cold");
  const list = frames(target, cache === "warm");
  const playback = usePlayback(list.length, 2000);
  const f = list[playback.i];
  const step = f.step;

  const packets: Packet[] = f.moves.flatMap((group, g) =>
    group.map((m, k) => ({ id: `${target}-${cache}-${playback.i}-${g}-${k}`, from: m.from, to: m.to, label: m.label, tone: m.tone, delay: g * 0.6, duration: 0.6 })),
  );
  const touched = new Set(f.moves.flat().flatMap((m) => [m.from, m.to]));
  const state = (id: HostId | "switch"): NodeState => {
    if (f.failed && id === "laptop") return "bad";
    if (id === "laptop") return "active";
    return touched.has(id) ? "active" : "idle";
  };

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="MAC addresses and ARP"
        blurb="IP addresses say where a packet is going in the end. But on a cable or Wi-Fi network, frames are delivered by MAC address, the hardware address of the next box. ARP is how a machine turns 'I need 192.168.1.50' into 'send it to 00:1b:a9:0c:22:7f'."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-4">
              <SystemMap
                chrome="split"
                title="Four devices on one switch"
                accent={ACCENT}
                nodes={[
                  ...HOSTS.map((h) => ({ id: h.id, label: h.name, sub: h.ip, state: state(h.id), ...AT[h.id] })),
                  { id: "switch", label: "Switch", sub: `${f.ports.length} MACs known`, state: touched.has("switch") ? ("active" as const) : ("idle" as const), ...AT.switch },
                ]}
                links={HOSTS.map((h) => ({ from: h.id, to: "switch", label: `port ${h.port}` }))}
                packets={packets}
                aspect={2}
                mobileAspect={1}
              />
              <section className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:grid-cols-2" aria-label="Tables">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Laptop ARP cache</p>
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                    {f.arp.map((r) => (
                      <li key={r.ip} className="flex flex-wrap justify-between gap-x-2 rounded px-1" style={{ background: r.fresh ? "var(--inset)" : undefined, color: r.mac.startsWith("(") ? "var(--bad)" : r.fresh ? ACCENT : undefined }}>
                        <span>{r.ip}</span><span>{r.mac}</span>
                      </li>
                    ))}
                    {!f.arp.length && <li className="text-[var(--faint)]">empty</li>}
                  </ul>
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Switch MAC table</p>
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                    {f.ports.map((r) => (
                      <li key={r.mac} className="flex flex-wrap justify-between gap-x-2 rounded px-1" style={{ background: r.fresh ? "var(--inset)" : undefined, color: r.fresh ? ACCENT : undefined }}>
                        <span>{r.mac}</span><span>port {r.port}</span>
                      </li>
                    ))}
                    {!f.ports.length && <li className="text-[var(--faint)]">empty</li>}
                  </ul>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Frame on the wire</p>
                  {f.frame ? (
                    <p className="mt-1 break-words font-mono text-[11px]">
                      <span className="text-[var(--faint)]">src</span> {f.frame.src} <span className="text-[var(--faint)]">dst</span>{" "}
                      <span style={{ color: f.frame.dst === BROADCAST ? ACCENT : undefined }}>{f.frame.dst}</span> · {f.frame.body}
                    </p>
                  ) : (
                    <p className="mt-1 font-mono text-[11px] text-[var(--faint)]">none</p>
                  )}
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={f.text}>
              <Choices label="Laptop sends to" accent={ACCENT} value={target} onChange={(v) => { setTarget(v); playback.reset(); }} options={TARGETS.map((t) => ({ id: t.id, label: t.label }))} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next" status={`${playback.i + 1} of ${list.length}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Pick the next-hop IP" what="If the destination is on this network, the next hop is the destination. If not, it's the router (the default gateway)." accent={ACCENT} active={step === 0}>
                <p className="font-mono text-xs">{target === "internet" ? "8.8.8.8 → next hop 192.168.1.1" : `${TARGETS.find((t) => t.id === target)!.ip} → next hop itself`}</p>
              </FlowStep>
              <FlowArrow label="an IP to look up" accent={ACCENT} active={step === 1} />
              <FlowStep n={2} title="Check the ARP cache" what="Every machine remembers recent IP → MAC answers for a short while, so most packets skip the question." accent={ACCENT} active={step === 1}>
                <Choices accent={ACCENT} value={cache} onChange={(v) => { setCache(v); playback.reset(); }} options={[{ id: "cold", label: "Empty cache" }, { id: "warm", label: "Recently used" }]} />
              </FlowStep>
              <FlowArrow label="cache miss" accent={ACCENT} active={step === 2} />
              <FlowStep n={3} title='Broadcast "who has this IP?"' what={`The ARP request goes to ${BROADCAST}, which every device on the network receives. The switch floods it out of every port.`} accent={ACCENT} active={step === 2}>
                <p className="text-xs text-[var(--muted)]">Broadcasts stop at the router. That&apos;s what makes this one network.</p>
              </FlowStep>
              <FlowArrow label="ARP request" accent={ACCENT} active={step === 3} />
              <FlowStep n={4} title="Get the owner's MAC back" what="Only the device with that IP replies, straight to the laptop. Everyone else drops the request." accent={ACCENT} active={step === 3}>
                <p className="text-xs" style={{ color: f.failed ? "var(--bad)" : "var(--muted)" }}>{f.failed ? "No one owns 192.168.1.99, so no reply ever comes." : "The laptop saves the answer in its cache."}</p>
              </FlowStep>
              <FlowArrow label="a MAC address" accent={ACCENT} active={step === 4} />
              <FlowStep n={5} title="Send the frame to that MAC" what="Now the packet goes out in a frame with the right destination MAC. The switch has learned where each MAC lives and sends it out of one port only." accent={ACCENT} active={step === 4}>
                <p className="text-xs text-[var(--muted)]">IPv6 does the same job with Neighbor Discovery instead of ARP.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
