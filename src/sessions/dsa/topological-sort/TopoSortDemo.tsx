"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { COURSES, edges, run } from "@/lib/topoSort";

const ACCENT = "var(--dsa)";
const at = (id: string) => COURSES.find((n) => n.id === id)!;

export default function TopoSortDemo() {
  const [mode, setMode] = useState("dag");
  return (
    <SessionPage>
      <SessionHeader kicker="DSA · interactive" title="Topological sort: an order that respects dependencies" blurb="Courses with prerequisites, build steps, package installs: what can you do first? Count each item's unmet prerequisites, start with the ones at zero, and unlock the rest as you go." />
      <div className="mt-6"><Run key={mode} cycle={mode === "cycle"} mode={mode} setMode={setMode} /></div>
    </SessionPage>
  );
}

function Run({ cycle, mode, setMode }: { cycle: boolean; mode: string; setMode: (v: string) => void }) {
  const frames = run(cycle);
  const E = edges(cycle);
  const playback = usePlayback(frames.length, 1300);
  const f = frames[playback.i];
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Dependency graph">
          <svg viewBox="0 0 440 210" className="w-full">
            <defs><marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--muted)" /></marker></defs>
            {E.map(([a, b]) => {
              const A = at(a), B = at(b); const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy); const k = 30 / L;
              const back = a === "Systems";
              return back
                ? <path key={a + b} d={`M${A.x} ${A.y - 22} C ${A.x - 20} -20, ${B.x + 40} -20, ${B.x + 24} ${B.y - 14}`} fill="none" stroke="var(--bad)" strokeWidth="2" markerEnd="url(#arr)" />
                : <line key={a + b} x1={A.x + dx * k} y1={A.y + dy * k} x2={B.x - dx * k} y2={B.y - dy * k} stroke={f.order.includes(a) ? ACCENT : "var(--line-strong)"} strokeWidth="2" markerEnd="url(#arr)" />;
            })}
            {COURSES.map((c) => {
              const done = f.order.includes(c.id); const queued = f.queue.includes(c.id);
              return (
                <g key={c.id}>
                  <rect x={c.x - 34} y={c.y - 18} width="68" height="36" rx="8" fill={done ? ACCENT : "var(--inset)"} stroke={c.id === f.cur ? "var(--text)" : queued ? "var(--good)" : "var(--line-strong)"} strokeWidth={c.id === f.cur || queued ? 2.5 : 1.2} />
                  <text x={c.x} y={c.y + 5} fontSize="13" textAnchor="middle" fill={done ? "var(--on-accent)" : "var(--text)"}>{c.id}</text>
                  {!done && <text x={c.x + 30} y={c.y - 22} fontSize="12" textAnchor="middle" fill={f.indeg[c.id] ? "var(--auto)" : "var(--good)"} className="font-mono">{f.indeg[c.id]}</text>}
                </g>
              );
            })}
          </svg>
          <p className="mt-2 font-mono text-xs text-[var(--muted)]">Ready queue: {f.queue.join(", ") || "empty"}</p>
          <p className="mt-1 font-mono text-sm" style={{ color: f.stuck ? "var(--bad)" : undefined }}>Order: {f.order.join(" → ") || "—"}</p>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="Prerequisites" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "dag", label: "No loops" }, { id: "cycle", label: "Systems requires Data" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Take next" status={`step ${playback.i + 1} of ${frames.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Count incoming edges" what="For each node, count how many prerequisites point at it. That's the small number on each box." accent={ACCENT} active={playback.i === 0}><p className="font-mono text-xs">indegree[v]++ for each edge u → v</p></FlowStep>
          <FlowArrow label="zeros can start" accent={ACCENT} />
          <FlowStep n={2} title="Queue everything at zero" what="These have nothing left to wait for." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Green outline: in the ready queue.</p></FlowStep>
          <FlowArrow label="take one" accent={ACCENT} />
          <FlowStep n={3} title="Take one and unlock its dependents" what="Add it to the order and subtract one from each node it points to. Any that reach zero join the queue." accent={ACCENT} active={!!f.cur}><p className="text-sm text-[var(--muted)]">O(V + E).</p></FlowStep>
          <FlowArrow label="leftovers?" accent={ACCENT} />
          <FlowStep n={4} title="Leftovers mean a cycle" what="If the queue empties before every node is taken, some nodes wait on each other forever. No valid order exists." accent={ACCENT} active={!!f.stuck}><p className="text-sm text-[var(--muted)]">Build tools and package managers report exactly this.</p></FlowStep>
        </>
      }
    />
  );
}
