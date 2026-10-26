"use client";

import { useMemo, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { EF_CONSTRUCTION, N, build, bruteForce, bytesPerVector, evaluate, layerCounts, points, search, type Pt } from "@/lib/hnswIndex";

const ACCENT = "var(--db)";
const K = 10;
const EFS = [10, 20, 40, 80];

type Opts = { M: number; ef: number; q: Pt };
const NAIVE: Opts = { M: 4, ef: 10, q: [0.52, 0.47] };
const TUNED: Opts = { M: 16, ef: 40, q: [0.52, 0.47] };

/** The points, the upper-layer links, the search path and the results; click to move the query. */
function Scatter({ M, q, onPick, trace, got, truth }: { M: number; q: Pt; onPick: (p: Pt) => void; trace: ReturnType<typeof search>["trace"]; got: Set<number>; truth: Set<number> }) {
  const pts = points();
  const h = build(M);
  const S = 300;
  const upper: [number, number][] = [];
  h.links.forEach((ls, i) => ls.slice(1).forEach((layer) => layer.forEach((j) => i < j && upper.push([i, j]))));
  const path = trace.map((t) => t.best);
  const visited0 = new Set(trace[trace.length - 1]?.visited ?? []);
  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      className="aspect-square w-full max-w-[22rem] cursor-crosshair rounded-lg bg-[var(--inset)]"
      role="img"
      aria-label={`${N} points; the query is at ${q[0].toFixed(2)}, ${q[1].toFixed(2)}. Click to move it.`}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onPick([Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]);
      }}
    >
      {upper.map(([a, b], i) => (
        <line key={i} x1={pts[a][0] * S} y1={pts[a][1] * S} x2={pts[b][0] * S} y2={pts[b][1] * S} stroke="var(--line-strong)" strokeWidth="0.6" />
      ))}
      {pts.map((p, i) => (
        <circle key={i} cx={p[0] * S} cy={p[1] * S} r={h.levels[i] > 0 ? 2.4 + h.levels[i] : 1.3} fill={got.has(i) ? "var(--good)" : truth.has(i) ? "var(--bad)" : visited0.has(i) ? "color-mix(in srgb, var(--db) 80%, transparent)" : h.levels[i] > 0 ? "var(--muted)" : "var(--faint)"} />
      ))}
      <polyline points={[...path.map((i) => `${pts[i][0] * S},${pts[i][1] * S}`), `${q[0] * S},${q[1] * S}`].join(" ")} fill="none" stroke="var(--db)" strokeWidth="1.6" strokeDasharray="4 2" />
      <circle cx={q[0] * S} cy={q[1] * S} r="5" fill="none" stroke="var(--text)" strokeWidth="1.8" />
      <circle cx={q[0] * S} cy={q[1] * S} r="1.6" fill="var(--text)" />
    </svg>
  );
}

