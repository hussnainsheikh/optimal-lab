"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { FIXES, weigh } from "@/lib/pageWeight";

const ACCENT = "var(--web)";

export default function PageWeightDemo() {
  const [on, setOn] = useState<Set<string>>(new Set());
  const w = weigh(on);
  const toggle = (id: string) => setOn((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const parts = [["Hero image", w.hero, ACCENT], ["Gallery images", w.gallery, "var(--c4)"], ["Fonts", w.fonts, "var(--auto)"], ["Everything else", 300, "var(--ghost)"]] as const;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Images and fonts" blurb="On most pages, images and fonts outweigh all the JavaScript. A full-size JPEG in a small slot, a gallery nobody scrolls to, and six weights of a font each cost seconds on a phone. Apply the fixes. Sizes and timings are illustrative." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Page weight">
              <div className="flex h-8 overflow-hidden rounded">{parts.map(([k, v, c]) => <span key={k} title={`${k}: ${v} KB`} style={{ width: `${(v / 4780) * 100}%`, background: c }} />)}</div>
              <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">{parts.map(([k, v, c]) => <li key={k} className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: c }} />{k}: <span className="font-mono">{v} KB</span></li>)}</ul>
              {w.deferred > 0 && <p className="mt-1 text-xs text-[var(--muted)]">+{w.deferred} KB of gallery loads later, only if the user scrolls.</p>}
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {[["Initial download", `${(w.total / 1000).toFixed(2)} MB`], ["LCP (slow 4G)", `${(w.lcp / 1000).toFixed(1)} s`], ["Text visible", `${(w.textVisible / 1000).toFixed(1)} s`]].map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono text-lg">{v}</dd></div>)}
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={on.size === 0 ? "4.8 MB before the user sees anything useful, and text stays invisible while fonts download." : `Down to ${(w.total / 1000).toFixed(2)} MB. ${on.has("swap") ? "Text shows in a fallback font immediately, then swaps." : "Text is still hidden until the font arrives: add font-display: swap."}`}>
              <div className="w-full space-y-1.5">{FIXES.map((f) => <label key={f.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] px-2 text-sm"><input type="checkbox" checked={on.has(f.id)} onChange={() => toggle(f.id)} style={{ accentColor: ACCENT }} />{f.label}</label>)}</div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Modern formats" what="AVIF and WebP are typically 30–70% smaller than JPEG at the same quality." accent={ACCENT} active={on.has("avif")}><p className="text-sm text-[var(--muted)]">Use &lt;picture&gt; for fallbacks.</p></FlowStep>
              <FlowArrow label="right size" accent={ACCENT} />
              <FlowStep n={2} title="Serve the displayed size" what="A 4000px photo in a 600px slot wastes most of its bytes. srcset lets the browser pick." accent={ACCENT} active={on.has("resize")}><p className="text-sm text-[var(--muted)]">Image CDNs resize on the fly.</p></FlowStep>
              <FlowArrow label="later" accent={ACCENT} />
              <FlowStep n={3} title="Lazy-load below the fold, prioritise the hero" what="loading=&quot;lazy&quot; for images further down; fetchpriority=&quot;high&quot; for the LCP image, never lazy." accent={ACCENT} active={on.has("lazy")}><p className="text-sm text-[var(--muted)]">Set width and height to avoid layout shift.</p></FlowStep>
              <FlowArrow label="fonts" accent={ACCENT} />
              <FlowStep n={4} title="Fewer, smaller fonts that don't block text" what="Subset to the characters you use, WOFF2, two weights or a variable font, and font-display: swap." accent={ACCENT} active={on.has("subset") || on.has("swap")}><p className="text-sm text-[var(--muted)]">next/font does much of this.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
