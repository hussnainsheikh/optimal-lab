"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { AFTER, BEFORE, EDITS, MINIFIED, MODULES, devStart, hotUpdate, redownload, type DevMode, type Edit } from "@/lib/bundlerBuild";

const ACCENT = "var(--web)";
const bytes = (s: string) => new TextEncoder().encode(s).length;

export default function BundlersDemo() {
  const [mode, setMode] = useState<DevMode>("bundle");
  const [edit, setEdit] = useState<Edit>("settings");
  const [manifest, setManifest] = useState(false);
  const [publicMaps, setPublicMaps] = useState(true);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const start = devStart(mode);
  const hot = hotUpdate(mode, edit);
  const r = redownload(edit, manifest);
  const editLabel = EDITS.find((e) => e.id === edit)!;

  const nodes: MapNode[] = [
    { id: "src", label: "Source files", sub: `${MODULES.toLocaleString("en-US")} modules`, at: [14, 22], mobileAt: [25, 12], state: "active" },
    { id: "dev", label: mode === "bundle" ? "Bundling dev server" : "ESM dev server", sub: `ready in ${(start.ms / 1000).toFixed(1)} s`, at: [50, 22], mobileAt: [75, 12], state: start.ms > 1000 ? "wait" : "good" },
    { id: "browser", label: "Browser (dev)", sub: hot.kind, at: [86, 22], mobileAt: [75, 45], state: hot.stateKept ? "good" : "wait" },
    { id: "build", label: "Production build", sub: `${r.after.length} hashed files`, at: [14, 78], mobileAt: [25, 45], state: "active" },
    { id: "cdn", label: "CDN", sub: "cached for a year", at: [50, 78], mobileAt: [25, 80], state: "good" },
    { id: "visitor", label: "Returning visitor", sub: `re-downloads ${r.kb} KB`, at: [86, 78], mobileAt: [75, 80], state: r.kb > 60 ? "bad" : "good" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("s", ["src", "dev", "browser"], { label: `${(start.ms / 1000).toFixed(1)} s`, tone: start.ms > 1000 ? "bad" : "good" })
    : stage === 1 ? hops("h", ["dev", "browser"], { label: `${hot.kind}, ${hot.ms} ms`, tone: hot.stateKept ? "good" : "bad" })
    : stage === 2 ? hops("b", ["src", "build"], { label: "transform" })
    : stage === 3 ? hops("c", ["build", "cdn", "visitor"], { label: `${r.changed.length} new name${r.changed.length === 1 ? "" : "s"}`, tone: r.kb > 60 ? "bad" : "good" })
    : stage === 4 ? hops("m", ["cdn", "visitor"], { label: publicMaps ? ".map public" : "maps private", tone: publicMaps ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: the dev server ${start.what}: ready in ${(start.ms / 1000).toFixed(1)} s.`,
    `Step 2: ${editLabel.label.toLowerCase()}: ${hot.kind} in ${hot.ms} ms${hot.stateKept ? ", and the page keeps its state" : ", and the page's state is lost"}. ${hot.why}.`,
    "Step 3: the production build strips types, compiles JSX, replaces import.meta.env.DEV with false and drops the code behind it.",
    `Step 4: after the edit, ${r.changed.length} file name${r.changed.length === 1 ? "" : "s"} changed: a returning visitor downloads ${r.kb} of ${r.total} KB again.`,
    publicMaps ? "Step 5: source maps are published next to the code, so anyone can read the original source in DevTools." : "Step 5: source maps go to the error tracker only; visitors get just the minified code.",
  ];
  const caption = stage !== null ? captions[stage] : `Dev start ${(start.ms / 1000).toFixed(1)} s · ${hot.kind} ${hot.ms} ms · ${r.kb} KB to re-download after the edit.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Bundlers"
        blurb="Vite, webpack, esbuild and Rollup do two jobs. In development they serve your code fast and swap edits into the running page. For production they transform it, strip what's only for development, and name every file after its contents so it can be cached forever. Make an edit and follow it through both."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Source files go to a dev server and the browser while developing, and through a production build to a CDN and returning visitors"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "src", to: "dev", label: "serve" },
                  { from: "dev", to: "browser", label: "HMR" },
                  { from: "src", to: "build", label: "build" },
                  { from: "build", to: "cdn", label: "deploy" },
                  { from: "cdn", to: "visitor", label: "cached files" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Output file names before and after the edit">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">dist/ after: {editLabel.label.toLowerCase()}</p>
                <ul className="mt-2 space-y-1 font-mono text-[11px]">
                  {r.after.map((f) => {
                    const was = r.before.find((b) => b.id === f.id)!;
                    const changed = was.name !== f.name;
                    return (
                      <li key={f.id} className="break-all">
                        <span style={{ color: changed ? "var(--bad)" : "var(--muted)" }}>{f.name}</span>
                        <span className="text-[var(--faint)]"> · {f.kb} KB{changed ? ` · was ${was.name.replace("assets/", "")}` : " · unchanged, still cached"}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="The edit" accent={ACCENT} value={edit} onChange={setEdit} options={EDITS.map((e) => ({ id: e.id, label: e.label }))} />
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Building…">
                Make the edit
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Start the dev server" what="A bundling dev server builds the whole app before it can serve a page. An ESM dev server like Vite's pre-bundles your dependencies once with esbuild, then transforms each of your files only when the browser asks for it." accent={ACCENT} active={at(0)}>
                <Choices<DevMode> accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "bundle", label: "Bundle first (webpack dev)" }, { id: "esm", label: "Native ESM (Vite)" }]} />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {start.what}: <span className="font-mono">{(start.ms / 1000).toFixed(1)} s</span>
                </p>
              </FlowStep>
              <FlowArrow label="an edit" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Swap the edit into the running page" what="Hot module replacement sends just the changed module to the browser. If something above it accepts the update (React Fast Refresh does for components), the page keeps its state; if nothing does, it falls back to a full reload." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs" style={{ color: hot.stateKept ? "var(--good)" : "var(--bad)" }}>
                  {hot.kind} · {hot.ms} ms · state {hot.stateKept ? "kept" : "lost"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">{hot.why}.</p>
              </FlowStep>
              <FlowArrow label="npm run build" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Transform for production" what="TypeScript types are stripped, JSX becomes function calls, import.meta.env.DEV becomes the literal false, and code behind if (false) is removed. Then the minifier shortens names and drops whitespace." accent={ACCENT} active={at(2)}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-[var(--faint)]">src/main.tsx · {bytes(BEFORE)} bytes</p>
                    <pre className="overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{BEFORE}</pre>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[var(--faint)]">transformed · {bytes(AFTER)} bytes</p>
                    <pre className="overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{AFTER}</pre>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-[var(--faint)]">minified · {bytes(MINIFIED)} bytes</p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-[var(--inset)] p-2 font-mono text-[10px]">{MINIFIED}</pre>
              </FlowStep>
              <FlowArrow label="output files" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Name each file after its contents" what="index-e531bbe2.js can be cached for a year: if the contents change, so does the name. But a chunk that imports another by its hashed name changes whenever that one does, so one small edit can rename the entry too. A manifest that maps names to files stops the cascade." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={manifest} onChange={(e) => setManifest(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Chunk names in a separate manifest
                </label>
                <p className="font-mono text-xs" style={{ color: r.kb > 60 ? "var(--bad)" : "var(--good)" }}>
                  {r.changed.length} renamed · {r.kb} KB of {r.total} KB downloaded again
                </p>
              </FlowStep>
              <FlowArrow label="errors in production" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Keep source maps for your eyes only" what="A source map turns minified stack traces back into your original lines. Published next to the code, it also hands anyone your full source and comments. Upload maps to your error tracker and leave them off the CDN." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={publicMaps} onChange={(e) => setPublicMaps(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Publish .map files on the CDN
                </label>
                <p className="mt-2 text-[11px] text-[var(--faint)]">File names use a real SHA-256 of each output&apos;s contents; dev-server and HMR timings and file sizes are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
