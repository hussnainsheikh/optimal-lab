"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CARDINALITY_LABELS, GORILLA_BYTES, HOSTS, INTERVALS, METRICS_PER_HOST, RANGES, RAW_BYTES, SCAN_RATE, TIERS, bytes, compute, count, scanned, secs, type Settings } from "@/lib/timeSeries";

const ACCENT = "var(--sys)";
const TIER_COLOR = ["var(--c1)", "var(--c3)", "var(--c4)"];

export default function TimeSeriesDemo() {
  const [s, setS] = useState<Settings>({ hosts: 1000, interval: 10, compress: false, downsample: false, cardinality: "none" });
  const [rangeId, setRangeId] = useState("30d");
  const { stage, busy, run } = useWalk(5, 1100);
  const set = (patch: Partial<Settings>) => setS((cur) => ({ ...cur, ...patch }));
  const r = compute(s);
  const range = RANGES.find((x) => x.id === rangeId)!;
  const sc = scanned(s, range.seconds);
  const at = (i: number) => stage === i;
  const explosion = s.cardinality === "user";

  const captions = [
    `Step 1: ${s.hosts.toLocaleString("en-US")} hosts × ${METRICS_PER_HOST} metrics every ${s.interval} s: ${count(r.pointsPerSec)} points a second, append-only.`,
    `Step 2: ${count(r.series)} series. ${explosion ? "A user-id label multiplied them by 10,000: cardinality explosion." : "Each label value multiplies the count."}`,
    s.compress ? `Step 3: Gorilla-style compression: ${GORILLA_BYTES} bytes a point instead of ${RAW_BYTES}, ${bytes(r.rawPerDay)} a day.` : `Step 3: ${RAW_BYTES} bytes a point raw: ${bytes(r.rawPerDay)} a day.`,
    s.downsample ? `Step 4: raw for ${TIERS[0].days} days, minute rollups for ${TIERS[1].days}, hour rollups for ${TIERS[2].days}: ${bytes(r.total)} kept.` : `Step 4: everything kept raw for two years: ${bytes(r.total)}.`,
    `Step 5: the ${range.label} query scans ${count(sc.points)} points from the ${sc.tier} tier: about ${secs(sc.points / SCAN_RATE)}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${count(r.pointsPerSec)} points/s · ${count(r.series)} series · ${bytes(r.total)} kept · ${range.label} query ${secs(sc.points / SCAN_RATE)}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Time-series databases"
        blurb="Metrics arrive as a timestamp and a number, thousands of times a second, and are almost never updated. A time-series database is built for exactly that: append-only writes, compression that exploits how little each point differs from the last, rollups that keep old data small, and queries over time ranges. Size one for a fleet."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Storage kept per tier and the numbers behind it">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {s.hosts.toLocaleString("en-US")} hosts · every {s.interval} s
                </p>
                <p className="font-mono text-sm" style={{ color: explosion ? "var(--bad)" : "var(--text)" }}>
                  {bytes(r.total)} kept
                </p>
              </div>
              <div className="mt-3 flex h-6 overflow-hidden rounded bg-[var(--track)]">
                {r.tiers.map((t, i) => (
                  <span key={t.label} className="h-full transition-[width] duration-300" style={{ width: `${(t.bytes / r.total) * 100}%`, background: TIER_COLOR[i] }} title={`${t.label}: ${bytes(t.bytes)}`} />
                ))}
              </div>
              <ul className="mt-2 space-y-0.5 text-xs">
                {r.tiers.map((t, i) => (
                  <li key={t.label} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TIER_COLOR[i] }} />
                      {t.label}, {t.days} days, {count(t.pointsPerSeriesPerDay)} points per series a day
                    </span>
                    <span className="font-mono">{bytes(t.bytes)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <Stat label="points a second" value={count(r.pointsPerSec)} />
                <Stat label="series" value={count(r.series)} bad={explosion} />
                <Stat label="bytes a point" value={String(r.bytesPerPoint)} />
                <Stat label="raw for 2 years" value={bytes(r.twoYearsRaw)} />
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Hosts" accent={ACCENT} value={String(s.hosts)} onChange={(v) => set({ hosts: Number(v) })} options={HOSTS.map((h) => ({ id: String(h), label: h.toLocaleString("en-US") }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Sizing…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Points arrive, append-only" what={`Every host reports ${METRICS_PER_HOST} metrics on a schedule. A point is (series, timestamp, value), written once and never changed. The write path is a log, not a table of rows to update.`} accent={ACCENT} active={at(0)}>
                <Choices label="Scrape interval" accent={ACCENT} value={String(s.interval)} onChange={(v) => set({ interval: Number(v) })} options={INTERVALS.map((i) => ({ id: String(i), label: `${i} s` }))} />
                <p className="mt-2 font-mono text-xs">
                  {s.hosts.toLocaleString("en-US")} × {METRICS_PER_HOST} ÷ {s.interval} s = {count(r.pointsPerSec)} points/s
                </p>
              </FlowStep>
              <FlowArrow label="which series?" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="A series per label combination" what="A metric with labels is a separate series for every combination of label values. Add a label with many values and the series count multiplies. This is the mistake that fills time-series databases." accent={ACCENT} active={at(1)}>
                <Choices label="Labels on each metric" accent={ACCENT} value={s.cardinality} onChange={(v) => set({ cardinality: v })} options={CARDINALITY_LABELS.map((c) => ({ id: c.id, label: c.label }))} />
                <p className="mt-2 font-mono text-xs" style={{ color: explosion ? "var(--bad)" : "var(--text)" }}>
                  {count(r.series)} series
                </p>
              </FlowStep>
              <FlowArrow label="bytes" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Compress what barely changes" what={`A raw point is ${RAW_BYTES} bytes. Consecutive timestamps are evenly spaced and consecutive values are close, so storing the differences of the differences (Gorilla, Facebook 2015) gets to about ${GORILLA_BYTES} bytes a point.`} accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={s.compress} onChange={(e) => set({ compress: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Gorilla-style compression
                </label>
                <p className="font-mono text-xs">
                  {r.bytesPerPoint} bytes × {count(r.pointsPerSec)}/s = {bytes(r.rawPerDay)} a day
                </p>
              </FlowStep>
              <FlowArrow label="over time" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Downsample and expire" what="Nobody looks at 10-second resolution from last year. Keep raw for a week, 1-minute averages for 90 days, 1-hour for two years, and drop the rest. Most of the data is old, so most of the saving is here." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={s.downsample} onChange={(e) => set({ downsample: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Rollups and retention tiers
                </label>
                <p className="font-mono text-xs">
                  kept: {bytes(r.total)} · raw for 2 years would be {bytes(r.twoYearsRaw)}
                </p>
              </FlowStep>
              <FlowArrow label="a query" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Query a time range" what="“p95 CPU across all hosts, last 30 days.” The engine picks the coarsest tier that covers the range, scans one metric's series over it, and aggregates. Points scanned decide the time." accent={ACCENT} active={at(4)}>
                <Choices label="Range" accent={ACCENT} value={rangeId} onChange={setRangeId} options={RANGES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 font-mono text-xs">
                  {count(sc.points)} points from the {sc.tier} tier ≈ {secs(sc.points / SCAN_RATE)} at {count(SCAN_RATE)} points/s
                </p>
                <p className="mt-2 text-xs text-[var(--faint)]">The compression figure is Gorilla&rsquo;s measured average; the scan rate is a typical engine. Everything else is arithmetic.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="font-mono text-sm" style={{ color: bad ? "var(--bad)" : "var(--text)" }}>
        {value}
      </dd>
    </div>
  );
}
