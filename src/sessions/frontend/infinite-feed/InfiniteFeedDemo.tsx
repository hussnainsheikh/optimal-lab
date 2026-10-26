"use client";

import { useEffect, useRef, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { LATENCY_MS, RESTORES, backButton, domCost, pageTwo, prefetch, type Paging, type Restore } from "@/lib/infiniteFeed";

const ACCENT = "var(--web)";
const LIVE_ROWS = 2000;
const LIVE_ROW_PX = 44;
const LIVE_HEIGHT = 264;

type Opts = { paging: Paging; ahead: number; virtual: boolean; observer: boolean; restore: Restore };
const NAIVE: Opts = { paging: "offset", ahead: 0, virtual: false, observer: false, restore: "none" };
const TUNED: Opts = { paging: "cursor", ahead: 2, virtual: true, observer: true, restore: "cached" };
const SPEEDS = [
  { id: "300", label: "Reading (300 px/s)" },
  { id: "1500", label: "Skimming (1,500 px/s)" },
  { id: "4000", label: "Flicking (4,000 px/s)" },
] as const;

export default function InfiniteFeedDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const [arrivals, setArrivals] = useState(4);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]["id"]>("1500");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const p2 = pageTwo(o.paging, arrivals);
  const pf = prefetch(o.ahead, Number(speed));
  const dom = domCost(400, o.virtual);
  const back = backButton(o.restore, 5, 37);
  // A scroll handler fires every frame while the end is in view; without an in-flight flag each fires a request.
  const duplicateRequests = o.observer ? 0 : Math.round(LATENCY_MS / 16.7) - 1;

  const nodes: MapNode[] = [
    { id: "reader", label: "Reader", sub: `${Number(speed).toLocaleString("en-US")} px/s`, at: [14, 22], mobileAt: [25, 12], state: pf.wait ? "wait" : "good" },
    { id: "sentinel", label: o.observer ? "IntersectionObserver" : "scroll handler", sub: o.ahead ? `${o.ahead} screens ahead` : "at the very end", at: [50, 22], mobileAt: [75, 12], state: duplicateRequests ? "bad" : "good" },
    { id: "api", label: "Feed API", sub: p2.request.replace("GET /feed", ""), at: [86, 22], mobileAt: [75, 45], state: p2.dupes.length ? "bad" : "good" },
    { id: "cache", label: "Page cache", sub: o.restore === "cached" ? "keeps loaded pages" : "none", at: [86, 78], mobileAt: [75, 80], state: o.restore === "cached" ? "good" : "dim" },
    { id: "dom", label: "DOM", sub: `${dom.nodes.toLocaleString("en-US")} nodes`, at: [50, 78], mobileAt: [25, 80], state: dom.nodes > 3000 ? "bad" : "good" },
    { id: "back", label: "Back button", sub: back.ok ? "same post" : back.lands === 0 ? "top of the feed" : `post ${back.lands + 1}`, at: [14, 78], mobileAt: [25, 45], state: back.ok ? "good" : "bad" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("p", ["sentinel", "api"], { label: o.paging, tone: p2.dupes.length ? "bad" : "good" })
    : stage === 1 ? hops("f", ["reader", "sentinel", "api"], { label: pf.wait ? `waits ${pf.wait} ms` : "ready in time", tone: pf.wait ? "bad" : "good" })
    : stage === 2 ? hops("v", ["api", "dom"], { label: `${dom.rows} rows in DOM`, tone: dom.nodes > 3000 ? "bad" : "good" })
    : stage === 3 ? hops("d", ["sentinel", "api"], { label: duplicateRequests ? `${duplicateRequests + 1} requests` : "1 request", tone: duplicateRequests ? "bad" : "good" })
    : stage === 4 ? hops("b", ["back", o.restore === "cached" ? "cache" : "api", "dom"], { label: back.ok ? "restored" : "refetched", tone: back.ok ? "good" : "bad" })
    : [];

  const captions = [
    p2.dupes.length ? `Step 1: ${arrivals} new posts arrived while reading, so offset=10 now starts ${arrivals} posts earlier: page 2 repeats ${p2.dupes.length} post${p2.dupes.length === 1 ? "" : "s"}.` : "Step 1: page 2 asks for posts older than the last one seen, so new posts at the top can't shift it.",
    pf.wait ? `Step 2: at ${Number(speed).toLocaleString("en-US")} px/s the reader reaches the end ${pf.wait} ms before the next page arrives: a spinner.` : "Step 2: the next page is requested early enough that it's there before the reader is.",
    o.virtual ? `Step 3: after 400 posts, only ${dom.rows} rows exist in the DOM: the ones on screen plus a few either side.` : `Step 3: after 400 posts, all ${dom.rows} rows are still in the DOM: ${dom.nodes.toLocaleString("en-US")} nodes to lay out and keep in memory.`,
    duplicateRequests ? `Step 4: the scroll handler fires every frame while the end is visible: ${duplicateRequests + 1} requests for the same page.` : "Step 4: an IntersectionObserver fires once when the sentinel appears, and an in-flight flag blocks repeats.",
    back.ok ? "Step 5: Back restores the cached pages and the saved position: the reader is at the same post." : `Step 5: Back lands the reader at post ${back.lands + 1} instead of post 38.`,
  ];
  const caption = stage !== null ? captions[stage] : `${p2.dupes.length} duplicates · waits ${pf.wait} ms at the end · ${dom.nodes.toLocaleString("en-US")} DOM nodes · Back: ${back.ok ? "same place" : "lost place"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · case study"
        title="An infinite scrolling feed"
        blurb="A feed that loads more as you scroll has five ways to go wrong: repeated posts, a spinner at the bottom, a page that gets slower the further you go, the same page fetched ten times, and losing your place when you come back. Build it one fix at a time."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The reader scrolls; a sentinel near the end asks the feed API for the next page; pages are rendered into the DOM and kept in a cache for the Back button"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "reader", to: "sentinel", label: "scroll" },
                  { from: "sentinel", to: "api", label: "next page" },
                  { from: "api", to: "cache", label: "pages" },
                  { from: "api", to: "dom", label: "render" },
                  { from: "back", to: "cache", label: "restore", dim: o.restore !== "cached" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <LiveList virtual={o.virtual} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  First version
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  All five fixes
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Scrolling…">
                Scroll the feed
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Page with a cursor, not an offset" what="New posts land at the top while someone reads. offset=10 then points at posts they've already seen. A cursor (the id or timestamp of the last post) asks for what comes after it, however the list changed." accent={ACCENT} active={at(0)}>
                <Choices<Paging> accent={ACCENT} value={o.paging} onChange={(v) => set({ paging: v })} options={[{ id: "offset", label: "offset" }, { id: "cursor", label: "cursor" }]} />
                <Slider label="New posts while reading page 1" value={arrivals} min={0} max={8} step={1} format={(v) => `${v}`} onChange={setArrivals} accent={ACCENT} />
                <p className="font-mono text-[11px] text-[var(--muted)]">{p2.request}</p>
                <p className="font-mono text-[11px]">
                  page 2:{" "}
                  {p2.page2.map((id) => (
                    <span key={id} style={{ color: p2.dupes.includes(id) ? "var(--bad)" : undefined }}>
                      {id}{" "}
                    </span>
                  ))}
                </p>
              </FlowStep>
              <FlowArrow label="the end comes closer" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Fetch before they reach the end" what={`The next page takes ${LATENCY_MS} ms. Start loading when the end is still a screen or two away, or fast readers will hit a spinner.`} accent={ACCENT} active={at(1)}>
                <Choices accent={ACCENT} value={String(o.ahead) as "0" | "1" | "2"} onChange={(v) => set({ ahead: Number(v) })} options={[{ id: "0", label: "At the end" }, { id: "1", label: "1 screen ahead" }, { id: "2", label: "2 screens ahead" }]} />
                <Choices accent={ACCENT} value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ id: s.id, label: s.label }))} />
                <p className="mt-2 font-mono text-xs" style={{ color: pf.wait ? "var(--bad)" : "var(--good)" }}>
                  {pf.wait ? `spinner for ${pf.wait} ms` : `no wait: ${pf.timeToEnd} ms to reach the end`}
                </p>
              </FlowStep>
              <FlowArrow label="hundreds of posts" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Render only what's on screen" what="Every post stays in the DOM unless you remove it. After a long session that's thousands of nodes for the browser to lay out and keep in memory. Virtualization keeps rows in a window around the viewport and positions them inside one tall spacer." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.virtual} onChange={(e) => set({ virtual: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Virtualize the list
                </label>
                <p className="font-mono text-xs text-[var(--muted)]">
                  after 400 posts: {dom.rows} rows · {dom.nodes.toLocaleString("en-US")} DOM nodes
                </p>
              </FlowStep>
              <FlowArrow label="the trigger" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Ask once per page" what="A scroll listener fires dozens of times a second, and keeps firing while the request is in flight. An IntersectionObserver on a sentinel element fires when it comes into view, and a loading flag stops repeats." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.observer} onChange={(e) => set({ observer: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  IntersectionObserver + an in-flight flag
                </label>
                <p className="font-mono text-xs" style={{ color: duplicateRequests ? "var(--bad)" : "var(--good)" }}>
                  {duplicateRequests + 1} request{duplicateRequests ? "s" : ""} for page 2
                </p>
              </FlowStep>
              <FlowArrow label="open a post, then Back" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Come back to the same place" what="The reader opens post 38 and presses Back. The browser can only restore a scroll position if the content is already there at the right height." accent={ACCENT} active={at(4)}>
                <Choices<Restore> accent={ACCENT} value={o.restore} onChange={(v) => set({ restore: v })} options={RESTORES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs text-[var(--muted)]">{RESTORES.find((x) => x.id === o.restore)!.what}</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Paging really slices a list that gains posts; the list under the map is really virtualized and its DOM nodes are counted live. Latency, speeds and row sizes are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function LiveList({ virtual }: { virtual: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [nodes, setNodes] = useState(0);
  const overscan = 3;
  const first = virtual ? Math.max(0, Math.floor(top / LIVE_ROW_PX) - overscan) : 0;
  const last = virtual ? Math.min(LIVE_ROWS, Math.ceil((top + LIVE_HEIGHT) / LIVE_ROW_PX) + overscan) : LIVE_ROWS;
  const rows = Array.from({ length: last - first }, (_, i) => first + i);

  useEffect(() => {
    const id = requestAnimationFrame(() => setNodes(box.current?.querySelectorAll("*").length ?? 0));
    return () => cancelAnimationFrame(id);
  }, [first, last]);

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="A live list of 2,000 posts">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
        live · {LIVE_ROWS.toLocaleString("en-US")} posts · {nodes.toLocaleString("en-US")} DOM nodes right now
      </p>
      <div ref={box} onScroll={(e) => setTop(e.currentTarget.scrollTop)} className="relative mt-2 overflow-y-auto rounded-md border border-[var(--line)] bg-[var(--inset)]" style={{ height: LIVE_HEIGHT }} tabIndex={0} aria-label="Scroll the posts">
        <div style={{ height: LIVE_ROWS * LIVE_ROW_PX, position: "relative" }}>
          {rows.map((i) => (
            <div key={i} className="absolute inset-x-0 flex items-center gap-2 border-b border-[var(--line)] px-2 text-xs" style={{ top: i * LIVE_ROW_PX, height: LIVE_ROW_PX }}>
              <span className="inline-block h-6 w-6 shrink-0 rounded-full bg-[var(--line-strong)]" />
              <span className="truncate">
                Post {i + 1}: <span className="text-[var(--muted)]">trail notes, day {(i % 30) + 1}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-[var(--faint)]">Scroll it. {virtual ? `Only rows ${first + 1}–${last} exist right now.` : "Every row exists, whether you can see it or not."}</p>
    </section>
  );
}
