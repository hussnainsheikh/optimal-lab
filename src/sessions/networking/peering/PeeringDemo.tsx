"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { CACHE_HIT, LABEL, LATENCY, OPTIONS, PER_DAY, PORT_GBPS, ROUTES, SPIKE_DAY, TRANSIT_PER_MBPS, candidates, day, demand, month, sortedCurve, type Opts, type Option, type Via } from "@/lib/peering";

const ACCENT = "var(--net)";

const START: Opts = { option: "transit", peak: 200, event: true, stuck: false, spill: false };
const STUCK: Opts = { option: "pni", peak: 200, event: true, stuck: true, spill: false };

const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;
const gbps = (x: number) => `${x >= 10 ? Math.round(x) : x.toFixed(1)} Gbps`;
const VIA: Record<Via, string> = { transit: "Transit", ixp: "Exchange", pni: "Cross-connect" };

// Stacked areas, bottom layer first; each layer is one value per sample.
function stack(layers: number[][], max: number, w: number, h: number): string[] {
  const n = layers[0].length;
  const x = (i: number) => (i / (n - 1)) * w;
  const y = (v: number) => h - (v / max) * h;
  const base = new Array(n).fill(0);
  return layers.map((layer) => {
    const top = base.map((b, i) => b + layer[i]);
    const d = `M${top.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("L")}L${base.map((v, i) => `${x(n - 1 - i).toFixed(1)},${y(base[n - 1 - i]).toFixed(1)}`).join("L")}Z`;
    for (let i = 0; i < n; i++) base[i] = top[i];
    return d;
  });
}

