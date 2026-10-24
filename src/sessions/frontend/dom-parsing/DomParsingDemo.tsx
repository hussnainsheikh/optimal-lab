"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { NET, SAMPLES, SCRIPT_MODES, parse, scriptTimeline, tokenLabel, type SampleId, type ScriptMode } from "@/lib/domParsing";

const ACCENT = "var(--web)";

export default function DomParsingDemo() {
  const [sample, setSample] = useState<SampleId>("missing");
  const [mode, setMode] = useState<ScriptMode>("classic");
  const [scanner, setScanner] = useState(true);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const p = parse(sample);
  const tl = scriptTimeline(mode, scanner);
  const blocking = mode === "classic";

  const nodes: MapNode[] = [
    { id: "net", label: "Network", sub: `${p.bytes} bytes of HTML`, at: [12, 22], mobileAt: [25, 12], state: "active" },
    { id: "tok", label: "Tokenizer", sub: `${p.tokens.length} tokens`, at: [40, 22], mobileAt: [75, 12], state: stage !== null && stage >= 1 ? "good" : "idle" },
    { id: "tree", label: "Tree builder", sub: p.fixes.length ? `${p.fixes.length} mistakes fixed` : "nothing to fix", at: [68, 22], mobileAt: [75, 42], state: blocking && at(3) ? "wait" : "active" },
    { id: "dom", label: "DOM", sub: `${p.elements} elements`, at: [90, 50], mobileAt: [75, 72], state: stage !== null && stage >= 2 ? "good" : "idle" },
    { id: "js", label: "JS engine", sub: `app.js runs at ${tl.scriptStart} ms`, at: [68, 80], mobileAt: [25, 72], state: at(3) ? "active" : "idle" },
    { id: "scan", label: "Preload scanner", sub: scanner ? "reads ahead for URLs" : "off", at: [26, 80], mobileAt: [25, 42], state: scanner ? "good" : "dim" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("b", ["net", "tok"], { label: `${p.bytes} B` })
    : stage === 1 ? hops("t", ["tok", "tree"], { label: `${p.tokens.length} tokens` })
    : stage === 2 ? hops("d", ["tree", "dom"], { label: `${p.elements} nodes`, tone: "good" })
    : stage === 3 ? [...hops("s", ["tree", "js"], { label: blocking ? "wait for app.js" : mode, tone: blocking ? "bad" : "accent" }), ...(scanner ? hops("p", ["scan", "net"], { label: "fetch images", tone: "good" }) : [])]
    : stage === 4 ? hops("e", ["dom", "js"], { label: "DOMContentLoaded", tone: "good" })
    : [];

  const captions = [
    `Step 1: ${p.bytes} bytes arrive and are decoded as UTF-8 into characters.`,
    `Step 2: the tokenizer turns the characters into ${p.tokens.length} tokens: start tags, end tags and text.`,
    p.fixes.length ? `Step 3: the tree builder made ${p.elements} elements and quietly fixed ${p.fixes.length} mistakes, the same way every browser does.` : `Step 3: the tree builder made ${p.elements} elements; there was nothing to fix.`,
    blocking ? `Step 4: the parser stops at <script> for ${tl.blockedMs} ms while app.js downloads and runs.` : `Step 4: with ${mode}, the parser keeps going while app.js downloads.`,
    `Step 5: DOMContentLoaded fires at ${tl.dcl} ms; the page can first paint at ${tl.paint} ms.`,
  ];
  const caption = stage !== null ? captions[stage] : `${p.elements} elements, ${p.fixes.length} fixes · DOMContentLoaded at ${tl.dcl} ms with ${SCRIPT_MODES.find((m) => m.id === mode)!.label}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Parsing HTML into the DOM"
        blurb="The browser reads HTML as a stream of bytes, cuts it into tokens and builds a tree from them, fixing broken markup as it goes so that every browser ends up with the same tree. A script tag can stop all of it."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Bytes from the network go through the tokenizer and tree builder into the DOM; scripts pause the tree builder; the preload scanner fetches ahead"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "net", to: "tok", label: "bytes" },
                  { from: "tok", to: "tree", label: "tokens" },
                  { from: "tree", to: "dom", label: "nodes" },
                  { from: "tree", to: "js", label: "script" },
                  { from: "scan", to: "net", label: "early fetches", dim: !scanner },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The DOM tree the parser built">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">DOM tree · {p.elements} elements</p>
                <ul className="mt-2 space-y-0.5 font-mono text-xs">
                  {p.rows.map((r, i) => (
                    <li key={i} className="break-all" style={{ paddingLeft: r.depth * 14, color: r.implied || r.reopened ? ACCENT : r.label.startsWith("<") ? "var(--text)" : "var(--muted)" }}>
                      {r.label}
                      {r.implied && <span className="ml-2 text-[10px] text-[var(--faint)]">added by the parser</span>}
                      {r.reopened && <span className="ml-2 text-[10px] text-[var(--faint)]">reopened</span>}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="The HTML" accent={ACCENT} value={sample} onChange={setSample} options={SAMPLES.map((s) => ({ id: s.id, label: s.label }))} />
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Parsing…">
                Parse the page
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Decode bytes into characters" what="The network delivers bytes. The browser picks an encoding (from the HTTP header or a <meta charset> in the first 1024 bytes) and turns them into text. It starts parsing before the last byte arrives." accent={ACCENT} active={at(0)}>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">{p.html}</pre>
              </FlowStep>
              <FlowArrow label="characters" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Cut the text into tokens" what="The tokenizer is a state machine reading one character at a time. It emits start tags (with their attributes), end tags, text and comments. Inside <title> or <script> it reads everything as text until the matching end tag." accent={ACCENT} active={at(1)}>
                <ol className="flex flex-wrap gap-1">
                  {p.tokens.map((t, i) => (
                    <li key={i} className="rounded border border-[var(--line)] bg-[var(--inset)] px-1.5 py-0.5 font-mono text-[10px]" style={{ color: t.type === "text" ? "var(--muted)" : t.type === "end" ? "var(--faint)" : "var(--text)" }}>
                      {tokenLabel(t)}
                    </li>
                  ))}
                </ol>
              </FlowStep>
              <FlowArrow label="tokens" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Build the tree, fixing mistakes" what="The tree builder keeps a stack of open elements. The HTML standard says exactly what to do with every mistake, so a page with missing or misnested tags gives the same DOM in every browser. It never throws an error." accent={ACCENT} active={at(2)}>
                {p.fixes.length === 0 ? (
                  <p className="text-sm text-[var(--good)]">Nothing to fix: every tag was opened and closed in order.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {p.fixes.map((f, i) => (
                      <li key={i} className="rounded-md border-l-2 bg-[var(--inset)] px-2 py-1" style={{ borderColor: ACCENT }}>
                        {f.what}
                      </li>
                    ))}
                  </ul>
                )}
              </FlowStep>
              <FlowArrow label="a <script> tag" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Stop for scripts, unless told not to" what="A plain <script> can call document.write or read the DOM so far, so the parser waits while it downloads and runs, and the script also waits for stylesheets above it. defer, async and modules let parsing carry on." accent={ACCENT} active={at(3)}>
                <Choices accent={ACCENT} value={mode} onChange={setMode} options={SCRIPT_MODES.map((m) => ({ id: m.id, label: m.label }))} />
                <p className="mt-2 break-all font-mono text-[11px] text-[var(--muted)]">{SCRIPT_MODES.find((m) => m.id === mode)!.tag}</p>
                <label className="mt-1 flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={scanner} onChange={(e) => setScanner(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Preload scanner (reads ahead while the parser waits)
                </label>
                <Timeline tl={tl} />
              </FlowStep>
              <FlowArrow label="the finished tree" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="DOMContentLoaded, then load" what="When the tree is complete and deferred scripts have run, DOMContentLoaded fires. Async scripts don't hold it up, and they run in whatever order they arrive. The load event waits for images too." accent={ACCENT} active={at(4)}>
                <ul className="grid gap-1 font-mono text-xs sm:grid-cols-2">
                  <li>first paint: {tl.paint} ms</li>
                  <li>DOMContentLoaded: {tl.dcl} ms</li>
                  <li>app.js ran: {tl.scriptStart}–{tl.scriptEnd} ms</li>
                  <li>load (images done): {tl.end} ms</li>
                </ul>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The tree is built by a real parser that follows the HTML standard&apos;s rules for these pages; it matches Chrome&apos;s DOMParser. Network times ({NET.htmlArrives} ms for the HTML, {NET.scriptLoad} ms for app.js) are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Timeline({ tl }: { tl: ReturnType<typeof scriptTimeline> }) {
  const scale = Math.max(tl.end, 1);
  const rows = [
    ...tl.bars.filter((b) => b.lane === "network").map((b) => ({ label: `fetch ${b.label}`, bars: [b] })),
    { label: "Parser", bars: tl.bars.filter((b) => b.lane === "parser") },
    { label: "JavaScript", bars: tl.bars.filter((b) => b.lane === "js") },
  ];
  return (
    <div className="mt-2 space-y-1.5" aria-label="Timeline in milliseconds">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-[11px] text-[var(--muted)]">{row.label}</span>
          <div className="relative h-5 flex-1 rounded bg-[var(--inset)]">
            {row.bars.map((b, i) => (
                <span
                  key={i}
                  title={`${b.label}: ${b.from}–${b.to} ms`}
                  className="absolute top-0.5 h-4 rounded-sm"
                  style={{ left: `${(b.from / scale) * 100}%`, width: `${Math.max(1, ((b.to - b.from) / scale) * 100)}%`, background: b.tone === "bad" ? "var(--bad)" : ACCENT, opacity: b.lane === "network" ? 0.6 : 0.9 }}
                />
              ))}
          </div>
        </div>
      ))}
      <p className="flex justify-between font-mono text-[10px] text-[var(--faint)]">
        <span>0 ms</span>
        <span>{scale} ms</span>
      </p>
      <p className="text-[11px] text-[var(--muted)]">
        {tl.blockedMs ? `Parser blocked for ${tl.blockedMs} ms.` : "The parser never stops."} Images start downloading at {tl.imgStart} ms.
      </p>
    </div>
  );
}
