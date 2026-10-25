"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { CITY, OBJ, POPS, REQUESTS, direct, hour, total, viaEdge, type City, type Obj, type Phase } from "@/lib/edgeNetworks";

const ACCENT = "var(--net)";

type Opts = { city: City; obj: Obj; warm: boolean; ttl: number; shield: boolean };
const COLD: Opts = { city: "sydney", obj: "api", warm: false, ttl: 60, shield: false };
const TUNED: Opts = { city: "sydney", obj: "api", warm: true, ttl: 600, shield: true };
const LEG: Record<Phase["leg"], string> = { user: "var(--good)", long: "var(--bad)", server: "var(--c2)" };
const TTLS = [
  { id: "60", label: "1 min" },
  { id: "600", label: "10 min" },
  { id: "3600", label: "1 hour" },
];

function Bar({ label, phases, max }: { label: string; phases: Phase[]; max: number }) {
  const t = total(phases);
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="font-mono">{t} ms</span>
      </div>
      <div className="mt-1 flex h-4 overflow-hidden rounded bg-[var(--inset)]" role="img" aria-label={`${label}: ${t} ms`}>
        {phases.map((p, i) => (
          <div key={i} className="h-full border-r border-[var(--panel)]" style={{ width: `${(p.ms / max) * 100}%`, background: LEG[p.leg], opacity: 0.8 }} title={`${p.label}: ${p.ms} ms`} />
        ))}
      </div>
    </div>
  );
}

