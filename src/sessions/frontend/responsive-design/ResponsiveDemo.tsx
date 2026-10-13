"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, Slider } from "@/components/session/ui";
import { at, BREAKPOINTS } from "@/lib/responsive";

const ACCENT = "var(--web)";

export default function ResponsiveDemo() {
  const [w, setW] = useState(700);
  const [dpr, setDpr] = useState("2");
  const r = at(w, Number(dpr));
  const scale = Math.min(1, 520 / w);
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Responsive design" blurb="One page, every screen. Start with the phone layout, then add min-width media queries that rearrange things as space allows. Images come in several sizes so each device downloads only what it can show. Drag the viewport width." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Simulated viewport">
              <div className="flex flex-wrap gap-1">{BREAKPOINTS.map((b) => <span key={b.name} className="rounded px-2 py-0.5 font-mono text-xs" style={{ background: r.active.includes(b.name) ? ACCENT : "var(--inset)", color: r.active.includes(b.name) ? "var(--on-accent)" : "var(--faint)" }}>{b.name}: ≥{b.min}</span>)}</div>
              <div className="mt-3 overflow-hidden rounded-lg border border-[var(--line-strong)]" style={{ width: w * scale, maxWidth: "100%" }}>
                <div className="flex items-center justify-between border-b border-[var(--line)] px-2 py-1 text-xs"><span className="font-medium">Shop</span>{r.nav === "links" ? <span className="text-[var(--muted)]">Lamps · Chairs · Desks · Cart</span> : <span className="rounded border border-[var(--line)] px-1.5">☰</span>}</div>
                <div className="flex gap-2 p-2">
                  {r.sidebar && <div className="w-1/5 rounded bg-[var(--inset)] p-1 text-[10px] text-[var(--muted)]">Filters</div>}
                  <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${r.cols}, minmax(0, 1fr))` }}>{Array.from({ length: 6 }, (_, i) => <div key={i} className="rounded bg-[var(--inset)] p-1"><div className="h-8 rounded" style={{ background: ACCENT, opacity: 0.6 }} /><p className="mt-1 text-[10px]">Lamp {i + 1}</p></div>)}</div>
                </div>
              </div>
              <p className="mt-3 font-mono text-xs">{w}px wide · {r.cols} column{r.cols > 1 ? "s" : ""} · nav: {r.nav} · image needs {r.needed}px → srcset picks <b style={{ color: ACCENT }}>lamp-{r.img}.jpg</b></p>
            </section>
          }
          panel={
            <SystemMapPanel caption={`At ${w}px: ${r.active.length ? r.active.join(", ") + " rules apply" : "only the base (mobile) styles apply"}. Each product image shows about ${Math.round(w / r.cols)} CSS pixels wide; at ${dpr}× density it needs ${r.needed} real pixels, so the browser downloads the ${r.img}px version.`}>
              <Slider label="Viewport width" accent={ACCENT} value={w} min={320} max={1440} step={20} format={(v) => `${v}px`} onChange={setW} />
              <Choices label="Screen density" accent={ACCENT} value={dpr} onChange={setDpr} options={[{ id: "1", label: "1×" }, { id: "2", label: "2× (retina)" }, { id: "3", label: "3×" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Mobile first" what="Write base styles for the narrowest screen, then add min-width queries that enhance." accent={ACCENT}><p className="font-mono text-xs">@media (min-width: 768px) {"{ … }"}</p></FlowStep>
              <FlowArrow label="layout" accent={ACCENT} />
              <FlowStep n={2} title="Let layout flex before it breaks" what="Grid with auto-fill and minmax, flex-wrap and clamp() for font sizes reduce how many breakpoints you need." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Container queries respond to the component&apos;s own width.</p></FlowStep>
              <FlowArrow label="images" accent={ACCENT} />
              <FlowStep n={3} title="srcset and sizes" what="Offer several widths; the browser picks by layout width and pixel density. Phones stop downloading desktop images." accent={ACCENT} active><p className="font-mono text-xs">&lt;img srcset=&quot;lamp-400.jpg 400w, lamp-800.jpg 800w&quot; sizes=&quot;…&quot;&gt;</p></FlowStep>
              <FlowArrow label="also" accent={ACCENT} />
              <FlowStep n={4} title="Touch targets and the viewport tag" what="Without the viewport meta tag, phones render a desktop page zoomed out. Keep tap targets at least ~44px." accent={ACCENT}><p className="font-mono text-xs">&lt;meta name=&quot;viewport&quot; content=&quot;width=device-width&quot;&gt;</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