export default function PeeringDemo() {
  const [o, setO] = useState<Opts>(START);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const m = month(o);
  const via = m.route.winner.via;
  const all = OPTIONS.map((k) => ({ k, m: month({ ...o, option: k }) }));
  const cheapest = Math.min(...all.map((x) => x.m.bill.total));

  const total = day(demand(o.peak, o.event), SPIKE_DAY);
  const inside = o.option === "embedded" ? total.map((v) => v * CACHE_HIT) : total.map(() => 0);
  const layers = [inside, day(m.peered, SPIKE_DAY), day(m.transit, SPIKE_DAY), day(m.dropped, SPIKE_DAY)];
  const dayMax = Math.max(...total, m.capacity) * 1.08;
  const paths = stack(layers, dayMax, 288, 100);
  const curve = sortedCurve(m.transit);
  const curveMax = Math.max(curve[0], 1e-9);
  const transitUsed = m.p95Transit > 0 || curve[0] > 0;

  const nodes: MapNode[] = [
    { id: "viewer", label: "Viewers", sub: `evening peak ${gbps(o.peak)}`, at: [11, 50], mobileAt: [50, 7], state: m.lostShare > 0.001 ? "bad" : "active" },
    { id: "isp", label: "HomeNet ISP", sub: o.option === "embedded" ? `caches serve ${Math.round(CACHE_HIT * 100)}%` : "AS64510", at: [37, 50], mobileAt: [50, 30], state: "active" },
    { id: "transit", label: "Tier 1 transit", sub: transitUsed ? `p95 ${gbps(m.p95Transit)}` : via === "transit" ? "all traffic" : "backup route", at: [63, 14], mobileAt: [17, 60], state: via === "transit" || transitUsed ? "active" : "idle" },
    { id: "ixp", label: "Internet exchange", sub: o.option === "transit" ? "not connected" : via === "ixp" ? `${m.capacity} Gbps port` : "standby", at: [63, 50], mobileAt: [50, 60], state: o.option === "transit" ? "dim" : via === "ixp" ? (m.lostShare > 0.001 ? "bad" : "good") : "idle" },
    { id: "pni", label: "Cross-connect", sub: o.option === "pni" || o.option === "embedded" ? `${m.capacity} Gbps` : "not built", at: [63, 86], mobileAt: [83, 60], state: via === "pni" ? (m.lostShare > 0.001 ? "bad" : "good") : "dim" },
    { id: "video", label: "StreamCo", sub: "AS64496 · video", at: [88, 50], mobileAt: [50, 90], state: "active" },
  ];
  const tone = m.lostShare > 0.001 ? "bad" : "good";
  const packets: Packet[] =
    stage === 0 ? hops("p", ["viewer", "isp"], { label: "play" })
    : stage === 1 ? hops("r", ["isp", via, "video"], { label: "route to 64510" })
    : stage === 2 ? (o.option === "embedded" ? hops("c", ["isp", "viewer"], { label: "from cache", tone: "good" }) : hops("v", ["video", via, "isp", "viewer"], { label: "video", tone }))
    : stage === 3 ? (transitUsed ? hops("b", ["video", "transit"], { label: usd(m.bill.transit), tone: "bad" }) : hops("b", ["video", via], { label: "flat port fee", tone: "good" }))
    : stage === 4 ? hops("t", ["video", via, "isp"], { label: usd(m.bill.total) })
    : [];

  const captions = [
    `Step 1: viewers inside HomeNet press play. Their evening peak is ${gbps(o.peak)}${o.event ? `, and the live final on day ${SPIKE_DAY + 1} adds 55% for four hours` : ""}.`,
    `Step 2: StreamCo has ${candidates(o.option).length} route${candidates(o.option).length === 1 ? "" : "s"} to HomeNet. BGP picks ${VIA[via].toLowerCase()} on ${m.route.rule}.`,
    m.capacity && m.congestedHours > 0
      ? `Step 3: the ${m.capacity} Gbps ${VIA[via].toLowerCase()} link is full for ${Math.round(m.congestedHours)} hours this month; ${o.spill ? "the overflow goes to transit" : `${(m.lostShare * 100).toFixed(1)}% of the video is dropped and viewers buffer`}.`
      : `Step 3: ${o.option === "embedded" ? `${Math.round(CACHE_HIT * 100)}% of the video comes from caches inside HomeNet; the rest` : "the video"} crosses ${VIA[via].toLowerCase()} with room to spare.`,
    transitUsed ? `Step 4: transit is billed on the 95th percentile of the month's 5-minute samples: ${gbps(m.p95Transit)} × ${usd(TRANSIT_PER_MBPS * 1000)} per Gbps = ${usd(m.bill.transit)}.` : "Step 4: no transit at the 95th percentile, so the transit bill is $0; the peering ports cost a flat monthly fee.",
    `Step 5: ${LABEL[o.option]}: ${usd(m.bill.total)} a month, ${m.latency.toFixed(0)} ms average round trip, ${(m.lostShare * 100).toFixed(1)}% dropped.`,
  ];
  const caption = stage !== null ? captions[stage] : `${LABEL[o.option]}: ${usd(m.bill.total)} a month for ${m.pb.toFixed(1)} PB, ${m.latency.toFixed(0)} ms average round trip, ${(m.lostShare * 100).toFixed(1)}% dropped.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="ISPs, peering and exchanges"
        blurb="The internet is about 75,000 networks that have agreed to carry each other's traffic. Some pay (transit), some swap for free (peering), some put servers inside each other. Follow a video service's traffic into a home ISP, watch BGP pick the path, and pay the bill the way it's really calculated."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Viewers in an ISP reach a video service through transit, an internet exchange or a private cross-connect"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "viewer", to: "isp", label: "home lines" },
                  { from: "isp", to: "transit", label: "paid", dim: !(via === "transit" || transitUsed) },
                  { from: "transit", to: "video", label: "paid", dim: !(via === "transit" || transitUsed) },
                  { from: "isp", to: "ixp", label: "peering", dim: o.option === "transit" },
                  { from: "ixp", to: "video", label: "peering", dim: o.option === "transit" },
                  { from: "isp", to: "pni", label: "fibre", dim: via !== "pni" },
                  { from: "pni", to: "video", label: "fibre", dim: via !== "pni" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.8}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="This month">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">This month · {m.pb.toFixed(1)} PB delivered</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-[var(--faint)]">Transit</dt><dd className="font-mono">{usd(m.bill.transit)}</dd></div>
                  <div><dt className="text-xs text-[var(--faint)]">Ports</dt><dd className="font-mono">{usd(m.bill.ports)}</dd></div>
                  <div><dt className="text-xs text-[var(--faint)]">Caches</dt><dd className="font-mono">{usd(m.bill.caches)}</dd></div>
                  <div><dt className="text-xs text-[var(--faint)]">Total</dt><dd className="font-mono font-semibold" style={{ color: m.bill.total === cheapest ? "var(--good)" : undefined }}>{usd(m.bill.total)}</dd></div>
                  <div><dt className="text-xs text-[var(--faint)]">Round trip</dt><dd className="font-mono">{m.latency.toFixed(0)} ms</dd></div>
                  <div><dt className="text-xs text-[var(--faint)]">Congested</dt><dd className="font-mono" style={{ color: m.congestedHours ? "var(--bad)" : undefined }}>{Math.round(m.congestedHours)} h</dd></div>
                  <div className="col-span-2"><dt className="text-xs text-[var(--faint)]">Video dropped</dt><dd className="font-mono" style={{ color: m.lostShare > 0.001 ? "var(--bad)" : "var(--good)" }}>{(m.lostShare * 100).toFixed(2)}%</dd></div>
                </dl>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(START)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Transit only
                </button>
                <button type="button" onClick={() => setO(STUCK)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  The ISP won&apos;t upgrade
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Streaming…">
                Follow the video
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Viewers press play" what="Viewers sit inside an eyeball ISP: a network of home and mobile lines. The video lives in StreamCo's network. The two are different companies, and the traffic has to cross between them somewhere." accent={ACCENT} active={at(0)}>
                <Slider label="Evening peak" value={o.peak} min={2} max={400} step={2} format={gbps} onChange={(v) => set({ peak: v })} accent={ACCENT} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.event} onChange={(e) => set({ event: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  A live final on day {SPIKE_DAY + 1}: +55% for four hours
                </label>
              </FlowStep>
              <FlowArrow label="routes to AS64510" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="BGP picks a route" what="Each connection to HomeNet brings a route. BGP compares them in order: local preference first (operators set peers above paid transit, because peering is free), then the shortest AS path, then MED, then the nearest exit." accent={ACCENT} active={at(1)}>
                <Choices<Option> accent={ACCENT} value={o.option} onChange={(v) => set({ option: v })} options={OPTIONS.map((id) => ({ id, label: LABEL[id] }))} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[18rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">route via</th>
                        <th className="py-1 text-right font-normal">local pref</th>
                        <th className="py-1 text-right font-normal">AS path</th>
                        <th className="py-1 text-right font-normal">IGP cost</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {(Object.keys(ROUTES) as Via[]).map((k) => {
                        const r = ROUTES[k];
                        const has = candidates(o.option).includes(r);
                        return (
                          <tr key={k} className="border-t border-[var(--line)]" style={{ opacity: has ? 1 : 0.35, color: k === via ? "var(--good)" : undefined, fontWeight: k === via ? 600 : 400 }}>
                            <td className="py-1 font-sans">{r.neighbor}{k === via ? " ✓" : ""}</td>
                            <td className="py-1 text-right">{r.localPref}</td>
                            <td className="py-1 text-right">{r.asPath.join(" ")}</td>
                            <td className="py-1 text-right">{r.igp}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ol className="space-y-0.5 text-xs text-[var(--muted)]">
                  {m.route.rounds.length === 0 ? <li>Only one route, so it wins.</li> : m.route.rounds.map((r, i) => <li key={i}>{i + 1}. {r.rule}: {r.left.map((v) => VIA[v]).join(", ")} left</li>)}
                </ol>
              </FlowStep>
              <FlowArrow label="video crosses the link" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Cross the interconnect" what="A peering link is a physical port with a fixed size. If it fills at the evening peak, packets queue and drop and viewers buffer, even though both networks have spare capacity elsewhere. Whoever has to pay for the upgrade is what peering disputes are about." accent={ACCENT} active={at(2)}>
                <figure>
                  <svg viewBox="0 0 288 112" className="w-full" role="img" aria-label={`Traffic on day ${SPIKE_DAY + 1}: cache, peering, transit and dropped, against the link capacity`}>
                    {paths.map((d, i) => (
                      <path key={i} d={d} fill={["var(--good)", ACCENT, "var(--c2)", "var(--bad)"][i]} fillOpacity={i === 1 ? 0.55 : 0.45} />
                    ))}
                    {m.capacity > 0 && (
                      <polyline points={inside.map((v, i) => `${((i / (PER_DAY - 1)) * 288).toFixed(1)},${(100 - ((v + m.capacity) / dayMax) * 100).toFixed(1)}`).join(" ")} fill="none" stroke="var(--text)" strokeDasharray="4 3" strokeWidth={0.8} />
                    )}
                    {[0, 6, 12, 18, 24].map((h) => (
                      <text key={h} x={Math.min(280, (h / 24) * 288)} y={111} fontSize={8} fill="var(--faint)">{`${String(h).padStart(2, "0")}:00`}</text>
                    ))}
                  </svg>
                  <figcaption className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                    <span><span style={{ color: "var(--good)" }}>■</span> cache in ISP</span>
                    <span><span style={{ color: ACCENT }}>■</span> peering</span>
                    <span><span style={{ color: "var(--c2)" }}>■</span> transit</span>
                    <span><span style={{ color: "var(--bad)" }}>■</span> dropped</span>
                    {m.capacity > 0 && <span>- - - link full ({m.capacity} Gbps)</span>}
                  </figcaption>
                </figure>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.stuck} onChange={(e) => set({ stuck: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  HomeNet won&apos;t add ports: stuck at {PORT_GBPS} Gbps
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.spill} onChange={(e) => set({ spill: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Send what doesn&apos;t fit over transit
                </label>
              </FlowStep>
              <FlowArrow label="5-minute samples" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Pay for transit at the 95th percentile" what="Transit is metered every 5 minutes. At the end of the month the 8,640 samples are sorted, the top 5% (36 hours) are thrown away, and you pay for the highest one left. Short bursts are free; a busy evening every day is not." accent={ACCENT} active={at(3)}>
                {transitUsed ? (
                  <svg viewBox="0 0 240 100" className="w-full" role="img" aria-label={`The month's transit samples, highest first; the 95th percentile is ${gbps(m.p95Transit)}`}>
                    <rect x={0} y={0} width={12} height={88} fill="var(--good)" fillOpacity={0.15} />
                    <polyline points={curve.map((v, i) => `${(i / (curve.length - 1)) * 240},${88 - (v / curveMax) * 84}`).join(" ")} fill="none" stroke="var(--c2)" strokeWidth={1.5} />
                    <line x1={0} x2={240} y1={88 - (m.p95Transit / curveMax) * 84} y2={88 - (m.p95Transit / curveMax) * 84} stroke="var(--bad)" strokeDasharray="4 3" strokeWidth={0.8} />
                    <text x={16} y={Math.max(9, 84 - (m.p95Transit / curveMax) * 84)} fontSize={8} fill="var(--bad)">billed: {gbps(m.p95Transit)}</text>
                    <text x={2} y={98} fontSize={7} fill="var(--good)">top 5% free</text>
                    <text x={238} y={98} fontSize={7} fill="var(--faint)" textAnchor="end">quietest sample</text>
                  </svg>
                ) : (
                  <p className="text-sm text-[var(--good)]">Transit carried nothing at the 95th percentile this month. {m.transit.some((v) => v > 0) ? "The spill-over happened in fewer than 36 hours, so it fell into the free top 5%." : ""}</p>
                )}
                <p className="font-mono text-xs">{gbps(m.p95Transit)} × {usd(TRANSIT_PER_MBPS * 1000)} per Gbps = {usd(m.bill.transit)}</p>
              </FlowStep>
              <FlowArrow label="the month's bill" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Compare the month" what="Peering swaps a usage bill for a flat port fee and a shorter path. Caches inside the ISP cost hardware but keep most bytes off every interconnect. Below a few Gbps, a port costs more than the transit it saves." accent={ACCENT} active={at(4)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[18rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">setup</th>
                        <th className="py-1 text-right font-normal">per month</th>
                        <th className="py-1 text-right font-normal">round trip</th>
                        <th className="py-1 text-right font-normal">dropped</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {all.map((x) => (
                        <tr key={x.k} className="border-t border-[var(--line)]" style={{ fontWeight: x.k === o.option ? 600 : 400 }}>
                          <td className="py-1 font-sans text-[var(--muted)]">{LABEL[x.k]}</td>
                          <td className="py-1 text-right" style={{ color: x.m.bill.total === cheapest ? "var(--good)" : undefined }}>{usd(x.m.bill.total)}</td>
                          <td className="py-1 text-right">{x.m.latency.toFixed(0)} ms</td>
                          <td className="py-1 text-right" style={{ color: x.m.lostShare > 0.001 ? "var(--bad)" : undefined }}>{(x.m.lostShare * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  The route choice and 95th-percentile billing run for real on {PER_DAY * 30} generated samples. Prices (transit {usd(TRANSIT_PER_MBPS)} per Mbps, ports, cache servers), round trips ({LATENCY.transit}, {LATENCY.ixp}, {LATENCY.pni} and {LATENCY.cache} ms) and the traffic shape are illustrative.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
