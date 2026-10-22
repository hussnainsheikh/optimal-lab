"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { DELAYS, DUP_RATE, EVENTS, HOURS, STRATEGIES, TRUE_COUNTS, WATERMARKS, freshness, hm, label, run, total, type Options, type Result, type Strategy } from "@/lib/dataPipelines";

const ACCENT = "var(--sys)";

export default function DataPipelinesDemo() {
  const [s, setS] = useState<Strategy>("processing");
  const [o, setO] = useState<Options>({ watermark: 5, dedupe: false, correct: false });
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const r = run(s, o);
  const set = (p: Partial<Options>) => setO((cur) => ({ ...cur, ...p }));
  const streaming = s !== "batch";
  const dups = EVENTS.filter((e) => e.dup).length;

  const packets: Packet[] =
    stage === 0 ? hops("e", ["app", "ingest"], { label: "order · 12:41" })
    : stage === 1 ? hops("d", ["app", "ingest"], { label: "same order again", tone: o.dedupe ? "good" : "bad" })
    : stage === 2 ? hops("p", ["ingest", streaming ? "stream" : "batch"], { label: streaming ? "every event" : "files" })
    : stage === 3 ? hops("w", [streaming ? "stream" : "batch", "wh"], { label: s === "batch" ? "whole day" : "12:00 hour" })
    : stage === 4 ? hops("l", ["app", "ingest", streaming ? "stream" : "batch"], { label: "late · 12:10", tone: o.correct ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: ${EVENTS.length - dups} orders placed between ${label(0)} and ${label(HOURS)}, each stamped on the phone with when it happened.`,
    `Step 2: ${dups} of them were delivered twice; ${o.dedupe ? "deduplicated by event id" : "both copies are counted"}.`,
    `Step 3: ${STRATEGIES.find((x) => x.id === s)!.label}: each hour's number appears ${hm(freshness(r))} after the hour ends, on average.`,
    s === "processing" ? `Step 4: counted by arrival time, ${r.misplaced} orders land in the wrong hour.` : s === "batch" ? `Step 4: the batch sees the whole day at once; ${r.late} orders still arrive after midnight.` : `Step 4: waiting ${o.watermark} min past each hour, ${r.late} orders arrive after their hour was published.`,
    `Step 5: ${r.wrongFinal} orders counted wrongly in the final numbers${o.correct ? ", after late corrections" : ""}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${STRATEGIES.find((x) => x.id === s)!.label}: ${r.wrongFirst} of ${EVENTS.length - dups} orders counted wrongly at first, ${r.wrongFinal} in the end · numbers ${hm(freshness(r))} after each hour.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Event pipelines and data warehouses"
        blurb={`A shopping app sends an event for every order to analytics, and the business wants orders per hour. Phones go offline, so events arrive minutes or hours after they happened, and some arrive twice. Count six hours of orders with a nightly batch or a stream, by arrival time or event time, and see what's fresh, what's right, and what's never counted.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Phones, the event log, a stream processor, a nightly batch job and the warehouse"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "app", label: "Phones", sub: "the app", at: [12, 50], mobileAt: [50, 8], state: "active" },
                  { id: "ingest", label: "Event log", sub: o.dedupe ? "dedupe by id" : "at-least-once", at: [34, 50], mobileAt: [50, 33], state: o.dedupe ? "good" : "wait" },
                  { id: "stream", label: "Stream processor", sub: s === "event" ? `watermark ${o.watermark} min` : s === "processing" ? "arrival time" : "off", at: [60, 20], mobileAt: [22, 62], state: streaming ? "active" : "dim" },
                  { id: "batch", label: "Nightly job", sub: "object storage", at: [60, 80], mobileAt: [78, 62], state: streaming ? (o.correct ? "idle" : "dim") : "active" },
                  { id: "wh", label: "Warehouse", sub: `${r.wrongFirst} wrong`, at: [88, 50], mobileAt: [50, 91], state: r.wrongFinal ? "bad" : "good" },
                ]}
                links={[
                  { from: "app", to: "ingest", label: "events" },
                  { from: "ingest", to: "stream", label: "stream", dim: !streaming },
                  { from: "ingest", to: "batch", label: "files", dim: streaming && !o.correct },
                  { from: "stream", to: "wh", label: "hourly", dim: !streaming },
                  { from: "batch", to: "wh", label: s === "batch" ? "daily" : "corrections", dim: streaming && !o.correct },
                ]}
                packets={packets}
                aspect={2}
                mobileAspect={0.9}
              />
              <Chart r={r} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Pipeline" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Counting…">
                Follow an order
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Stamp every event with when it happened" what="The phone records the time of the order. The pipeline records when the event arrived. They differ by however long the phone was offline, and analytics almost always wants the first." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {DELAYS.map((d) => (
                    <li key={d.label} className="flex justify-between gap-2">
                      <span>arrives {d.label}</span>
                      <span>{Math.round(d.share * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="raw events" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Land raw events, then deduplicate by id" what={`Mobile SDKs retry when they don't hear back, so about ${Math.round(DUP_RATE * 100)}% of events arrive twice. Keep the raw events, untouched, so you can recompute, and drop repeats of an event id before counting.`} accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.dedupe} onChange={(e) => set({ dedupe: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Deduplicate by event id
                </label>
                <p className="font-mono text-xs" style={{ color: r.doubles ? "var(--bad)" : "var(--good)" }}>
                  {r.doubles} orders counted twice
                </p>
              </FlowStep>
              <FlowArrow label="batch or stream" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Choose batch, streaming, or both" what="A nightly batch sees the whole day and is simple to rerun, but yesterday's numbers arrive today. A stream publishes each hour minutes after it ends, and has to decide when an hour is finished." accent={ACCENT} active={at(2)}>
                <Choices label="Pipeline" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{STRATEGIES.find((x) => x.id === s)!.one}</p>
                <p className="mt-1 font-mono text-xs">each hour visible after {hm(freshness(r))}</p>
              </FlowStep>
              <FlowArrow label="close the hour" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Window by event time and wait for a watermark" what="Counting by arrival time puts a 12:55 order that arrives at 13:05 in the 13:00 hour. Counting by event time is right, but you must pick how long to wait before calling an hour done: the watermark. Longer is more complete and less fresh." accent={ACCENT} active={at(3)}>
                <Choices label="Watermark" accent={ACCENT} value={String(o.watermark)} onChange={(v) => set({ watermark: Number(v) })} options={WATERMARKS.map((w) => ({ id: String(w), label: `${w} min` }))} />
                <p className="mt-2 font-mono text-xs">
                  {s === "processing" ? `${r.misplaced} in the wrong hour (watermarks apply to event time)` : s === "batch" ? `batch waits until midnight: ${r.late} still late` : `${r.late} arrive after their hour was published`}
                </p>
              </FlowStep>
              <FlowArrow label="late events" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Decide what late data does" what="Drop it, or send it to a side output and correct the hour later: the stream updates the published number, or the nightly batch recomputes the day from the raw events. Fresh numbers first, right numbers by morning." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.correct} onChange={(e) => set({ correct: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Correct late events (recompute from raw)
                </label>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">fresh</span>
                  <span className="text-right text-[var(--faint)]">wrong at first</span>
                  <span className="text-right text-[var(--faint)]">in the end</span>
                  {STRATEGIES.map((x) => {
                    const y = run(x.id, o);
                    return <Row key={x.id} cells={[x.label, hm(freshness(y)), String(y.wrongFirst), String(y.wrongFinal)]} on={x.id === s} />;
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">{EVENTS.length} generated events with a fixed seed; delays follow the mix in step 1. Arrival-time counting can’t be corrected: the event time was never used.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, on }: { cells: string[]; on: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ color: on ? "var(--text)" : "var(--muted)", fontWeight: on ? 600 : 400 }}>
          {c}
        </span>
      ))}
    </>
  );
}

// Orders per hour: the truth (outline) against what was first published (filled).
function Chart({ r }: { r: Result }) {
  const max = Math.max(...TRUE_COUNTS, ...r.first);
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label={`Orders per hour, first published against the truth: ${r.first.map((c, h) => `${label(h)} ${c} of ${TRUE_COUNTS[h]}`).join(", ")}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">orders per hour · first published</p>
        <p className="font-mono text-xs text-[var(--muted)]">
          {total(r.first)} published · {total(TRUE_COUNTS)} real
        </p>
      </div>
      <ul className="mt-3 space-y-1.5">
        {r.first.map((c, h) => {
          const diff = c - TRUE_COUNTS[h];
          return (
            <li key={h} className="grid grid-cols-[3rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-[11px]">
              <span className="font-mono text-[var(--muted)]">{label(h)}</span>
              <span className="relative h-4 rounded-sm">
                <span className="absolute inset-y-0 left-0 rounded-sm border border-[var(--line-strong)]" style={{ width: `${(TRUE_COUNTS[h] / max) * 100}%` }} />
                <span className="absolute inset-y-0.5 left-0 rounded-sm" style={{ width: `${(c / max) * 100}%`, background: diff === 0 ? "var(--good)" : ACCENT, opacity: 0.85 }} />
              </span>
              <span className="text-right font-mono" style={{ color: diff === 0 ? "var(--good)" : "var(--bad)" }}>
                {c} {diff === 0 ? "✓" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-[var(--faint)]">Outline: real orders that hour. Filled: the number first published. An hour can look right while one late order and one double cancel out.</p>
    </section>
  );
}
