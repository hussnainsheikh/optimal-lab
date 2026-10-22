"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { DRIVERS, ONLINE_DRIVERS, PRECISIONS, RIDERS, RIDE_REQUESTS_PER_S, UPDATE_EVERY, bounds, cellSizeKm, etaMin, search } from "@/lib/rideSharing";

const ACCENT = "var(--sys)";
const fmt = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);
const [A, B] = RIDERS;

export default function RideSharingDemo() {
  const [precision, setPrecision] = useState(6);
  const [withNeighbours, setNeighbours] = useState(false);
  const [lock, setLock] = useState(false);
  const [every, setEvery] = useState(4);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const sa = search(A, precision, withNeighbours);
  const sb = search(B, precision, withNeighbours, lock && sa.found ? [sa.found.d.id] : []);
  const clash = !!sa.found && !!sb.found && sa.found.d.id === sb.found.d.id;
  const cell = cellSizeKm(precision);
  const writes = ONLINE_DRIVERS / every;

  const packets: Packet[] =
    stage === 0 ? hops("l", ["driver", "loc", "geo"], { label: "lat, lng" })
    : stage === 1 ? hops("i", ["loc", "geo"], { label: `geohash ${sa.own}` })
    : stage === 2 ? hops("s", ["rider", "match", "geo"], { label: `${sa.cells.length} cell${sa.cells.length > 1 ? "s" : ""}` }).concat(hops("r", ["geo", "match"], { label: `${sa.candidates.length} drivers`, start: 1, tone: sa.found ? "good" : "bad" }))
    : stage === 3 ? (sa.found ? hops("o", ["match", "driver"], { label: clash ? "same driver ×2" : "offer", tone: clash ? "bad" : "good" }) : [])
    : stage === 4 ? hops("t", ["driver", "loc", "rider"], { label: "on the way" })
    : [];

  const captions = [
    `Step 1: ${fmt(ONLINE_DRIVERS)} drivers report their position every ${every} s: ${fmt(writes)} writes a second.`,
    `Step 2: each position becomes a geohash; at precision ${precision} a cell is about ${cell.w.toFixed(2)} × ${cell.h.toFixed(2)} km.`,
    !sa.found ? `Step 3: no driver in the ${sa.cells.length} cell${sa.cells.length > 1 ? "s" : ""} searched; widen the search.` : sa.missedNearest ? `Step 3: the nearest driver found is ${sa.found.km.toFixed(2)} km away, but one ${sa.truth.km.toFixed(2)} km away sits just over the cell border.` : `Step 3: ${sa.candidates.length} candidate${sa.candidates.length === 1 ? "" : "s"}; the nearest is ${sa.found.km.toFixed(2)} km away, ${etaMin(sa.found.km).toFixed(0)} min by road.`,
    clash ? "Step 4: rider A and rider B were both offered the same driver; one of them will be left waiting." : "Step 4: each rider is offered a different driver.",
    "Step 5: the driver's position streams to the rider until pickup.",
  ];
  const caption = stage !== null ? captions[stage] : `Precision ${precision}${withNeighbours ? " + neighbours" : ""}: ${sa.candidates.length} candidate${sa.candidates.length === 1 ? "" : "s"} · ${sa.found ? `nearest found ${sa.found.km.toFixed(2)} km${sa.missedNearest ? ` (true nearest ${sa.truth.km.toFixed(2)} km)` : ""}` : "nobody found"} · ${clash ? "double-booked" : "no double booking"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design ride sharing (like Uber)"
        blurb="A rider asks for a car and nearby drivers have to be found in milliseconds, among a million who are all moving. Index driver positions by geohash, search the right cells, offer the trip without giving one driver to two riders, and stream the car's position to the rider."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <City sa={sa} sb={sb} precision={precision} />
              <SystemMap
                title="Driver apps, location service, geo index, rider app and matching service"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "driver", label: "Driver apps", sub: `every ${every} s`, at: [12, 25], mobileAt: [22, 13], state: "active" },
                  { id: "loc", label: "Location service", sub: `${fmt(writes)} writes/s`, at: [45, 25], mobileAt: [78, 13], state: writes > 500_000 ? "bad" : "active" },
                  { id: "geo", label: "Geo index", sub: `geohash-${precision}`, at: [82, 50], mobileAt: [78, 50], state: "good" },
                  { id: "rider", label: "Rider app", sub: "request", at: [12, 78], mobileAt: [22, 91], state: "active" },
                  { id: "match", label: "Matching", sub: lock ? "locks drivers" : "no lock", at: [45, 78], mobileAt: [22, 50], state: clash ? "bad" : "good" },
                ]}
                links={[
                  { from: "driver", to: "loc", label: "position" },
                  { from: "loc", to: "geo", label: "update" },
                  { from: "rider", to: "match", label: "request" },
                  { from: "match", to: "geo", label: "nearby?" },
                  { from: "match", to: "driver", label: "offer", dashed: true },
                ]}
                packets={packets}
                aspect={2.1}
                mobileAspect={1}
              />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Geohash precision" accent={ACCENT} value={String(precision)} onChange={(v) => setPrecision(Number(v))} options={PRECISIONS.map((p) => ({ id: String(p), label: String(p) }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Matching…">
                Request a ride
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Stream driver positions" what="Every online driver's app sends its position every few seconds. That's a write firehose that only needs the latest value per driver, so keep it in memory, not in a database row history." accent={ACCENT} active={at(0)}>
                <Choices label="Update every" accent={ACCENT} value={String(every)} onChange={(v) => setEvery(Number(v))} options={UPDATE_EVERY.map((s) => ({ id: String(s), label: `${s} s` }))} />
                <p className="mt-2 font-mono text-xs">
                  {fmt(ONLINE_DRIVERS)} drivers ÷ {every} s = {fmt(writes)} writes/s · {fmt(RIDE_REQUESTS_PER_S)} ride requests/s
                </p>
              </FlowStep>
              <FlowArrow label="index" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Index positions by geohash" what="A geohash interleaves the bits of latitude and longitude into a short string; nearby points share a prefix. Each extra character makes the cell smaller. Searching becomes “which drivers are in these cells”, not “measure the distance to a million drivers”." accent={ACCENT} active={at(1)}>
                <Choices label="Geohash precision" accent={ACCENT} value={String(precision)} onChange={(v) => setPrecision(Number(v))} options={PRECISIONS.map((p) => ({ id: String(p), label: String(p) }))} />
                <p className="mt-2 font-mono text-xs">
                  rider A is in {sa.own} · cell ≈ {cell.w.toFixed(2)} × {cell.h.toFixed(2)} km
                </p>
              </FlowStep>
              <FlowArrow label="search" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Search the cell and its neighbours" what="A rider near the edge of a cell can be closer to drivers in the next cell than to any in their own. Search the 3 × 3 block around them, then measure exact distances to just those candidates. If nobody is there, widen the ring." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={withNeighbours} onChange={(e) => setNeighbours(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Include the 8 neighbouring cells
                </label>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">cells</span>
                  <span className="text-right text-[var(--faint)]">checked</span>
                  <span className="text-right text-[var(--faint)]">nearest</span>
                  {PRECISIONS.flatMap((p) =>
                    [false, true].map((n) => {
                      const y = search(A, p, n);
                      return <Row key={`${p}-${n}`} cells={[`${p}${n ? " + neighbours" : ""}`, String(y.cells.length), String(y.candidates.length), y.found ? `${y.found.km.toFixed(2)} km` : "none"]} on={p === precision && n === withNeighbours} bad={!y.found || y.missedNearest} />;
                    }),
                  )}
                </div>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">scanning everyone checks {DRIVERS.length} here, {fmt(ONLINE_DRIVERS)} in production</p>
              </FlowStep>
              <FlowArrow label="offer" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Offer to one driver at a time" what="Two riders a few metres apart get the same nearest driver. Reserve the driver for the few seconds an offer is open (a lock with a timeout), so the second rider is offered the next nearest instead of waiting for a refusal." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Reserve a driver while their offer is open
                </label>
                <p className="font-mono text-xs" style={{ color: clash ? "var(--bad)" : "var(--good)" }}>
                  A → driver {sa.found?.d.id ?? "none"}
                  {sa.found ? ` (${etaMin(sa.found.km).toFixed(0)} min)` : ""} · B → driver {sb.found?.d.id ?? "none"}
                  {sb.found ? ` (${etaMin(sb.found.km).toFixed(0)} min)` : ""}
                  {clash ? " · same driver" : ""}
                </p>
              </FlowStep>
              <FlowArrow label="pickup" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Stream the trip to the rider" what="Once matched, the rider's app holds a WebSocket and receives the driver's position as it arrives, plus a recomputed ETA. The same location stream feeds pricing, fraud checks and the trip record." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs">{fmt(RIDE_REQUESTS_PER_S * 600 / every)} position pushes/s to riders with a trip in progress (10-minute pickups)</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">400 drivers placed with a fixed seed; distances are great-circle, ETAs assume a 1.4× road detour at 22 km/h. Real matching also weighs ETA by road, driver rating and heading.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, on, bad }: { cells: string[]; on: boolean; bad: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ color: bad && i === 3 ? "var(--bad)" : on ? "var(--text)" : "var(--muted)", fontWeight: on ? 600 : 400 }}>
          {c}
        </span>
      ))}
    </>
  );
}

// The city: every driver, the cells searched for rider A, the candidates and the match.
function City({ sa, sb, precision }: { sa: ReturnType<typeof search>; sb: ReturnType<typeof search>; precision: number }) {
  // a window about 3 × 2.7 km around the riders
  const V = { lat: [RIDERS[0].lat - 0.012, RIDERS[0].lat + 0.012], lng: [RIDERS[0].lng - 0.018, RIDERS[0].lng + 0.018] };
  const W = 300;
  const H = (W * (V.lat[1] - V.lat[0]) * 1.32) / (V.lng[1] - V.lng[0]); // ~ equal km per unit
  const x = (lng: number) => ((lng - V.lng[0]) / (V.lng[1] - V.lng[0])) * W;
  const y = (lat: number) => H - ((lat - V.lat[0]) / (V.lat[1] - V.lat[0])) * H;
  const inView = DRIVERS.filter((d) => d.lat > V.lat[0] && d.lat < V.lat[1] && d.lng > V.lng[0] && d.lng < V.lng[1]);
  const cand = new Set(sa.candidates.map((d) => d.id));
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label={`City map: ${DRIVERS.length} drivers, ${sa.cells.length} geohash cells searched at precision ${precision}, ${sa.candidates.length} candidates`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
          {DRIVERS.length} drivers · 3 km around the riders · geohash-{precision}
        </p>
        <p className="font-mono text-xs text-[var(--muted)]">{sa.candidates.length} checked</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full overflow-hidden rounded-md bg-[var(--inset)]" aria-hidden>
        {sa.cells.map((h) => {
          const b = bounds(h);
          return <rect key={h} x={x(b.lng[0])} y={y(b.lat[1])} width={x(b.lng[1]) - x(b.lng[0])} height={y(b.lat[0]) - y(b.lat[1])} fill={h === sa.own ? "color-mix(in srgb, var(--sys) 18%, transparent)" : "color-mix(in srgb, var(--sys) 8%, transparent)"} stroke={ACCENT} strokeWidth={0.5} />;
        })}
        {inView.map((d) => (
          <circle key={d.id} cx={x(d.lng)} cy={y(d.lat)} r={cand.has(d.id) ? 1.8 : 1.1} fill={cand.has(d.id) ? "var(--text)" : "var(--faint)"} />
        ))}
        {sa.missedNearest && <circle cx={x(sa.truth.d.lng)} cy={y(sa.truth.d.lat)} r={3.2} fill="none" stroke="var(--bad)" strokeWidth={0.8} />}
        {sa.found && <line x1={x(RIDERS[0].lng)} y1={y(RIDERS[0].lat)} x2={x(sa.found.d.lng)} y2={y(sa.found.d.lat)} stroke="var(--good)" strokeWidth={0.9} />}
        {sb.found && <line x1={x(RIDERS[1].lng)} y1={y(RIDERS[1].lat)} x2={x(sb.found.d.lng)} y2={y(sb.found.d.lat)} stroke="var(--c2)" strokeWidth={0.9} strokeDasharray="2 1.5" />}
        {RIDERS.map((r, i) => (
          <circle key={r.id} cx={x(r.lng)} cy={y(r.lat)} r={2.6} fill={i ? "var(--c2)" : "var(--good)"} stroke="var(--panel)" strokeWidth={0.6} />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--good)" }} /> rider A
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--c2)" }} /> rider B
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border" style={{ borderColor: ACCENT, background: "color-mix(in srgb, var(--sys) 18%, transparent)" }} /> cells searched
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border" style={{ borderColor: "var(--bad)" }} /> true nearest, missed
        </span>
      </div>
    </section>
  );
}
