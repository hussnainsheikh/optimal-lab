"use client";

import { useRef, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { CARDS, COST, FRAME_MS, PROPS, SHAPES, runFrame, trace, type Prop, type Shape } from "@/lib/reflowRepaint";

const ACCENT = "var(--web)";
const SEG_COLOR: Record<string, string> = { js: "var(--faint)", style: "var(--sys)", layout: "var(--bad)", paint: ACCENT, composite: "var(--good)" };
const MEASURE_CARDS = 300;

export default function ReflowDemo() {
  const [shape, setShape] = useState<Shape>("interleaved");
  const [prop, setProp] = useState<Prop>("height");
  const [measured, setMeasured] = useState<{ prop: Prop; ms: Record<Shape, number> } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const f = runFrame(shape, prop);
  const p = PROPS.find((x) => x.id === prop)!;
  const code = SHAPES.find((s) => s.id === shape)!.code(p.css);
  const thrash = f.forcedLayout > 1;

  const measure = () => {
    const root = box.current;
    if (!root) return;
    const cards = Array.from(root.children) as HTMLElement[];
    const write = (c: HTMLElement, h: number) => {
      if (prop === "height") c.style.height = `${(h % 30) + 10}px`;
      if (prop === "background") c.style.background = h % 2 ? "gold" : "tan";
      if (prop === "transform") c.style.transform = `translateX(${h % 7}px)`;
    };
    const once = (s: Shape) => {
      cards.forEach((c) => {
        c.style.height = "20px";
        c.style.background = "";
        c.style.transform = "";
        // Matches the model: the cards already have will-change, so a transform skips layout.
        c.style.willChange = prop === "transform" ? "transform" : "";
      });
      void root.offsetHeight;
      const t0 = performance.now();
      if (s === "interleaved") for (const c of cards) write(c, c.offsetHeight + 1);
      if (s === "writes-then-reads") {
        cards.forEach((c, i) => write(c, i));
        cards.map((c) => c.offsetHeight);
      }
      if (s === "reads-then-writes") {
        const hs = cards.map((c) => c.offsetHeight);
        cards.forEach((c, i) => write(c, hs[i] + 1));
      }
      void root.offsetHeight; // include the layout the frame would do anyway
      return performance.now() - t0;
    };
    const ms = {} as Record<Shape, number>;
    for (const s of SHAPES) {
      const runs = Array.from({ length: 7 }, () => once(s.id)).sort((a, b) => a - b);
      ms[s.id] = runs[3];
    }
    setMeasured({ prop, ms });
  };

  const nodes: MapNode[] = [
    { id: "js", label: "Your loop", sub: `${CARDS} cards`, at: [14, 22], mobileAt: [25, 12], state: "active" },
    { id: "style", label: "Style", sub: `${f.styles} recalc${f.styles === 1 ? "" : "s"}`, at: [50, 22], mobileAt: [75, 12], state: f.forcedStyle > 1 ? "wait" : "good" },
    { id: "layout", label: "Layout", sub: `${f.layouts} layout${f.layouts === 1 ? "" : "s"}`, at: [86, 22], mobileAt: [75, 45], state: thrash ? "bad" : f.layouts ? "good" : "dim" },
    { id: "paint", label: "Paint", sub: f.paints ? "1 paint" : "skipped", at: [86, 78], mobileAt: [75, 80], state: f.paints ? "good" : "dim" },
    { id: "comp", label: "Compositor", sub: "GPU layers", at: [50, 78], mobileAt: [25, 80], state: "good" },
    { id: "screen", label: "Screen", sub: f.overBudget ? `${f.droppedFrames} dropped frame${f.droppedFrames === 1 ? "" : "s"}` : "next frame on time", at: [14, 78], mobileAt: [25, 45], state: f.overBudget ? "bad" : "good" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("w", ["js", "style"], { label: `write ${prop}` })
    : stage === 1 ? hops("d", ["style", "layout"], { label: p.dirties === "layout" ? "mark dirty" : "layout unaffected", tone: p.dirties === "layout" ? "accent" : "good" })
    : stage === 2 ? (f.forcedLayout ? hops("f", ["js", "layout", "js"], { label: `forced ×${f.forcedLayout}`, tone: thrash ? "bad" : "accent" }) : hops("f", ["js", "style"], { label: f.forcedStyle ? `style ×${f.forcedStyle}` : "nothing forced", tone: f.forcedStyle > 1 ? "bad" : "good" }))
    : stage === 3 ? hops("e", f.paints ? ["layout", "paint", "comp"] : ["style", "comp"], { label: "end of frame" })
    : stage === 4 ? hops("s", ["comp", "screen"], { label: `${f.total.toFixed(1)} ms`, tone: f.overBudget ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: the loop writes ${prop} on ${CARDS} cards. Writing doesn't do any layout yet.`,
    p.dirties === "layout" ? "Step 2: the browser only marks layout dirty and plans to do it once, at the end of the frame." : `Step 2: ${prop} doesn't change any sizes, so layout stays clean.`,
    f.forcedLayout ? `Step 3: ${f.forcedLayout} read${f.forcedLayout === 1 ? "" : "s"} found layout dirty and forced the browser to lay out the page on the spot.` : f.forcedStyle ? `Step 3: reads forced ${f.forcedStyle} style recalculations, but no layout.` : "Step 3: every read found layout clean, so nothing was forced.",
    `Step 4: at the end of the frame: ${[f.layouts && !f.forcedLayout ? "style and layout" : null, f.paints ? "paint" : null, "composite"].filter(Boolean).join(", ")}.`,
    f.overBudget ? `Step 5: ${f.total.toFixed(1)} ms of work in a ${FRAME_MS.toFixed(1)} ms frame: the screen misses ${f.droppedFrames} frame${f.droppedFrames === 1 ? "" : "s"}.` : `Step 5: ${f.total.toFixed(1)} ms of work fits in the ${FRAME_MS.toFixed(1)} ms frame.`,
  ];
  const caption = stage !== null ? captions[stage] : `${f.layouts} layout${f.layouts === 1 ? "" : "s"} (${f.forcedLayout} forced) · ${f.total.toFixed(1)} ms of a ${FRAME_MS.toFixed(1)} ms frame.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Reflows and repaints"
        blurb="Changing a size doesn't lay the page out straight away: the browser waits and does it once, at the end of the frame. Read a size in between and it has to lay out right now. Do that in a loop over a hundred cards and one frame becomes three."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A JavaScript loop writes styles; style, layout, paint and the compositor turn them into the next frame; a geometry read sends layout back to the loop early"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "js", to: "style", label: "write" },
                  { from: "style", to: "layout", label: "sizes" },
                  { from: "layout", to: "js", label: "offsetHeight", dim: !f.forcedLayout },
                  { from: "layout", to: "paint", label: "boxes", dim: !f.paints },
                  { from: "paint", to: "comp", label: "pixels", dim: !f.paints },
                  { from: "style", to: "comp", label: "transform", dim: prop !== "transform" },
                  { from: "comp", to: "screen", label: "frame" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The main thread during this frame">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">main thread · {f.total.toFixed(1)} ms</p>
                <div className="relative mt-2 flex h-6 overflow-hidden rounded bg-[var(--inset)]">
                  {f.segs.map((s, i) => (
                    <span key={i} title={`${s.kind}${s.forced ? " (forced)" : ""}: ${s.ms.toFixed(2)} ms`} style={{ width: `${(s.ms / Math.max(f.total, FRAME_MS)) * 100}%`, background: SEG_COLOR[s.kind], borderRight: s.forced ? "1px solid var(--panel)" : undefined }} />
                  ))}
                  <span className="absolute inset-y-0 border-l-2 border-dashed" style={{ left: `${(FRAME_MS / Math.max(f.total, FRAME_MS)) * 100}%`, borderColor: "var(--text)" }} aria-hidden />
                </div>
                <p className="mt-1 text-[11px] text-[var(--faint)]">Dashed line: one frame at 60 Hz ({FRAME_MS.toFixed(1)} ms).</p>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  {(["js", "style", "layout", "paint", "composite"] as const).map((k) => (
                    <li key={k} className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SEG_COLOR[k] }} />
                      {k === "js" ? "JavaScript" : k}
                    </li>
                  ))}
                </ul>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-[var(--inset)] p-2">
                    <dt className="text-[10px] text-[var(--faint)]">forced layouts</dt>
                    <dd className="font-mono text-sm" style={{ color: thrash ? "var(--bad)" : undefined }}>{f.forcedLayout}</dd>
                  </div>
                  <div className="rounded-md bg-[var(--inset)] p-2">
                    <dt className="text-[10px] text-[var(--faint)]">layout time</dt>
                    <dd className="font-mono text-sm">{f.layoutMs.toFixed(1)} ms</dd>
                  </div>
                  <div className="rounded-md bg-[var(--inset)] p-2">
                    <dt className="text-[10px] text-[var(--faint)]">paints</dt>
                    <dd className="font-mono text-sm">{f.paints}</dd>
                  </div>
                </dl>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="The loop" accent={ACCENT} value={shape} onChange={setShape} options={SHAPES.map((s) => ({ id: s.id, label: s.label }))} />
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Running…">
                Run one frame
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Write a style" what="Setting a style is cheap: the browser records the change. Which property matters. Sizes and positions affect layout, colours only need a repaint, and transform and opacity can skip both, on an element that already has will-change: transform. Adding a transform where there was none still needs layout once: the element becomes a new containing block." accent={ACCENT} active={at(0)}>
                <Choices accent={ACCENT} value={prop} onChange={setProp} options={PROPS.map((x) => ({ id: x.id, label: x.label }))} />
                <pre className="mt-2 overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">{code}</pre>
              </FlowStep>
              <FlowArrow label="a dirty flag" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Mark it dirty and wait" what="Instead of laying out the page after every change, the browser marks the affected part dirty and does all the work once, just before the next frame is drawn." accent={ACCENT} active={at(1)}>
                <ol className="space-y-0.5 font-mono text-[11px]">
                  {trace(shape, prop).map((r, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-2 rounded bg-[var(--inset)] px-2 py-0.5">
                      <span>{r.op}</span>
                      <span style={{ color: r.forced ? "var(--bad)" : r.layoutDirty ? ACCENT : "var(--faint)" }}>{r.forced ? "forced layout!" : r.layoutDirty ? "layout dirty" : "layout clean"}</span>
                    </li>
                  ))}
                  <li className="px-2 text-[var(--faint)]">… {CARDS * 2 - 6} more</li>
                </ol>
              </FlowStep>
              <FlowArrow label="a geometry read" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="A read forces layout now" what="offsetHeight, getBoundingClientRect, scrollTop and getComputedStyle must return correct numbers, so if layout is dirty the browser does it immediately. Interleaving reads and writes does this once per card." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-sm" style={{ color: thrash ? "var(--bad)" : "var(--good)" }}>
                  {f.forcedLayout} forced layout{f.forcedLayout === 1 ? "" : "s"} · {f.forcedStyle} forced style recalc{f.forcedStyle === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Fix: do all the reads first, then all the writes, or put the writes in requestAnimationFrame.</p>
              </FlowStep>
              <FlowArrow label="end of the frame" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Style, layout, paint, composite, once" what="Whatever is still dirty is done once: recalculate styles, lay out, paint the changed areas, and hand layers to the compositor. A transform change skips layout and paint entirely." accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs text-[var(--muted)]">
                  layout {COST.layout} ms × {f.layouts} · paint {COST.paint} ms × {f.paints} · composite {COST.composite} ms
                </p>
              </FlowStep>
              <FlowArrow label="the frame" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Measure it in your browser" what={`The numbers above are a model. This button runs all three loops for real on ${MEASURE_CARDS} hidden cards in this page and times them (median of 7 runs).`} accent={ACCENT} active={at(4)}>
                <button type="button" onClick={measure} className="min-h-11 rounded-md border px-3 text-sm" style={{ borderColor: ACCENT }}>
                  Measure with {prop}
                </button>
                {measured && (
                  <ul className="mt-2 space-y-0.5 font-mono text-xs">
                    {SHAPES.map((s) => (
                      <li key={s.id} className="flex flex-wrap justify-between gap-2">
                        <span>{s.label}</span>
                        <span>{measured.ms[s.id].toFixed(2)} ms</span>
                      </li>
                    ))}
                    <li className="text-[10px] text-[var(--faint)]">measured with {measured.prop}, on this device, just now</li>
                  </ul>
                )}
                <p className="mt-2 text-[11px] text-[var(--faint)]">Forced layouts are counted by running the loop through the browser&apos;s dirty-flag rules; the per-stage costs are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
      <div ref={box} aria-hidden className="pointer-events-none invisible fixed left-0 top-0 h-px w-72 overflow-hidden">
        {Array.from({ length: MEASURE_CARDS }, (_, i) => (
          <div key={i} className="border p-1 text-xs">
            card {i + 1}
          </div>
        ))}
      </div>
    </SessionPage>
  );
}
