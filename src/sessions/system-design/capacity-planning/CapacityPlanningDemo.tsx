"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { BASE_RPS, DB_CEILING_RPS, GROWTH, HORIZON, INSTANCE_RPS, LEAD_MONTHS, ON_DEMAND, PEAK_FACTOR, RESERVED, START, STRATEGIES, TROUGH_FACTOR, UTIL_TARGETS, ZONES, avgRps, dayShape, forecast, instancesFor, money, monthCost, rps, wallMonth, yearCost, type Settings } from "@/lib/capacityPlanning";

const ACCENT = "var(--sys)";

export default function CapacityPlanningDemo() {
  const [s, setS] = useState<Settings>(START);
  const { stage, busy, run } = useWalk(5, 1100);
  const set = (patch: Partial<Settings>) => setS((cur) => ({ ...cur, ...patch }));
  const at = (i: number) => stage === i;
  const rows = forecast(s);
  const row = rows[s.month];
  const wall = wallMonth(s);
  const cost = monthCost(s, s.month);
  const shape = dayShape();
  const hourly = shape.map((m) => avgRps(s.growth, s.month) * m);
  const hourlyInstances = hourly.map((v) => instancesFor(v, s.util, s.zoneSafe));

  const captions = [
    `Step 1: ${rps(BASE_RPS)} requests a second today, growing ${Math.round(s.growth * 100)}% a month: ${rps(rows[HORIZON].avg)} on average in a year.`,
    `Step 2: the busiest hour is ${PEAK_FACTOR}× the average. In month ${s.month} that's ${rps(row.peak)} a second.`,
    `Step 3: at ${Math.round(s.util * 100)}% of ${INSTANCE_RPS} per instance${s.zoneSafe ? ", with a zone's worth spare" : ""}: ${row.instances} instances.`,
    wall === null ? `Step 4: the database (${rps(DB_CEILING_RPS)} a second) holds for the whole year.` : `Step 4: the peak passes the database's ${rps(DB_CEILING_RPS)} in month ${wall}. That work has to start by month ${Math.max(0, wall - LEAD_MONTHS)}.`,
    `Step 5: ${STRATEGIES.find((x) => x.id === s.strategy)!.label.toLowerCase()}: ${money(cost.cost)} in month ${s.month}, ${Math.round(cost.idleShare * 100)}% of paid hours idle.`,
  ];
  const caption = stage !== null ? captions[stage] : `Month ${s.month}: peak ${rps(row.peak)}/s · ${row.instances} instances · ${money(cost.cost)} a month · ${Math.round(cost.idleShare * 100)}% idle${wall !== null ? ` · database wall in month ${wall}` : ""}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Capacity planning and cost optimization"
        blurb={`A service at ${rps(BASE_RPS)} requests a second today. Forecast a year of growth, size the fleet for the busiest hour with headroom and a lost zone, find the month the database runs out, and choose how to pay for instances that sit idle at 4 a.m.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="A day of traffic against the instances running, and twelve months of peak against the database ceiling">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">month {s.month} · one day, hour by hour</p>
              <DayChart hourly={hourly} instances={hourlyInstances} s={s} />
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">peak by month · database ceiling</p>
              <YearChart rows={rows} month={s.month} />
              <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <Stat label="peak req/s" value={rps(row.peak)} bad={row.overCeiling} />
                <Stat label="instances at peak" value={String(row.instances)} />
                <Stat label="this month" value={money(cost.cost)} />
                <Stat label="next 12 months" value={money(yearCost(s))} />
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Slider label="Month" value={s.month} min={0} max={HORIZON} step={1} format={(v) => `${v}`} onChange={(v) => set({ month: v })} accent={ACCENT} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Planning…">
                Walk through the plan
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Forecast the growth" what="Start from the measured average and a growth rate from the last few months. Compounding matters: 5% a month is 80% a year, 10% a month is three times." accent={ACCENT} active={at(0)}>
                <Choices label="Growth a month" accent={ACCENT} value={String(s.growth)} onChange={(v) => set({ growth: Number(v) })} options={GROWTH.map((g) => ({ id: String(g), label: `${Math.round(g * 100)}%` }))} />
                <p className="mt-2 font-mono text-xs">
                  average: {rps(BASE_RPS)} now → {rps(rows[6].avg)} in 6 months → {rps(rows[HORIZON].avg)} in 12
                </p>
              </FlowStep>
              <FlowArrow label="the average" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Size for the busiest hour, not the average" what={`Traffic follows the day. Here the quietest hour is ${TROUGH_FACTOR}× the average and the busiest ${PEAK_FACTOR}×. A fleet sized for the average falls over every evening.`} accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  month {s.month}: quietest {rps(Math.min(...hourly))}/s · average {rps(row.avg)}/s · busiest {rps(row.peak)}/s
                </p>
              </FlowStep>
              <FlowArrow label="the peak" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Add headroom, and survive a zone" what={`One instance serves ${INSTANCE_RPS} requests a second flat out, but latency climbs long before that, so plan to a utilisation target. Spread across ${ZONES} zones, the fleet must still carry the peak with one zone gone: that's 50% more instances.`} accent={ACCENT} active={at(2)}>
                <Choices label="Utilisation target" accent={ACCENT} value={String(s.util)} onChange={(v) => set({ util: Number(v) })} options={UTIL_TARGETS.map((u) => ({ id: String(u), label: `${Math.round(u * 100)}%` }))} />
                <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={s.zoneSafe} onChange={(e) => set({ zoneSafe: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Survive losing a zone
                </label>
                <p className="font-mono text-xs">
                  {rps(row.peak)} ÷ ({INSTANCE_RPS} × {Math.round(s.util * 100)}%){s.zoneSafe ? ` ÷ ${ZONES - 1}/${ZONES} zones` : ""}, rounded to whole zones = {row.instances} instances
                </p>
              </FlowStep>
              <FlowArrow label="the fleet grows" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Find the wall before you hit it" what={`App servers scale by adding more. Some things don't: here the database primary tops out at ${rps(DB_CEILING_RPS)} requests a second. Replicas, caching or sharding take about ${LEAD_MONTHS} months to do properly, so the plan's real output is a date to start.`} accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs" style={{ color: wall === null ? "var(--good)" : "var(--bad)" }}>
                  {wall === null ? "no wall within 12 months at this growth" : `peak passes ${rps(DB_CEILING_RPS)} in month ${wall} → start by month ${Math.max(0, wall - LEAD_MONTHS)}`}
                </p>
                <ul className="mt-1 space-y-0.5 font-mono text-xs text-[var(--muted)]">
                  {GROWTH.map((g) => {
                    const w = wallMonth({ ...s, growth: g });
                    return (
                      <li key={g}>
                        {Math.round(g * 100)}% a month: {w === null ? "no wall this year" : `wall in month ${w}`}
                      </li>
                    );
                  })}
                </ul>
              </FlowStep>
              <FlowArrow label="the bill" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Stop paying for idle machines" what={`A fleet sized for the evening peak is mostly idle at night. Reserve what's always busy (${Math.round((1 - RESERVED / ON_DEMAND) * 100)}% cheaper for a year's commitment) and autoscale the rest by the hour, with a cooldown before scaling in.`} accent={ACCENT} active={at(4)}>
                <Choices label="How to pay" accent={ACCENT} value={s.strategy} onChange={(v) => set({ strategy: v })} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">12 months</span>
                  <span className="text-right text-[var(--faint)]">idle</span>
                  {STRATEGIES.map((x) => {
                    const ss = { ...s, strategy: x.id };
                    const w = x.id === s.strategy ? 700 : 400;
                    return (
                      <Row key={x.id} w={w} cells={[x.label, money(yearCost(ss)), `${Math.round(monthCost(ss, s.month).idleShare * 100)}%`]} />
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  On demand ${ON_DEMAND.toFixed(2)} an instance-hour, reserved ${RESERVED.toFixed(2)}. Round numbers in the range of the big clouds&rsquo; general-purpose instances.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, w }: { cells: string[]; w: number }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: w }}>
          {c}
        </span>
      ))}
    </>
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

// Demand by hour as bars, and the instances' capacity (at the target) as a stepped line.
function DayChart({ hourly, instances, s }: { hourly: number[]; instances: number[]; s: Settings }) {
  const peakFleet = s.strategy === "peakYear" ? forecast(s)[HORIZON].instances : Math.max(...instances);
  const fleet = s.strategy === "reservedAuto" ? instances : instances.map(() => peakFleet);
  const capacity = fleet.map((n) => n * INSTANCE_RPS * s.util * (s.zoneSafe ? (ZONES - 1) / ZONES : 1));
  const max = Math.max(...capacity, ...hourly) * 1.08;
  const W = 100;
  const H = 34;
  const bw = W / 24;
  const y = (v: number) => H - 4 - (v / max) * (H - 6);
  const step = capacity.map((c, h) => `${h ? "L" : "M"}${(h * bw).toFixed(2)},${y(c).toFixed(2)} L${((h + 1) * bw).toFixed(2)},${y(c).toFixed(2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Requests a second for each hour of the day as bars, with the capacity paid for as a line above them">
      {hourly.map((v, h) => (
        <rect key={h} x={h * bw + 0.3} y={y(v)} width={bw - 0.6} height={H - 4 - y(v)} fill={ACCENT} opacity={0.75} />
      ))}
      <path d={step} fill="none" stroke="var(--c3)" strokeWidth={0.7} />
      {[0, 6, 12, 18].map((h) => (
        <text key={h} x={h * bw} y={H - 0.5} fontSize={2.6} fill="var(--faint)">
          {String(h).padStart(2, "0")}:00
        </text>
      ))}
      <text x={W} y={y(capacity[3]) - 1} textAnchor="end" fontSize={2.6} fill="var(--c3)">
        capacity paid for
      </text>
    </svg>
  );
}

function YearChart({ rows, month }: { rows: ReturnType<typeof forecast>; month: number }) {
  const max = Math.max(DB_CEILING_RPS, ...rows.map((r) => r.peak)) * 1.1;
  const W = 100;
  const H = 26;
  const bw = W / rows.length;
  const y = (v: number) => H - 4 - (v / max) * (H - 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`Peak requests a second for months 0 to ${HORIZON}, against the database ceiling of ${DB_CEILING_RPS}`}>
      {rows.map((r) => (
        <rect key={r.month} x={r.month * bw + 0.4} y={y(r.peak)} width={bw - 0.8} height={H - 4 - y(r.peak)} fill={r.overCeiling ? "var(--bad)" : ACCENT} opacity={r.month === month ? 1 : 0.5} />
      ))}
      <line x1={0} x2={W} y1={y(DB_CEILING_RPS)} y2={y(DB_CEILING_RPS)} stroke="var(--bad)" strokeWidth={0.5} strokeDasharray="1.5 1" />
      <text x={1} y={y(DB_CEILING_RPS) - 1} fontSize={2.6} fill="var(--bad)">
        database ceiling
      </text>
      <text x={0} y={H - 0.5} fontSize={2.6} fill="var(--faint)">
        month 0
      </text>
      <text x={W} y={H - 0.5} textAnchor="end" fontSize={2.6} fill="var(--faint)">
        month {HORIZON}
      </text>
    </svg>
  );
}
