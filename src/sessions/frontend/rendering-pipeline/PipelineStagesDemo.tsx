"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CHANGES, FRAME_BUDGET, STAGES } from "@/lib/renderPipeline";

const ACCENT = "var(--web)";

export default function PipelineStagesDemo() {
  const [id, setId] = useState("width");
  const c = CHANGES.find((x) => x.id === id)!;
  const over = c.ms > FRAME_BUDGET;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Style, layout, paint and composite" blurb="After your code changes the page, the browser redoes some of its work to update the pixels. What you change decides how much. Change the right property and an animation runs smoothly; change the wrong one and it stutters." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Which stages run">
              <p className="font-mono text-sm">{c.code}</p>
              <ol className="mt-4 flex flex-wrap items-center gap-1.5">
                {STAGES.map((s, i) => {
                  const on = c.runs.includes(s);
                  return (
                    <li key={s} className="flex items-center gap-1.5">
                      <span className="rounded-md border px-2.5 py-2 text-sm" style={{ borderColor: on ? ACCENT : "var(--line)", background: on ? "color-mix(in srgb, var(--web) 18%, transparent)" : "var(--inset)", color: on ? "var(--text)" : "var(--faint)", textDecoration: on ? undefined : "line-through" }}>{s}</span>
                      {i < STAGES.length - 1 && <span className="text-[var(--faint)]">→</span>}
                    </li>
                  );
                })}
              </ol>
              <div className="mt-5">
                <p className="flex justify-between text-xs text-[var(--muted)]"><span>Work per frame</span><span className="font-mono">{c.ms} ms of a {FRAME_BUDGET} ms budget (60 fps)</span></p>
                <span className="mt-1 block h-3 rounded bg-[var(--track)]"><span className="block h-full rounded" style={{ width: `${Math.min(100, (c.ms / FRAME_BUDGET) * 100)}%`, background: over ? "var(--bad)" : c.ms > 6 ? "var(--auto)" : "var(--good)" }} /></span>
                <p className="mt-2 text-sm" style={{ color: over ? "var(--bad)" : undefined }}>{over ? `${Math.ceil(c.ms / FRAME_BUDGET)} frames' worth of work: visible stutter.` : "Fits in one frame."}</p>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={c.note}>
              <Choices label="What your code changes" accent={ACCENT} value={id} onChange={setId} options={CHANGES.map((x) => ({ id: x.id, label: x.label }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Style: which rules apply" what="Recalculate the CSS that applies to changed elements." accent={ACCENT} active={c.runs.includes("Style")}><p className="text-sm text-[var(--muted)]">Cheap for a few elements.</p></FlowStep>
              <FlowArrow label="sizes and positions" accent={ACCENT} />
              <FlowStep n={2} title="Layout: where every box goes" what="Width, height, top, margins and font size change geometry, and one box can push many others. Usually the most expensive stage." accent={ACCENT} active={c.runs.includes("Layout")}><p className="text-sm text-[var(--muted)]">{c.runs.includes("Layout") ? "Runs for this change." : "Skipped."}</p></FlowStep>
              <FlowArrow label="pixels" accent={ACCENT} />
              <FlowStep n={3} title="Paint: fill in the pixels" what="Text, colours, borders and shadows are drawn into layers." accent={ACCENT} active={c.runs.includes("Paint")}><p className="text-sm text-[var(--muted)]">{c.runs.includes("Paint") ? "Runs for this change." : "Skipped."}</p></FlowStep>
              <FlowArrow label="layers" accent={ACCENT} />
              <FlowStep n={4} title="Composite: stack the layers" what="The compositor positions finished layers, often on the GPU. Animate transform and opacity and only this step runs." accent={ACCENT} active={!c.runs.includes("Layout") && !c.runs.includes("Paint")}><p className="text-sm text-[var(--muted)]">Read layout values in one pass, then write in another, to avoid thrashing.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
