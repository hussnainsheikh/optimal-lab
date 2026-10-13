"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { BUNDLES, STRATEGIES, timeline, type Strategy } from "@/lib/hydration";

const ACCENT = "var(--web)";
const SPAN = 4500;

export default function HydrationDemo() {
  const [kb, setKb] = useState("300");
  const rows = STRATEGIES.map((s) => ({ ...s, t: timeline(s.id, Number(kb)) }));
  const [focus, setFocus] = useState<Strategy>("ssr");
  const cur = rows.find((r) => r.id === focus)!;
  const pct = (ms: number) => `${(Math.min(ms, SPAN) / SPAN) * 100}%`;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Hydration" blurb="Server rendering gets content on screen early, but the page can't respond to clicks until its JavaScript has loaded and hydrated it. Compare when users see the page and when they can use it. Times are simplified, for a mid-range phone." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Timeline for each rendering strategy">
              {rows.map((r) => (
                <button key={r.id} type="button" onClick={() => setFocus(r.id)} className="mt-3 block w-full text-left first:mt-0" aria-pressed={r.id === focus}>
                  <p className="flex flex-wrap justify-between gap-2 text-sm" style={{ color: r.id === focus ? "var(--text)" : "var(--muted)" }}><span>{r.label}</span><span className="font-mono text-xs">visible {r.t.firstPaint} ms · usable {r.t.interactive} ms</span></p>
                  <span className="relative mt-1 block h-5 rounded bg-[var(--track)]" style={{ outline: r.id === focus ? `1px solid ${ACCENT}` : undefined }}>
                    <span className="absolute inset-y-0 left-0 rounded-l" style={{ width: pct(r.t.firstPaint), background: "var(--ghost)" }} />
                    {r.t.deadClicks > 0 && <span className="absolute inset-y-0" style={{ left: pct(r.t.firstPaint), width: pct(r.t.deadClicks), background: "var(--auto)" }} />}
                    <span className="absolute inset-y-0" style={{ left: pct(r.t.interactive), right: 0, background: "var(--good)" }} />
                  </span>
                </button>
              ))}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[var(--ghost)]" /> blank screen</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[var(--auto)]" /> visible, clicks do nothing</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[var(--good)]" /> interactive</span>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={`${cur.label}: content at ${cur.t.firstPaint} ms, clickable at ${cur.t.interactive} ms${cur.t.deadClicks ? `, ${cur.t.deadClicks} ms where clicks are ignored` : ""}.`}>
              <Choices label="JavaScript bundle" accent={ACCENT} value={kb} onChange={setKb} options={BUNDLES.map((b) => ({ id: String(b), label: `${b} KB` }))} />
              <Choices label="Focus" accent={ACCENT} value={focus} onChange={setFocus} options={STRATEGIES.map((s) => ({ id: s.id, label: s.label }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Client rendering: blank until JS runs" what="The HTML is an empty shell. Nothing shows until the bundle downloads and runs." accent={ACCENT} active={focus === "csr"}><p className="text-sm text-[var(--muted)]">Bigger bundle, longer blank screen.</p></FlowStep>
              <FlowArrow label="render on the server instead" accent={ACCENT} />
              <FlowStep n={2} title="Server HTML shows content early" what="The browser paints the HTML as soon as it arrives. It looks finished." accent={ACCENT} active={focus === "ssr"}><p className="text-sm text-[var(--muted)]">But buttons are still plain HTML with no handlers.</p></FlowStep>
              <FlowArrow label="the same JS still loads" accent={ACCENT} />
              <FlowStep n={3} title="Hydration attaches the handlers" what="React runs the components again in the browser, matches them to the existing HTML, and wires up events. Until then, clicks are lost. If the HTML differs from what the client renders (a date, a random id), React warns and patches it." accent={ACCENT} active={focus === "ssr"}><p className="text-sm text-[var(--muted)]">Usable at {timeline("ssr", Number(kb)).interactive} ms with {kb} KB.</p></FlowStep>
              <FlowArrow label="ship less JavaScript" accent={ACCENT} />
              <FlowStep n={4} title="Hydrate only what's interactive" what="Islands and React Server Components send no JavaScript for static parts, so the interactive bits are ready sooner." accent={ACCENT} active={focus === "islands"}><p className="text-sm text-[var(--muted)]">Usable at {timeline("islands", Number(kb)).interactive} ms.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
