"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { NAIVE, RTT_MS, TUNED, bundle, kb, nativeLoad, type Kept, type Opts } from "@/lib/moduleGraph";

const ACCENT = "var(--web)";
type Delivery = "bundle" | "native";

const SIDE_EFFECTS = [
  { id: "unknown", label: "not declared", json: "// no \"sideEffects\" field" },
  { id: "accurate", label: "[\"./analytics.js\"]", json: "\"sideEffects\": [\"./analytics.js\"]" },
  { id: "false", label: "false", json: "\"sideEffects\": false" },
] as const;

/** lodash-es is 14 tiny files; show them as one row. */
function grouped(rows: Kept[]) {
  const lodash = rows.filter((r) => r.file.startsWith("lodash-es/"));
  const rest = rows.filter((r) => !r.file.startsWith("lodash-es/"));
  if (!lodash.length) return rest;
  const sum = (k: "kb" | "full") => lodash.reduce((a, r) => a + r[k], 0);
  return [...rest, { id: "lodash-es", file: `lodash-es (${lodash.length} files)`, kb: sum("kb"), full: sum("full"), why: "only debounce and the helpers it imports", chunk: lodash[0].chunk }];
}

export default function ModulesDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const [delivery, setDelivery] = useState<Delivery>("bundle");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const n = nativeLoad(o);
  const b = bundle(o);
  const native = delivery === "native";
  const firstLoadKb = native ? n.kb : b.mainKb;
  const lodashKb = grouped(b.chunks.main).find((r) => r.file.startsWith("lodash"))?.kb ?? 0;

  const nodes: MapNode[] = [
    { id: "browser", label: "Browser", sub: native ? `${n.requests} requests · ${n.ms} ms` : `${kb(firstLoadKb)} first load`, at: [14, 22], mobileAt: [25, 12], state: native && n.cjsBroken ? "bad" : "active" },
    { id: "main", label: "main.js", sub: "the entry", at: [50, 22], mobileAt: [75, 12], state: "active" },
    { id: "utils", label: "utils/index.js", sub: "a barrel of 3 modules", at: [86, 22], mobileAt: [75, 45], state: b.pageViewSent ? "good" : "bad" },
    { id: "cart", label: "cart.js", sub: "uses debounce", at: [86, 78], mobileAt: [75, 80], state: "active" },
    { id: "lodash", label: o.lodash === "esm" ? "lodash-es" : "lodash (CommonJS)", sub: `${kb(lodashKb)} kept`, at: [50, 78], mobileAt: [25, 80], state: o.lodash === "esm" ? "good" : "bad" },
    { id: "charts", label: "charts.js", sub: o.lazyCharts ? `${kb(b.chartsKb)}, on click` : "in the first load", at: [14, 78], mobileAt: [25, 45], state: o.lazyCharts ? "good" : "wait" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("g", ["browser", "main", "utils"], { label: "import" })
    : stage === 1 ? (native ? hops("n", ["main", "cart", "lodash"], { label: `${n.roundTrips} round trip${n.roundTrips === 1 ? "" : "s"}`, tone: n.roundTrips > 2 ? "bad" : "good" }) : hops("n", ["main", "browser"], { label: "1 file", tone: "good" }))
    : stage === 2 ? hops("t", ["lodash", "cart"], { label: o.lodash === "esm" ? "debounce only" : "all 72 KB", tone: o.lodash === "esm" ? "good" : "bad" })
    : stage === 3 ? hops("s", ["utils", "main"], { label: b.pageViewSent ? "analytics kept" : "analytics dropped!", tone: b.pageViewSent ? "good" : "bad" })
    : stage === 4 ? hops("c", ["main", "charts"], { label: o.lazyCharts ? "import()" : "static import", tone: o.lazyCharts ? "good" : "accent" })
    : [];

  const captions = [
    `Step 1: starting at main.js, ${n.requests} modules are reachable through import statements, ${n.levels} levels deep.`,
    native ? (n.cjsBroken ? "Step 2: the browser can't load lodash: it's CommonJS, which only a bundler (or an ESM build) can turn into imports." : `Step 2: the browser finds each level of imports only after fetching the one above: ${n.roundTrips} round trip${n.roundTrips === 1 ? "" : "s"}, ${n.ms} ms before main.js runs.`) : "Step 2: the bundler joins the modules into one file, so the browser fetches the code in one request.",
    o.lodash === "esm" ? `Step 3: lodash-es is ES modules, so the bundler keeps debounce and its helpers: ${kb(lodashKb)}.` : "Step 3: lodash is CommonJS: its exports only exist at runtime, so all 72 KB is kept for one function.",
    b.pageViewSent ? `Step 4: modules that might do something when loaded are kept${o.sideEffects === "unknown" ? ", including 28 KB of date locales nobody uses" : ""}.` : "Step 4: \"sideEffects\": false told the bundler analytics.js does nothing on load. It was dropped, and page views stopped.",
    o.lazyCharts ? `Step 5: import() puts the ${kb(b.chartsKb)} chart code in its own chunk, fetched when someone opens a chart.` : `Step 5: the chart code is imported statically, so all ${kb(b.mainKb)} loads up front.`,
  ];
  const caption = stage !== null ? captions[stage] : native ? `${n.requests} files over ${n.roundTrips} round trip${n.roundTrips === 1 ? "" : "s"} (${kb(n.kb)})${n.cjsBroken ? " · lodash fails to load" : ""}.` : `First load ${kb(b.mainKb)}${o.lazyCharts ? `, charts ${kb(b.chartsKb)} later` : ""} · from ${kb(b.before)} of source${b.pageViewSent ? "" : " · page views lost"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="ES modules and bundling"
        blurb="Browsers can load ES modules directly, one file at a time. Bundlers join them into a few files and leave out exports nobody imports. How much they can leave out depends on how the code is written: ES modules or CommonJS, side effects declared or not, and where import() splits it."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The browser loads main.js, which imports a utils barrel and cart.js; cart.js imports lodash; charts.js is imported statically or with import()"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "browser", to: "main", label: "<script type=module>" },
                  { from: "main", to: "utils", label: "formatPrice" },
                  { from: "main", to: "cart", label: "renderCart" },
                  { from: "cart", to: "lodash", label: "debounce" },
                  { from: "main", to: "charts", label: o.lazyCharts ? "import()" : "import", dashed: o.lazyCharts },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label={native ? "Files the browser requests" : "What ends up in each chunk"}>
                {native ? (
                  <>
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                      {n.requests} requests · {n.roundTrips} round trip{n.roundTrips === 1 ? "" : "s"} · {kb(n.kb)}
                    </p>
                    <ol className="mt-2 space-y-0.5">
                      {Array.from({ length: n.levels }, (_, i) => i + 1).map((lvl) => {
                        const files = n.files.filter((f) => f.level === lvl);
                        const start = o.preload ? 0 : lvl - 1;
                        return (
                          <li key={lvl} className="flex items-center gap-2 text-[11px]">
                            <span className="w-14 shrink-0 font-mono text-[var(--faint)]">{start * RTT_MS}ms</span>
                            <span className="h-3 shrink-0 rounded-sm" style={{ width: `${(1 / n.levels) * 40}%`, marginLeft: `${(start / n.levels) * 40}%`, background: files.some((f) => f.id === "lodash") ? "var(--bad)" : ACCENT }} />
                            <span className="min-w-0 truncate font-mono">{files.map((f) => f.file.replace("lodash-es/", "")).join(", ")}</span>
                          </li>
                        );
                      })}
                    </ol>
                    {n.cjsBroken && <p className="mt-2 font-mono text-[11px] text-[var(--bad)]">SyntaxError: The requested module &apos;lodash/lodash.js&apos; does not provide an export named &apos;debounce&apos;</p>}
                  </>
                ) : (
                  <>
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                      bundle · {kb(b.mainKb + b.chartsKb)} of {kb(b.before)} source
                    </p>
                    {(["main", "charts"] as const).map((chunk) =>
                      b.chunks[chunk].length ? (
                        <div key={chunk} className="mt-2">
                          <p className="text-xs font-medium">
                            {chunk}.[hash].js · {kb(chunk === "main" ? b.mainKb : b.chartsKb)}
                            {chunk === "charts" && <span className="text-[var(--faint)]"> · loaded on click</span>}
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {grouped(b.chunks[chunk]).map((r) => (
                              <li key={r.id} className="text-[11px]">
                                <span className="flex flex-wrap justify-between gap-x-2">
                                  <span className="font-mono">{r.file}</span>
                                  <span className="font-mono" style={{ color: r.kb === 0 ? "var(--good)" : r.kb >= 20 && r.chunk === "main" ? "var(--bad)" : undefined }}>
                                    {kb(r.kb)} / {kb(r.full)}
                                  </span>
                                </span>
                                <span className="block text-[var(--faint)]">{r.why}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null,
                    )}
                  </>
                )}
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices<Delivery> label="Ship it as" accent={ACCENT} value={delivery} onChange={setDelivery} options={[{ id: "bundle", label: "A bundle" }, { id: "native", label: "Native ES modules" }]} />
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  As written
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Tuned
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Building…">
                Build and load
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Follow the imports" what="import and export are static: they sit at the top level with fixed names, so tools (and the browser) can find every module and every imported name without running any code." accent={ACCENT} active={at(0)}>
                <pre className="overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">
                  {[
                    "// main.js",
                    'import { formatPrice } from "./utils/index.js";',
                    'import { renderCart } from "./cart.js";',
                    o.lazyCharts ? 'button.onclick = async () => {\n  const { drawChart } = await import("./charts.js");\n  drawChart(sales);\n};' : 'import { drawChart } from "./charts.js";',
                  ].join("\n")}
                </pre>
              </FlowStep>
              <FlowArrow label={`${n.requests} modules`} accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Load them: one round trip per level" what="Without a bundler, the browser only learns what main.js imports after downloading it, and what those import after downloading them. Each level of the graph waits a full round trip. modulepreload lists the files in the HTML up front." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.preload} onChange={(e) => set({ preload: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  &lt;link rel=&quot;modulepreload&quot;&gt; for every file
                </label>
                <p className="font-mono text-xs text-[var(--muted)]">
                  native: {n.levels} levels → {n.roundTrips} × {RTT_MS} ms = {n.ms} ms · bundled: 1 file
                </p>
              </FlowStep>
              <FlowArrow label="the module graph" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Tree-shake unused exports" what="The bundler marks every export that's actually imported, starting at the entry, and leaves the rest out. CommonJS can't be shaken: require() and module.exports are ordinary runtime code, so the whole library goes in." accent={ACCENT} active={at(2)}>
                <Choices accent={ACCENT} value={o.lodash} onChange={(v) => set({ lodash: v })} options={[{ id: "cjs", label: 'import from "lodash"' }, { id: "esm", label: 'import from "lodash-es"' }]} />
                <p className="mt-2 font-mono text-xs" style={{ color: o.lodash === "esm" ? "var(--good)" : "var(--bad)" }}>
                  lodash in the bundle: {kb(lodashKb)}
                </p>
              </FlowStep>
              <FlowArrow label="unused modules" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Keep side effects, drop the rest" what="Importing a module runs its top-level code. Unless a package says otherwise, the bundler must keep any module whose top-level code might do something, even if none of its exports are used. The sideEffects field in package.json says which files are safe to drop. Get it wrong and real work disappears." accent={ACCENT} active={at(3)}>
                <Choices accent={ACCENT} value={o.sideEffects} onChange={(v) => set({ sideEffects: v })} options={SIDE_EFFECTS.map((s) => ({ id: s.id, label: s.label }))} />
                <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">utils/package.json: {SIDE_EFFECTS.find((s) => s.id === o.sideEffects)!.json}</p>
                <p className="mt-1 text-xs" style={{ color: b.pageViewSent ? "var(--good)" : "var(--bad)" }}>
                  {b.pageViewSent ? "analytics.js runs and sends its page view" : "analytics.js was removed: no page views are recorded"}
                </p>
              </FlowStep>
              <FlowArrow label="what's left" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Split at import()" what="A dynamic import() is a place the code can wait, so the bundler puts everything behind it in a separate chunk. Modules both sides need stay in the main chunk." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.lazyCharts} onChange={(e) => set({ lazyCharts: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Load charts.js with import()
                </label>
                <p className="font-mono text-xs text-[var(--muted)]">
                  first load {kb(b.mainKb)}
                  {o.lazyCharts ? ` · on click ${kb(b.chartsKb)}` : ""}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">What&apos;s kept is computed by marking used exports from the entry over this module graph; lodash-es&apos;s imports for debounce are the real ones. File sizes and the {RTT_MS} ms round trip are approximate.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
