"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { EDGES, NODES, pathTo, run } from "@/lib/dijkstra";

const ACCENT = "var(--dsa)";
const FRAMES = run();
const at = (id: string) => NODES.find((n) => n.id === id)!;

export default function DijkstraDemo() {
  const playback = usePlayback(FRAMES.length, 1200);
  const f = FRAMES[playback.i];
  const tree = new Set(Object.entries(f.prev).filter(([, p]) => p).map(([v, p]) => [p, v].sort().join("")));
  const best = playback.atEnd ? pathTo(f.prev, "F") : [];
  const onBest = (a: string, b: string) => best.some((x, i) => i > 0 && [best[i - 1], x].sort().join("") === [a, b].sort().join(""));
  return (
    <SessionPage>
      <SessionHeader kicker="DSA · interactive" title="Dijkstra: shortest paths" blurb="Find the cheapest route from A to every other node. Always settle the closest node you haven't settled yet, then see whether going through it makes its neighbours cheaper. Weights must not be negative." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Weighted graph">
              <svg viewBox="0 -5 410 230" className="w-full">
                {EDGES.map(([a, b, w]) => {
                  const A = at(a), B = at(b); const cur = f.edge && [a, b].sort().join("") === [...f.edge].sort().join(""); const inTree = tree.has([a, b].sort().join(""));
                  return (
                    <g key={a + b}>
                      <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={onBest(a, b) ? "var(--good)" : cur ? ACCENT : inTree ? "var(--muted)" : "var(--line)"} strokeWidth={onBest(a, b) || cur ? 4 : inTree ? 2.5 : 1.5} />
                      <text x={(A.x + B.x) / 2} y={(A.y + B.y) / 2 - 5} fontSize="13" textAnchor="middle" fill="var(--muted)" className="font-mono">{w}</text>
                    </g>
                  );
                })}
                {NODES.map((n) => {
                  const done = f.done.includes(n.id);
                  return (
                    <g key={n.id}>
                      <circle cx={n.x} cy={n.y} r="20" fill={done ? ACCENT : "var(--inset)"} stroke={n.id === f.cur ? "var(--text)" : "var(--line-strong)"} strokeWidth={n.id === f.cur ? 3 : 1.5} />
                      <text x={n.x} y={n.y + 5} fontSize="14" textAnchor="middle" fill={done ? "var(--on-accent)" : "var(--text)"}>{n.id}</text>
                      <text x={n.x} y={n.y < 100 ? n.y - 27 : n.y + 36} fontSize="12" textAnchor="middle" fill="var(--muted)" className="font-mono">{f.dist[n.id] === Infinity ? "∞" : f.dist[n.id]}</text>
                    </g>
                  );
                })}
              </svg>
              <p className="mt-2 font-mono text-xs text-[var(--muted)]">Queue (closest first): {f.queue.map(([n, d]) => `${n}:${d}`).join("  ") || "empty"}</p>
              {best.length > 0 && <p className="mt-1 font-mono text-sm text-[var(--good)]">A → F: {best.join(" → ")} = {f.dist.F}</p>}
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${FRAMES.length}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Start with ∞ everywhere" what="Distance 0 to the start, unknown (∞) to everything else. Put the start in a priority queue." accent={ACCENT} active={playback.i === 0}><p className="text-sm text-[var(--muted)]">The number under each node is its best known distance.</p></FlowStep>
              <FlowArrow label="pop the closest" accent={ACCENT} />
              <FlowStep n={2} title="Settle the closest node" what="Nothing can reach it more cheaply later, because every other route already costs more and weights aren't negative." accent={ACCENT} active={!!f.cur && !f.edge}><p className="text-sm text-[var(--muted)]">Filled nodes are final.</p></FlowStep>
              <FlowArrow label="relax its edges" accent={ACCENT} />
              <FlowStep n={3} title="Relax each edge" what="If going through this node is cheaper than a neighbour's current distance, update it and remember where you came from." accent={ACCENT} active={!!f.edge}><p className="font-mono text-xs">if (d[u] + w &lt; d[v]) d[v] = d[u] + w</p></FlowStep>
              <FlowArrow label="repeat" accent={ACCENT} />
              <FlowStep n={4} title="Follow the trail back" what="When everything is settled, walk the remembered predecessors back from the target to read off the path." accent={ACCENT} active={playback.atEnd}><p className="text-sm text-[var(--muted)]">O((V + E) log V) with a heap. Maps use variants like A*.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
