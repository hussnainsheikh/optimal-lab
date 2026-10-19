"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CONSUMER_CHOICES, KEYS, PARTITIONS, PER_TICK, RETENTION_DAYS, SCENARIOS, TICKS, frames, hash, partitionOf, type Frame, type GroupId, type Scenario } from "@/lib/pubSub";

const ACCENT = "var(--sys)";
const PART_COLOR = ["var(--c1)", "var(--c3)", "var(--c4)"];
const GROUPS: { id: GroupId; label: string; pace: string }[] = [
  { id: "billing", label: "Billing", pace: "one event a tick per consumer" },
  { id: "analytics", label: "Analytics", pace: "one event a tick in total" },
];

export default function PubSubDemo() {
  const [scenario, setScenario] = useState<Scenario>("pace");
  const [consumers, setConsumers] = useState(3);
  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Pub/sub and event streaming"
        blurb={`A topic with ${PARTITIONS} partitions. Producers append ${PER_TICK} events a tick, each with a customer as its key. Two consumer groups read the same events at their own pace, each keeping its own offsets. Take a group down, add consumers, or replay from the start, and watch the log: it keeps every event for ${RETENTION_DAYS} days whether anyone has read it or not.`}
      />
      <div className="mt-6">
        <Run key={`${scenario}-${consumers}`} scenario={scenario} setScenario={setScenario} consumers={consumers} setConsumers={setConsumers} />
      </div>
    </SessionPage>
  );
}

