"use client";

import { useState, type ReactNode } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { NAIVE, NET, SIZES, TUNED, load, rounds, type Opts } from "@/lib/criticalPath";

const ACCENT = "var(--web)";

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
      {children}
    </label>
  );
}

export default function CriticalPathDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const r = load(o);
  const scale = Math.max(r.end, r.textVisible, 1);
  const row = (id: string) => r.rows.find((x) => x.id === id)!;

  const nodes: MapNode[] = [
    { id: "browser", label: "Browser", sub: `first paint ${r.fcp} ms`, at: [14, 22], mobileAt: [25, 12], state: r.fcp > 1000 ? "bad" : "good" },
    { id: "site", label: "Your server", sub: `HTML in ${r.htmlRounds} round trip${r.htmlRounds === 1 ? "" : "s"}`, at: [50, 22], mobileAt: [75, 12], state: "active" },
    { id: "fonts", label: "fonts.example", sub: o.preconnect ? "preconnected" : "new connection", at: [86, 22], mobileAt: [75, 45], state: o.preconnect ? "good" : "wait" },
    { id: "analytics", label: "analytics.example", sub: o.deferScript ? "defer" : "blocks the parser", at: [86, 78], mobileAt: [75, 80], state: o.deferScript ? "good" : "bad" },
    { id: "cdn", label: "Image CDN", sub: `hero ${SIZES.hero} KB`, at: [50, 78], mobileAt: [25, 80], state: o.heroPriority ? "good" : "wait" },
    { id: "screen", label: "Screen", sub: `text ${r.textVisible} ms · LCP ${r.lcp} ms`, at: [14, 78], mobileAt: [25, 45], state: r.lcp > 1000 ? "bad" : "good" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("h", ["site", "browser"], { label: `${SIZES.html + (o.inlineCritical ? SIZES.critical : 0)} KB HTML` })
    : stage === 1 ? (o.inlineCritical ? hops("c", ["site", "browser"], { label: "CSS, non-blocking", tone: "good" }) : hops("c", ["site", "browser", "fonts"], { label: o.noImport ? "app.css" : "app.css → @import", tone: "bad" }))
    : stage === 2 ? hops("s", ["analytics", "browser"], { label: o.deferScript ? "defer" : "blocking script", tone: o.deferScript ? "good" : "bad" })
    : stage === 3 ? hops("f", ["fonts", "browser", "screen"], { label: o.fontSwap ? "swap" : "invisible text", tone: o.fontSwap ? "good" : "bad" })
    : stage === 4 ? hops("i", ["cdn", "browser", "screen"], { label: `LCP ${r.lcp} ms`, tone: r.lcp > 1000 ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: the HTML takes ${r.htmlRounds} round trips of TCP slow start; its <head> arrives in the first one, at ${row("html").start + NET.rtt} ms.`,
    o.inlineCritical ? "Step 2: the CSS for the first screen is inline, so the full stylesheet loads without blocking the paint." : o.noImport ? `Step 2: app.css and fonts.css both block rendering, fetched in parallel; done at ${Math.max(row("css").end, row("fontcss").end)} ms.` : `Step 2: fonts.css is behind an @import in app.css, so it's found only at ${row("css").end} ms and blocks the paint until ${row("fontcss").end} ms.`,
    o.deferScript ? "Step 3: analytics.js is deferred: it downloads in parallel and runs after parsing." : `Step 3: analytics.js in <head> stops the parser until it's fetched from another origin and run, at ${row("script").end} ms.`,
    o.fontSwap ? `Step 4: text paints in a fallback font at ${r.fcp} ms and swaps when serif.woff2 arrives.` : `Step 4: headings stay invisible until serif.woff2 arrives: text visible at ${r.textVisible} ms.`,
    `Step 5: first paint at ${r.fcp} ms; the hero image, the largest element, finishes at ${row("hero").end} ms, so LCP is ${r.lcp} ms.`,
  ];
  const caption = stage !== null ? captions[stage] : `First paint ${r.fcp} ms · text visible ${r.textVisible} ms · LCP ${r.lcp} ms · blocked by ${r.chain.join(", ")}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="The critical rendering path"
        blurb="Before a browser paints anything it needs the HTML, every stylesheet in the <head>, and any script that blocks the parser. Each of those can need more round trips than you'd think: a new connection, TCP slow start, a stylesheet found only inside another one. Shorten the chain one fix at a time."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The browser fetches HTML and CSS from your server, a font from a font origin, a script from an analytics origin and the hero image from an image CDN, then paints the screen"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "site", to: "browser", label: "HTML, CSS" },
                  { from: "browser", to: "fonts", label: "fonts.css, woff2" },
                  { from: "analytics", to: "browser", label: "script" },
                  { from: "cdn", to: "browser", label: "image" },
                  { from: "browser", to: "screen", label: "paint" },
                  { from: "fonts", to: "screen", label: "text" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Waterfall of the page's requests">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">waterfall · {NET.rtt} ms round trip · {NET.kbps} KB/s</p>
                <ul className="mt-2 space-y-1.5">
                  {r.rows.map((x) => (
                    <li key={x.id} className="text-[11px]">
                      <span className="flex flex-wrap justify-between gap-x-2">
                        <span className="font-mono">{x.label}</span>
                        <span className="font-mono text-[var(--faint)]">
                          {x.start}–{x.end} ms
                        </span>
                      </span>
                      <span className="relative mt-0.5 block h-2.5 rounded-sm bg-[var(--inset)]">
                        <span className="absolute inset-y-0 rounded-sm" style={{ left: `${(x.start / scale) * 100}%`, width: `${Math.max(1, ((x.end - x.start) / scale) * 100)}%`, background: x.blocking ? "var(--bad)" : ACCENT }} />
                        <span className="absolute inset-y-[-3px] border-l-2 border-[var(--good)]" style={{ left: `${(r.fcp / scale) * 100}%` }} aria-hidden />
                      </span>
                      <span className="block text-[var(--faint)]">{x.note}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Red: blocks the first paint. Green line: first paint at {r.fcp} ms.</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  As shipped
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  All six fixes
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Loading…">
                Load the article
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Get the HTML: the first 14 KB is special" what="A new TCP connection may send only about 14 KB (10 packets) in its first round trip, then doubles each round trip. Whatever the first paint needs should fit in that first window: the <head>, and ideally the CSS for the first screen, inlined." accent={ACCENT} active={at(0)}>
                <Toggle checked={o.inlineCritical} onChange={(v) => set({ inlineCritical: v })}>
                  Inline the critical CSS ({SIZES.critical} KB), load the rest without blocking
                </Toggle>
                <p className="font-mono text-xs text-[var(--muted)]">
                  14 KB → {rounds(14)} round trip · {SIZES.html + (o.inlineCritical ? SIZES.critical : 0)} KB → {r.htmlRounds} · {SIZES.css} KB → {rounds(SIZES.css)}
                </p>
              </FlowStep>
              <FlowArrow label="stylesheets" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="CSS blocks rendering" what="The browser won't paint until it has every stylesheet in the <head>, so it never shows unstyled content. An @import inside a stylesheet is worse: the second file is only discovered once the first has downloaded." accent={ACCENT} active={at(1)}>
                <Toggle checked={o.noImport} onChange={(v) => set({ noImport: v })}>
                  Replace @import with a &lt;link&gt; in the &lt;head&gt;
                </Toggle>
              </FlowStep>
              <FlowArrow label="scripts" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Scripts in the head stop the parser" what="A classic script in <head> must download and run before the parser continues, and before the first paint. One from another origin also needs its own connection." accent={ACCENT} active={at(2)}>
                <Toggle checked={o.deferScript} onChange={(v) => set({ deferScript: v })}>
                  Load analytics.js with defer
                </Toggle>
              </FlowStep>
              <FlowArrow label="fonts" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Fonts from another origin" what="A new origin costs DNS, TCP and TLS before the first byte: three round trips. preconnect starts that early. A web font is requested only once the CSS says visible text uses it, and by default text using it stays invisible for up to 3 seconds." accent={ACCENT} active={at(3)}>
                <Toggle checked={o.preconnect} onChange={(v) => set({ preconnect: v })}>
                  &lt;link rel=&quot;preconnect&quot;&gt; to fonts.example
                </Toggle>
                <Toggle checked={o.fontSwap} onChange={(v) => set({ fontSwap: v })}>
                  font-display: swap
                </Toggle>
              </FlowStep>
              <FlowArrow label="first paint" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Paint, then the largest element" what="The first paint shows text and layout. Largest Contentful Paint waits for the biggest thing on screen, here the hero image, which the browser treats as low priority unless told otherwise." accent={ACCENT} active={at(4)}>
                <Toggle checked={o.heroPriority} onChange={(v) => set({ heroPriority: v })}>
                  fetchpriority=&quot;high&quot; on the hero image
                </Toggle>
                <ul className="grid gap-1 font-mono text-xs sm:grid-cols-3">
                  <li>first paint: {r.fcp} ms</li>
                  <li>text visible: {r.textVisible} ms</li>
                  <li style={{ color: r.lcp <= 2500 ? "var(--good)" : "var(--bad)" }}>LCP: {r.lcp} ms</li>
                </ul>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Round trips follow TCP slow start (10 packets, doubling up to the link&apos;s capacity) and TLS 1.3 setup; the {NET.rtt} ms round trip, bandwidth and file sizes are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
