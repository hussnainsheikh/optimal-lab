"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { depth, EDGES, N, rootOf, run } from "@/lib/unionFind";

const ACCENT = "var(--dsa)";
const FRAMES = run(true);
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--ai)", "var(--web)", "var(--ops)"];

export default function UnionFindDemo() {
  const playback = usePlayback(FRAMES.length, 1300);
  const f = FRAMES[playback.i];
  const roots = [...new Set(f.parent.map((_, i) => rootOf(f.parent, i)))];
  return (
    <SessionPage>
      <SessionHeader kicker="DSA · interactive" title="Union-find: connected groups" blurb="Union-find tracks which items are connected as edges arrive. Each group has a root; two items are connected if they share one. Merging attaches one root under the other. It answers “are these connected?” almost instantly." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Groups and the parent array">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Edges</p>
              <ol className="mt-2 flex flex-wrap gap-1.5 font-mono text-xs">
                {EDGES.map(([a, b], i) => <li key={i} className="rounded px-2 py-1" style={{ background: "var(--inset)", outline: f.edge && f.edge[0] === a && f.edge[1] === b ? `2px solid ${ACCENT}` : undefined, opacity: i < playback.i ? 0.5 : 1 }}>{a}–{b}</li>)}
              </ol>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{f.components} groups</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {roots.map((r) => (
                  <div key={r} className="rounded-lg border p-2" style={{ borderColor: COLORS[r] }}>
                    <p className="font-mono text-[11px] text-[var(--faint)]">root {r}</p>
                    <div className="mt-1 flex flex-wrap gap-1">{f.parent.map((_, i) => i).filter((i) => rootOf(f.parent, i) === r).map((i) => <span key={i} className="grid h-8 w-8 place-items-center rounded-full font-mono text-xs" style={{ background: COLORS[r], color: "var(--on-accent)", outline: f.edge?.includes(i) ? "2px solid var(--text)" : undefined }}>{i}</span>)}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">parent[]</p>
              <div className="mt-1 grid grid-cols-8 gap-1 font-mono text-xs">
                {f.parent.map((p, i) => <span key={i} className="rounded bg-[var(--inset)] py-1 text-center"><span className="block text-[10px] text-[var(--faint)]">{i}</span>{p}<span className="block text-[10px] text-[var(--faint)]">d{depth(f.parent, i)}</span></span>)}
              </div>
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next edge" status={`edge ${playback.i} of ${EDGES.length}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Find: follow parents to the root" what="Each item points at a parent. The root points at itself and names the group." accent={ACCENT}><p className="font-mono text-xs">while (parent[x] !== x) x = parent[x]</p></FlowStep>
              <FlowArrow label="merge" accent={ACCENT} />
              <FlowStep n={2} title="Union: attach the smaller root" what="Hang the smaller group under the bigger one's root, so trees stay shallow." accent={ACCENT} active={!!f.edge && !f.text.includes("Skip")}><p className="text-sm text-[var(--muted)]">d = depth; it stays tiny.</p></FlowStep>
              <FlowArrow label="same root?" accent={ACCENT} />
              <FlowStep n={3} title="Same root means already connected" what="An edge between two items with the same root would close a loop. That's how Kruskal's algorithm and cycle checks use it." accent={ACCENT} active={f.text.includes("Skip")}><p className="text-sm text-[var(--muted)]">Count of groups = connected components.</p></FlowStep>
              <FlowArrow label="speed" accent={ACCENT} />
              <FlowStep n={4} title="Path compression" what="During find, point every node you passed straight at the root. With union by size, operations are nearly O(1)." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Amortised O(α(n)), effectively constant.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
