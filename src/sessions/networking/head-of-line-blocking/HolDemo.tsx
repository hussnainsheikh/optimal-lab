"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { FILES, LABEL, LOSSES, PKTS, SLOW, TRANSPORTS, TRIALS, runOnce, stats, type Transport } from "@/lib/holBlocking";

const ACCENT = "var(--net)";

type Opts = { transport: Transport; loss: number; rtt: number; slow: boolean; seed: number };
const TCP: Opts = { transport: "h2", loss: 0.02, rtt: 40, slow: false, seed: 1003 };
const QUIC: Opts = { ...TCP, transport: "h3" };
const COLOR: Record<Transport, string> = { h1one: "var(--c5)", h1six: "var(--c2)", h2: "var(--bad)", h3: ACCENT };
const RTTS = [20, 40, 80, 150];

export default function HolDemo() {
  const [o, setO] = useState<Opts>(TCP);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const r = runOnce(o.transport, o.loss, o.rtt, o.slow, o.seed);
  const ideal = runOnce(o.transport, 0, o.rtt, o.slow, o.seed);
  const all = TRANSPORTS.map((t) => ({ t, s: stats(t, o.loss, o.rtt, o.slow) }));
  const curves = TRANSPORTS.map((t) => ({ t, ys: LOSSES.map((l) => stats(t, l, o.rtt, o.slow).meanP95) }));
  const yMax = Math.max(...curves.flatMap((c) => c.ys)) * 1.08;
  const best = Math.min(...all.map((x) => x.s.meanP95));
  const fast = r.losses - r.rtos;
  const tcpLike = o.transport !== "h3";

  const nodes: MapNode[] = [
    { id: "app", label: "Browser", sub: `files done by ${Math.round(r.page)} ms`, at: [11, 50], mobileAt: [50, 7], state: "active" },
    { id: "buffer", label: o.transport === "h3" ? "QUIC stream buffers" : "TCP receive buffer", sub: `${r.held} packets held`, at: [36, 50], mobileAt: [50, 35], state: r.held > 20 ? "bad" : r.held ? "wait" : "good" },
    { id: "link", label: "Lossy link", sub: `${(o.loss * 100).toFixed(1)}% lost · ${o.rtt} ms`, at: [63, 50], mobileAt: [50, 63], state: r.losses ? "wait" : "good" },
    { id: "server", label: "Server", sub: o.slow ? `${FILES[1]} takes ${SLOW} ms` : "6 files", at: [89, 50], mobileAt: [50, 91], state: "active" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("s", ["server", "link", "buffer"], { label: "6 files" })
    : stage === 1 ? hops("l", ["server", "link"], { label: `${r.losses} lost`, tone: r.losses ? "bad" : "good" })
    : stage === 2 ? hops("h", ["link", "buffer"], { label: `${r.held} wait`, tone: r.held > 20 ? "bad" : "accent" })
    : stage === 3 ? [...hops("a", ["buffer", "link", "server"], { label: "dup ACKs" }), ...hops("t", ["server", "link", "buffer"], { label: "resent", tone: "good", start: 1 })]
    : stage === 4 ? hops("d", ["buffer", "app"], { label: `${Math.round(r.mean)} ms average`, tone: "good" })
    : [];

  const captions = [
    o.transport === "h1one" ? "Step 1: one HTTP/1.1 connection sends the six files one after another, never interleaved." : o.transport === "h1six" ? "Step 1: six TCP connections each carry one file; they share the link." : `Step 1: the six files are interleaved as streams on one ${o.transport === "h2" ? "TCP" : "QUIC"} connection.`,
    `Step 2: ${r.losses} of ${FILES.length * PKTS} packets were lost on the way in this run.`,
    o.transport === "h3" ? `Step 3: QUIC only holds back packets of the stream with the gap: ${r.held} packets waited.` : `Step 3: TCP hands bytes over in order, so everything after a gap waits in the buffer${o.transport === "h1six" ? " of that connection" : ", whichever file it belongs to"}: ${r.held} packets waited.`,
    `Step 4: ${fast} loss${fast === 1 ? " was" : "es were"} spotted by three duplicate ACKs within a round trip; ${r.rtos} needed the ${Math.max(200, 3 * o.rtt)} ms timeout.`,
    `Step 5: over ${TRIALS} runs at ${(o.loss * 100).toFixed(1)}% loss, a file takes ${Math.round(all.find((x) => x.t === o.transport)!.s.meanP50)} ms on average, ${Math.round(all.find((x) => x.t === o.transport)!.s.meanP95)} ms in the worst 5% of loads.`,
  ];
  const caption = stage !== null ? captions[stage] : `${LABEL[o.transport]}: ${r.losses} packets lost, ${r.held} held behind a gap; files ready after ${Math.round(r.mean)} ms on average (${Math.round(ideal.mean)} ms with no loss).`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="Head-of-line blocking"
        blurb="When things must be delivered in order, one missing piece holds up everything behind it, even pieces that have already arrived. It happens with responses on an HTTP/1.1 connection and with packets on a TCP connection. Send six files over a lossy link four ways and count what waits."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A server sends six files across a lossy link into a receive buffer that hands them to the browser"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "server", to: "link", label: "packets" },
                  { from: "link", to: "buffer", label: "arrive" },
                  { from: "buffer", to: "app", label: "in order" },
                ]}
                packets={packets}
                aspect={2.2}
                mobileAspect={0.75}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Every packet in this run">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">This run · packet by packet</p>
                <div className="mt-2 space-y-1">
                  {FILES.map((f, s) => {
                    const mine = r.pkts.filter((p) => p.stream === s).sort((a, b) => a.idx - b.idx);
                    return (
                      <div key={f} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.2rem] items-center gap-2 text-[11px]">
                        <span className="truncate font-mono text-[var(--muted)]">{f}</span>
                        <span className="flex gap-px" aria-hidden>
                          {mine.map((p) => (
                            <span key={p.idx} className="h-3 min-w-0 flex-1 rounded-[1px]" style={{ background: p.lost ? "var(--bad)" : p.deliver > p.arrive ? "var(--c2)" : "var(--good)", opacity: p.lost || p.deliver > p.arrive ? 1 : 0.55 }} />
                          ))}
                        </span>
                        <span className="text-right font-mono" style={{ color: r.done[s] > ideal.done[s] + 5 ? "var(--bad)" : undefined }}>
                          {Math.round(r.done[s])} ms
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-[var(--muted)]">
                  <span><span style={{ color: "var(--good)" }}>■</span> handed over on arrival</span>
                  <span><span style={{ color: "var(--c2)" }}>■</span> arrived, held behind a gap</span>
                  <span><span style={{ color: "var(--bad)" }}>■</span> lost, resent</span>
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO({ ...TCP, seed: o.seed })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  HTTP/2 over TCP
                </button>
                <button type="button" onClick={() => setO({ ...QUIC, seed: o.seed })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  HTTP/3 over QUIC
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Sending…">
                Send the files
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Send six files at once" what="The page needs six files. HTTP/1.1 on one connection sends them one after another, so a slow response blocks the queue. HTTP/2 and HTTP/3 interleave them as streams on one connection; browsers used to open six connections instead." accent={ACCENT} active={at(0)}>
                <Choices<Transport> accent={ACCENT} value={o.transport} onChange={(v) => set({ transport: v })} options={TRANSPORTS.map((id) => ({ id, label: LABEL[id] }))} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.slow} onChange={(e) => set({ slow: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  {FILES[1]} takes {SLOW} ms on the server
                </label>
              </FlowStep>
              <FlowArrow label="150 packets" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Lose a few packets" what="Wi-Fi interference, a busy mobile cell or a full router queue drops packets. A loss of 1–2% is common on a bad connection." accent={ACCENT} active={at(1)}>
                <Slider label="Packets lost" value={o.loss * 100} min={0} max={5} step={0.5} format={(v) => `${v.toFixed(1)}%`} onChange={(v) => set({ loss: Math.round(v * 10) / 1000 })} accent={ACCENT} />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => set({ seed: o.seed + 1 })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                    Another run
                  </button>
                  <span className="font-mono text-xs">
                    run #{o.seed - 1000} · {r.losses} lost
                  </span>
                </div>
              </FlowStep>
              <FlowArrow label="packets with gaps" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Hold everything behind the gap" what={tcpLike ? "TCP promises a single ordered byte stream. Packets that arrive after a gap sit in the receive buffer until the missing one comes, even if they belong to a different file that HTTP/2 could already use." : "QUIC keeps order per stream, not per connection. A gap in one file holds back only that file; the others keep flowing to the browser."} accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs" style={{ color: r.held > 20 ? "var(--bad)" : "var(--good)" }}>
                  {r.held} of {FILES.length * PKTS} packets arrived and had to wait
                </p>
              </FlowStep>
              <FlowArrow label="the gap is filled" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Resend the lost packet" what="Three later packets arriving make the receiver send duplicate ACKs, and the sender resends within about a round trip. If too few packets follow (the end of a file on its own connection), only a timeout of at least 200 ms finds the loss." accent={ACCENT} active={at(3)}>
                <Choices<string> label="Round trip" accent={ACCENT} value={String(o.rtt)} onChange={(v) => set({ rtt: Number(v) })} options={RTTS.map((x) => ({ id: String(x), label: `${x} ms` }))} />
                <p className="font-mono text-xs">
                  {fast} by duplicate ACKs · {r.rtos} by timeout
                </p>
              </FlowStep>
              <FlowArrow label={`${TRIALS} runs`} accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Measure many loads" what="One run is luck. Over many runs, compare how long a file takes on average to be usable, typical and in the worst 5% of loads. Losses hurt one TCP connection most because every gap stalls every file." accent={ACCENT} active={at(4)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[16rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">transport</th>
                        <th className="py-1 text-right font-normal">typical</th>
                        <th className="py-1 text-right font-normal">worst 5%</th>
                        <th className="py-1 text-right font-normal">held</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {all.map((x) => (
                        <tr key={x.t} className="border-t border-[var(--line)]" style={{ fontWeight: x.t === o.transport ? 600 : 400 }}>
                          <td className="py-1 font-sans" style={{ color: COLOR[x.t] }}>{LABEL[x.t]}</td>
                          <td className="py-1 text-right">{Math.round(x.s.meanP50)} ms</td>
                          <td className="py-1 text-right" style={{ color: x.s.meanP95 === best ? "var(--good)" : undefined }}>{Math.round(x.s.meanP95)} ms</td>
                          <td className="py-1 text-right">{x.s.heldP50}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <svg viewBox="0 0 260 110" className="w-full" role="img" aria-label="Worst-5% average file time against packet loss for the four transports">
                  {curves.map((c) => (
                    <polyline key={c.t} points={c.ys.map((y, i) => `${20 + (i / (LOSSES.length - 1)) * 220},${96 - (y / yMax) * 90}`).join(" ")} fill="none" stroke={COLOR[c.t]} strokeWidth={c.t === o.transport ? 2.2 : 1.2} />
                  ))}
                  {LOSSES.map((l, i) => (
                    <text key={l} x={20 + (i / (LOSSES.length - 1)) * 220} y={108} fontSize={8} fill="var(--faint)" textAnchor="middle">{(l * 100).toFixed(1)}%</text>
                  ))}
                  <text x={0} y={10} fontSize={8} fill="var(--faint)">{Math.round(yMax)} ms</text>
                </svg>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Each run is simulated packet by packet: one packet per millisecond, losses at random, fast retransmit after three later packets, otherwise a timeout. Congestion control is left out, so the effect shown is ordering alone; the file sizes and the link are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
