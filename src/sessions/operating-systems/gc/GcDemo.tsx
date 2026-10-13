"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { EDGES, NODES, run, type Mode } from "@/lib/garbageCollection";

const ACCENT = "var(--os)";
const at = (id: string) => NODES.find((n) => n.id === id)!;

export default function GcDemo() {
  const [mode, setMode] = useState<Mode>("mark-sweep");
  return (
    <SessionPage>
      <SessionHeader kicker="Operating systems · interactive" title="Garbage collection" blurb="A garbage collector frees objects your program can no longer reach. Reference counting frees things the moment nothing points at them, but misses cycles. Mark and sweep traces from the roots and frees everything it didn't reach." />
      <div className="mt-6"><Run key={mode} mode={mode} setMode={setMode} /></div>
    </SessionPage>
  );
}

function Run({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const fr = run(mode);
  const playback = usePlayback(fr.length, 1100);
  const f = fr[playback.i];
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Heap graph">
          <svg viewBox="0 0 340 210" className="w-full">
            <defs><marker id="gca" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--muted)" /></marker></defs>
            {EDGES.map(([a, b], i) => { const A = at(a), B = at(b); const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy), k = 22 / L; const off = a === "oldView" ? 8 : a === "oldTab" ? -8 : 0; return <line key={i} x1={A.x + dx * k + off} y1={A.y + dy * k} x2={B.x - dx * k + off} y2={B.y - dy * k} stroke="var(--muted)" strokeWidth="1.5" markerEnd="url(#gca)" />; })}
            {NODES.map((n) => {
              const marked = f.marked.includes(n.id), freed = f.freed.includes(n.id);
              return (
                <g key={n.id} opacity={freed ? 0.35 : 1}>
                  <rect x={n.x - 28} y={n.y - 14} width="56" height="28" rx="6" fill={n.root ? "var(--text)" : marked ? ACCENT : "var(--inset)"} stroke={n.id === f.cur ? "var(--text)" : freed ? "var(--bad)" : "var(--line-strong)"} strokeWidth={n.id === f.cur ? 2.5 : 1.2} strokeDasharray={freed ? "4 3" : undefined} />
                  <text x={n.x} y={n.y + 4} fontSize="11" textAnchor="middle" fill={n.root || marked ? "var(--on-accent)" : "var(--text)"}>{n.id}</text>
                  {f.counts && !n.root && <text x={n.x + 30} y={n.y - 14} fontSize="11" fill="var(--auto)" className="font-mono">{f.counts[n.id]}</text>}
                  {freed && <text x={n.x} y={n.y + 26} fontSize="10" textAnchor="middle" fill="var(--bad)">freed</text>}
                </g>
              );
            })}
          </svg>
          <p className="text-xs text-[var(--muted)]">{mode === "refcount" ? "Amber numbers: reference counts." : "Filled: marked reachable. Dashed red: swept."}</p>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="Collector" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "refcount", label: "Reference counting" }, { id: "mark-sweep", label: "Mark and sweep" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${fr.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Reachable means alive" what="Anything you can get to from a root (globals, the stack) might still be used. Everything else is garbage." accent={ACCENT}><p className="text-sm text-[var(--muted)]">You can&apos;t leak what you can&apos;t reach… almost.</p></FlowStep>
          <FlowArrow label="count pointers" accent={ACCENT} />
          <FlowStep n={2} title="Reference counting" what="Free an object when its count hits zero. Immediate and predictable, but cycles keep each other alive." accent={ACCENT} active={mode === "refcount"}><p className="text-sm text-[var(--muted)]">Swift, Rust&apos;s Rc; Python adds a cycle collector.</p></FlowStep>
          <FlowArrow label="trace instead" accent={ACCENT} />
          <FlowStep n={3} title="Mark and sweep" what="Mark everything reachable from the roots, then free the rest. Cycles aren't a problem." accent={ACCENT} active={mode === "mark-sweep"}><p className="text-sm text-[var(--muted)]">JavaScript, Java, Go, C#.</p></FlowStep>
          <FlowArrow label="the cost" accent={ACCENT} />
          <FlowStep n={4} title="Generations and pauses" what="Most objects die young, so collectors scan new objects often and old ones rarely. Real leaks are objects still reachable: forgotten listeners, caches, globals." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Heap snapshots find what holds them.</p></FlowStep>
        </>
      }
    />
  );
}
