"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { BACKLOG, DEFENSE_LABEL, FILTER_LABEL, LEGIT_GBPS, LINK_GBPS, POPS, SYNACK_HOLD_S, VECTOR, absorbVolume, appFilter, synQueue, type Defense, type Filter, type Vector } from "@/lib/ddosDefense";

const ACCENT = "var(--net)";

type Opts = { vector: Vector; flood: number; defense: Defense; half: number; cookies: boolean; filter: Filter; serverCap: number };
const EXPOSED: Opts = { vector: "volumetric", flood: 240, defense: "link", half: 16, cookies: false, filter: "none", serverCap: 20 };
const DEFENDED: Opts = { vector: "volumetric", flood: 240, defense: "anycast", half: 16, cookies: true, filter: "challenge", serverCap: 20 };
const VECTORS: Vector[] = ["volumetric", "stateExhaustion", "application"];
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function DdosDemo() {
  const [o, setO] = useState<Opts>(EXPOSED);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const vol = absorbVolume(o.defense, o.flood);
  const q = synQueue(o.half, o.cookies);
  const app = appFilter(o.filter, 90, 5, o.serverCap);
  const defenses: Defense[] = ["link", "blackhole", "anycast"];
  const volAll = defenses.map((d) => ({ d, a: absorbVolume(d, o.flood) }));

  const up = o.vector === "volumetric" ? vol.up : o.vector === "stateExhaustion" ? q.legitAccepted > 0.2 : app.humanShare > 0.5;
  const nodes: MapNode[] = [
    { id: "legit", label: "Real users", sub: `${LEGIT_GBPS} Gbps`, at: [11, 20], mobileAt: [22, 7], state: up ? "good" : "bad" },
    { id: "flood", label: "Flood sources", sub: `${o.vector === "volumetric" ? `${o.flood} Gbps` : o.vector === "stateExhaustion" ? `${o.half}k half-open/s` : "90k req/s"}`, at: [11, 80], mobileAt: [78, 7], state: "bad" },
    { id: "edge", label: o.defense === "anycast" ? `Scrubbing · ${POPS} sites` : o.defense === "blackhole" ? "ISP blackhole" : "Your link", sub: o.vector === "volumetric" ? vol.note.split(";")[0].slice(0, 36) : o.defense === "anycast" ? "filters per site" : "10 Gbps", at: [40, 50], mobileAt: [50, 38], state: up ? "good" : o.defense === "blackhole" ? "bad" : "wait" },
    { id: "server", label: "Server", sub: o.vector === "stateExhaustion" ? `${q.attackEntries}/${BACKLOG} queue` : o.vector === "application" ? `${o.serverCap}k req/s max` : "origin", at: [72, 50], mobileAt: [50, 70], state: up ? "good" : "bad" },
    { id: "db", label: "Served", sub: up ? "customers OK" : "customers blocked", at: [92, 50], mobileAt: [50, 92], state: up ? "good" : "bad" },
  ];
  const floodReaches = o.defense === "blackhole" ? "edge" : o.defense === "anycast" ? "edge" : "server";
  const packets: Packet[] =
    stage === 0 ? [...hops("l", ["legit", "edge"], { label: "real" }), ...hops("f", ["flood", "edge"], { label: "flood", tone: "bad", start: 0.2 })]
    : stage === 1 ? hops("a", ["flood", "edge", ...(floodReaches === "server" ? ["server"] : [])], { label: o.defense === "anycast" ? "split 300 ways" : o.defense === "blackhole" ? "all dropped" : `${vol.reaches.toFixed(0)} Gbps`, tone: vol.up ? "good" : "bad" })
    : stage === 2 ? hops("s", ["flood", "edge", "server"], { label: o.cookies ? "SYN cookies: no state" : `fills ${q.attackEntries}/${BACKLOG}`, tone: q.legitAccepted > 0.2 ? "good" : "bad" })
    : stage === 3 ? hops("r", ["flood", "edge", "server"], { label: `${FILTER_LABEL[o.filter].split(" ")[0]}: ${pct(1 - app.bots / 90)} of bots blocked`, tone: app.humanShare > 0.5 ? "good" : "bad" })
    : stage === 4 ? hops("d", ["legit", "edge", "server", "db"], { label: up ? "served" : "blocked", tone: up ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: ${VECTOR[o.vector].what}`,
    o.vector === "volumetric" ? `Step 2: ${vol.note}` : `Step 2: a bandwidth flood would be absorbed here; this is a ${VECTOR[o.vector].label.toLowerCase()}, which gets past the edge to the server.`,
    o.vector === "stateExhaustion" ? `Step 2: ${q.note}` : "Step 3: a connection flood is handled at the server's queue (try the connection flood).",
    o.vector === "application" ? `Step 3: ${FILTER_LABEL[o.filter]} lets ${pct(app.humanShare)} of real users through and ${app.offered > o.serverCap ? "the server is still overloaded" : "the server keeps up"}.` : "Step 3: an application flood is sorted real-from-fake here (try the application flood).",
    `Step 4: ${up ? "customers are served" : "customers can't get through"}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${VECTOR[o.vector].label} vs ${DEFENSE_LABEL[o.defense].toLowerCase()}: the service is ${up ? "up" : "down"} for real users.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="DDoS attacks"
        blurb="A distributed denial of service tries to drown a service in traffic so real users can't get through. There's no single fix: too much bandwidth, too many half-open connections and too many real-looking requests are three different problems with three different defences. See where each is absorbed."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Real users and a flood both arrive at an edge defence in front of the server"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "legit", to: "edge", label: "users" },
                  { from: "flood", to: "edge", label: "flood" },
                  { from: "edge", to: "server", label: "cleaned", dim: o.defense === "blackhole" },
                  { from: "server", to: "db", label: "served", dim: !up },
                ]}
                packets={packets}
                aspect={1.7}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Service status">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{VECTOR[o.vector].label}</p>
                <p className="mt-2 text-sm" style={{ color: up ? "var(--good)" : "var(--bad)" }}>
                  {up ? "✓ Real users are getting through" : "✕ Real users are shut out"}
                </p>
                {o.vector === "volumetric" && (
                  <div className="mt-3 space-y-2">
                    {volAll.map(({ d, a }) => (
                      <div key={d}>
                        <div className="flex justify-between text-xs">
                          <span className="text-[var(--muted)]">{DEFENSE_LABEL[d]}</span>
                          <span className="font-mono" style={{ color: a.up ? "var(--good)" : "var(--bad)" }}>{a.up ? "up" : "down"}</span>
                        </div>
                        <div className="mt-0.5 flex h-3 overflow-hidden rounded bg-[var(--inset)]" role="img" aria-label={`${DEFENSE_LABEL[d]}: real traffic ${pct(a.legitThrough / LEGIT_GBPS)} through`}>
                          <div className="h-full" style={{ width: `${(a.legitThrough / LEGIT_GBPS) * 100}%`, background: a.up ? "var(--good)" : "var(--bad)" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {o.vector === "stateExhaustion" && (
                  <div className="mt-3">
                    <div className="flex h-4 overflow-hidden rounded bg-[var(--inset)]" role="img" aria-label={`Queue: ${q.attackEntries} of ${BACKLOG} held by half-open connections`}>
                      <div className="h-full" style={{ width: `${(q.attackEntries / BACKLOG) * 100}%`, background: "var(--bad)" }} />
                    </div>
                    <p className="mt-1 font-mono text-xs">{q.cookies ? "SYN cookies: queue stays empty" : `${q.attackEntries} of ${BACKLOG} slots half-open · ${pct(q.legitAccepted)} of real SYNs accepted`}</p>
                  </div>
                )}
                {o.vector === "application" && (
                  <p className="mt-3 font-mono text-xs">{FILTER_LABEL[o.filter]}: {pct(app.humanShare)} of real users served, {pct(1 - app.bots / 90)} of the flood blocked</p>
                )}
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO({ ...EXPOSED, vector: o.vector })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Unprotected
                </button>
                <button type="button" onClick={() => setO({ ...DEFENDED, vector: o.vector })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Behind a scrubber
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Running…">
                Run the flood
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Pick the kind of flood" what="Denial of service comes in three shapes. A volumetric flood is about raw bandwidth. A state-exhaustion flood fills a limited table, like the half-open connection queue. An application flood sends cheap requests that cost the server dearly. Each is defended differently." accent={ACCENT} active={at(0)}>
                <Choices<Vector> accent={ACCENT} value={o.vector} onChange={(v) => set({ vector: v })} options={VECTORS.map((id) => ({ id, label: VECTOR[id].label }))} />
                <p className="text-xs text-[var(--muted)]">{VECTOR[o.vector].what}</p>
              </FlowStep>
              <FlowArrow label="arrives at the edge" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Absorb the bandwidth" what="A single link has a fixed size; once the flood fills it, real packets are dropped at the ISP before they even reach you, so nothing on your server can help. Blackholing stops the collateral damage but takes you fully offline. Anycast answers one address from hundreds of sites, so the flood divides and each site scrubs its share." accent={ACCENT} active={at(1)}>
                <Choices<Defense> accent={ACCENT} value={o.defense} onChange={(v) => set({ defense: v })} options={defenses.map((id) => ({ id, label: DEFENSE_LABEL[id] }))} />
                {o.vector === "volumetric" && (
                  <>
                    <Slider label="Flood size" value={o.flood} min={2} max={500} step={2} format={(v) => `${v} Gbps`} onChange={(v) => set({ flood: v })} accent={ACCENT} />
                    <p className="text-xs" style={{ color: vol.up ? "var(--good)" : "var(--bad)" }}>{vol.note}</p>
                  </>
                )}
                <p className="font-mono text-[11px] text-[var(--faint)]">A {LINK_GBPS} Gbps link saturates around {LINK_GBPS - LEGIT_GBPS} Gbps of flood; an anycast network spreads it across {POPS} sites.</p>
              </FlowStep>
              <FlowArrow label="connections at the server" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Keep the connection queue open" what={`A half-finished handshake (a SYN with no final ACK) sits in a queue for about ${SYNACK_HOLD_S} seconds. Enough of them fill the ${BACKLOG}-slot queue and real connections are refused. SYN cookies let the server answer without storing anything: it rebuilds the connection from the client's reply, so there's nothing to fill.`} accent={ACCENT} active={at(2)}>
                {o.vector === "stateExhaustion" ? (
                  <>
                    <Slider label="Half-open connections" value={o.half} min={0} max={100} step={1} format={(v) => `${v}k/s`} onChange={(v) => set({ half: v })} accent={ACCENT} />
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" checked={o.cookies} onChange={(e) => set({ cookies: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                      Turn on SYN cookies
                    </label>
                    <p className="text-xs" style={{ color: q.legitAccepted > 0.2 ? "var(--good)" : "var(--bad)" }}>{q.note}</p>
                  </>
                ) : (
                  <p className="text-xs text-[var(--muted)]">This step matters for a connection flood. Switch the flood kind in step 1 to try it.</p>
                )}
              </FlowStep>
              <FlowArrow label="requests at the app" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Tell real requests from fake" what="An application flood looks like normal traffic, so you can't block it by volume alone. Rate limits per address help until the flood spreads across many addresses. A lightweight challenge (run some JavaScript, solve a small proof of work) is cheap for a browser and expensive at flood scale; reputation on the connection's fingerprint catches the rest." accent={ACCENT} active={at(3)}>
                {o.vector === "application" ? (
                  <>
                    <Choices<Filter> accent={ACCENT} value={o.filter} onChange={(v) => set({ filter: v })} options={(Object.keys(FILTER_LABEL) as Filter[]).map((id) => ({ id, label: FILTER_LABEL[id] }))} />
                    <Slider label="Server capacity" value={o.serverCap} min={5} max={100} step={5} format={(v) => `${v}k req/s`} onChange={(v) => set({ serverCap: v })} accent={ACCENT} />
                    <p className="font-mono text-xs" style={{ color: app.humanShare > 0.5 ? "var(--good)" : "var(--bad)" }}>
                      flood through: {app.bots.toFixed(1)}k/s · real users served: {pct(app.humanShare)}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-[var(--muted)]">This step matters for an application flood. Switch the flood kind in step 1 to try it.</p>
                )}
              </FlowStep>
              <FlowArrow label="who gets served" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Keep real users served" what="No single layer stops everything: bandwidth is absorbed upstream, connection floods are defused at the server's queue, and application floods are filtered by behaviour. A service that stays up under attack has all three, usually bought as a managed scrubbing service in front of the origin." accent={ACCENT} active={at(4)}>
                <p className="text-sm" style={{ color: up ? "var(--good)" : "var(--bad)" }}>
                  {up ? "✓ With this defence, real users still get through." : "✕ Real users are shut out: this layer doesn't stop this flood."}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">This page is about defences, not running an attack. Link and server capacities, the queue size and the filter effectiveness are illustrative round numbers; anycast spreads a flood across {POPS} example sites.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
