"use client";

import { useState, type ReactNode } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { BADGES_MS, BOUNDARY_OPTS, FALLBACK_SPINNER, NAIVE, SECTIONS, TUNED, firstContent, frames, layoutShift, ready, tabSwitch, type Frame, type Opts } from "@/lib/suspenseBoundaries";

const ACCENT = "var(--web)";
const SCALE = 0.12; // px on screen per px of page

export default function SuspenseDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const fs = frames(o);
  const cls = layoutShift(o);
  const fc = firstContent(o);
  const rd = ready(o);
  const tab = tabSwitch(o);
  const clsBad = cls.score > 0.1;

  const nodes: MapNode[] = [
    { id: "browser", label: "Browser", sub: fc.first === 0 ? `header at 0 ms, product at ${fc.product} ms` : `blank until ${fc.first} ms`, at: [14, 22], mobileAt: [25, 12], state: fc.first === 0 ? "good" : "bad" },
    { id: "react", label: "React", sub: `${BOUNDARY_OPTS.find((b) => b.id === o.boundaries)!.label.toLowerCase()}`, at: [50, 22], mobileAt: [75, 12], state: "active" },
    { id: "product", label: "Product API", sub: `${rd.product} ms`, at: [86, 22], mobileAt: [75, 45], state: "good" },
    { id: "reviews", label: "Reviews API", sub: `${rd.reviews} ms`, at: [86, 78], mobileAt: [75, 80], state: "wait" },
    { id: "badges", label: "Badges API", sub: o.parallel ? `${BADGES_MS} ms, in parallel` : `starts at ${rd.reviews} ms`, at: [50, 78], mobileAt: [25, 80], state: o.parallel ? "good" : "bad" },
    { id: "recs", label: "Recommendations API", sub: `${rd.recs} ms`, at: [14, 78], mobileAt: [25, 45], state: "wait" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("r", ["browser", "react"], { label: "render" })
    : stage === 1 ? hops("s", ["react", "reviews"], { label: "suspend: fetch" })
    : stage === 2 ? hops("p", ["product", "react", "browser"], { label: o.boundaries === "none" || o.boundaries === "one" ? "wait for all" : "reveal Product", tone: o.boundaries === "none" ? "bad" : "good" })
    : stage === 3 ? (o.parallel ? hops("b", ["react", "badges"], { label: "in parallel", tone: "good" }) : hops("b", ["reviews", "react", "badges"], { label: "then badges", tone: "bad" }))
    : stage === 4 ? hops("t", ["react", "browser"], { label: o.transition ? "keep old tab" : "fallback flash", tone: o.transition ? "good" : "bad" })
    : [];

  const captions = [
    "Step 1: React renders the page. Product, Reviews and Recommendations each ask for data that isn't there yet, so they suspend.",
    o.boundaries === "none" ? "Step 2: there's no Suspense boundary, so the whole page waits: nothing is shown until everything is ready." : `Step 2: each suspended part shows the fallback of the nearest boundary${o.boundaries === "one" ? ": one spinner for everything below the header" : ""}.`,
    `Step 3: boundaries reveal at ${fs.map((f) => `${f.t} ms`).join(", ")}. Layout shift ${cls.score}${clsBad ? ": content jumps as fallbacks are replaced" : ""}.`,
    o.parallel ? `Step 4: the badges are fetched alongside the reviews, so Reviews is complete at ${Math.max(rd.reviews, rd.badges)} ms.` : `Step 4: Badges only starts fetching once Reviews has its data: a waterfall that ends at ${rd.badges} ms.`,
    o.transition ? "Step 5: switching tabs inside startTransition keeps the old tab on screen, dimmed, until the new one is ready." : "Step 5: switching tabs replaces content the reader was looking at with a fallback, for 400 ms.",
  ];
  const caption = stage !== null ? captions[stage] : `First content at ${fc.first} ms · product at ${fc.product} ms · all done at ${fc.done} ms · layout shift ${cls.score}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Suspense and streaming"
        blurb="A component that's waiting for data can suspend. React then shows the nearest Suspense boundary's fallback, and swaps in everything inside that boundary together once it's ready. Where you put boundaries decides what readers see first, what pops in together, and whether the page jumps."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="React renders the page in the browser; Product, Reviews, Badges and Recommendations data come from APIs that answer at different times"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "browser", to: "react", label: "render" },
                  { from: "react", to: "product", label: "fetch" },
                  { from: "react", to: "reviews", label: "fetch" },
                  { from: "reviews", to: "badges", label: "then", dim: o.parallel },
                  { from: "react", to: "badges", label: "fetch", dim: !o.parallel },
                  { from: "react", to: "recs", label: "fetch" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="What the screen shows over time">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">the screen over time · layout shift {cls.score}</p>
                <ol className="mt-2 flex flex-wrap gap-3">
                  {fs.map((f) => (
                    <li key={f.t} className="w-[72px]">
                      <p className="mb-1 font-mono text-[10px] text-[var(--muted)]">{f.t} ms</p>
                      <Screen f={f} o={o} shifted={cls.shifts.some((s) => s.t === f.t)} />
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Filled: content. Dashed: a fallback. A red edge marks a frame where content already on screen moved.</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  No boundaries
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Planned boundaries
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Loading…">
                Load the page
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Render, and suspend on missing data" what="A component that reads data with use() (or a Suspense-aware data library) suspends if the data isn't there: React stops rendering that part and remembers to try again when the promise settles." accent={ACCENT} active={at(0)}>
                <pre className="overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">{"function Reviews({ id }) {\n  const reviews = use(fetchReviews(id));   // suspends\n  return <List items={reviews} />;\n}"}</pre>
              </FlowStep>
              <FlowArrow label="a thrown promise" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Show the nearest fallback" what="React walks up to the closest <Suspense> and shows its fallback instead of everything inside it. With no boundary at all, the page can't show anything until every part is ready." accent={ACCENT} active={at(1)}>
                <Choices accent={ACCENT} value={o.boundaries} onChange={(v) => set({ boundaries: v })} options={BOUNDARY_OPTS.map((b) => ({ id: b.id, label: b.label }))} />
                <pre className="mt-2 overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{BOUNDARY_OPTS.find((b) => b.id === o.boundaries)!.code}</pre>
              </FlowStep>
              <FlowArrow label="data arrives" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Reveal a boundary all at once" what="A boundary waits until everything inside it is ready, then swaps the fallback for the content in one go. If the fallback is a small spinner, the content below it jumps down when it's replaced." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.sizedFallback} onChange={(e) => set({ sizedFallback: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Skeleton fallbacks the size of the content (not a {FALLBACK_SPINNER}px spinner)
                </label>
                <p className="font-mono text-xs" style={{ color: clsBad ? "var(--bad)" : "var(--good)" }}>
                  layout shift {cls.score} {clsBad ? "(poor above 0.25, good below 0.1)" : "(good)"}
                </p>
              </FlowStep>
              <FlowArrow label="nested data" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Don't fetch in a waterfall" what="If Badges starts its fetch only when it renders, and it can only render after Reviews has its data, the two requests run one after the other. Start both together (in the parent, or with a preload) and the slow part is only as slow as the slowest request." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.parallel} onChange={(e) => set({ parallel: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Start the badges fetch with the reviews
                </label>
                <p className="font-mono text-xs text-[var(--muted)]">
                  reviews {rd.reviews} ms · badges {o.parallel ? `${BADGES_MS} ms alongside` : `${rd.reviews} + ${BADGES_MS} = ${rd.badges} ms`}
                </p>
              </FlowStep>
              <FlowArrow label="the next click" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Keep the old screen during updates" what="Once something is on screen, swapping it for a spinner feels like going backwards. Wrapping the update in startTransition tells React to keep showing the current content until the new content is ready." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.transition} onChange={(e) => set({ transition: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Switch tabs inside startTransition
                </label>
                <p className="font-mono text-xs" style={{ color: tab.flash ? "var(--bad)" : "var(--good)" }}>
                  for {tab.ms} ms: {tab.during}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Frames follow React&apos;s rule that a boundary reveals only when everything inside it is ready; layout shift is scored like CLS (impact × distance). API times are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Screen({ f, o, shifted }: { f: Frame; o: Opts; shifted: boolean }) {
  const one = o.boundaries === "one";
  const rest = SECTIONS.filter((s) => s.id !== "header");
  const box = (key: string, h: number, kind: "content" | "fallback" | "blank", label: string, inner?: ReactNode) => (
    <div key={key} className="relative overflow-hidden rounded-sm text-[8px] leading-none" style={{ height: Math.max(3, h * SCALE), border: kind === "fallback" ? `1px dashed var(--line-strong)` : "none", background: kind === "content" ? `color-mix(in srgb, ${ACCENT} 30%, transparent)` : "transparent" }}>
      {kind === "content" && <span className="absolute left-1 top-1 text-[var(--text)]">{label}</span>}
      {inner}
    </div>
  );
  const fallbackH = (h: number) => (o.sizedFallback ? h : FALLBACK_SPINNER);
  return (
    <div className="flex h-[130px] flex-col gap-0.5 overflow-hidden rounded border bg-[var(--inset)] p-0.5" style={{ borderColor: shifted ? "var(--bad)" : "var(--line)" }}>
      {SECTIONS.filter((s) => s.id === "header").map((s) => box(s.id, s.height, f.shown.header, s.label))}
      {one && f.shown.product !== "content"
        ? box("one", o.sizedFallback ? rest.reduce((a, s) => a + s.height, 0) : FALLBACK_SPINNER, "fallback", "")
        : rest.map((s) => {
            const kind = f.shown[s.id];
            const h = kind === "content" ? s.height : kind === "fallback" ? fallbackH(s.height) : 0;
            const inner = s.id === "reviews" && kind === "content" && f.badges === "fallback" ? <span className="absolute bottom-1 right-1 h-2 w-4 rounded-sm border border-dashed border-[var(--line-strong)]" /> : null;
            return box(s.id, h, kind, s.label, inner);
          })}
    </div>
  );
}
