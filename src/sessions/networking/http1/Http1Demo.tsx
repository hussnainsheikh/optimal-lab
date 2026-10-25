"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { FILES, MODES, MODE_LABEL, loadPage, parseStream, request, responses, type Framing, type Mode } from "@/lib/http1";

const ACCENT = "var(--net)";

type Opts = { framing: Framing; lengthError: number; mode: Mode; rtt: number; slowApi: boolean };
const OLD: Opts = { framing: "close", lengthError: 0, mode: "close", rtt: 80, slowApi: true };
const MODERN: Opts = { framing: "chunked", lengthError: 0, mode: "six", rtt: 80, slowApi: true };

const FRAMING: Record<Framing, string> = { length: "Content-Length", chunked: "Chunked", close: "Close to end" };
const LENGTH_ERRORS = [
  { id: "0", label: "Correct length" },
  { id: "-6", label: "6 bytes short" },
  { id: "4", label: "4 bytes long" },
];
const PHASE_COLOR = { connect: "var(--c4)", wait: "var(--line-strong)", transfer: ACCENT } as const;
const ms = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(2)} s` : `${Math.round(x)} ms`);
const show = (raw: string) => raw.replace(/\r\n/g, "␍␊\n");

export default function Http1Demo() {
  const [o, setO] = useState<Opts>(OLD);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const keepAlive = o.mode !== "close";
  const req = request("/cart", keepAlive);
  const raw = responses(o.framing, o.framing === "length" ? o.lengthError : 0);
  const parsed = parseStream(raw, o.framing === "close");
  const broken = parsed.some((p) => p.error);
  const load = loadPage(o.mode, o.rtt, o.slowApi);
  const all = MODES.map((m) => ({ m, l: loadPage(m, o.rtt, o.slowApi) }));
  const best = Math.min(...all.map((x) => x.l.total));
  const rows = o.mode === "close" || o.mode === "six" ? 6 : 1;
  const apiIndex = FILES.findIndex((f) => f.name === "/api/cart");

  const nodes: MapNode[] = [
    { id: "browser", label: "Browser", sub: `${load.connections} connection${load.connections === 1 ? "" : "s"} · ${load.handshakes} handshake${load.handshakes === 1 ? "" : "s"}`, at: [13, 50], mobileAt: [50, 10], state: broken ? "bad" : "active" },
    { id: "server", label: "Web server", sub: keepAlive ? "keep-alive" : "Connection: close", at: [50, 50], mobileAt: [50, 50], state: "active" },
    { id: "api", label: "Cart service", sub: o.slowApi ? "/api/cart · 350 ms" : "/api/cart · 30 ms", at: [87, 50], mobileAt: [50, 90], state: o.slowApi && o.mode === "pipeline" ? "bad" : "idle" },
  ];
  const packets: Packet[] =
    stage === 0 ? [...hops("s", ["browser", "server"], { label: "SYN, ClientHello" }), ...hops("s2", ["server", "browser"], { label: "2 round trips", start: 0.5 })]
    : stage === 1 ? hops("g", ["browser", "server"], { label: "GET /cart" })
    : stage === 2 ? hops("r", ["server", "browser"], { label: broken ? "200 OK + garbage" : "200 OK", tone: broken ? "bad" : "good" })
    : stage === 3 ? [...hops("p", ["browser", "server", "api"], { label: o.mode === "pipeline" ? "3 requests at once" : "next request" }), ...hops("p2", ["api", "server", "browser"], { label: o.slowApi ? "350 ms" : "30 ms", tone: o.slowApi && o.mode === "pipeline" ? "bad" : "accent", start: 1 })]
    : stage === 4 ? hops("f", ["server", "browser"], { label: `30 files · ${ms(load.total)}`, tone: load.total === best ? "good" : "accent" })
    : [];

  const captions = [
    `Step 1: before the first byte of HTTP, TCP and TLS 1.3 cost two round trips: ${ms(2 * o.rtt)} at ${o.rtt} ms.`,
    `Step 2: the request is plain text: a request line, ${req.split("\r\n").length - 3} headers, and an empty line that says "that's all" (${req.length} bytes).`,
    broken ? `Step 3: the Content-Length is wrong, so the parser cuts the body in the wrong place and reads the leftover as the next response: ${parsed.find((p) => p.error)?.error}.` : `Step 3: the browser knows where the body ends from ${o.framing === "length" ? "Content-Length" : o.framing === "chunked" ? "the chunk sizes, ending with a 0-size chunk" : "the connection closing, so the connection can't be reused"}.`,
    o.mode === "pipeline" ? `Step 4: pipelining sends every request at once, but responses must return in order: the slow /api/cart holds up everything behind it.` : o.mode === "close" ? "Step 4: Connection: close means every file pays the two-round-trip handshake again." : `Step 4: keep-alive reuses the connection, but one connection carries one response at a time.`,
    `Step 5: ${MODE_LABEL[o.mode]}: the page's 30 files take ${ms(load.total)}${load.total === best ? ", the fastest here" : `; the fastest option takes ${ms(best)}`}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${MODE_LABEL[o.mode]} at ${o.rtt} ms round trip: 30 files in ${ms(load.total)}, ${load.handshakes} handshake${load.handshakes === 1 ? "" : "s"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="HTTP/1.1"
        blurb="HTTP/1.1 is text over a TCP connection: a request line, headers, a blank line, maybe a body. Read the real bytes, see how the browser knows where a response ends (and what a wrong length does), then load a page of 30 files four ways."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A browser sends HTTP/1.1 requests to a web server, which calls a cart service"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "browser", to: "server", label: "TCP + TLS", dashed: keepAlive },
                  { from: "server", to: "api", label: "/api/cart" },
                ]}
                packets={packets}
                aspect={2.2}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="When each file arrives">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {MODE_LABEL[o.mode]} · {ms(load.total)}
                </p>
                <svg viewBox={`0 0 300 ${rows * 14 + 14}`} className="mt-2 w-full" role="img" aria-label={`Timeline of ${rows} connection${rows === 1 ? "" : "s"}: handshakes, waiting and transfers; the page finishes at ${ms(load.total)}`}>
                  {load.segments.map((s, i) => (
                    <rect
                      key={i}
                      x={(s.from / load.total) * 300}
                      y={s.conn * 14 + 2}
                      width={Math.max(0.6, ((s.to - s.from) / load.total) * 300)}
                      height={10}
                      fill={s.file === apiIndex && s.phase !== "connect" ? "var(--bad)" : PHASE_COLOR[s.phase]}
                      opacity={s.phase === "wait" ? 0.6 : 0.9}
                    />
                  ))}
                  <text x={0} y={rows * 14 + 12} fontSize={8} fill="var(--faint)">0</text>
                  <text x={300} y={rows * 14 + 12} fontSize={8} fill="var(--faint)" textAnchor="end">{ms(load.total)}</text>
                </svg>
                <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-[var(--muted)]">
                  <span><span style={{ color: "var(--c4)" }}>■</span> handshake</span>
                  <span><span style={{ color: "var(--line-strong)" }}>■</span> waiting</span>
                  <span><span style={{ color: ACCENT }}>■</span> downloading</span>
                  <span><span style={{ color: "var(--bad)" }}>■</span> /api/cart</span>
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(OLD)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  HTTP/1.0 habits
                </button>
                <button type="button" onClick={() => setO(MODERN)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  What browsers do
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Loading…">
                Load the page
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Open a connection" what="HTTP/1.1 runs on a TCP connection, almost always wrapped in TLS. Setting one up costs a round trip for TCP and another for TLS 1.3 before any request can go out." accent={ACCENT} active={at(0)}>
                <Slider label="Round trip to the server" value={o.rtt} min={10} max={250} step={10} format={(v) => `${v} ms`} onChange={(v) => set({ rtt: v })} accent={ACCENT} />
                <p className="font-mono text-xs text-[var(--muted)]">handshake: 2 × {o.rtt} ms = {ms(2 * o.rtt)}</p>
              </FlowStep>
              <FlowArrow label="an open connection" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Write the request" what="A request is lines of text, each ending in carriage return + line feed (␍␊). The method, path and version come first, then headers. An empty line ends the headers. Host is required, because one IP address can serve many sites." accent={ACCENT} active={at(1)}>
                <pre className="whitespace-pre-wrap break-all rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">{show(req)}</pre>
              </FlowStep>
              <FlowArrow label="response bytes" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Find where the response ends" what="On a reused connection the next response starts right after this one, so the browser must know exactly where the body ends: a Content-Length, chunks that each start with their size in hex, or the server closing the connection." accent={ACCENT} active={at(2)}>
                <Choices<Framing> accent={ACCENT} value={o.framing} onChange={(v) => set({ framing: v })} options={(Object.keys(FRAMING) as Framing[]).map((id) => ({ id, label: FRAMING[id] }))} />
                {o.framing === "length" && <Choices<string> accent={ACCENT} value={String(o.lengthError)} onChange={(v) => set({ lengthError: Number(v) })} options={LENGTH_ERRORS} />}
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">{show(raw)}</pre>
                <ol className="space-y-1 text-xs">
                  {parsed.map((p, i) => (
                    <li key={i} className="break-words" style={{ color: p.error ? "var(--bad)" : "var(--good)" }}>
                      {p.error ? `✕ response ${i + 1}: ${p.error}` : `✓ response ${i + 1}: ${p.status}, ${p.framing}, body ${JSON.stringify(p.body)}`}
                    </li>
                  ))}
                </ol>
              </FlowStep>
              <FlowArrow label="the next request" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Reuse the connection" what="Keep-alive (the default in HTTP/1.1) saves the handshake. But one connection carries one response at a time. Pipelining sends requests without waiting, yet responses must come back in order, so a slow one blocks the rest. Browsers turned it off; they open up to six connections per site instead." accent={ACCENT} active={at(3)}>
                <Choices<Mode> accent={ACCENT} value={o.mode} onChange={(v) => set({ mode: v })} options={MODES.map((id) => ({ id, label: MODE_LABEL[id] }))} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.slowApi} onChange={(e) => set({ slowApi: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  /api/cart takes 350 ms on the server
                </label>
              </FlowStep>
              <FlowArrow label="30 files" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Load the whole page" what="The HTML comes first, then 29 files it points to: styles, scripts, the cart API and images, about 1 MB in all over a 20 Mbps link. Round trips and handshakes, not bandwidth, decide most of the time." accent={ACCENT} active={at(4)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[16rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">connections</th>
                        <th className="py-1 text-right font-normal">handshakes</th>
                        <th className="py-1 text-right font-normal">page loaded</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {all.map((x) => (
                        <tr key={x.m} className="border-t border-[var(--line)]" style={{ fontWeight: x.m === o.mode ? 600 : 400 }}>
                          <td className="py-1 font-sans text-[var(--muted)]">{MODE_LABEL[x.m]}</td>
                          <td className="py-1 text-right">{x.l.handshakes}</td>
                          <td className="py-1 text-right" style={{ color: x.l.total === best ? "var(--good)" : undefined }}>{ms(x.l.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The bytes and the parser are real HTTP/1.1. The page load runs millisecond by millisecond with bandwidth shared between transfers; file sizes and server times are illustrative, and TCP slow start is left out.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
