"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, Slider } from "@/components/session/ui";
import { MODES, sees, type Mode } from "@/lib/renderingModes";

const ACCENT = "var(--web)";

export default function RenderingModesDemo() {
  const [m, setM] = useState<Mode>("ssg");
  const [t, setT] = useState(30);
  const md = MODES.find((x) => x.id === m)!;
  const v = sees(m, t);
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="CSR, SSR, SSG and ISR" blurb="Where and when is the HTML made? In the browser, on every request, once at build time, or at build time and then refreshed in the background. Each trades speed, freshness and server cost differently. The author fixes a typo; when do readers see it?" />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Comparison">
              <ul className="space-y-1.5">{MODES.map((x) => <li key={x.id} className="grid grid-cols-[9rem_minmax(0,1fr)_4rem] items-center gap-2 text-xs" style={{ opacity: x.id === m ? 1 : 0.55 }}><span>{x.label}</span><span className="relative h-4 rounded bg-[var(--track)]"><span className="absolute inset-y-0 left-0 rounded-l" style={{ width: `${(x.ttfb / 1500) * 100}%`, background: "var(--ghost)" }} /><span className="absolute inset-y-0 rounded" style={{ left: `${(x.ttfb / 1500) * 100}%`, width: `${((x.content - x.ttfb) / 1500) * 100}%`, background: x.id === m ? ACCENT : "var(--muted)" }} /></span><span className="text-right font-mono">{x.content} ms</span></li>)}</ul>
              <p className="mt-1 text-[11px] text-[var(--muted)]">Grey: waiting for the first byte. Colour: until the article text is visible.</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {[["Server work", md.serverWork], ["Build", md.build], ["Freshness", md.fresh], ["SEO", md.seo]].map(([k, val]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd>{val}</dd></div>)}
              </dl>
              <p className="mt-3 rounded-lg border-2 p-2 text-sm" style={{ borderColor: v === "new" ? "var(--good)" : "var(--auto)" }}>A reader {t} s after the fix sees the <b>{v}</b> version.</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={m === "csr" ? "The server sends an empty shell; the browser fetches data and renders. Fresh, but slow to show content and weak for SEO." : m === "ssr" ? "The server renders on every request: always fresh, but every visitor waits for it and you pay for every render." : m === "ssg" ? "Pages are pre-built HTML on a CDN: fastest and cheapest, but stale until the next build." : "Static speed, and after the revalidate window (60 s) the next visitor triggers a background rebuild of just that page."}>
              <Choices label="Rendering" accent={ACCENT} value={m} onChange={setM} options={MODES.map((x) => ({ id: x.id, label: x.label }))} />
              <Slider label="Reader arrives after the fix" accent={ACCENT} value={t} min={0} max={300} step={10} format={(x) => `${x} s`} onChange={setT} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="CSR: render in the browser" what="Good for app-like screens behind a login, where SEO doesn't matter." accent={ACCENT} active={m === "csr"}><p className="text-sm text-[var(--muted)]">Dashboards, editors.</p></FlowStep>
              <FlowArrow label="per request" accent={ACCENT} />
              <FlowStep n={2} title="SSR: render on each request" what="For personalised or constantly changing pages that must be crawlable." accent={ACCENT} active={m === "ssr"}><p className="text-sm text-[var(--muted)]">Cache aggressively where you can.</p></FlowStep>
              <FlowArrow label="ahead of time" accent={ACCENT} />
              <FlowStep n={3} title="SSG and ISR: render ahead" what="Docs, blogs, marketing and product pages. ISR or on-demand revalidation keeps them fresh without full rebuilds." accent={ACCENT} active={m === "ssg" || m === "isr"}><p className="font-mono text-xs">export const revalidate = 60</p></FlowStep>
              <FlowArrow label="mix" accent={ACCENT} />
              <FlowStep n={4} title="Choose per route" what="Modern frameworks let each page pick. Static shell plus streamed dynamic parts is increasingly common." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Next.js, Astro, Remix, Nuxt.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
