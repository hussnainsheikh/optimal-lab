"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { AGGS, GROUP_BYS, HAVING_MAX, ROWS, WHERE_MIN, keyOf, passesWhere, run, sqlFor, type Agg, type GroupBy } from "@/lib/aggregation";

const ACCENT = "var(--db)";
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--db)"];
const label = "font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]";

const CAPTIONS = [
  "WHERE looks at single rows, before any grouping.",
  "Rows with the same key land in the same group.",
  "The aggregate turns each group's rows into one number.",
  "HAVING looks at those numbers and drops whole groups.",
  "One row per surviving group comes back.",
];

export default function AggregationDemo() {
  const [groupBy, setGroupBy] = useState<GroupBy>("region");
  const [agg, setAgg] = useState<Agg>("sum");
  const [where, setWhere] = useState(false);
  const [having, setHaving] = useState(0);
  const walk = useWalk(5, 900);
  const q = { groupBy, agg, where, having };
  const { input, groups, out } = run(q);
  const colorOf = (key: string) => COLORS[Math.max(0, groups.findIndex((g) => g.key === key)) % COLORS.length];
  const at = walk.stage;
  const fmt = (v: number) => (agg === "avg" ? v.toFixed(2) : String(v));

  const caption =
    at === null
      ? `${ROWS.length} rows in, ${input.length} after WHERE, ${groups.length} groups, ${out.length} after HAVING.`
      : CAPTIONS[at];

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="GROUP BY and aggregation"
        blurb="Eight orders. GROUP BY sorts them into groups, an aggregate like SUM squashes each group into one number, and HAVING filters the groups. Change the query and watch rows move between groups."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Orders, grouped, and the result">
              <pre className="whitespace-pre-wrap break-words rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{sqlFor(q)}</pre>
              <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <p className={label}>orders</p>
                  <ul className="mt-1 space-y-1 font-mono text-xs">
                    {ROWS.map((r) => {
                      const kept = passesWhere(r, where);
                      const key = keyOf(r, groupBy);
                      return (
                        <li
                          key={r.id}
                          className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-1 rounded px-2 py-1"
                          style={{
                            background: kept ? `color-mix(in srgb, ${colorOf(key)} 16%, transparent)` : "var(--inset)",
                            borderLeft: `3px solid ${kept ? colorOf(key) : "var(--line)"}`,
                            opacity: kept ? 1 : 0.4,
                            textDecoration: kept ? undefined : "line-through",
                          }}
                        >
                          <span className="text-[var(--faint)]">{r.id}</span>
                          <span className="truncate">{r.region}</span>
                          <span className="truncate">{r.product}</span>
                          <span className="text-right">{r.amount}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="min-w-0">
                  <p className={label}>groups → result</p>
                  <ul className="mt-1 space-y-1 font-mono text-xs">
                    {groups.map((g) => (
                      <li
                        key={g.key}
                        className="rounded px-2 py-1"
                        style={{ borderLeft: `3px solid ${colorOf(g.key)}`, background: "var(--inset)", opacity: g.kept ? 1 : 0.4 }}
                      >
                        <span className="flex justify-between gap-2">
                          <span className="truncate">{g.key}</span>
                          <span style={{ color: g.kept ? "var(--text)" : "var(--bad)" }}>{fmt(g.value)}</span>
                        </span>
                        <span className="block text-[10px] text-[var(--faint)]">
                          rows {g.rows.map((r) => r.id).join(", ")}
                          {!g.kept && " · dropped by HAVING"}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    {out.length} {out.length === 1 ? "row" : "rows"} returned
                  </p>
                </div>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT}>
                Run the query
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Filter rows with WHERE" what="WHERE checks one row at a time, before groups exist. It can't use SUM or COUNT." accent={ACCENT} active={at === 0}>
                <Choices
                  label="WHERE"
                  accent={ACCENT}
                  value={where ? "on" : "off"}
                  onChange={(v) => setWhere(v === "on")}
                  options={[
                    { id: "off", label: "none" },
                    { id: "on", label: `amount >= ${WHERE_MIN}` },
                  ]}
                />
                <p className="mt-2 font-mono text-xs">{input.length} of {ROWS.length} rows pass</p>
              </FlowStep>
              <FlowArrow label={`${input.length} rows`} accent={ACCENT} />
              <FlowStep n={2} title="Sort rows into groups" what="Rows with equal values in the GROUP BY columns go into the same group. Two columns make smaller groups." accent={ACCENT} active={at === 1}>
                <Choices label="GROUP BY" accent={ACCENT} value={groupBy} onChange={setGroupBy} options={GROUP_BYS.map((g) => ({ id: g.id, label: g.label }))} />
                <p className="mt-2 font-mono text-xs">{groups.length} groups</p>
              </FlowStep>
              <FlowArrow label={`${groups.length} groups`} accent={ACCENT} />
              <FlowStep n={3} title="Run the aggregate per group" what="The aggregate reads every row in a group and returns one value. Columns not in GROUP BY must be inside an aggregate." accent={ACCENT} active={at === 2}>
                <Choices
                  label="Aggregate"
                  accent={ACCENT}
                  value={agg}
                  onChange={(v) => {
                    setAgg(v);
                    setHaving(0);
                  }}
                  options={AGGS.map((a) => ({ id: a.id, label: a.label }))}
                />
              </FlowStep>
              <FlowArrow label={`${groups.length} values`} accent={ACCENT} />
              <FlowStep n={4} title="Drop groups with HAVING" what="HAVING is WHERE for groups. It runs after the aggregate, so it can test SUM, COUNT or AVG." accent={ACCENT} active={at === 3}>
                <Slider label={`HAVING ${AGGS.find((a) => a.id === agg)!.sql} >`} accent={ACCENT} value={having} min={0} max={HAVING_MAX[agg]} step={agg === "count" ? 1 : 5} format={String} onChange={setHaving} />
              </FlowStep>
              <FlowArrow label={`${out.length} groups`} accent={ACCENT} />
              <FlowStep n={5} title="Return one row per group" what="Each surviving group becomes one output row: its key and its aggregate. ORDER BY and LIMIT, if any, run after this." accent={ACCENT} active={at === 4}>
                <p className="font-mono text-xs">{out.map((g) => `${g.key}: ${fmt(g.value)}`).join(" · ") || "no rows"}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
