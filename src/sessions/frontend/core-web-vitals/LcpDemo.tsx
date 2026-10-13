"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { FIXES, waterfall, type Fix } from "@/lib/lcp";

const ACCENT = "var(--web)";
const SPAN = 4500;

export default function LcpDemo() {
  const [on, setOn] = useState<Set<Fix>>(new Set());
  const w = waterfall(on);
  const pct = (ms: number) => `${(Math.min(ms, SPAN) / SPAN) * 100}%`;
  const color = w.rating === "good" ? "var(--good)" : w.rating === "poor" ? "var(--bad)" : "var(--auto)";
  const toggle = (f: Fix) => setOn((s) => { const n = new Set(s); if (n.has(f)) n.delete(f); else n.add(f); return n; });
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Core Web Vitals: Largest Contentful Paint" blurb="LCP is when the biggest thing on screen, usually a hero image or headline, finishes drawing. Google counts under 2.5 s as good. It's a chain of waits, so fix the links. Times are illustrative." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Network waterfall">
              <p className="flex flex-wrap justify-between gap-2"><span className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Waterfall</span><span className="font-mono text-sm" style={{ color }}>LCP {(w.lcp / 1000).toFixed(2)} s · {w.rating}</span></p>
              <ul className="mt-3 space-y-2">
                {w.rows.map((r) => (
                  <li key={r.name} className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-2 text-xs">
                    <span className="truncate font-mono" style={{ color: r.blocking ? "var(--bad)" : undefined }}>{r.name}</span>
                    <span className="relative h-4 rounded bg-[var(--track)]"><span className="absolute inset-y-0 rounded" style={{ left: pct(r.from), width: pct(r.to - r.from), background: r.name === "hero.jpg" ? ACCENT : r.blocking ? "var(--bad)" : "var(--ghost)" }} /></span>
                  </li>
                ))}
                <li className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-2 text-xs"><span className="font-mono">LCP</span><span className="relative h-4"><span className="absolute inset-y-0 w-0.5" style={{ left: pct(w.lcp), background: color }} /><span className="absolute inset-y-0 w-px border-l border-dashed border-[var(--good)]" style={{ left: pct(2500) }} /></span></li>
              </ul>
              <p className="mt-2 text-xs text-[var(--muted)]">Dashed line: the 2.5 s “good” threshold.</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={`LCP ${(w.lcp / 1000).toFixed(2)} s with ${on.size} of ${FIXES.length} fixes.`}>
              <div className="w-full space-y-2">
                {FIXES.map((f) => (
                  <label key={f.id} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-md border border-[var(--line)] p-2 text-sm">
                    <input type="checkbox" checked={on.has(f.id)} onChange={() => toggle(f.id)} className="mt-1" style={{ accentColor: ACCENT }} />
                    <span><span className="font-medium">{f.label}</span><span className="block text-xs text-[var(--muted)]">{f.saves}</span></span>
                  </label>
                ))}
              </div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="The HTML has to arrive" what="Every round trip to a far-away server adds delay before anything starts." accent={ACCENT} active={!on.has("cdn")}><p className="text-sm text-[var(--muted)]">A CDN shortens every round trip.</p></FlowStep>
              <FlowArrow label="render-blocking files" accent={ACCENT} />
              <FlowStep n={2} title="CSS and sync scripts block rendering" what="Nothing paints until blocking CSS and scripts in the head finish. Defer scripts that aren't needed for the first paint." accent={ACCENT} active={!on.has("defer")}><p className="text-sm text-[var(--muted)]">&lt;script defer src=&quot;app.js&quot;&gt;</p></FlowStep>
              <FlowArrow label="find the image sooner" accent={ACCENT} />
              <FlowStep n={3} title="Start the hero image early" what="If the image is set in CSS or JS, the browser discovers it late. Preload it, or put it in the HTML with fetchpriority=high." accent={ACCENT} active={!on.has("preload")}><p className="text-sm text-[var(--muted)]">&lt;link rel=&quot;preload&quot; as=&quot;image&quot; href=&quot;hero.avif&quot;&gt;</p></FlowStep>
              <FlowArrow label="make it smaller" accent={ACCENT} />
              <FlowStep n={4} title="Send fewer bytes" what="Resize to the displayed size and use AVIF or WebP. A 1.2 MB photo for a 600 px slot is the most common LCP problem." accent={ACCENT} active={!on.has("compress")}><p className="text-sm text-[var(--muted)]">Also watch CLS (layout shifts) and INP (slow responses to input).</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
