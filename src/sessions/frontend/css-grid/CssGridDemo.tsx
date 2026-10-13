"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, Slider } from "@/components/session/ui";
import { GAP, layout, PRESETS, type Preset } from "@/lib/cssGrid";

const ACCENT = "var(--web)";
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];
const ROW = 46;

export default function CssGridDemo() {
  const [p, setP] = useState<Preset>("autofill");
  const [width, setWidth] = useState(700);
  const g = layout(p, width);
  const preset = PRESETS.find((x) => x.id === p)!;
  const pct = (px: number) => `${(px / width) * 100}%`;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="CSS Grid" blurb="Grid lays out rows and columns at the same time. Fixed tracks take their size, fr units share what's left, and auto-fill adds or removes columns as the container changes. Drag the width." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The grid">
              <pre className="whitespace-pre-wrap rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{preset.css}</pre>
              <p className="mt-3 font-mono text-xs text-[var(--faint)]">container {width}px · columns: {g.cols.map((c) => Math.round(c)).join(" | ")}</p>
              <div className="relative mt-2 rounded border border-dashed border-[var(--line-strong)]" style={{ width: `${(width / 900) * 100}%`, height: g.rows * ROW + (g.rows - 1) * GAP }}>
                {g.cells.map((c, i) => {
                  const w = g.cols.slice(c.col, c.col + c.span).reduce((a, b) => a + b, 0) + GAP * (c.span - 1);
                  return <div key={c.name} className="absolute grid place-items-center overflow-hidden rounded font-mono text-[11px]" style={{ left: pct(g.left[c.col]), width: pct(w), top: c.row * (ROW + GAP), height: ROW, background: COLORS[i % COLORS.length], color: "var(--on-accent)" }}>{c.name}</div>;
                })}
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={p === "autofill" ? `${g.cols.length} columns of at least 160px fit in ${width}px; the leftover is shared so they stretch to ${Math.round(g.cols[0])}px. No media queries.` : p === "sidebar" ? `The sidebar stays 200px; 1fr takes the remaining ${Math.round(g.cols[1])}px.` : p === "thirds" ? `Three 1fr columns share ${width}px minus two ${GAP}px gaps.` : "Areas name the regions; the header and footer span both columns."}>
              <Choices label="Template" accent={ACCENT} value={p} onChange={setP} options={PRESETS.map((x) => ({ id: x.id, label: x.label }))} />
              <Slider label="Container width" accent={ACCENT} value={width} min={360} max={900} step={20} format={(v) => `${v}px`} onChange={setWidth} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Define the tracks" what="grid-template-columns lists column sizes. px is fixed, fr is a share of the free space." accent={ACCENT} active={p === "thirds" || p === "sidebar"}><p className="font-mono text-xs">200px 1fr</p></FlowStep>
              <FlowArrow label="responsive without breakpoints" accent={ACCENT} />
              <FlowStep n={2} title="auto-fill + minmax" what="Fit as many columns as possible, each at least the minimum, then stretch them to fill the row." accent={ACCENT} active={p === "autofill"}><p className="font-mono text-xs">repeat(auto-fill, minmax(160px, 1fr))</p></FlowStep>
              <FlowArrow label="name the regions" accent={ACCENT} />
              <FlowStep n={3} title="Template areas" what="Draw the layout as strings, then place items with grid-area: head. Rearrange the strings in a media query to change the layout." accent={ACCENT} active={p === "areas"}><p className="font-mono text-xs">grid-area: main;</p></FlowStep>
              <FlowArrow label="grid or flex?" accent={ACCENT} />
              <FlowStep n={4} title="Grid for layouts, flex for lines" what="Grid when rows and columns must line up; flexbox when items flow in one direction and size to content." accent={ACCENT}><p className="text-sm text-[var(--muted)]">gap works in both.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
