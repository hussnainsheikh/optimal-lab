"use client";

import { useMemo, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { HORIZON, MIGRATE_AT, OPS, QUERY_EVERY, REPORT_MS, backfill, blocks, simulate, workMs, type Op } from "@/lib/migrationLocks";

const ACCENT = "var(--db)";

type Opts = { op: Op; safe: boolean; rowsExp: number; timeout: boolean; lockTimeout: number; batch: number };
const NAIVE: Opts = { op: "addColumn", safe: false, rowsExp: 7, timeout: false, lockTimeout: 1000, batch: 0 };
const TUNED: Opts = { op: "addColumn", safe: true, rowsExp: 7, timeout: true, lockTimeout: 200, batch: 10_000 };

const secs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`);

export default function MigrationsPracticeDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const info = OPS[o.op];
  const rows = Math.round(Math.pow(10, o.rowsExp));
  const lock = o.safe ? info.safeLock : info.lock;
  const work = o.safe ? info.safeWork : info.work;
  const hold = workMs(work, rows, o.safe && o.op === "createIndex");
  const b = blocks(lock);
  const { op, safe, rowsExp, timeout, lockTimeout } = o;
  const sim = useMemo(() => {
    const i = OPS[op];
    const w = workMs(safe ? i.safeWork : i.work, Math.round(Math.pow(10, rowsExp)), safe && op === "createIndex");
    return simulate(safe ? i.safeLock : i.lock, w, timeout ? lockTimeout : null);
  }, [op, safe, rowsExp, timeout, lockTimeout]);
  const bf = backfill(rows, o.batch || null);
  const maxQ = Math.max(1, ...sim.waitingSeries);
  const hurt = sim.over1s > 0;

  const nodes: MapNode[] = [
    { id: "deploy", label: "Deploy", sub: o.safe ? info.safeLabel : info.label, at: [12, 22], mobileAt: [25, 10], state: "active" },
    { id: "report", label: "Report", sub: `running ${secs(REPORT_MS)}`, at: [12, 78], mobileAt: [75, 10], state: "wait" },
    { id: "queue", label: "Lock queue", sub: `${Math.max(...sim.waitingSeries)} waiting at peak`, at: [50, 50], mobileAt: [50, 45], state: hurt ? "bad" : "good" },
    { id: "app", label: "App", sub: `${1000 / QUERY_EVERY} queries/s`, at: [88, 22], mobileAt: [25, 82], state: hurt ? "bad" : "good" },
    { id: "table", label: "orders", sub: `${rows.toLocaleString("en-US")} rows`, at: [88, 78], mobileAt: [75, 82], state: b.reads || b.writes ? "wait" : "good" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("d", ["deploy", "queue"], { label: lock })
    : stage === 1 ? [...hops("r", ["report", "queue"], { label: "ACCESS SHARE" }), ...hops("a", ["app", "queue"], { label: hurt ? "queued" : "granted", tone: hurt ? "bad" : "good", start: 0.3 })]
    : stage === 2 ? hops("t", ["queue", "deploy"], { label: o.timeout ? `gives up after ${secs(o.lockTimeout)}` : "waits", tone: o.timeout ? "good" : "bad" })
    : stage === 3 ? hops("h", ["queue", "table"], { label: `held ${secs(hold)}`, tone: hold > 1000 && (b.reads || b.writes) ? "bad" : "good" })
    : stage === 4 ? hops("bf", ["deploy", "table"], { label: o.batch ? `${bf.statements} batches` : "1 UPDATE", tone: o.batch ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: ${o.safe ? info.safeLabel : info.label} takes ${lock}, which blocks ${b.reads && b.writes ? "reads and writes" : b.writes ? "writes" : "neither reads nor writes"}${work !== "none" ? ` while it ${work === "rewrite" ? "rewrites" : work === "scan" ? "scans" : "builds an index over"} the whole table` : ""}.`,
    `Step 2: a ${secs(REPORT_MS)} report is already reading the table. ${lock === "ACCESS EXCLUSIVE" ? "The ALTER waits for it, and every query that arrives after the ALTER queues behind it" : "Requests that conflict with the migration's lock queue behind it"}: ${sim.over1s.toLocaleString("en-US")} of ${sim.total.toLocaleString("en-US")} app queries wait over a second.`,
    o.timeout ? `Step 3: with lock_timeout = ${o.lockTimeout} ms the migration gives up instead of blocking the queue, and retries: ${sim.attempts.map((x) => x.result).join("; ")}.` : "Step 3: with no lock_timeout the migration waits as long as it takes, and the app waits with it.",
    `Step 4: once granted, the lock is held ${secs(hold)} on ${rows.toLocaleString("en-US")} rows${hold > HORIZON ? ", longer than this chart" : ""}.`,
    o.batch ? `Step 5: a backfill in ${bf.statements.toLocaleString("en-US")} batches of ${o.batch.toLocaleString("en-US")} keeps each transaction to ${secs(Math.round(bf.longestTxnS * 1000))}.` : `Step 5: one UPDATE over ${rows.toLocaleString("en-US")} rows is one ${secs(Math.round(bf.longestTxnS * 1000))} transaction locking every row it touches.`,
  ];
  const caption = stage !== null ? captions[stage] : `${sim.over1s.toLocaleString("en-US")} app queries waited over 1 s (longest ${secs(sim.maxWait)})${sim.stillWaiting ? `, ${sim.stillWaiting} still waiting at ${HORIZON / 1000} s` : ""} · migration ${sim.ddlDone !== null ? `done at ${secs(sim.ddlDone)}` : "not done yet"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Schema migrations"
        blurb="Even ALTER TABLE ADD COLUMN, which finishes in milliseconds, can take a busy site down: it needs an exclusive lock, waits behind a long query, and every request after it waits too. Run six common changes against a table taking 100 queries a second, then make them safe with lock_timeout, two-step constraints, CONCURRENTLY and batched backfills."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A deploy's migration, a long-running report and the app all queue for locks on the orders table"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "deploy", to: "queue", label: lock },
                  { from: "report", to: "queue", label: "ACCESS SHARE" },
                  { from: "app", to: "queue", label: "reads, writes" },
                  { from: "queue", to: "table", label: "granted" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="App queries waiting for a lock over time">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">App queries waiting for a lock · 0 → {HORIZON / 1000} s</p>
                <div className="relative mt-3 flex h-24 items-end gap-px">
                  {sim.waitingSeries.map((n, i) => (
                    <span key={i} className="min-w-0 flex-1 rounded-t-[1px]" style={{ height: `${(n / maxQ) * 100}%`, background: n ? "var(--bad)" : "transparent" }} />
                  ))}
                  <span className="absolute bottom-0 top-0 w-px bg-[var(--text)]" style={{ left: `${(MIGRATE_AT / HORIZON) * 100}%` }} />
                  <span className="absolute bottom-0 top-0 w-px bg-[var(--muted)]" style={{ left: `${(REPORT_MS / HORIZON) * 100}%` }} />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]">
                  <span>0 s</span>
                  <span>migration at 1 s · report ends at {REPORT_MS / 1000} s</span>
                  <span>{HORIZON / 1000} s</span>
                </div>
                <p className="mt-2 text-xs" style={{ color: hurt ? "var(--bad)" : "var(--good)" }}>
                  peak {Math.max(...sim.waitingSeries)} queued · longest wait {secs(sim.maxWait)} · {sim.over1s.toLocaleString("en-US")} waited over 1 s
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO({ ...NAIVE, op: o.op })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Run it as written
                </button>
                <button type="button" onClick={() => setO({ ...TUNED, op: o.op })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Safe migration
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Migrating…">
                Deploy the migration
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Know which lock the change takes" what="Every DDL statement takes a table lock. ACCESS EXCLUSIVE blocks even SELECT; SHARE blocks writes; SHARE UPDATE EXCLUSIVE blocks neither. Some changes also rewrite or scan the whole table while holding it." accent={ACCENT} active={at(0)}>
                <Choices<Op> accent={ACCENT} value={o.op} onChange={(v) => set({ op: v })} options={(Object.keys(OPS) as Op[]).map((id) => ({ id, label: OPS[id].label }))} />
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">{o.safe ? info.safeSql : info.sql}</pre>
                <p className="font-mono text-xs">
                  {lock} · blocks reads: {b.reads ? "yes" : "no"} · blocks writes: {b.writes ? "yes" : "no"} · {work === "none" ? "catalog only" : work}
                </p>
              </FlowStep>
              <FlowArrow label="needs the lock" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Wait for the lock, and make everyone wait" what="Locks are granted in arrival order. A waiting ACCESS EXCLUSIVE request conflicts with everything, so queries that arrive after it queue behind it, even though they don't conflict with the report holding the table." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs" style={{ color: hurt ? "var(--bad)" : "var(--good)" }}>
                  {sim.over1s.toLocaleString("en-US")} of {sim.total.toLocaleString("en-US")} app queries waited over 1 s · longest {secs(sim.maxWait)}
                </p>
              </FlowStep>
              <FlowArrow label="give up quickly" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Set lock_timeout and retry" what="SET lock_timeout makes the migration fail fast if it can't get its lock, so it never sits at the head of the queue for long. Retry it a moment later, in a loop, until the long query is gone." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.timeout} onChange={(e) => set({ timeout: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  SET lock_timeout before the statement
                </label>
                {o.timeout && <Slider label="lock_timeout" value={o.lockTimeout} min={100} max={3000} step={100} format={(v) => secs(v)} onChange={(v) => set({ lockTimeout: v })} accent={ACCENT} />}
                <ol className="space-y-0.5 font-mono text-[11px]">
                  {sim.attempts.map((x, i) => (
                    <li key={i} style={{ color: x.ok ? "var(--good)" : "var(--muted)" }}>
                      try {i + 1} at {secs(x.at)}: {x.result}
                    </li>
                  ))}
                  {!sim.attempts.length && <li className="text-[var(--bad)]">still waiting when the chart ends</li>}
                </ol>
              </FlowStep>
              <FlowArrow label="lock granted" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Hold strong locks for milliseconds" what="Rewrites, full-table validation and plain CREATE INDEX hold their lock for as long as the work takes, which grows with the table. Each has a safer form that does the slow part under a weak lock." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.safe} onChange={(e) => set({ safe: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Safer form: {info.safeLabel}
                </label>
                <Slider label="Rows in orders" value={o.rowsExp} min={5} max={8} step={0.5} format={(v) => Math.round(Math.pow(10, v)).toLocaleString("en-US")} onChange={(v) => set({ rowsExp: v })} accent={ACCENT} />
                <p className="text-xs" style={{ color: hold > 1000 && (b.reads || b.writes) ? "var(--bad)" : "var(--good)" }}>
                  {lock} held {secs(hold)}: {info.safeNote}.
                </p>
              </FlowStep>
              <FlowArrow label="fill in old rows" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Backfill in small batches" what="Filling a new column on existing rows with one UPDATE is one huge transaction: every row locked, a burst of WAL for replicas to chew through, and dead rows for vacuum. Small batches with a pause between keep each transaction short." accent={ACCENT} active={at(4)}>
                <Choices<string> accent={ACCENT} value={String(o.batch)} onChange={(v) => set({ batch: Number(v) })} options={[{ id: "0", label: "One UPDATE" }, { id: "1000", label: "Batches of 1,000" }, { id: "10000", label: "Batches of 10,000" }]} />
                <p className="font-mono text-xs">
                  {bf.statements.toLocaleString("en-US")} statement{bf.statements === 1 ? "" : "s"} · longest transaction {secs(Math.round(bf.longestTxnS * 1000))} · {bf.rowsLockedAtOnce.toLocaleString("en-US")} rows locked at once · {secs(Math.round(bf.totalS * 1000))} total
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The lock queue is simulated a millisecond at a time with Postgres&apos;s table-lock conflict rules; which lock each statement takes follows the Postgres docs. Rewrite, scan and build speeds are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
