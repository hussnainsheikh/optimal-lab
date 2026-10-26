"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { FIXED, GEN, KB, LEAKY, buildHeap, collect, fmtKb, generations, growth, retainerPath, type Fixes } from "@/lib/jsMemoryLeaks";

const ACCENT = "var(--web)";

const FIX_ROWS: { key: keyof Fixes; label: string }[] = [
  { key: "removeListener", label: "Remove the resize listener on close" },
  { key: "clearTimer", label: "Clear the interval on close" },
  { key: "weakCache", label: "Cache thumbnails in a WeakMap keyed by the viewer" },
  { key: "clearFocus", label: "Forget lastFocused on close" },
];

function code(f: Fixes) {
  return [
    `const thumbs = new ${f.weakCache ? "WeakMap" : "Map"}();`,
    "let lastFocused = null;",
    "",
    "async open(photo) {",
    `  this.image = await decode(photo.url);   // ${fmtKb(KB.image)}`,
    "  this.el = renderDialog(photo);",
    `  window.addEventListener("resize", () => this.layout()${f.removeListener ? ", { signal: this.abort.signal }" : ""});`,
    "  this.timer = setInterval(() => this.poll(), 1000);",
    `  thumbs.set(${f.weakCache ? "this" : "photo.id"}, makeThumb(this.image));`,
    "  this.el.onclick = (e) => {",
    "    lastFocused = e.target;",
    "    if (e.target.matches(\".close\")) this.close();",
    "  };",
    "}",
    "",
    "close() {",
    "  this.el.remove();",
    ...(f.removeListener ? ["  this.abort.abort();   // removes the listener"] : []),
    ...(f.clearTimer ? ["  clearInterval(this.timer);"] : []),
    ...(f.clearFocus ? ["  lastFocused = null;"] : []),
    "}",
  ].join("\n");
}

// Which map node each object in a retainer path belongs to.
const NODE_OF = (id: string) => (id.startsWith("onResize") || id.startsWith("onTick") ? "cb" : id.startsWith("viewer") ? "viewer" : id.startsWith("image") || id.startsWith("dialog") ? "img" : id.startsWith("thumb") || id === "cache" ? "cache" : "roots");

