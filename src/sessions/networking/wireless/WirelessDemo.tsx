"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { BAND, CELL, MCS_SNR, MODULATION, RETRY_LIMIT, link, mobile, rateTable, retries, share, type Band, type Cell } from "@/lib/wireless";

const ACCENT = "var(--net)";

type Opts = { band: Band; meters: number; walls: number; slowPeer: boolean; fair: boolean; interference: boolean; cell: Cell; gap: number };
const HOME: Opts = { band: "5", meters: 12, walls: 2, slowPeer: true, fair: false, interference: false, cell: "lte", gap: 30 };
const TUNED: Opts = { band: "5", meters: 6, walls: 1, slowPeer: true, fair: true, interference: false, cell: "nr", gap: 8 };
const mbps = (x: number) => `${x >= 100 ? Math.round(x) : x.toFixed(1)} Mbps`;

export default function WirelessDemo() {
  const [o, setO] = useState<Opts>(HOME);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const l = link(o.band, o.meters, o.walls);
  const connected = l.mcs >= 0;
  const table = rateTable(o.band);
  const stations = [
    { name: "Your phone", phy: l.phy },
    { name: "Laptop by the router", phy: table[11] },
    ...(o.slowPeer ? [{ name: "Old tablet in the garden", phy: table[0] / 2 }] : []),
  ].filter((s) => s.phy > 0);
  const got = connected ? share(stations, o.fair) : [];
  const alone = connected ? share([stations[0]], o.fair)[0] : 0;
  const rt = connected ? retries(l.phy, l.margin, o.interference) : null;
  const m = mobile(o.cell, o.gap);
  const k = CELL[o.cell];

  const nodes: MapNode[] = [
    { id: "phone", label: "Your phone", sub: connected ? `${l.rssi.toFixed(0)} dBm · MCS ${l.mcs}` : "no Wi-Fi signal", at: [13, 55], mobileAt: [80, 7], state: connected ? "active" : "bad" },
    { id: "others", label: "Other devices", sub: `${stations.length - 1} sharing the channel`, at: [13, 14], mobileAt: [20, 7], state: o.slowPeer && !o.fair ? "bad" : "idle" },
    { id: "ap", label: "Wi-Fi router", sub: BAND[o.band].label, at: [46, 34], mobileAt: [20, 48], state: connected ? "active" : "dim" },
    { id: "tower", label: "Cell tower", sub: `${k.label} · ${m.idle ? "radio idle" : "connected"}`, at: [46, 86], mobileAt: [80, 48], state: m.idle ? "wait" : "active" },
    { id: "net", label: "Internet", sub: "the server", at: [86, 55], mobileAt: [50, 90], state: "idle" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("s", ["ap", "phone"], { label: `${l.rssi.toFixed(0)} dBm`, tone: connected ? "accent" : "bad" })
    : stage === 1 ? hops("r", ["phone", "ap", "net"], { label: connected ? mbps(l.phy) : "no link", tone: connected ? "good" : "bad" })
    : stage === 2 ? [...hops("a", ["others", "ap"], { label: "their turn" }), ...hops("b", ["phone", "ap"], { label: connected ? mbps(got[0]) : "—", start: 0.5, tone: o.slowPeer && !o.fair ? "bad" : "good" })]
    : stage === 3 ? hops("f", ["phone", "ap"], { label: rt ? `${rt.attempts.toFixed(2)} tries/frame` : "—", tone: rt && rt.fer > 0.1 ? "bad" : "good" })
    : stage === 4 ? hops("m", ["phone", "tower", "net"], { label: `${m.latency} ms`, tone: m.idle ? "bad" : "good" })
    : [];

  const captions = [
    connected ? `Step 1: ${o.meters} m and ${o.walls} wall${o.walls === 1 ? "" : "s"} away the signal arrives at ${l.rssi.toFixed(0)} dBm, ${l.snr.toFixed(0)} dB above the noise.` : `Step 1: at ${o.meters} m through ${o.walls} walls the signal (${l.rssi.toFixed(0)} dBm) is below the noise. No usable link on ${BAND[o.band].label}.`,
    connected ? `Step 2: with ${l.snr.toFixed(0)} dB to spare, the router picks MCS ${l.mcs} (${MODULATION[l.mcs]}): ${mbps(l.phy)} on the air, about ${mbps(l.goodput)} of real throughput.` : "Step 2: no rate works at this signal level.",
    connected ? `Step 3: sharing the channel, your phone gets ${mbps(got[0])} instead of ${mbps(alone)}${o.slowPeer && !o.fair ? ": the slow tablet holds the air longest and everyone drops to its pace" : ""}.` : "Step 3: not connected.",
    rt ? `Step 4: ${(rt.fer * 100).toFixed(1)}% of frames fail and are retried after a random, doubling wait: a frame takes ${rt.p50.toFixed(2)} ms typically, ${rt.p99.toFixed(2)} ms in the worst 1%.` : "Step 4: not connected.",
    `Step 5: on ${k.label}, a request every ${o.gap} s ${m.idle ? `finds the radio idle and waits ${k.promotion} ms for it to wake: ${m.latency} ms` : `finds the radio still connected: ${m.latency} ms`}.`,
  ];
  const caption = stage !== null ? captions[stage] : connected ? `${BAND[o.band].label}, ${o.meters} m, ${o.walls} wall${o.walls === 1 ? "" : "s"}: MCS ${l.mcs}, ${mbps(got[0])} for your phone. On ${k.label}: ${m.latency} ms per request.` : `No Wi-Fi at ${o.meters} m through ${o.walls} walls. On ${k.label}: ${m.latency} ms per request.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="Wi-Fi and mobile networks"
        blurb="Over radio, the link speed isn't fixed: it depends on how strong the signal is, who else is talking, and whether the radio is awake. Walk away from the router, add a slow device to the network, switch on a microwave, then send requests over a phone network that dozes between them."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Your phone reaches the internet through a Wi-Fi router shared with other devices, or through a cell tower"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "phone", to: "ap", label: "radio", dim: !connected },
                  { from: "others", to: "ap", label: "same channel" },
                  { from: "ap", to: "net", label: "fibre" },
                  { from: "phone", to: "tower", label: "radio", dashed: true },
                  { from: "tower", to: "net", label: "core" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.8}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Signal and rate">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Signal-to-noise and the rate it allows</p>
                <svg viewBox="0 0 300 70" className="mt-2 w-full" role="img" aria-label={`SNR ${l.snr.toFixed(0)} dB against the thresholds for MCS 0 to 11`}>
                  {MCS_SNR.map((s, i) => (
                    <g key={i}>
                      <rect x={(s / 45) * 300} y={10 + (i % 2) * 4} width={2} height={34} fill={i === l.mcs ? ACCENT : "var(--line-strong)"} />
                      <text x={(s / 45) * 300 + 1} y={56 + (i % 2) * 9} fontSize={7} fill={i === l.mcs ? ACCENT : "var(--faint)"} textAnchor="middle">{i}</text>
                    </g>
                  ))}
                  <rect x={0} y={24} width={Math.max(0, Math.min(300, (l.snr / 45) * 300))} height={6} fill={connected ? "var(--good)" : "var(--bad)"} opacity={0.8} />
                  <text x={2} y={8} fontSize={8} fill="var(--faint)">SNR {l.snr.toFixed(1)} dB · MCS thresholds (dB) below</text>
                </svg>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(HOME)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Busy home network
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Closer, fair, 5G
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Sending…">
                Send a request
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Lose signal to distance and walls" what="Radio power spreads out and walls absorb it, so the signal falls fast: each doubling of distance indoors costs about 9 dB, each wall several more. What matters is how far it stays above the background noise, and a wider channel collects more noise." accent={ACCENT} active={at(0)}>
                <Choices<Band> accent={ACCENT} value={o.band} onChange={(v) => set({ band: v })} options={(Object.keys(BAND) as Band[]).map((id) => ({ id, label: BAND[id].label }))} />
                <Slider label="Distance from the router" value={o.meters} min={1} max={40} step={1} format={(v) => `${v} m`} onChange={(v) => set({ meters: v })} accent={ACCENT} />
                <Choices<string> label="Walls in between" accent={ACCENT} value={String(o.walls)} onChange={(v) => set({ walls: Number(v) })} options={[0, 1, 2, 3].map((w) => ({ id: String(w), label: String(w) }))} />
                <p className="font-mono text-xs">
                  {l.rssi.toFixed(0)} dBm signal − ({l.noise.toFixed(0)} dBm noise) = {l.snr.toFixed(1)} dB SNR
                </p>
              </FlowStep>
              <FlowArrow label="SNR" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Pick a speed the signal can carry" what="Denser modulations pack more bits into each symbol but need a cleaner signal to decode. The router keeps picking the fastest rate (MCS) the signal clears with some margin, and drops down when frames start failing." accent={ACCENT} active={at(1)}>
                {connected ? (
                  <p className="font-mono text-xs">
                    MCS {l.mcs}: {MODULATION[l.mcs]}, 2 streams = {mbps(l.phy)} on the air ≈ {mbps(l.goodput)} after protocol overhead
                  </p>
                ) : (
                  <p className="font-mono text-xs text-[var(--bad)]">Below MCS 0: the phone falls back to mobile data.</p>
                )}
              </FlowStep>
              <FlowArrow label="your share of the air" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Share the air" what="Only one device on a channel transmits at a time. With equal chances to send, a device far away at a slow rate takes ages per frame, and every other device waits; all end up at about the slowest one's pace. Airtime fairness gives each device equal time instead." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.slowPeer} onChange={(e) => set({ slowPeer: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  An old tablet in the garden at MCS 0
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.fair} onChange={(e) => set({ fair: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The router enforces airtime fairness
                </label>
                {connected && (
                  <ul className="space-y-0.5 text-xs">
                    {stations.map((s, i) => (
                      <li key={s.name} className="flex justify-between gap-2">
                        <span className="text-[var(--muted)]">
                          {s.name} <span className="text-[var(--faint)]">({mbps(s.phy)} link)</span>
                        </span>
                        <span className="font-mono">{mbps(got[i])}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </FlowStep>
              <FlowArrow label="frames" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Retry lost frames" what={`Wi-Fi acknowledges every frame and resends failed ones itself, up to ${RETRY_LIMIT} times, waiting a random and doubling backoff between tries. Loss gets hidden from TCP, but turns into delay that jumps from frame to frame.`} accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.interference} onChange={(e) => set({ interference: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Interference: a microwave, a neighbour&apos;s network
                </label>
                {rt && (
                  <dl className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                    {[
                      ["frames failing", `${(rt.fer * 100).toFixed(1)}%`],
                      ["tries per frame", rt.attempts.toFixed(2)],
                      ["typical frame", `${rt.p50.toFixed(2)} ms`],
                      ["worst 1%", `${rt.p99.toFixed(2)} ms`],
                    ].map(([a, b]) => (
                      <div key={a} className="rounded-md bg-[var(--inset)] p-2">
                        <dt className="text-[var(--faint)]">{a}</dt>
                        <dd className="font-mono text-sm">{b}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </FlowStep>
              <FlowArrow label="or over mobile data" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Wake the mobile radio" what="To save battery, a phone's cellular radio drops to an idle state a few seconds after the last packet. The next request must first be promoted back to connected, a negotiation with the tower that costs longer than the request itself on 4G." accent={ACCENT} active={at(4)}>
                <Choices<Cell> accent={ACCENT} value={o.cell} onChange={(v) => set({ cell: v })} options={(Object.keys(CELL) as Cell[]).map((id) => ({ id, label: CELL[id].label }))} />
                <Slider label="Time between requests" value={o.gap} min={1} max={60} step={1} format={(v) => `${v} s`} onChange={(v) => set({ gap: v })} accent={ACCENT} />
                <p className="font-mono text-xs" style={{ color: m.idle ? "var(--bad)" : "var(--good)" }}>
                  {k.rtt} ms round trip + {k.schedule} ms scheduling{m.idle ? ` + ${k.promotion} ms waking the radio` : ""} = {m.latency} ms · radio on {Math.round(m.radioOn * 100)}% of the time
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Path loss, thermal noise and the Wi-Fi 6 rate table are computed; 2,000 frames are simulated with random backoff. MCS thresholds, wall losses, the tablet&apos;s link and the 4G/5G timers are typical values, not measurements.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
