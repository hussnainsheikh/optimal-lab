"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { chunkOf, firstLoad, MODULES, STRATEGIES, type Strategy } from "@/lib/codeSplitting";

const ACCENT = "var(--web)";
const CHUNK_COLORS: Record<string, string> = { main: "var(--c1)", home: "var(--c2)", settings: "var(--c3)", dashboard: "var(--c4)", chart: "var(--c5)", "settings-editor": "var(--auto)" };

export default function CodeSplittingDemo() {
  const [s, setS] = useState<Strategy>("single");
  const [page, setPage] = useState<"home" | "dashboard">("home");
  const f = firstLoad(s, page);
  const need = new Set(["main", page]);
  const chunks = [...new Set(MODULES.map((m) => chunkOf(s, m.route)))];
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Code splitting" blurb="A single bundle makes every visitor download the code for every page, including a 180 KB chart library most never see. Split by route, and load heavy parts only when they're needed." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Chunks">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{chunks.length} chunk{chunks.length > 1 ? "s" : ""}</p>
              <div className="mt-2 space-y-2">
                {chunks.map((c) => {
                  const mods = MODULES.filter((m) => chunkOf(s, m.route) === c);
                  const kb = mods.reduce((a, m) => a + m.kb, 0);
                  const loaded = need.has(c);
                  return (
                    <div key={c} className="rounded-lg border p-2" style={{ borderColor: loaded ? ACCENT : "var(--line)", opacity: loaded ? 1 : 0.5 }}>
                      <p className="flex justify-between font-mono text-xs"><span>{c}.js {loaded ? "· downloaded" : "· not needed yet"}</span><span>{kb} KB</span></p>
                      <div className="mt-1 flex flex-wrap gap-1">{mods.map((m) => <span key={m.name} className="rounded border-l-4 bg-[var(--inset)] px-1.5 py-0.5 text-[11px]" style={{ borderLeftColor: CHUNK_COLORS[m.route] ?? "var(--ghost)" }}>{m.name} {m.kb}</span>)}</div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 font-mono text-sm">first load of /{page}: <b style={{ color: ACCENT }}>{f.kb} KB</b> · ~{(f.ms / 1000).toFixed(1)} s on slow 4G</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={s === "single" ? `Every page downloads all ${f.kb} KB, including the chart library and the editor.` : s === "routes" ? `Home only needs shared code plus its own page: ${firstLoad("routes", "home").kb} KB. But the dashboard still pulls the whole chart library up front.` : `The chart and editor load only when someone opens them. Even the dashboard starts at ${firstLoad("lazy", "dashboard").kb} KB.`}>
              <Choices label="Bundling" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES} />
              <Choices label="Visitor opens" accent={ACCENT} value={page} onChange={setPage} options={[{ id: "home", label: "/home" }, { id: "dashboard", label: "/dashboard" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="JavaScript is expensive bytes" what="It has to download, parse and run before the page is interactive. On a mid-range phone that's slow." accent={ACCENT} active={s === "single"}><p className="text-sm text-[var(--muted)]">Check with the bundle analyzer.</p></FlowStep>
              <FlowArrow label="split by page" accent={ACCENT} />
              <FlowStep n={2} title="Route-based splitting" what="Each page gets its own chunk; shared code goes in a common one. Next.js and most routers do this automatically." accent={ACCENT} active={s === "routes"}><p className="text-sm text-[var(--muted)]">Common chunks are cached across pages.</p></FlowStep>
              <FlowArrow label="split by interaction" accent={ACCENT} />
              <FlowStep n={3} title="Lazy-load heavy parts" what="Dynamic import() loads a component when it's about to be shown: charts, editors, maps, modals." accent={ACCENT} active={s === "lazy"}><p className="font-mono text-xs">const Chart = lazy(() =&gt; import(&quot;./Chart&quot;))</p></FlowStep>
              <FlowArrow label="hide the wait" accent={ACCENT} />
              <FlowStep n={4} title="Prefetch what's likely next" what="Fetch the next chunk on hover or when idle, and show a skeleton while it loads. Don't split so finely that requests pile up." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Too many tiny chunks is its own problem.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
