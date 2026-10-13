"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { frames, SPAN, TASK_MS, TASK_START } from "@/lib/workerJank";

const ACCENT = "var(--web)";

export default function WorkerDemo() {
  const [w, setW] = useState("main");
  const fr = frames(w === "worker");
  const dropped = fr.filter((f) => f.dropped).length;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Web Workers" blurb={`A page animates at 60 frames a second, then starts a ${(TASK_MS / 1000).toFixed(1)}-second calculation (parsing a big file, say). JavaScript on the main thread blocks rendering and input until it finishes. A Web Worker runs it on another thread.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Frames over two seconds">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Main thread</p>
              <div className="relative mt-1 h-6 rounded bg-[var(--inset)]">{w === "main" && <span className="absolute inset-y-0 grid place-items-center rounded font-mono text-[10px]" style={{ left: `${(TASK_START / SPAN) * 100}%`, width: `${(TASK_MS / SPAN) * 100}%`, background: "var(--bad)", color: "var(--on-accent)" }}>calculation</span>}</div>
              {w === "worker" && <><p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Worker thread</p><div className="relative mt-1 h-6 rounded bg-[var(--inset)]"><span className="absolute inset-y-0 grid place-items-center rounded font-mono text-[10px]" style={{ left: `${(TASK_START / SPAN) * 100}%`, width: `${(TASK_MS / SPAN) * 100}%`, background: ACCENT, color: "var(--on-accent)" }}>calculation</span></div></>}
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Frames painted</p>
              <div className="mt-1 flex gap-px">{fr.map((f, i) => <span key={i} className="h-6 flex-1" style={{ background: f.dropped ? "var(--bad)" : "var(--good)" }} />)}</div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>0 s</span><span>2 s</span></div>
              <p className="mt-3 font-mono text-sm" style={{ color: dropped ? "var(--bad)" : "var(--good)" }}>{dropped} of {fr.length} frames dropped{dropped ? " · clicks ignored for 1.2 s" : ""}</p>
            </section>
          }
          panel={<SystemMapPanel caption={w === "main" ? "For 1.2 seconds the browser can't paint or respond: the animation freezes and clicks queue up. That's a long task." : "The calculation runs in parallel. The main thread stays free for rendering and input, and gets the result by message when it's done."}><Choices label="Run the calculation on" accent={ACCENT} value={w} onChange={setW} options={[{ id: "main", label: "Main thread" }, { id: "worker", label: "Web Worker" }]} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="One main thread does everything" what="JavaScript, style, layout, paint and input handling share it. A long task blocks them all." accent={ACCENT} active={w === "main"}><p className="text-sm text-[var(--muted)]">Over 50 ms counts as a long task.</p></FlowStep>
              <FlowArrow label="move it" accent={ACCENT} />
              <FlowStep n={2} title="Workers run on their own thread" what="new Worker(url) starts a separate JavaScript context with no DOM access." accent={ACCENT} active={w === "worker"}><p className="font-mono text-xs">const w = new Worker(new URL(&quot;./parse.ts&quot;, import.meta.url))</p></FlowStep>
              <FlowArrow label="talk" accent={ACCENT} />
              <FlowStep n={3} title="Communicate by messages" what="postMessage copies data across (or transfers ArrayBuffers for free). Comlink makes it feel like function calls." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Copying huge objects has its own cost.</p></FlowStep>
              <FlowArrow label="when" accent={ACCENT} />
              <FlowStep n={4} title="Good fits" what="Parsing large files, image processing, search indexes, syntax highlighting, running WASM." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Not for small tasks: startup isn&apos;t free.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
