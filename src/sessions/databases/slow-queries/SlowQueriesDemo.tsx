"use client";

import { useMemo, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { CALLS, FIXES, PLANS, executions, normalize, slowLog, sorted, stats, type Fix, type Sort } from "@/lib/slowQueries";

const ACCENT = "var(--db)";
const THRESHOLDS = [10, 50, 100, 250, 500, 1000, 5000];

type Opts = { sort: Sort; tIx: number; fixes: Fix[]; explain: string };
const NAIVE: Opts = { sort: "mean", tIx: 5, fixes: [], explain: "report" };
const TUNED: Opts = { sort: "total", tIx: 1, fixes: ["ordersIndex", "trigramIndex", "lowerEmailIndex"], explain: "openOrders" };

const s = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms.toFixed(ms < 10 ? 2 : 0)} ms`);
const SHAPE_LABEL: Record<string, string> = { openOrders: "open orders count", login: "login by email", search: "product search", report: "revenue report", session: "session lookup", product: "product by id", cart: "cart update", events: "event insert", orderPage: "order page" };

export default function SlowQueriesDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const fixes = useMemo(() => new Set(o.fixes), [o.fixes]);
  const base = useMemo(() => stats(new Set()), []);
  const now = useMemo(() => stats(fixes), [fixes]);
  const ranked = sorted(now, o.sort);
  const threshold = THRESHOLDS[o.tIx];
  const log = useMemo(() => slowLog(threshold), [threshold]);
  const total = (xs: typeof base) => xs.reduce((a, x) => a + x.total, 0);
  const before = total(base), after = total(now);
  const topTotal = sorted(base, "total")[0];
  const raws = executions().filter((e) => e.shape === "openOrders").slice(0, 3);
  const fixFor = (Object.keys(FIXES) as Fix[]).find((f) => FIXES[f].shape === o.explain)!;
  const explained = fixes.has(fixFor);
  const toggle = (f: Fix) => set({ fixes: o.fixes.includes(f) ? o.fixes.filter((x) => x !== f) : [...o.fixes, f] });

  const nodes: MapNode[] = [
    { id: "app", label: "App", sub: `${CALLS.toLocaleString("en-US")} queries / hour`, at: [12, 50], mobileAt: [50, 8], state: "active" },
    { id: "pg", label: "Postgres", sub: `${s(after)} busy per hour`, at: [42, 50], mobileAt: [50, 36], state: after < before * 0.5 ? "good" : "wait" },
    { id: "pss", label: "pg_stat_statements", sub: `${now.length} query shapes`, at: [80, 22], mobileAt: [25, 66], state: "good" },
    { id: "log", label: "Slow query log", sub: `${log.lines.toLocaleString("en-US")} lines ≥ ${s(threshold)}`, at: [80, 78], mobileAt: [75, 66], state: log.share > 0.6 ? "good" : "wait" },
    { id: "you", label: "You", sub: `sorted by ${o.sort}`, at: [42, 90], mobileAt: [50, 92], state: "active" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("q", ["app", "pg", "pss"], { label: "$1, $2 …" })
    : stage === 1 ? hops("r", ["pss", "you"], { label: `top: ${SHAPE_LABEL[ranked[0].shape]}`, tone: ranked[0].shape === topTotal.shape ? "good" : "bad" })
    : stage === 2 ? hops("l", ["pg", "log"], { label: `${Math.round(log.share * 100)}% of time`, tone: log.share > 0.6 ? "good" : "bad" })
    : stage === 3 ? hops("e", ["you", "pg"], { label: "EXPLAIN ANALYZE" })
    : stage === 4 ? hops("f", ["you", "pg"], { label: `−${Math.round((1 - after / before) * 100)}%`, tone: after < before ? "good" : "accent" })
    : [];

  const captions = [
    `Step 1: pg_stat_statements replaces each literal with $1, $2 … so ${CALLS.toLocaleString("en-US")} executions collapse into ${base.length} shapes, each with calls, total and mean time.`,
    o.sort === "total" ? `Step 2: by total time the top shape is the ${SHAPE_LABEL[topTotal.shape]} query: ${s(topTotal.total)} an hour from ${topTotal.calls.toLocaleString("en-US")} calls of ${s(topTotal.mean)}.` : `Step 2: sorted by ${o.sort}, the top is the ${SHAPE_LABEL[ranked[0].shape]}, but the most database time goes to the ${SHAPE_LABEL[topTotal.shape]} (${s(topTotal.total)}).`,
    `Step 3: log_min_duration_statement = ${s(threshold)} logs ${log.lines.toLocaleString("en-US")} executions, covering ${Math.round(log.share * 100)}% of database time.`,
    `Step 4: EXPLAIN ANALYZE on the ${SHAPE_LABEL[o.explain]} ${explained ? "after the fix" : "shows why it's slow"}.`,
    `Step 5: database time per hour ${s(before)} → ${s(after)} (${Math.round((1 - after / before) * 100)}% less).`,
  ];
  const caption = stage !== null ? captions[stage] : `Top by ${o.sort}: ${SHAPE_LABEL[ranked[0].shape]} · slow log at ${s(threshold)} sees ${Math.round(log.share * 100)}% of database time · ${s(before)} → ${s(after)} per hour.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Finding slow queries"
        blurb="The query that hurts most is rarely the slowest one: it's usually a 14 ms query run thousands of times an hour. pg_stat_statements groups every execution by shape and adds up the time; the slow-query log only sees the outliers. Rank an hour of real-looking traffic, read the plans, and fix what matters."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The app sends queries to Postgres, which aggregates them in pg_stat_statements and writes outliers to the slow query log; you read both"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "pg", label: "queries" },
                  { from: "pg", to: "pss", label: "every call" },
                  { from: "pg", to: "log", label: "≥ threshold" },
                  { from: "pss", to: "you", label: "top N" },
                  { from: "you", to: "pg", label: "EXPLAIN" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="pg_stat_statements, top six">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">pg_stat_statements · ORDER BY {o.sort === "total" ? "total_exec_time" : o.sort === "mean" ? "mean_exec_time" : "calls"} DESC</p>
                <ol className="mt-2 space-y-2">
                  {ranked.slice(0, 6).map((r) => (
                    <li key={r.query} className="min-w-0">
                      <code className="block truncate font-mono text-[11px]" title={r.query}>{r.query}</code>
                      <div className="mt-0.5 flex items-center gap-2">
                        <div className="h-1.5 min-w-0 flex-1 rounded bg-[var(--inset)]">
                          <div className="h-full rounded" style={{ width: `${(r.total / before) * 100}%`, background: r.shape === topTotal.shape ? "var(--bad)" : ACCENT }} />
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-[var(--muted)]">{r.calls.toLocaleString("en-US")} × {s(r.mean)} = {s(r.total)}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Chase the slowest
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Fix by total time
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Profiling…">
                Profile an hour
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Record every query, grouped by shape" what="pg_stat_statements strips the literal values out of each query and keeps running totals per normalized text: how often it ran, total and mean time, rows. It needs shared_preload_libraries and costs very little." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 font-mono text-[11px] text-[var(--muted)]">
                  {raws.map((r, i) => (
                    <li key={i} className="break-words">{r.sql}</li>
                  ))}
                </ul>
                <p className="break-words font-mono text-[11px]">→ {normalize(raws[0].sql)}</p>
              </FlowStep>
              <FlowArrow label="rank them" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Rank by total time, not by the slowest" what="Total time is calls × mean, and it's what the database actually spends. Sorting by mean finds the rare monster; sorting by calls finds the cheap chatter. Sorting by total finds what to fix first." accent={ACCENT} active={at(1)}>
                <Choices<Sort> accent={ACCENT} value={o.sort} onChange={(v) => set({ sort: v })} options={[{ id: "total", label: "total time" }, { id: "mean", label: "mean time" }, { id: "calls", label: "calls" }]} />
              </FlowStep>
              <FlowArrow label="what the log sees" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Know what the slow log misses" what="log_min_duration_statement logs each execution slower than a threshold. It's good for spotting outliers with their real parameters, and blind to a fast query that runs constantly." accent={ACCENT} active={at(2)}>
                <Slider label="log_min_duration_statement" value={o.tIx} min={0} max={THRESHOLDS.length - 1} step={1} format={(i) => s(THRESHOLDS[i])} onChange={(v) => set({ tIx: v })} accent={ACCENT} />
                <p className="font-mono text-xs" style={{ color: log.share > 0.6 ? "var(--good)" : "var(--bad)" }}>
                  {log.lines.toLocaleString("en-US")} lines · {Math.round(log.share * 100)}% of database time · {[...log.byShape].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${SHAPE_LABEL[k]} ×${v}`).join(", ") || "nothing"}
                </p>
              </FlowStep>
              <FlowArrow label="why is it slow?" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="EXPLAIN the top offenders" what="EXPLAIN (ANALYZE, BUFFERS) runs the query and shows the plan with real times and rows. A sequential scan that throws away millions of rows to return two is the classic sign of a missing index." accent={ACCENT} active={at(3)}>
                <Choices<string> accent={ACCENT} value={o.explain} onChange={(v) => set({ explain: v })} options={Object.keys(PLANS).map((k) => ({ id: k, label: SHAPE_LABEL[k] }))} />
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed" style={{ color: explained ? "var(--good)" : "var(--text)" }}>
                  {explained ? PLANS[o.explain].after : PLANS[o.explain].before}
                </pre>
              </FlowStep>
              <FlowArrow label="fix, then measure" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Fix it and measure again" what="Apply one fix at a time and reset the statistics (pg_stat_statements_reset()) so the next hour shows the effect. Indexes fix scans; a big report that is simply big belongs on a replica." accent={ACCENT} active={at(4)}>
                {(Object.keys(FIXES) as Fix[]).map((f) => (
                  <label key={f} className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" checked={fixes.has(f)} onChange={() => toggle(f)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                    {FIXES[f].label}
                  </label>
                ))}
                <p className="font-mono text-xs" style={{ color: after < before ? "var(--good)" : "var(--muted)" }}>
                  database time per hour: {s(before)} → {s(after)} ({Math.round((1 - after / before) * 100)}% less)
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">60,000 executions with real literal values are generated, normalized and aggregated here; per-shape timings are illustrative log-normal draws.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
