"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Slider } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { LIMITS, bitString, generate, makeId } from "@/lib/snowflake";

const ACCENT = "var(--sys)";
const COLORS = { ts: "var(--c1)", machine: "var(--c2)", seq: "var(--c3)" };
const IDS = generate();

export default function SnowflakeDemo() {
  const [ms, setMs] = useState(1000);
  const [machine, setMachine] = useState(7);
  const [seq, setSeq] = useState(0);
  const b = bitString(ms, machine, seq);
  const id = makeId(ms, machine, seq);
  const sorted = [...IDS].sort((a, c) => (a.id < c.id ? -1 : 1));

  return (
    <SessionPage>
      <SessionHeader kicker="System Design · interactive" title="Unique IDs at scale" blurb="An auto-increment id needs one database to hand out numbers. A random UUID needs no coordination but doesn't sort. Snowflake-style ids pack time, machine and a counter into 64 bits: any server makes them alone, and they still sort by time." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The bits of one id">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">64 bits</p>
              <p className="mt-2 break-all font-mono text-[11px] leading-5 sm:text-xs">
                <span className="text-[var(--faint)]">{b.sign}</span>
                <span style={{ color: COLORS.ts }}>{b.ts}</span>
                <span style={{ color: COLORS.machine }}>{b.machine}</span>
                <span style={{ color: COLORS.seq }}>{b.seq}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span style={{ color: COLORS.ts }}>41 bits time: {ms} ms</span>
                <span style={{ color: COLORS.machine }}>10 bits machine: {machine}</span>
                <span style={{ color: COLORS.seq }}>12 bits sequence: {seq}</span>
              </div>
              <p className="mt-3 font-mono text-lg">id = {id.toString()}</p>

              <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Ids made by three servers, sorted</p>
              <table className="mt-2 w-full font-mono text-xs">
                <thead><tr className="text-left text-[var(--faint)]"><th className="font-normal">id</th><th className="font-normal">ms</th><th className="font-normal">machine</th><th className="font-normal">seq</th></tr></thead>
                <tbody>
                  {sorted.map((g) => (
                    <tr key={g.order}><td className="py-0.5">{g.id.toString()}</td><td>{g.ms}</td><td style={{ color: COLORS.machine }}>{g.machine}</td><td>{g.seq}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          }
          panel={
            <SystemMapPanel caption={`Time ${ms} ms, machine ${machine}, sequence ${seq} → ${id.toString()}`}>
              <Slider label="Milliseconds since epoch" accent={ACCENT} value={ms} min={1000} max={1010} step={1} format={(v) => String(v)} onChange={setMs} />
              <Slider label="Machine id" accent={ACCENT} value={machine} min={0} max={20} step={1} format={(v) => String(v)} onChange={setMachine} />
              <Slider label="Sequence in this ms" accent={ACCENT} value={seq} min={0} max={5} step={1} format={(v) => String(v)} onChange={setSeq} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Time goes in the high bits" what="Milliseconds since a chosen epoch fill the top 41 bits, so a later id is a bigger number." accent={ACCENT}>
                <p className="text-sm text-[var(--muted)]">41 bits lasts about {LIMITS.years} years.</p>
              </FlowStep>
              <FlowArrow label="which machine" accent={ACCENT} />
              <FlowStep n={2} title="Each machine has its own number" what="10 bits for the machine id: two servers can never make the same id, without talking to each other." accent={ACCENT}>
                <p className="text-sm text-[var(--muted)]">Up to {LIMITS.machines.toLocaleString()} machines.</p>
              </FlowStep>
              <FlowArrow label="same millisecond" accent={ACCENT} />
              <FlowStep n={3} title="A counter covers the same millisecond" what="12 bits count ids made by one machine within one millisecond, then reset." accent={ACCENT}>
                <p className="text-sm text-[var(--muted)]">Up to {LIMITS.perMs.toLocaleString()} ids per machine per millisecond.</p>
              </FlowStep>
              <FlowArrow label="the trade-off" accent={ACCENT} />
              <FlowStep n={4} title="Sorted by time, roughly" what="Ids sort by millisecond. Within one millisecond, order between machines isn't real time. Clocks that jump backwards are the main risk." accent={ACCENT} active>
                <p className="text-sm text-[var(--muted)]">Compared with UUIDv4: half the size, and indexes stay in insert order.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