export default function EdgeDemo() {
  const [o, setO] = useState<Opts>(COLD);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const c = CITY[o.city];
  const ob = OBJ[o.obj];
  const d = direct(o.city, o.obj);
  const e = viaEdge(o.city, o.obj, o.warm);
  const max = Math.max(total(d), total(e));
  const loads = [false, true].map((sh) => ({ sh, l: hour(o.ttl, sh) }));
  const mine = hour(o.ttl, o.shield);
  const hit = ob.hit;

  const nodes: MapNode[] = [
    { id: "user", label: `You, ${c.name}`, sub: `${c.toEdge} ms to the edge`, at: [11, 58], mobileAt: [50, 7], state: "active" },
    { id: "edge", label: `Edge, ${c.name}`, sub: hit ? "cache hit" : ob.cacheable ? "cache miss" : "passes it on", at: [37, 58], mobileAt: [50, 35], state: hit ? "good" : "wait" },
    { id: "shield", label: "Shield tier", sub: o.shield ? "edges ask here first" : "off", at: [64, 18], mobileAt: [80, 63], state: o.shield ? "active" : "dim" },
    { id: "origin", label: "Origin, Ashburn", sub: `${c.toOrigin} ms from ${c.name}`, at: [88, 58], mobileAt: [50, 91], state: hit ? "idle" : "active" },
  ];
  const toOrigin = o.shield ? ["edge", "shield", "origin"] : ["edge", "origin"];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["user", "edge"], { label: `${c.toEdge} ms` })
    : stage === 1 ? hops("h", ["user", "edge"], { label: "TCP + TLS here", tone: "good" })
    : stage === 2 ? hops("c", ["edge", "user"], { label: hit ? "hit" : "miss", tone: hit ? "good" : "bad" })
    : stage === 3 ? (hit ? [] : hops("o", toOrigin, { label: o.warm ? "warm connection" : "new TCP + TLS", tone: o.warm ? "good" : "bad" }))
    : stage === 4 ? hops("s", toOrigin, { label: `${mine.origin.toLocaleString("en-US")} / hour` })
    : [];

  const captions = [
    `Step 1: anycast routes you from ${c.name} to the edge ${c.toEdge} ms away instead of the origin ${c.toOrigin} ms away.`,
    `Step 2: the TCP and TLS handshakes end at the edge: ${2 * c.toEdge} ms instead of ${2 * c.toOrigin} ms.`,
    hit ? `Step 3: the edge has ${ob.name}, so it answers itself: ${total(e)} ms in all.` : `Step 3: the edge doesn't have ${ob.name}${ob.cacheable ? " yet" : " and can't cache it"}, so it must ask the origin.`,
    hit ? "Step 4: nothing goes to the origin." : o.warm ? `Step 4: the edge reuses a warm connection to the origin: no handshakes and no slow start on the ${c.toOrigin} ms leg. ${total(e)} ms vs ${total(d)} ms direct.` : `Step 4: the edge opens a new connection to the origin, so it pays the long handshakes and slow start itself: ${total(e)} ms, slower than going direct (${total(d)} ms).`,
    `Step 5: in an hour of ${REQUESTS.toLocaleString("en-US")} requests across ${POPS} edges, ${mine.origin.toLocaleString("en-US")} reach the origin${o.shield ? " through the shield" : ""}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${ob.name} from ${c.name}: ${total(d)} ms direct, ${total(e)} ms through the edge.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="CDNs and edge networks"
        blurb="An edge network puts servers close to users. Caching is part of why that's faster, but not all of it: handshakes and TCP slow start cost round trips, and round trips to a nearby edge are short. Fetch an image, an API call and a fresh page from three continents, then count what reaches the origin."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A user reaches a nearby edge, which answers from cache or asks the origin, optionally through a shield tier"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "user", to: "edge", label: "short hop" },
                  { from: "edge", to: "origin", label: o.warm ? "warm connection" : "long haul", dim: o.shield, dashed: o.warm },
                  { from: "edge", to: "shield", label: "miss", dim: !o.shield },
                  { from: "shield", to: "origin", label: "miss", dim: !o.shield },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.75}
              />
              <section className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Time to get the file">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{ob.name} from {c.name}</p>
                <Bar label="Straight to the origin" phases={d} max={max} />
                <Bar label="Through the edge" phases={e} max={max} />
                <p className="flex flex-wrap gap-x-3 text-[11px] text-[var(--muted)]">
                  <span><span style={{ color: LEG.user }}>■</span> round trips to the edge</span>
                  <span><span style={{ color: LEG.long }}>■</span> long-haul round trips</span>
                  <span><span style={{ color: LEG.server }}>■</span> origin request</span>
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(COLD)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Cold edge
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Warm and shielded
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Fetching…">
                Fetch it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Reach the nearest edge" what="The edge network announces the same addresses from every location (anycast) or answers DNS with a nearby one, so each user lands on the closest edge. The origin stays where it is, here in Virginia." accent={ACCENT} active={at(0)}>
                <Choices<City> accent={ACCENT} value={o.city} onChange={(v) => set({ city: v })} options={(Object.keys(CITY) as City[]).map((id) => ({ id, label: CITY[id].name }))} />
                <p className="font-mono text-xs">
                  edge {c.toEdge} ms · origin {c.toOrigin} ms round trip
                </p>
              </FlowStep>
              <FlowArrow label="TCP + TLS" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Shake hands at the edge" what="TCP needs a round trip and TLS 1.3 another before the request can go. Both end at the edge, so they cost two short round trips, whatever happens next." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  handshakes: <span style={{ color: "var(--good)" }}>{2 * c.toEdge} ms at the edge</span> vs <span style={{ color: "var(--bad)" }}>{2 * c.toOrigin} ms at the origin</span>
                </p>
              </FlowStep>
              <FlowArrow label="GET" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Look in the edge cache" what="A hit is answered from the edge. Personal or changing responses, like a cart, can't be cached and always go back to the origin; a file just changed by a deploy misses once at each edge." accent={ACCENT} active={at(2)}>
                <Choices<Obj> accent={ACCENT} value={o.obj} onChange={(v) => set({ obj: v })} options={(Object.keys(OBJ) as Obj[]).map((id) => ({ id, label: OBJ[id].name }))} />
              </FlowStep>
              <FlowArrow label="miss: to the origin" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Fetch over a warm connection" what="On a miss the edge must cross the ocean anyway. If it opens a new connection it pays the long handshakes and slow start itself, and the edge only adds a hop. Edges keep long-lived connections to the origin open, already past slow start, so a miss costs about one long round trip." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.warm} onChange={(ev) => set({ warm: ev.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The edge keeps warm connections to the origin
                </label>
                <ul className="space-y-0.5 text-xs">
                  {e.map((p, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="min-w-0 text-[var(--muted)]">{p.label}</span>
                      <span className="shrink-0 font-mono" style={{ color: LEG[p.leg] }}>{p.ms} ms</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="every edge, for an hour" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Shield the origin" what={`Each of the ${POPS} edges keeps its own cache, so a popular file can miss ${POPS} times per TTL. A shield tier near the origin collects the misses: edges ask it first, and only its misses reach the origin.`} accent={ACCENT} active={at(4)}>
                <Choices<string> label="Cache TTL" accent={ACCENT} value={String(o.ttl)} onChange={(v) => set({ ttl: Number(v) })} options={TTLS} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.shield} onChange={(ev) => set({ shield: ev.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Put a shield tier in front of the origin
                </label>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[16rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">setup</th>
                        <th className="py-1 text-right font-normal">edge hits</th>
                        <th className="py-1 text-right font-normal">to origin</th>
                        <th className="py-1 text-right font-normal">origin out</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {loads.map(({ sh, l }) => (
                        <tr key={String(sh)} className="border-t border-[var(--line)]" style={{ fontWeight: sh === o.shield ? 600 : 400 }}>
                          <td className="py-1 font-sans text-[var(--muted)]">{sh ? "With a shield" : "Edges only"}</td>
                          <td className="py-1 text-right">{((l.edgeHits / REQUESTS) * 100).toFixed(0)}%</td>
                          <td className="py-1 text-right" style={{ color: sh ? "var(--good)" : "var(--bad)" }}>{l.origin.toLocaleString("en-US")}</td>
                          <td className="py-1 text-right">{l.originGb.toFixed(1)} GB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Round trips and slow start (10 packets, doubling per round trip, capped by bandwidth) are counted per phase. The hour is simulated request by request over {POPS} edges and 4,000 files with Zipf popularity. Distances, sizes and server times are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
