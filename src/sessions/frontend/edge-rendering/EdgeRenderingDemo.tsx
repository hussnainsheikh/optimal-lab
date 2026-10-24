"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { CITIES, FEATURES, ORIGIN, RENDER_MS, WHERE, breakEven, table, ttfb, type Opts, type Where } from "@/lib/edgeRendering";

const ACCENT = "var(--web)";
const START: Opts = { where: "edge", queries: 3, personalised: false, renderMs: RENDER_MS };

export default function EdgeRenderingDemo() {
  const [o, setO] = useState<Opts>(START);
  const [cityId, setCityId] = useState("syd");
  const [uses, setUses] = useState<string[]>(["tcp", "fetch", "cookies"]);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const city = CITIES.find((c) => c.id === cityId)!;
  const rows = table(o);
  const here = ttfb(city, o);
  const origin = ttfb(city, { ...o, where: "origin" });
  const max = Math.max(...rows.map((r) => r.ms), ...rows.map((r) => ttfb(r.city, { ...o, where: "origin" }).total), 1);
  const atEdge = o.where !== "origin";
  const broken = atEdge ? FEATURES.filter((f) => uses.includes(f.id) && !f.edgeOk) : [];
  const worse = here.total > origin.total;

  const nodes: MapNode[] = [
    { id: "visitor", label: `Visitor, ${city.name}`, sub: `${here.total} ms to first byte`, at: [14, 22], mobileAt: [25, 12], state: worse ? "bad" : "good" },
    { id: "edge", label: `Edge, ${city.name}`, sub: atEdge ? "renders the page" : "TLS + cache only", at: [50, 22], mobileAt: [75, 12], state: atEdge ? (broken.length ? "bad" : "active") : "idle" },
    { id: "kv", label: "Edge data store", sub: o.where === "edge-cache" ? "replicated reads" : "not used", at: [14, 78], mobileAt: [25, 45], state: o.where === "edge-cache" ? "good" : "dim" },
    { id: "origin", label: `Origin, ${ORIGIN.name}`, sub: o.where === "origin" ? "renders the page" : "not used for render", at: [86, 22], mobileAt: [75, 45], state: o.where === "origin" ? "active" : "dim" },
    { id: "db", label: `Database, ${ORIGIN.name}`, sub: `${o.queries} quer${o.queries === 1 ? "y" : "ies"} per page`, at: [86, 78], mobileAt: [75, 80], state: o.where === "edge" && o.queries > 1 ? "bad" : "good" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("r", ["visitor", "edge"], { label: "GET /" })
    : stage === 1 ? (o.where === "origin" ? hops("o", ["edge", "origin"], { label: `${rows.find((r) => r.city.id === cityId)!.rtt} ms round trip` }) : hops("o", ["edge", "visitor"], { label: "nearby" }))
    : stage === 2 ? (o.where === "edge" ? hops("q", ["edge", "db"], { label: `${o.queries} × ocean`, tone: o.queries > 1 ? "bad" : "accent" }) : o.where === "origin" ? hops("q", ["origin", "db"], { label: `${o.queries} × 1 ms`, tone: "good" }) : hops("q", ["edge", "kv"], { label: "local reads", tone: "good" }))
    : stage === 3 ? (o.where === "edge-cache" && o.personalised ? hops("p", ["edge", "origin"], { label: "per-user data", tone: "bad" }) : hops("p", ["kv", "edge"], { label: "replicated", tone: "good" }))
    : stage === 4 ? hops("h", [o.where === "origin" ? "origin" : "edge", o.where === "origin" ? "edge" : "visitor"], { label: broken.length ? "runtime error" : "HTML", tone: broken.length ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: a visitor in ${city.name} reaches the nearest edge location in a few milliseconds.`,
    o.where === "origin" ? `Step 2: the edge forwards to the origin ${rows.find((r) => r.city.id === cityId)!.distance.toLocaleString("en-US")} km away: a ${rows.find((r) => r.city.id === cityId)!.rtt} ms round trip.` : "Step 2: the page renders right there, next to the visitor.",
    o.where === "edge" ? `Step 3: each of ${o.queries} queries crosses to ${ORIGIN.name} and back, one after another: ${o.queries * rows.find((r) => r.city.id === cityId)!.rtt} ms.` : o.where === "origin" ? `Step 3: the queries run next to the database: ${o.queries} ms.` : "Step 3: the edge reads replicated data locally.",
    o.where === "edge-cache" && o.personalised ? "Step 4: data for this signed-in user isn't replicated, so one trip home is still needed." : `Step 4: in ${city.name} this page needs ${breakEven(city)} queries before rendering at the edge is slower than at the origin.`,
    broken.length ? `Step 5: ${broken[0].label} doesn't work in an edge runtime: ${broken[0].why}` : `Step 5: first byte in ${city.name} at ${here.total} ms (origin rendering: ${origin.total} ms).`,
  ];
  const caption = stage !== null ? captions[stage] : `${city.name}: ${here.total} ms to first byte at ${WHERE.find((w) => w.id === o.where)!.label.toLowerCase()}, ${origin.total} ms rendering at the origin.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Rendering at the edge"
        blurb="Edge functions run your rendering code in data centres close to every visitor. That cuts the distance to the visitor, but not to your database. A page that makes several queries can end up slower at the edge, unless the data moves too. Round trips here come from the real distances between cities."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A visitor reaches a nearby edge location; the page renders there or at an origin next to the database in North Virginia; an edge data store holds replicated reads"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "visitor", to: "edge", label: "a few km" },
                  { from: "edge", to: "origin", label: "across the ocean", dim: o.where === "edge" || (o.where === "edge-cache" && !o.personalised) },
                  { from: "edge", to: "db", label: "queries", dim: o.where !== "edge" },
                  { from: "origin", to: "db", label: "same building", dim: o.where !== "origin" },
                  { from: "kv", to: "edge", label: "local reads", dim: o.where !== "edge-cache" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Time to first byte from six cities">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">time to first byte · {WHERE.find((w) => w.id === o.where)!.label.toLowerCase()}</p>
                <ul className="mt-2 space-y-1.5">
                  {rows.map((r) => {
                    const ori = ttfb(r.city, { ...o, where: "origin" }).total;
                    return (
                      <li key={r.city.id} className="text-xs">
                        <span className="flex flex-wrap justify-between gap-x-2">
                          <span>
                            {r.city.name} <span className="font-mono text-[10px] text-[var(--faint)]">{r.distance.toLocaleString("en-US")} km · {r.rtt} ms RTT</span>
                          </span>
                          <span className="font-mono" style={{ color: r.ms > ori ? "var(--bad)" : r.ms < ori ? "var(--good)" : undefined }}>
                            {r.ms} ms {r.ms !== ori && <span className="text-[var(--faint)]">(origin {ori})</span>}
                          </span>
                        </span>
                        <span className="mt-0.5 block h-2 rounded-sm" style={{ width: `${(r.ms / max) * 100}%`, background: r.ms > ori ? "var(--bad)" : ACCENT }} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Visitor in" accent={ACCENT} value={cityId} onChange={setCityId} options={CITIES.map((c) => ({ id: c.id, label: c.name }))} />
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Requesting…">
                Request the page
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Pick where the page renders" what="A CDN already terminates TLS near the visitor. The question is whether your rendering code runs there too, or back at the origin beside your database." accent={ACCENT} active={at(0)}>
                <Choices<Where> accent={ACCENT} value={o.where} onChange={(v) => set({ where: v })} options={WHERE.map((w) => ({ id: w.id, label: w.label }))} />
                <p className="mt-2 text-xs text-[var(--muted)]">{WHERE.find((w) => w.id === o.where)!.what}</p>
              </FlowStep>
              <FlowArrow label="distance" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Distance sets the floor" what="Light in fibre covers about 200 km per millisecond, and cables don't run in straight lines. Nothing you do in code beats the round trip between two cities." accent={ACCENT} active={at(1)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {here.parts.map((p) => (
                    <li key={p.label} className="flex justify-between gap-2">
                      <span>{p.label}</span>
                      <span>{p.ms} ms</span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-2 border-t border-[var(--line)] pt-0.5">
                    <span>{city.name}, first byte</span>
                    <span>{here.total} ms</span>
                  </li>
                </ul>
              </FlowStep>
              <FlowArrow label="queries" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Every query goes back to the data" what="Most pages query the database more than once, often one query after another because each needs the last one's answer. At the origin each costs about a millisecond; from the edge each costs a full ocean round trip." accent={ACCENT} active={at(2)}>
                <Slider label="Sequential queries per page" value={o.queries} min={0} max={5} step={1} format={(v) => `${v}`} onChange={(v) => set({ queries: v })} accent={ACCENT} />
              </FlowStep>
              <FlowArrow label="the data" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Move the data, or render near it" what="Edge rendering pays off for pages that need no data, or whose data is replicated to the edge (a key-value store, a read replica per region). Data for a signed-in user usually isn't, and still needs a trip home." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.personalised} onChange={(e) => set({ personalised: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The page shows data for the signed-in user
                </label>
                <p className="font-mono text-xs text-[var(--muted)]">
                  edge loses from {breakEven(city)} sequential queries in {city.name}
                </p>
              </FlowStep>
              <FlowArrow label="the code" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Fit the edge runtime" what="Edge functions run in lightweight isolates with web-standard APIs, small bundles and short CPU limits. Code that needs a filesystem, raw TCP or native modules has to change or stay at the origin." accent={ACCENT} active={at(4)}>
                <div className="space-y-0.5">
                  {FEATURES.map((f) => (
                    <label key={f.id} className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" checked={uses.includes(f.id)} onChange={(e) => setUses((u) => (e.target.checked ? [...u, f.id] : u.filter((x) => x !== f.id)))} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                      <span style={{ color: atEdge && uses.includes(f.id) && !f.edgeOk ? "var(--bad)" : undefined }}>{f.label}</span>
                    </label>
                  ))}
                </div>
                {broken.map((f) => (
                  <p key={f.id} className="mt-1 text-[11px] text-[var(--bad)]">
                    {f.label}: {f.why}
                  </p>
                ))}
                <p className="mt-2 text-[11px] text-[var(--faint)]">Round trips come from great-circle distances to {ORIGIN.name}, at 200 km/ms over routes 1.5× the straight line; render time ({RENDER_MS} ms) and runtime limits are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