export default function HnswDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const h = useMemo(() => build(o.M), [o.M]);
  const res = useMemo(() => search(h, o.q, K, o.ef), [h, o.q, o.ef]);
  const truthIds = useMemo(() => bruteForce(o.q, K), [o.q]);
  const truth = new Set(truthIds);
  const got = new Set(res.ids);
  const found = res.ids.filter((i) => truth.has(i)).length;
  const table = useMemo(() => EFS.map((ef) => ({ ef, ...evaluate(o.M, ef, K) })), [o.M]);
  const cur = table.find((t) => t.ef === o.ef) ?? evaluate(o.M, o.ef, K);
  const counts = layerCounts(h);
  const upperVisited = res.trace.slice(0, -1).reduce((a, t) => a + t.visited.length, 0);

  const nodes: MapNode[] = [
    { id: "app", label: "Query vector", sub: "find the 10 nearest", at: [10, 50], mobileAt: [50, 8], state: "active" },
    { id: "top", label: `Layer ${h.top}`, sub: `${counts[h.top]} point${counts[h.top] === 1 ? "" : "s"}`, at: [34, 20], mobileAt: [25, 32], state: "active" },
    { id: "mid", label: h.top > 1 ? `Layers ${h.top - 1}–1` : "Layer 1", sub: `${counts.slice(1, h.top).reduce((a, b) => a + b, 0) || counts[1] || 0} points`, at: [62, 20], mobileAt: [75, 32], state: "active" },
    { id: "l0", label: "Layer 0", sub: `all ${N} · beam ${Math.max(o.ef, K)}`, at: [62, 80], mobileAt: [50, 62], state: "active" },
    { id: "out", label: "Top 10", sub: `${found} of 10 right`, at: [90, 80], mobileAt: [50, 90], state: found === K ? "good" : found >= 8 ? "wait" : "bad" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("v", ["app", "top"], { label: `${N} distances by brute force` })
    : stage === 1 ? hops("l", ["top", "mid", "l0"], { label: `M = ${o.M}` })
    : stage === 2 ? hops("g", ["app", "top", "mid", "l0"], { label: `${upperVisited} hops` })
    : stage === 3 ? hops("b", ["l0", "out"], { label: `${res.distances} distances`, tone: found === K ? "good" : "bad" })
    : stage === 4 ? hops("t", ["app", "l0", "out"], { label: `recall ${(cur.recall * 100).toFixed(0)}%`, tone: cur.recall > 0.95 ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: brute force compares the query with all ${N} vectors: exact, but the work grows with every vector you add.`,
    `Step 2: each vector got a random top layer: ${counts.map((c, l) => `${c} on layer ${l}`).join(", ")}. Each links to its ${o.M} nearest on every layer it's on (${2 * o.M} on layer 0).`,
    `Step 3: from the single entry point on layer ${h.top}, hop greedily to whichever neighbour is closer to the query, then drop a layer: ${upperVisited} points visited on the way down.`,
    `Step 4: on layer 0 a beam of ${Math.max(o.ef, K)} candidates spreads out from there: ${res.distances} distance computations instead of ${N}, and ${found} of the true 10 nearest found.`,
    `Step 5: over 60 random queries, M = ${o.M} and efSearch = ${o.ef} find ${(cur.recall * 100).toFixed(0)}% of the true neighbours with ${Math.round(cur.distances)} distances each.`,
  ];
  const caption = stage !== null ? captions[stage] : `${found} of 10 nearest found with ${res.distances} distance computations (brute force: ${N}) · average recall ${(cur.recall * 100).toFixed(0)}%.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Vector indexes: HNSW"
        blurb="Finding the vectors nearest a query by comparing against every one doesn't scale to millions. HNSW builds a layered graph instead: sparse upper layers for long jumps, a dense bottom layer for the final search. It's approximate, and how approximate is up to you. This is a real HNSW over 800 points; click the plot to move the query."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A query vector enters at the top layer of the HNSW graph, descends through the upper layers, searches layer 0 with a beam and returns the top 10"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "top", label: "entry point" },
                  { from: "top", to: "mid", label: "greedy" },
                  { from: "mid", to: "l0", label: "drop a layer" },
                  { from: "l0", to: "out", label: "beam" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The points and the search">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">800 points · upper-layer links · search path</p>
                <div className="mt-2 flex justify-center">
                  <Scatter M={o.M} q={o.q} onPick={(q) => set({ q })} trace={res.trace} got={got} truth={truth} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--good)" }} />found</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--bad)" }} />true neighbour missed</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} />visited on layer 0</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full" style={{ background: "var(--muted)" }} />on an upper layer</span>
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO({ ...NAIVE, q: o.q })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Sparse and narrow
                </button>
                <button type="button" onClick={() => setO({ ...TUNED, q: o.q })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Well connected
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Searching…">
                Search the graph
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Compare against every vector, or don't" what="An embedding model turns each document into a vector; similar meaning, nearby vectors. The exact answer compares the query with all of them. At millions of 768-number vectors that's billions of multiplications per query." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">brute force: {N} distances, exact · HNSW here: {res.distances} distances, {found} of 10 right</p>
              </FlowStep>
              <FlowArrow label="build layers" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Give each vector a random top layer" what={`Every vector is on layer 0; each layer up keeps about 1 in M of the one below, picked at random. Inserting a vector searches for its nearest neighbours (with a beam of ${EF_CONSTRUCTION}) and links to M of them on each of its layers.`} accent={ACCENT} active={at(1)}>
                <Choices<string> accent={ACCENT} value={String(o.M)} onChange={(v) => set({ M: Number(v) })} options={[{ id: "4", label: "M = 4" }, { id: "8", label: "M = 8" }, { id: "16", label: "M = 16" }]} />
                <p className="font-mono text-xs">{counts.map((c, l) => `layer ${l}: ${c}`).join(" · ")}</p>
                <p className="text-[11px] text-[var(--muted)]">Building it took {h.buildDistances.toLocaleString("en-US")} distance computations.</p>
              </FlowStep>
              <FlowArrow label="start at the top" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Descend greedily through the upper layers" what="The upper layers are sparse, so their links are long. Starting at the single entry point, keep moving to a neighbour closer to the query until none is, then drop to the next layer and repeat. A few hops cross the whole space." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs">{res.trace.slice(0, -1).map((t) => `layer ${t.layer}: ${t.visited.length} visited`).join(" · ") || "only one layer"}</p>
              </FlowStep>
              <FlowArrow label="layer 0" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Search the bottom layer with a beam" what="On layer 0 the search keeps the efSearch best candidates found so far and keeps expanding the closest one's neighbours until nothing closer turns up. A wider beam explores more and misses less." accent={ACCENT} active={at(3)}>
                <Slider label="efSearch" value={o.ef} min={10} max={80} step={10} format={(v) => String(v)} onChange={(v) => set({ ef: v })} accent={ACCENT} />
                <div className="flex flex-wrap gap-2">
                  {[[0.52, 0.47], [0.15, 0.85], [0.9, 0.1]].map((p) => (
                    <button key={p.join()} type="button" onClick={() => set({ q: p as Pt })} className="min-h-9 rounded-md border border-[var(--line)] px-2 text-xs text-[var(--muted)]">
                      Query at {p[0]}, {p[1]}
                    </button>
                  ))}
                </div>
                <p className="font-mono text-xs" style={{ color: found === K ? "var(--good)" : "var(--bad)" }}>
                  {found} of 10 · {res.distances} distances · {res.trace[res.trace.length - 1].visited.length} expanded on layer 0
                </p>
              </FlowStep>
              <FlowArrow label="tune it" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Trade recall for speed and memory" what="More links (M) and a wider beam (efSearch) find more of the true neighbours but compute more distances; more links also cost memory on every vector. Measure recall on your own queries, not someone's benchmark." accent={ACCENT} active={at(4)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[16rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">efSearch</th>
                        <th className="py-1 text-right font-normal">recall@10</th>
                        <th className="py-1 text-right font-normal">distances</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {table.map((t) => (
                        <tr key={t.ef} className="border-t border-[var(--line)]" style={{ fontWeight: t.ef === o.ef ? 600 : 400 }}>
                          <td className="py-1">{t.ef}</td>
                          <td className="py-1 text-right" style={{ color: t.recall > 0.95 ? "var(--good)" : "var(--bad)" }}>{(t.recall * 100).toFixed(1)}%</td>
                          <td className="py-1 text-right">{Math.round(t.distances)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="font-mono text-[11px] text-[var(--muted)]">
                  memory per 768-d vector at M = {o.M}: {Math.round(bytesPerVector(o.M)).toLocaleString("en-US")} bytes ({Math.round(bytesPerVector(o.M) - 768 * 4).toLocaleString("en-US")} of them links)
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">A real HNSW build and search over 800 generated 2-D points; recall is against brute force over 60 random queries. Neighbours are chosen by distance only, without the paper&apos;s diversity heuristic.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
