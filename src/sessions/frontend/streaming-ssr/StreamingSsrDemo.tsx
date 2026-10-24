"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { BUFFERED, STREAMED, T, timeline, wire, type Opts } from "@/lib/streamingSsr";

const ACCENT = "var(--web)";

export default function StreamingSsrDemo() {
  const [o, setO] = useState<Opts>(BUFFERED);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const w = wire(o);
  const tl = timeline(o);
  const firstChunk = w.chunks[0];

  const nodes: MapNode[] = [
    { id: "browser", label: "Browser", sub: `shell painted at ${tl.shellPaint} ms`, at: [14, 22], mobileAt: [25, 12], state: tl.shellPaint < 300 ? "good" : "bad" },
    { id: "proxy", label: o.proxyBuffers ? "Proxy (buffering)" : "CDN / proxy", sub: o.proxyBuffers ? "waits for the whole response" : "passes chunks through", at: [50, 22], mobileAt: [75, 12], state: o.proxyBuffers ? "bad" : "good" },
    { id: "server", label: "App server", sub: o.stream ? "renderToPipeableStream" : "renders, then sends", at: [86, 22], mobileAt: [75, 45], state: "active" },
    { id: "db", label: "Product database", sub: `${T.product} ms`, at: [86, 78], mobileAt: [75, 80], state: o.missing ? "bad" : "good" },
    { id: "reviews", label: "Reviews service", sub: `${T.reviews} ms`, at: [50, 78], mobileAt: [25, 80], state: o.missing ? "dim" : "wait" },
    { id: "status", label: "Search crawler", sub: `sees ${w.status}`, at: [14, 78], mobileAt: [25, 45], state: tl.softFourOhFour ? "bad" : "good" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("q", ["browser", "proxy", "server"], { label: "GET /p/trail-runner" })
    : stage === 1 ? hops("s", ["server", "proxy", "browser"], { label: o.stream ? `shell @${firstChunk.at} ms` : `all @${firstChunk.at} ms`, tone: o.stream ? "good" : "bad" })
    : stage === 2 ? (o.stream ? hops("p", ["db", "server", "proxy"], { label: "product chunk" }) : hops("p", ["db", "server"], { label: "wait" }))
    : stage === 3 ? hops("x", ["proxy", "browser"], { label: o.proxyBuffers ? `held until ${tl.done - T.oneWay} ms` : "as they come", tone: o.proxyBuffers ? "bad" : "good" })
    : stage === 4 ? hops("c", ["browser", "status"], { label: w.status, tone: tl.softFourOhFour ? "bad" : "good" })
    : [];

  const captions = [
    "Step 1: the request reaches the server. The page's shell is ready in 30 ms; the product and reviews take longer.",
    o.stream ? `Step 2: the shell is flushed at ${firstChunk.at} ms as the first chunk${o.headScript ? ", but a script in <head> holds back the first paint" : ""}.` : `Step 2: nothing is sent until the slowest part is done: the first byte leaves at ${firstChunk.at} ms.`,
    o.stream ? "Step 3: each part goes out when it's ready, as hidden HTML plus a tiny script that moves it into its placeholder." : "Step 3: the browser has nothing to show while the server waits.",
    o.proxyBuffers ? `Step 4: a buffering proxy holds every chunk until the response ends, so streaming makes no difference: shell at ${tl.shellPaint} ms.` : `Step 4: chunks pass straight through: shell at ${tl.shellPaint} ms, product at ${tl.productAt} ms${tl.reviewsAt ? `, reviews at ${tl.reviewsAt} ms` : ""}.`,
    tl.softFourOhFour ? "Step 5: the product doesn't exist, but 200 OK went out with the shell. Search engines index a 'not found' page as a real one." : `Step 5: the response says ${w.status}${o.missing ? ", decided before the first byte" : ""}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${w.status} · first byte at ${tl.ttfb} ms · shell painted at ${tl.shellPaint} ms · product at ${tl.productAt} ms.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Streaming server rendering"
        blurb="Server rendering usually waits for the slowest part of the page before sending anything. Streaming sends the page in pieces: the shell straight away, and each slow part as soon as it's ready, over one HTTP response. It only works if nothing in between buffers it, and if you decide the status code before the first byte."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The browser requests a page through a CDN or proxy; the app server renders it from a product database and a reviews service; a search crawler reads the status code"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "browser", to: "proxy", label: "HTTP" },
                  { from: "proxy", to: "server", label: "HTTP" },
                  { from: "server", to: "db", label: "query" },
                  { from: "server", to: "reviews", label: "fetch", dim: o.missing },
                  { from: "browser", to: "status", label: "same URL" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The response as it goes over the wire">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">on the wire · {w.totalBytes} bytes of HTML</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{w.headers.join("\n")}</pre>
                <ol className="mt-2 space-y-1.5">
                  {w.chunks.map((c, i) => (
                    <li key={i} className="rounded-md border-l-2 bg-[var(--inset)] px-2 py-1" style={{ borderColor: ACCENT }}>
                      <p className="font-mono text-[10px] text-[var(--faint)]">
                        sent at {c.at} ms{o.proxyBuffers ? ` · reaches the browser at ${tl.done} ms` : ` · arrives at ${c.at + T.oneWay} ms`}
                      </p>
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed">{c.raw.replace(/\r\n/g, "␍␊\n")}</pre>
                    </li>
                  ))}
                </ol>
                <p className="mt-1 text-[11px] text-[var(--faint)]">␍␊ marks the CRLF line endings. In a chunked response each chunk starts with its length in hex.</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(BUFFERED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Render, then send
                </button>
                <button type="button" onClick={() => setO(STREAMED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Stream it
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Loading…">
                Load the product page
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Render what's ready" what="The page's layout, header and placeholders need no data. The product needs a database query; the reviews need a slower service." accent={ACCENT} active={at(0)}>
                <Choices accent={ACCENT} value={o.stream ? "stream" : "buffer"} onChange={(v) => set({ stream: v === "stream" })} options={[{ id: "buffer", label: "renderToString (wait for all)" }, { id: "stream", label: "Stream with Suspense" }]} />
                <ul className="mt-2 grid gap-1 font-mono text-xs sm:grid-cols-3">
                  <li>shell: {T.shell} ms</li>
                  <li>product: {T.product} ms</li>
                  <li>reviews: {T.reviews} ms</li>
                </ul>
              </FlowStep>
              <FlowArrow label="the first chunk" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Flush the shell straight away" what="With streaming, the <head> and the shell are the first chunk, so the browser starts fetching CSS and painting while the server is still waiting on data. A classic script in <head> still blocks that first paint." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.headScript} onChange={(e) => set({ headScript: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  A blocking &lt;script&gt; in &lt;head&gt; ({T.scriptLoad} ms to load)
                </label>
                <p className="font-mono text-xs text-[var(--muted)]">
                  first byte {tl.ttfb} ms · shell painted {tl.shellPaint} ms
                </p>
              </FlowStep>
              <FlowArrow label="later chunks" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Send the rest out of order" what="When the product is ready, React sends its HTML in a hidden div followed by a small inline script that swaps it into the placeholder. Parts arrive in whatever order they finish, on the same connection." accent={ACCENT} active={at(2)}>
                <ul className="grid gap-1 font-mono text-xs sm:grid-cols-2">
                  <li>product shown: {tl.productAt} ms</li>
                  <li>reviews shown: {tl.reviewsAt ?? "n/a"} {tl.reviewsAt ? "ms" : ""}</li>
                </ul>
              </FlowStep>
              <FlowArrow label="through the proxy" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Make sure nothing buffers it" what="A proxy, load balancer or compression layer that collects the whole response before passing it on undoes streaming without any error. nginx's proxy_buffering and some compression middleware do exactly that unless they're configured not to." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.proxyBuffers} onChange={(e) => set({ proxyBuffers: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  A proxy that buffers responses
                </label>
              </FlowStep>
              <FlowArrow label="the status line" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Decide the status before the first byte" what="The status code and headers go out with the first chunk. If the product turns out not to exist after the shell is sent, it's too late for a 404: the page says not found, the response says 200. Check what decides the status before you start streaming." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.missing} onChange={(e) => set({ missing: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The product doesn&apos;t exist
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.checkFirst} disabled={!o.stream} onChange={(e) => set({ checkFirst: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Check it exists before streaming (+{T.check} ms)
                </label>
                <p className="font-mono text-xs" style={{ color: tl.softFourOhFour ? "var(--bad)" : "var(--good)" }}>
                  HTTP {w.status}
                  {tl.softFourOhFour ? ": a soft 404" : ""}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The chunk framing and byte counts are real Transfer-Encoding: chunked; the $RC swap mirrors React&apos;s streaming format, simplified. Render and network times are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
