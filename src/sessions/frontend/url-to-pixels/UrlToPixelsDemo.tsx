"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { STEPS } from "@/lib/urlToPixels";

const ACCENT = "var(--web)";
const END = 460;

export default function UrlToPixelsDemo() {
  const playback = usePlayback(STEPS.length, 1300);
  const s = STEPS[playback.i];
  const painted = playback.i >= 8, interactive = playback.i >= 9;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="From URL to pixels" blurb="What happens between pressing Enter and seeing the page? A chain of network round trips, then the browser turning bytes into a DOM, styles, layout and finally pixels. Step through one page load." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Timeline and browser">
              <ul className="space-y-1">
                {STEPS.map((x, i) => (
                  <li key={x.name} className="grid grid-cols-[10rem_minmax(0,1fr)] items-center gap-2 text-[11px]" style={{ opacity: i <= playback.i ? 1 : 0.35 }}>
                    <span>{x.name}</span>
                    <span className="relative h-3 rounded bg-[var(--inset)]"><span className="absolute inset-y-0 rounded" style={{ left: `${(x.start / END) * 100}%`, width: `${(x.ms / END) * 100}%`, background: x.lane === "network" ? "var(--c4)" : ACCENT, outline: i === playback.i ? "2px solid var(--text)" : undefined }} /></span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-[var(--muted)]"><span className="text-[var(--c4)]">■</span> network · <span style={{ color: ACCENT }}>■</span> main thread · 0–{END} ms</p>
              <div className="mt-4 rounded-lg border border-[var(--line)]">
                <p className="border-b border-[var(--line)] px-2 py-1 font-mono text-[11px] text-[var(--muted)]">https://shop.example.com</p>
                <div className="h-24 p-3">{painted ? <><p className="font-semibold">Brass desk lamp</p><p className="text-sm text-[var(--muted)]">$40 · In stock</p><span className="mt-1 inline-block rounded px-2 py-0.5 text-xs" style={{ background: interactive ? ACCENT : "var(--ghost)", color: "var(--on-accent)" }}>{interactive ? "Add to cart" : "Add to cart (not ready)"}</span></> : <p className="text-sm text-[var(--faint)]">blank</p>}</div>
              </div>
            </section>
          }
          panel={<SystemMapPanel caption={`${s.name}, at ${s.start} ms: ${s.note}`}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`${playback.i + 1} of ${STEPS.length}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Connect" what="DNS, TCP and TLS cost round trips before any HTML arrives." accent={ACCENT} active={playback.i <= 1}><p className="text-sm text-[var(--muted)]">CDNs and connection reuse shrink this.</p></FlowStep>
              <FlowArrow label="receive" accent={ACCENT} />
              <FlowStep n={2} title="Parse while downloading" what="HTML is parsed as it streams in; the preload scanner spots CSS, JS and images early." accent={ACCENT} active={playback.i >= 2 && playback.i <= 5}><p className="text-sm text-[var(--muted)]">Sync scripts in the head stop the parser.</p></FlowStep>
              <FlowArrow label="render" accent={ACCENT} />
              <FlowStep n={3} title="Style, layout, paint" what="DOM + CSSOM make the render tree; layout computes geometry; paint and composite draw it." accent={ACCENT} active={playback.i >= 6 && playback.i <= 8}><p className="text-sm text-[var(--muted)]">See the rendering pipeline session.</p></FlowStep>
              <FlowArrow label="interact" accent={ACCENT} />
              <FlowStep n={4} title="JavaScript makes it usable" what="Scripts run and attach handlers. Until then the page looks ready but isn't." accent={ACCENT} active={playback.i === 9}><p className="text-sm text-[var(--muted)]">See hydration and Core Web Vitals.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