function Run({ scenario, setScenario, consumers, setConsumers }: { scenario: Scenario; setScenario: (s: Scenario) => void; consumers: number; setConsumers: (n: number) => void }) {
  const list = frames(scenario, consumers);
  const playback = usePlayback(list.length, 900);
  const f = list[playback.i];
  const sc = SCENARIOS.find((s) => s.id === scenario)!;
  const latest = f.log.flat().filter((e) => e.tick === f.tick);
  const total = f.log.reduce((s, p) => s + p.length, 0);

  return (
    <SessionLayout
      visual={<Log f={f} />}
      panel={
        <SystemMapPanel caption={f.caption}>
          <div className="w-full">
            <Choices label="Scenario" accent={ACCENT} value={scenario} onChange={setScenario} options={SCENARIOS.map((s) => ({ id: s.id, label: s.label }))} />
          </div>
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next tick" status={`tick ${f.tick} of ${TICKS}`} />
          <p className="w-full text-xs text-[var(--muted)]">{sc.what}</p>
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Publish an event with a key" what="A producer appends an event to the topic: a payload and a key, here the customer. It doesn't address a consumer; it doesn't know who will read it. The broker gives the event a position in a partition and that is where it stays." accent={ACCENT} active={f.tick > 0 && f.tick <= 2}>
            <p className="font-mono text-xs">{f.tick === 0 ? "nothing published yet" : `tick ${f.tick}: ${latest.map((e) => `${e.key} #${e.n} → partition ${partitionOf(e.key)}`).join(" · ")}`}</p>
          </FlowStep>
          <FlowArrow label="hash the key" accent={ACCENT} />

          <FlowStep n={2} title="The key picks the partition" what={`hash(key) mod ${PARTITIONS}. Every event with the same key lands in the same partition, in the order it was published, so one customer's events are always read in order. Different keys can land anywhere; order across keys is not promised.`} accent={ACCENT} active={f.tick > 2 && f.tick <= 4}>
            <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 font-mono text-xs sm:grid-cols-6">
              {KEYS.map((k) => (
                <span key={k}>
                  {k} <span style={{ color: PART_COLOR[partitionOf(k)] }}>→ {partitionOf(k)}</span>
                </span>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--faint)]">djb2 hash: {KEYS[0]} is {hash(KEYS[0]).toLocaleString("en-US")}, mod {PARTITIONS} = {partitionOf(KEYS[0])}. A hot key is a hot partition; no consumer count fixes that.</p>
          </FlowStep>
          <FlowArrow label="consumers read" accent={ACCENT} />

          <FlowStep n={3} title="Each group keeps its own offsets" what="A consumer group is one application reading the topic. It remembers, per partition, the next offset to read, and commits it as it goes. Two groups read the same events independently; neither can slow or starve the other. A queue would delete each message when one consumer took it." accent={ACCENT} active={f.tick > 4 && f.tick <= 6}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
              <span />
              <span className="text-right text-[var(--faint)]">offsets p0 p1 p2</span>
              <span className="text-right text-[var(--faint)]">behind</span>
              {GROUPS.map((g) => (
                <GroupRow key={g.id} label={g.label} offsets={f.offsets[g.id]} lag={f.lag[g.id]} down={g.id === "billing" && !f.billingUp} />
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {total} events in the log. {GROUPS.map((g) => `${g.label}: ${g.pace}`).join("; ")}.
            </p>
          </FlowStep>
          <FlowArrow label="more consumers" accent={ACCENT} />

          <FlowStep n={4} title="Scale a group up to the partition count" what={`Partitions are the unit of parallelism: each one is read by exactly one consumer in a group. ${PARTITIONS} partitions feed at most ${PARTITIONS} busy consumers; a fourth sits idle. Want more parallelism? More partitions, decided when the topic is created.`} accent={ACCENT} active={f.tick > 6 && f.tick <= 8}>
            <Choices label="Billing consumers" accent={ACCENT} value={String(consumers)} onChange={(v) => setConsumers(Number(v))} options={CONSUMER_CHOICES.map((n) => ({ id: String(n), label: String(n) }))} />
            <p className="mt-2 font-mono text-xs">
              {f.assignment.map((c, p) => `p${p} → consumer ${c}`).join(" · ")}
              {f.idle > 0 && <span style={{ color: "var(--bad)" }}> · {f.idle} idle</span>}
            </p>
          </FlowStep>
          <FlowArrow label="fall behind" accent={ACCENT} />

          <FlowStep n={5} title="Fall behind, come back, replay" what={`A consumer that stops loses nothing: the log keeps events for ${RETENTION_DAYS} days, and its offsets wait where they were. Reset the offsets to zero and the same events are read again, which is how a new report is built from history. Lag, the gap between the log's end and a group's offset, is the number to watch.`} accent={ACCENT} active={f.tick > 8}>
            <Choices label="Scenario" accent={ACCENT} value={scenario} onChange={setScenario} options={SCENARIOS.map((s) => ({ id: s.id, label: s.label }))} />
            <p className="mt-2 font-mono text-xs">
              billing {f.lag.billing} behind · analytics {f.lag.analytics} behind{!f.billingUp ? " · billing down" : ""}
            </p>
            <p className="mt-2 text-xs text-[var(--faint)]">Kafka, Pulsar and Kinesis work this way. A classic queue (SQS, RabbitMQ) hands each message to one consumer and deletes it; fan-out there means one queue per subscriber.</p>
          </FlowStep>
        </>
      }
    />
  );
}

function GroupRow({ label, offsets, lag, down }: { label: string; offsets: number[]; lag: number; down: boolean }) {
  return (
    <>
      <span className="font-sans" style={{ color: down ? "var(--bad)" : "var(--text)" }}>
        {label}
        {down ? " (down)" : ""}
      </span>
      <span className="text-right">{offsets.join(" ")}</span>
      <span className="text-right" style={{ color: lag > 6 ? "var(--bad)" : "var(--text)" }}>
        {lag}
      </span>
    </>
  );
}

// The log: one row per partition, one cell per event, shaded by who has read it.
function Log({ f }: { f: Frame }) {
  const width = Math.max(10, ...f.log.map((p) => p.length));
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={`The log at tick ${f.tick}: ${f.log.map((p, i) => `partition ${i} has ${p.length} events`).join(", ")}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">topic orders · tick {f.tick}</p>
        <p className="font-mono text-xs text-[var(--muted)]">
          billing {f.lag.billing} behind · analytics {f.lag.analytics} behind
        </p>
      </div>
      <div className="mt-3 space-y-2">
        {f.log.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-7 shrink-0 font-mono text-[11px]" style={{ color: PART_COLOR[i] }}>
              p{i}
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}>
              {p.map((e, j) => {
                const billing = j < f.offsets.billing[i];
                const analytics = j < f.offsets.analytics[i];
                return (
                  <span
                    key={e.seq}
                    title={`offset ${j}: ${e.key} #${e.n}${billing ? ", read by billing" : ""}${analytics ? ", read by analytics" : ""}`}
                    className="flex h-7 items-center justify-center overflow-hidden rounded border font-mono text-[9px] sm:text-[10px]"
                    style={{
                      borderColor: billing || analytics ? PART_COLOR[i] : "var(--line-strong)",
                      background: billing && analytics ? PART_COLOR[i] : billing || analytics ? `color-mix(in srgb, ${PART_COLOR[i]} 35%, transparent)` : "transparent",
                      color: billing && analytics ? "var(--on-accent)" : "var(--text)",
                    }}
                  >
                    {e.key.slice(0, 1)}
                    {e.n}
                  </span>
                );
              })}
              {Array.from({ length: width - p.length }, (_, j) => (
                <span key={`empty-${j}`} aria-hidden className="h-7 rounded border border-dashed border-[var(--line)] opacity-60" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border" style={{ borderColor: "var(--line-strong)" }} /> unread
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ background: `color-mix(in srgb, ${PART_COLOR[0]} 35%, transparent)`, border: `1px solid ${PART_COLOR[0]}` }} /> read by one group
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ background: PART_COLOR[0] }} /> read by both
        </span>
        <span>a1 = ana’s first event</span>
      </div>
    </section>
  );
}
