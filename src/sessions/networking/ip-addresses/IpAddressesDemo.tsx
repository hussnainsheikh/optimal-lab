"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState, type Packet } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { DESTS, GATEWAY, ME, PREFIXES, REAL_PREFIX, decide, maskOf, octetBits, toDotted, toInt, usableHosts, type DestId } from "@/lib/ipAddresses";

const ACCENT = "var(--net)";

function Bits({ label, value, prefix, dim }: { label: string; value: number; prefix: number; dim?: boolean }) {
  const octets = octetBits(value);
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
        <span className="text-[var(--faint)]">{label}</span>
        <span className="font-mono">{toDotted(value)}</span>
      </p>
      <div className="overflow-x-auto">
        <p className="whitespace-nowrap font-mono text-[10px] tracking-tight sm:text-[11px]">
          {octets.map((o, oi) => (
            <span key={oi}>
              {o.split("").map((b, bi) => {
                const net = oi * 8 + bi < prefix;
                return (
                  <span key={bi} style={{ color: net ? (dim ? "var(--muted)" : ACCENT) : "var(--faint)" }}>{b}</span>
                );
              })}
              {oi < 3 && <span className="text-[var(--faint)]">.</span>}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

export default function IpAddressesDemo() {
  const [prefix, setPrefix] = useState(24);
  const [destId, setDestId] = useState<DestId>("nas");
  const { stage, busy, run, setStage } = useWalk(5, 1000);
  const dest = DESTS.find((d) => d.id === destId)!;
  const d = decide(dest.ip, prefix);
  const me = toInt(ME.ip);
  const dst = toInt(dest.ip);

  const lanLabel = d.onWire ? dest.name : "Printer";
  const farLabel = d.onWire ? "Floor 2 server" : dest.name;
  const path: string[] =
    d.outcome === "direct" ? ["laptop", "switch", "lan"]
    : d.outcome === "via-router" ? ["laptop", "switch", "router", "far"]
    : d.outcome === "detour" ? ["laptop", "switch", "router", "switch", "lan"]
    : ["laptop", "switch", "lan"];
  const sending = stage === 4;
  const packets: Packet[] = !sending
    ? []
    : d.outcome === "no-reply"
      ? [
          ...hops("arp", ["laptop", "switch"], { label: "who has?", tone: "bad", step: 0.6 }),
          { id: "arp-a", from: "switch", to: "lan", label: "who has?", tone: "bad", delay: 0.6, duration: 0.6 },
          { id: "arp-b", from: "switch", to: "router", label: "who has?", tone: "bad", delay: 0.6, duration: 0.6 },
        ]
      : hops(`pkt-${destId}-${prefix}`, path, { label: dest.ip, step: 0.6, tone: d.outcome === "detour" ? "accent" : "good" });
  const onPath = (id: string) => path.includes(id);
  const node = (id: string): NodeState =>
    d.outcome === "no-reply" && id === "lan" ? "bad" : !onPath(id) ? "dim" : id === path[path.length - 1] && sending ? "good" : "active";
  const linkOn = (a: string, b: string) => path.some((p, i) => i > 0 && ((path[i - 1] === a && p === b) || (path[i - 1] === b && p === a)));

  const captions = [
    `The laptop is ${ME.ip} with mask ${toDotted(maskOf(prefix))} (/${prefix}).`,
    `${ME.ip} AND mask = ${toDotted(d.myNet)}. That is the laptop's network.`,
    `${dest.ip} AND the same mask = ${toDotted(d.destNet)}.`,
    d.local ? `${toDotted(d.myNet)} = ${toDotted(d.destNet)}: the laptop decides it's local.` : `${toDotted(d.myNet)} ≠ ${toDotted(d.destNet)}: the laptop decides it's remote.`,
    d.verdict,
  ];
  const caption = stage === null ? `${d.local ? "Local" : "Remote"}. ${d.verdict}` : captions[stage];

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="IP addresses and subnets"
        blurb="Before sending anything, your computer asks one question: is this address on my own network, or somewhere else? It answers by keeping only the network part of both addresses (an AND with the subnet mask) and comparing them. Local goes straight there. Remote goes to the router."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <SystemMap
              chrome="split"
              title="A laptop, a switch, a local device, the router and a remote host"
              accent={ACCENT}
              nodes={[
                { id: "laptop", label: "Laptop", sub: `${ME.ip}/${prefix}`, at: [12, 28], mobileAt: [24, 12], state: "active" },
                { id: "switch", label: "Switch", sub: "192.168.1.0/24", at: [40, 28], mobileAt: [24, 46], state: node("switch") },
                { id: "lan", label: lanLabel, sub: d.onWire ? dest.ip : "192.168.1.50", at: [40, 80], mobileAt: [24, 86], state: node("lan") },
                { id: "router", label: "Router", sub: GATEWAY.ip, at: [68, 28], mobileAt: [76, 46], state: node("router") },
                { id: "far", label: farLabel, sub: d.onWire ? "192.168.2.10" : dest.ip, at: [88, 80], mobileAt: [76, 86], state: node("far") },
              ]}
              links={[
                { from: "laptop", to: "switch", label: "frame", active: linkOn("laptop", "switch") },
                { from: "switch", to: "lan", label: d.outcome === "no-reply" ? "no answer" : "frame", active: linkOn("switch", "lan") },
                { from: "switch", to: "router", label: "to gateway", active: linkOn("switch", "router") },
                { from: "router", to: "far", label: "routed", active: linkOn("router", "far"), dim: d.onWire },
              ]}
              packets={packets}
              aspect={2.1}
              mobileAspect={0.95}
            />
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Send to" accent={ACCENT} value={destId} onChange={(v) => { setDestId(v); setStage(null); }} options={DESTS.map((x) => ({ id: x.id, label: `${x.name} ${x.ip}` }))} />
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Deciding…">Decide and send</RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Read your address and mask" what="The mask says how many leading bits are the network's name. The rest number the machines inside it." accent={ACCENT} active={stage === 0}>
                <Choices label="Subnet mask" accent={ACCENT} value={String(prefix)} onChange={(v) => { setPrefix(Number(v)); setStage(null); }} options={PREFIXES.map((p) => ({ id: String(p), label: `/${p} ${toDotted(maskOf(p))}` }))} />
                <div className="mt-3 space-y-1">
                  <Bits label="laptop" value={me} prefix={prefix} />
                  <Bits label="mask" value={d.mask} prefix={prefix} />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">/{prefix} leaves {32 - prefix} bits for machines: {usableHosts(prefix).toLocaleString("en-US")} usable addresses. This switch is really wired as /{REAL_PREFIX}.</p>
              </FlowStep>
              <FlowArrow label="address + mask" accent={ACCENT} active={stage === 1} />
              <FlowStep n={2} title="AND your address with the mask" what="Each bit stays only where the mask has a 1. What's left is your network address." accent={ACCENT} active={stage === 1}>
                <Bits label="my network" value={d.myNet} prefix={prefix} />
              </FlowStep>
              <FlowArrow label="my network" accent={ACCENT} active={stage === 2} />
              <FlowStep n={3} title="AND the destination with the same mask" what="Do the same to the address you want to reach. Always with your mask, since you don't know theirs." accent={ACCENT} active={stage === 2}>
                <Bits label={dest.name.toLowerCase()} value={dst} prefix={prefix} dim />
                <Bits label="its network" value={d.destNet} prefix={prefix} />
              </FlowStep>
              <FlowArrow label="two network addresses" accent={ACCENT} active={stage === 3} />
              <FlowStep n={4} title="Compare the two networks" what="Equal means the destination is on your local network. Different means it is somewhere past the router." accent={ACCENT} active={stage === 3}>
                <p className="font-mono text-sm" style={{ color: d.local ? "var(--good)" : ACCENT }}>
                  {toDotted(d.myNet)} {d.local ? "=" : "≠"} {toDotted(d.destNet)} → {d.local ? "local" : "remote"}
                </p>
              </FlowStep>
              <FlowArrow label={d.local ? `look up ${dest.ip}` : `look up ${GATEWAY.ip}`} accent={ACCENT} active={stage === 4} />
              <FlowStep n={5} title={d.local ? "Send straight to it" : "Send it to the router"} what="Either way the laptop needs a MAC address next (that's ARP). Local: the destination's. Remote: the router's. The IP header always keeps the real destination." accent={ACCENT} active={stage === 4}>
                <p className="text-sm" style={{ color: d.outcome === "no-reply" ? "var(--bad)" : d.outcome === "detour" ? "var(--muted)" : "var(--good)" }}>{d.verdict}</p>
                <p className="mt-2 font-mono text-xs text-[var(--muted)]">next hop {d.nextHop} · IP destination {dest.ip}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
