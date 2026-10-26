"use client";

import { useEffect, useRef, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { ROWS, STRATEGIES, reconnect, renderLoad, stampede, type Strategy } from "@/lib/liveDashboard";

const ACCENT = "var(--web)";
const RATES = ["50", "200", "1000"] as const;
const SYMBOLS = ["ACME", "BOLT", "CRUX", "DUNE", "EMBR", "FERN"];

type Opts = { rate: (typeof RATES)[number]; strategy: Strategy; hidden: boolean; pauseHidden: boolean; detectGaps: boolean; jitter: boolean };
const NAIVE: Opts = { rate: "200", strategy: "every", hidden: false, pauseHidden: false, detectGaps: false, jitter: false };
const TUNED: Opts = { rate: "200", strategy: "throttle", hidden: false, pauseHidden: true, detectGaps: true, jitter: true };

export default function LiveDashboardDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const load = renderLoad(o.strategy, Number(o.rate), o.hidden, o.pauseHidden);
  const gap = reconnect(o.detectGaps);
  const storm = stampede(o.jitter);

  const nodes: MapNode[] = [
    { id: "feed", label: "Price feed", sub: `${o.rate} messages/s`, at: [14, 22], mobileAt: [25, 12], state: "active" },
    { id: "socket", label: "WebSocket", sub: o.detectGaps ? "checks sequence numbers" : "trusts the stream", at: [50, 22], mobileAt: [75, 12], state: o.detectGaps ? "good" : "wait" },
    { id: "buffer", label: "Buffer", sub: o.strategy === "frame" || o.strategy === "throttle" ? "latest value per row" : "none", at: [86, 22], mobileAt: [75, 45], state: o.strategy === "frame" || o.strategy === "throttle" ? "good" : "dim" },
    { id: "table", label: `Table (${ROWS} rows)`, sub: `${load.commitsPerSec} renders/s · ${load.busy}% busy`, at: [86, 78], mobileAt: [75, 80], state: load.busy > 70 ? "bad" : load.busy > 30 ? "wait" : "good" },
    { id: "tab", label: "Browser tab", sub: o.hidden ? (o.pauseHidden ? "hidden: paused" : "hidden, still rendering") : "visible", at: [50, 78], mobileAt: [25, 80], state: o.hidden && !o.pauseHidden ? "bad" : "good" },
    { id: "clients", label: "10,000 clients", sub: `peak ${storm.peak.toLocaleString("en-US")} reconnects/s`, at: [14, 78], mobileAt: [25, 45], state: storm.peak > 5000 ? "bad" : "good" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("m", ["feed", "socket"], { label: `${o.rate}/s` })
    : stage === 1 ? hops("r", ["socket", o.strategy === "frame" || o.strategy === "throttle" ? "buffer" : "table", "table"].filter((v, i, a) => a.indexOf(v) === i), { label: `${load.commitsPerSec} renders/s`, tone: load.busy > 70 ? "bad" : "good" })
    : stage === 2 ? hops("h", ["tab", "table"], { label: o.hidden && o.pauseHidden ? "paused" : "rendering", tone: o.hidden && !o.pauseHidden ? "bad" : "good" })
    : stage === 3 ? hops("g", ["feed", "socket", "table"], { label: gap.stale ? `${gap.stale} rows wrong` : "snapshot resync", tone: gap.stale ? "bad" : "good" })
    : stage === 4 ? hops("c", ["clients", "feed"], { label: `${storm.peak.toLocaleString("en-US")}/s`, tone: storm.peak > 5000 ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: the server pushes ${o.rate} price updates a second over one WebSocket, each for one of ${ROWS} rows.`,
    `Step 2: ${STRATEGIES.find((s) => s.id === o.strategy)!.what}: ${load.commitsPerSec} renders a second, ${load.busy}% of the main thread${load.dropped ? `, about ${load.dropped} dropped frames a second` : ""}.`,
    o.hidden ? (o.pauseHidden ? "Step 3: the tab is hidden, so rendering stops; messages only update the buffer, and one render catches up when it's visible again." : "Step 3: the tab is hidden but still renders every update nobody can see.") : "Step 3: the tab is visible. Hide it to see what happens to the work.",
    gap.stale ? `Step 4: the connection dropped for 5 s; ${gap.missed} messages were lost, and ${gap.stale} rows still show old prices because nothing noticed the gap.` : `Step 4: the first message after reconnecting is #${gap.firstSeqAfter} but the last one seen was #${gap.lastSeen}; the gap triggers a snapshot, and every row is right.`,
    `Step 5: when the server restarts, ${storm.clients.toLocaleString("en-US")} clients reconnect; the busiest second has ${storm.peak.toLocaleString("en-US")} of them.`,
  ];
  const caption = stage !== null ? captions[stage] : `${load.busy}% main thread · ${gap.stale} stale rows after a drop · peak ${storm.peak.toLocaleString("en-US")} reconnects/s.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · case study"
        title="A live dashboard"
        blurb="Hundreds of rows, hundreds of updates a second over a WebSocket. Rendering each message as it arrives melts the main thread; the page has to batch, pause when nobody's looking, notice what it missed while disconnected, and reconnect without stampeding the server."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A price feed pushes messages over a WebSocket into a buffer and a table in a browser tab; many clients reconnect when the feed restarts"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "feed", to: "socket", label: "messages" },
                  { from: "socket", to: "buffer", label: "write", dim: !(o.strategy === "frame" || o.strategy === "throttle") },
                  { from: "buffer", to: "table", label: "flush", dim: !(o.strategy === "frame" || o.strategy === "throttle") },
                  { from: "socket", to: "table", label: "setState", dim: o.strategy === "frame" || o.strategy === "throttle" },
                  { from: "tab", to: "table", label: "visibility" },
                  { from: "clients", to: "feed", label: "reconnect" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <Ticker strategy={o.strategy} paused={o.hidden && o.pauseHidden} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Render every message
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Built for the firehose
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Streaming…">
                Open the dashboard
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Subscribe to the stream" what="One WebSocket carries every update. Each message says which row changed and carries a sequence number, so the client can tell if it missed any." accent={ACCENT} active={at(0)}>
                <Choices label="Messages a second" accent={ACCENT} value={o.rate} onChange={(v) => set({ rate: v })} options={RATES.map((r) => ({ id: r, label: r }))} />
              </FlowStep>
              <FlowArrow label="messages" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Don't render every message" what="People can't read 200 changes a second. Write each message into a buffer that keeps the latest value per row, and render from it once a frame, or a few times a second. Memoised rows help, but a commit per message still adds up." accent={ACCENT} active={at(1)}>
                <Choices<Strategy> accent={ACCENT} value={o.strategy} onChange={(v) => set({ strategy: v })} options={STRATEGIES.map((s) => ({ id: s.id, label: s.label }))} />
                <p className="mt-2 font-mono text-xs" style={{ color: load.busy > 70 ? "var(--bad)" : "var(--good)" }}>
                  {load.commitsPerSec} renders/s · {load.msPerSec} ms of work per second · {load.busy}% busy
                </p>
              </FlowStep>
              <FlowArrow label="nobody watching" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Pause when the tab is hidden" what="A dashboard left open in a background tab keeps receiving. Stop rendering on visibilitychange, keep updating the buffer (or unsubscribe), and render once when the tab comes back." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.hidden} onChange={(e) => set({ hidden: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The tab is in the background
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.pauseHidden} onChange={(e) => set({ pauseHidden: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Pause rendering while hidden
                </label>
              </FlowStep>
              <FlowArrow label="a dropped connection" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Notice what you missed" what="Mobile networks drop. After reconnecting, the stream carries on from now, and rows that changed while disconnected keep their old values until they happen to change again. A sequence number makes the gap visible; fetch a snapshot to fill it." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.detectGaps} onChange={(e) => set({ detectGaps: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Check sequence numbers and resync on a gap
                </label>
                <p className="font-mono text-xs" style={{ color: gap.stale ? "var(--bad)" : "var(--good)" }}>
                  {gap.missed} messages lost · {gap.stale} rows wrong afterwards
                </p>
              </FlowStep>
              <FlowArrow label="a server restart" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Reconnect without a stampede" what="If every client retries exactly one second after the server goes away, they all arrive in the same second and knock it over again. Exponential backoff with random jitter spreads them out." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.jitter} onChange={(e) => set({ jitter: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Add random jitter to the retry delay
                </label>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Lost and stale rows come from replaying a real message stream with sequence numbers; render costs and the reconnect spread are illustrative models.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

/** A small table that really updates at the strategy's pace (capped so the page stays calm). */
function Ticker({ strategy, paused }: { strategy: Strategy; paused: boolean }) {
  const [prices, setPrices] = useState(() => SYMBOLS.map((_, i) => 100 + i * 7));
  const [renders, setRenders] = useState(0);
  const seed = useRef(7);
  const every = strategy === "throttle" ? 250 : strategy === "frame" ? 1000 / 30 : 1000 / 30;
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setPrices((p) =>
        p.map((v) => {
          seed.current = (seed.current * 16807) % 2147483647;
          return Math.max(1, Math.round((v + ((seed.current % 200) - 100) / 100) * 100) / 100);
        }),
      );
      setRenders((n) => n + 1);
    }, every);
    return () => clearInterval(id);
  }, [every, paused]);
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="A few live rows">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
        live preview · {paused ? "paused" : `${Math.round(1000 / every)} updates/s`} · {renders} renders
      </p>
      <table className="mt-2 w-full font-mono text-xs">
        <tbody>
          {SYMBOLS.map((s, i) => (
            <tr key={s} className="border-t border-[var(--line)]">
              <td className="py-1">{s}</td>
              <td className="py-1 text-right tabular-nums">{prices[i].toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-[var(--faint)]">Six rows, updated at this strategy&apos;s pace (capped at 30 a second here).</p>
    </section>
  );
}