export default function MemoryLeaksDemo() {
  const [fixes, setFixes] = useState<Fixes>(LEAKY);
  const [opens, setOpens] = useState(10);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Fixes>) => setFixes((c) => ({ ...c, ...p }));
  const c = collect(opens, fixes);
  const path = retainerPath(buildHeap(opens, fixes), "image1");
  const g = generations();
  const grow = growth(opens, fixes);
  const maxKb = Math.max(...grow, KB.image * 2);
  const viewer1 = c.marked.has("viewer1");
  const callbacksHold = !fixes.removeListener || !fixes.clearTimer;

  const nodes: MapNode[] = [
    { id: "roots", label: "Roots", sub: "window · document · timers", at: [14, 22], mobileAt: [25, 12], state: "active" },
    { id: "cb", label: "Callbacks", sub: callbacksHold ? `${[!fixes.removeListener && "listener", !fixes.clearTimer && "interval"].filter(Boolean).join(" + ")} still registered` : "removed on close", at: [50, 22], mobileAt: [75, 12], state: callbacksHold ? "bad" : "good" },
    { id: "viewer", label: "Viewer #1", sub: viewer1 ? "still reachable" : "collected", at: [86, 22], mobileAt: [75, 45], state: viewer1 ? "bad" : "good" },
    { id: "img", label: "Image + dialog", sub: fmtKb(KB.image + KB.dialog), at: [86, 78], mobileAt: [75, 80], state: c.marked.has("image1") ? "bad" : "good" },
    { id: "cache", label: "Thumbnail cache", sub: `${fixes.weakCache ? "WeakMap" : "Map"} · ${c.thumbs} kept`, at: [50, 78], mobileAt: [25, 80], state: c.thumbs > 1 ? "bad" : "good" },
    { id: "gc", label: "Garbage collector", sub: `${fmtKb(c.retainedKb)} survives`, at: [14, 78], mobileAt: [25, 45], state: c.retainedKb > KB.image ? "bad" : "good" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("o", ["roots", "cb", "viewer", "img"], { label: "open #1" })
    : stage === 1 ? hops("y", ["gc", "cache"], { label: `${g.scavenges} minor GCs`, tone: "good" })
    : stage === 2 ? hops("c", ["viewer", "roots"], { label: "dialog.remove()" })
    : stage === 3 ? (path ? hops("m", path.map((p) => NODE_OF(p.id)).filter((id, i, a) => a.indexOf(id) === i), { label: "marked", tone: "bad" }) : hops("m", ["gc", "roots", "cb"], { label: "not reached", tone: "good" }))
    : stage === 4 ? hops("f", ["gc", "roots"], { label: `freed ${fmtKb(c.freedKb)}`, tone: c.retainedKb > KB.image ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: opening the viewer allocates a ${fmtKb(KB.image)} decoded image, the dialog's DOM, two callbacks and a thumbnail.`,
    `Step 2: ${g.diedYoung.toLocaleString("en-US")} of ${g.allocated.toLocaleString("en-US")} small objects die before they're ever promoted; ${g.scavenges} quick minor GCs clean them up.`,
    `Step 3: closing removes the dialog from the page, but ${callbacksHold || !fixes.clearFocus ? "some references to it are still there" : "nothing else points at it any more"}.`,
    path ? `Step 4: marking from the roots reaches viewer #1 through ${path[1]?.via ?? "a root"}, so its image can't be freed.` : "Step 4: marking from the roots never reaches viewer #1, so it and its image are garbage.",
    `Step 5: after ${opens} opens and a full GC, ${fmtKb(c.retainedKb)} is still in use and ${fmtKb(c.freedKb)} was freed.`,
  ];
  const caption = stage !== null ? captions[stage] : `${opens} opens: ${fmtKb(c.retainedKb)} still in use · ${c.leakedViewers} viewer${c.leakedViewers === 1 ? "" : "s"} and ${c.thumbs} thumbnail${c.thumbs === 1 ? "" : "s"} can't be freed.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Memory and garbage collection"
        blurb="JavaScript frees memory for you: anything that can't be reached from the page's roots is garbage. A leak is memory that's still reachable by accident. Open and close a photo viewer and find what's still holding on to it."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Roots reach callbacks, which reach a viewer, which holds a large image and its dialog; a cache holds thumbnails; the garbage collector frees what roots can't reach"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "roots", to: "cb", label: "registered" },
                  { from: "cb", to: "viewer", label: "closure" },
                  { from: "viewer", to: "img", label: "this.image" },
                  { from: "roots", to: "img", label: "lastFocused", dim: fixes.clearFocus },
                  { from: "roots", to: "cache", label: "module variable" },
                  { from: "gc", to: "roots", label: "mark from" },
                  { from: "gc", to: "cache", label: "scavenge" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Memory still in use after each open and close">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">heap after a full GC · {fmtKb(c.retainedKb)}</p>
                <div className="mt-2 flex h-24 items-end gap-0.5" aria-hidden>
                  {grow.map((kb, i) => (
                    <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(2, (kb / maxKb) * 100)}%`, background: kb > KB.image ? "var(--bad)" : ACCENT, opacity: 0.85 }} />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-[var(--faint)]">After open and close 1 to {opens}. A flat line means memory comes back; a staircase is a leak.</p>
                <ul className="mt-2 grid gap-x-3 text-xs sm:grid-cols-2">
                  <li>viewers still alive: <span className="font-mono">{c.leakedViewers}</span></li>
                  <li>detached dialogs: <span className="font-mono">{c.detachedDialogs}</span></li>
                  <li>thumbnails kept: <span className="font-mono">{c.thumbs}</span></li>
                  <li>freed: <span className="font-mono">{fmtKb(c.freedKb)}</span></li>
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setFixes(LEAKY)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Leaky viewer
                </button>
                <button type="button" onClick={() => setFixes(FIXED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Cleaned up
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Collecting…">
                Open, close, collect
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Open the viewer: allocate" what="Every object, closure, array and DOM node lives on the heap. Opening the viewer creates a few big things and thousands of small ones." accent={ACCENT} active={at(0)}>
                <pre className="overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{code(fixes)}</pre>
              </FlowStep>
              <FlowArrow label="thousands of small objects" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Most objects die young" what="Engines like V8 split the heap. New objects go in a small young generation that's swept often and cheaply; anything that survives two of those sweeps is promoted to the old generation, which is collected rarely." accent={ACCENT} active={at(1)}>
                <ul className="grid gap-1 font-mono text-xs sm:grid-cols-2">
                  <li>allocated: {g.allocated.toLocaleString("en-US")}</li>
                  <li>minor GCs: {g.scavenges}</li>
                  <li>died young: {g.diedYoung.toLocaleString("en-US")}</li>
                  <li>
                    promoted: {g.promoted} of {g.longLived} long-lived
                  </li>
                </ul>
                <p className="mt-1 text-[11px] text-[var(--faint)]">A {GEN.youngKb} KB young generation; temporary objects live for {GEN.tempLife} allocations.</p>
              </FlowStep>
              <FlowArrow label="close()" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Close it, and let go of everything" what="Removing the dialog from the page isn't enough. Anything that still points at the viewer keeps all of it alive: a listener on window, a running timer, a cache, a variable outside the component." accent={ACCENT} active={at(2)}>
                <div className="space-y-0.5">
                  {FIX_ROWS.map((r) => (
                    <label key={r.key} className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" checked={fixes[r.key]} onChange={(e) => set({ [r.key]: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                      {r.label}
                    </label>
                  ))}
                </div>
              </FlowStep>
              <FlowArrow label="a full GC" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Mark from the roots" what="The collector starts at the roots and follows every reference. Whatever it reaches stays; the rest is swept. A heap snapshot's Retainers panel shows the chain that kept an object alive." accent={ACCENT} active={at(3)}>
                <p className="text-xs text-[var(--muted)]">Retainers of decoded image #1:</p>
                {path ? (
                  <ol className="mt-1 space-y-0.5 font-mono text-[11px]">
                    {path.map((p, i) => (
                      <li key={p.id} style={{ paddingLeft: i * 10 }}>
                        {p.via && <span className="text-[var(--faint)]">─{p.via}→ </span>}
                        <span style={{ color: i === 0 ? ACCENT : i === path.length - 1 ? "var(--bad)" : undefined }}>{p.label}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 font-mono text-xs text-[var(--good)]">none: nothing reachable points at it, so it was freed</p>
                )}
              </FlowStep>
              <FlowArrow label="again and again" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Open it many times" what="One leaked viewer is a few megabytes. A leak shows up as memory that climbs with every open and never comes back down, until the tab slows or crashes." accent={ACCENT} active={at(4)}>
                <Slider label="Opens" value={opens} min={1} max={20} step={1} format={(v) => `${v}`} onChange={setOpens} accent={ACCENT} />
                <p className="mt-1 font-mono text-sm" style={{ color: c.retainedKb > KB.image ? "var(--bad)" : "var(--good)" }}>
                  {fmtKb(c.retainedKb)} still in use
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Reachability is computed by marking a real object graph from its roots, with WeakMap entries kept only while their key is reachable; the object sizes are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
