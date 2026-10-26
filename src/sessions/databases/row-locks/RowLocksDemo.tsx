"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { DEFAULT_OPTS, MODE_SQL, conflicts, fkTxns, jobQueue, simulate, ticketTxns, type Mode, type Policy, type Scenario } from "@/lib/rowLocks";
import { LockTimeline } from "./LockTimeline";

const ACCENT = "var(--db)";
const MODES: Mode[] = ["keyShare", "share", "noKeyUpdate", "update"];

type Opts = { scenario: Scenario; hold: number; policy: Policy; lockTimeout: number; adminMode: Mode; skipLocked: boolean };
const NAIVE: Opts = { scenario: "queue", hold: 400, policy: "wait", lockTimeout: 100, adminMode: "update", skipLocked: false };
const TUNED: Opts = { scenario: "queue", hold: 400, policy: "wait", lockTimeout: 100, adminMode: "noKeyUpdate", skipLocked: true };

const SCENARIO_TEXT: Record<Scenario, { title: string; a: string; others: string; row: string }> = {
  ticket: { title: "Three buyers, one seat", a: "Buyer A", others: "Buyers B and C", row: "seat 14C" },
  fk: { title: "Orders for a customer someone is editing", a: "Admin", others: "Two checkouts", row: "customer 7" },
  queue: { title: "Three workers, one jobs table", a: "Worker 1", others: "Workers 2 and 3", row: "jobs" },
};

export default function RowLocksDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const isQueue = o.scenario === "queue";
  const txns = o.scenario === "fk" ? fkTxns(o.hold, o.adminMode) : ticketTxns(o.hold);
  const sim = simulate(txns, { ...DEFAULT_OPTS, policy: o.policy, lockTimeout: o.lockTimeout });
  const q = jobQueue(o.skipLocked, o.hold);
  const text = SCENARIO_TEXT[o.scenario];
  const aMode = isQueue ? "update" : txns[0].steps[0].mode;
  const bMode = isQueue ? "update" : txns[1].steps[0].mode;
  const clash = conflicts(bMode, aMode);
  const failed = sim.outcomes.filter((x) => x.error);
  const waited = isQueue ? q.waited : sim.outcomes.reduce((s, x) => s + x.waited, 0);
  const end = isQueue ? q.end : sim.end;

  const lanes = isQueue ? q.perWorker.map((w) => ({ id: w.id, label: `${w.id} · ${w.jobs} job${w.jobs === 1 ? "" : "s"}` })) : txns.map((t, i) => ({ id: t.id, label: i === 0 ? text.a : o.scenario === "fk" ? `Checkout ${t.id}` : `Buyer ${t.id}` }));
  const segs = isQueue ? q.segs : sim.segs;

  const nodes: MapNode[] = isQueue
    ? [
        ...q.perWorker.map((w, i) => ({ id: `t${i}`, label: `Worker ${i + 1}`, sub: `${w.jobs} job${w.jobs === 1 ? "" : "s"} done`, at: [14, 18 + i * 32] as [number, number], mobileAt: [18 + i * 32, 14] as [number, number], state: (w.jobs ? "good" : "wait") as MapNode["state"] })),
        { id: "pg", label: "Postgres", sub: `${(q.waited / 1000).toFixed(1)} s waited`, at: [50, 50], mobileAt: [50, 50], state: q.waited ? "wait" : "good" },
        { id: "row", label: "jobs table", sub: `6 jobs in ${(q.end / 1000).toFixed(1)} s`, at: [86, 50], mobileAt: [50, 86], state: q.waited ? "bad" : "good" },
      ]
    : [
        ...txns.map((t, i) => {
          const out = sim.outcomes[i];
          return { id: `t${i}`, label: lanes[i].label, sub: out.error ? "error" : out.waited ? `waited ${out.waited} ms` : "no wait", at: [14, 18 + i * 32] as [number, number], mobileAt: [18 + i * 32, 14] as [number, number], state: (out.error ? "bad" : out.waited ? "wait" : "good") as MapNode["state"] };
        }),
        { id: "pg", label: "Lock manager", sub: MODE_SQL[aMode], at: [50, 50], mobileAt: [50, 50], state: clash ? "wait" : "good" },
        { id: "row", label: text.row, sub: `held ${o.hold} ms`, at: [86, 50], mobileAt: [50, 86], state: "active" },
      ];

  const packets: Packet[] =
    stage === 0 ? hops("a", ["t0", "pg", "row"], { label: MODE_SQL[aMode] })
    : stage === 1 ? hops("b", ["t1", "pg"], { label: MODE_SQL[bMode], tone: clash ? "bad" : "good" })
    : stage === 2 ? [...hops("w1", ["t1", "pg"], { label: waited ? "waiting" : "granted", tone: waited ? "bad" : "good" }), ...hops("w2", ["t2", "pg"], { label: waited ? "waiting" : "granted", tone: waited ? "bad" : "good" })]
    : stage === 3 ? hops("p", ["pg", "t1"], { label: isQueue ? (o.skipLocked ? "SKIP LOCKED" : "same row") : o.policy === "wait" ? "keep waiting" : o.policy === "nowait" ? "NOWAIT error" : "lock_timeout", tone: (isQueue ? o.skipLocked : !failed.length) ? "good" : "bad" })
    : stage === 4 ? hops("c", ["t0", "pg"], { label: "COMMIT", tone: "good" })
    : [];

  const captions = isQueue
    ? [
        "Step 1: each worker runs SELECT … WHERE status = 'pending' ORDER BY id LIMIT 1 FOR UPDATE to claim the oldest job.",
        "Step 2: all three ask for the same oldest row at the same moment. FOR UPDATE conflicts with FOR UPDATE, so only one gets it.",
        o.skipLocked ? "Step 3: with SKIP LOCKED nobody waits: each worker skips rows another has locked and takes the next one." : `Step 3: the other two queue behind worker 1. When it commits, the row is no longer pending, so their query returns nothing and they poll again: ${(q.waited / 1000).toFixed(1)} s of waiting in total.`,
        o.skipLocked ? "Step 4: SKIP LOCKED turns one hot row into a queue: three workers, three different jobs at once." : "Step 4: by the time the others poll again, worker 1 has already locked the next job. It ends up doing all six.",
        `Step 5: locks are released only at COMMIT. Six ${o.hold} ms jobs took ${(q.end / 1000).toFixed(1)} s.`,
      ]
    : [
        `Step 1: ${text.a} runs ${txns[0].steps[0].sql}, taking a ${MODE_SQL[aMode]} lock on ${text.row} for ${o.hold} ms.`,
        `Step 2: ${text.others} ask for ${MODE_SQL[bMode]}. ${clash ? `That conflicts with ${MODE_SQL[aMode]}.` : `That doesn't conflict with ${MODE_SQL[aMode]}, so they go straight through.`}`,
        waited ? `Step 3: they queue in arrival order and wait ${waited} ms in total.` : "Step 3: nobody waits.",
        failed.length ? `Step 4: ${failed.length} transaction${failed.length === 1 ? "" : "s"} gave up: ${failed[0].error}.` : `Step 4: ${o.policy === "wait" ? "the default waits as long as it takes" : "nobody hit the limit"}.`,
        `Step 5: COMMIT releases every lock the transaction holds; everything finished at ${sim.end} ms.`,
      ];
  const caption = stage !== null ? captions[stage] : isQueue ? `6 jobs in ${(q.end / 1000).toFixed(1)} s · ${(q.waited / 1000).toFixed(1)} s spent waiting · ${q.emptyPolls} empty polls.` : `${waited} ms spent waiting · ${failed.length} error${failed.length === 1 ? "" : "s"} · done at ${sim.end} ms.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Row locks and lock waits"
        blurb="Writing a row locks it until the transaction ends, and SELECT … FOR UPDATE does the same before you write. Anyone who needs a conflicting lock waits in line. Watch who waits for whom with Postgres's four row-lock modes, then stop waiting with NOWAIT, lock_timeout or SKIP LOCKED."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Three transactions ask the lock manager for the same row"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "t0", to: "pg", label: "lock" },
                  { from: "t1", to: "pg", label: "lock" },
                  { from: "t2", to: "pg", label: "lock" },
                  { from: "pg", to: "row", label: "rows" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.9}
              />
              <LockTimeline lanes={lanes} segs={segs} end={end} title={`${text.title} · timeline`} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices<Scenario>
                accent={ACCENT}
                value={o.scenario}
                onChange={(v) => set({ scenario: v })}
                options={[{ id: "queue", label: "Job queue" }, { id: "ticket", label: "Last seat" }, { id: "fk", label: "Foreign key" }]}
              />
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Plain FOR UPDATE
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  SKIP LOCKED
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Locking…">
                Run the transactions
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Take a row lock" what="UPDATE and DELETE lock the rows they change. SELECT … FOR UPDATE (or a weaker mode) locks rows you only read, so nobody changes them before you write. The lock lives until COMMIT or ROLLBACK, not until the statement ends." accent={ACCENT} active={at(0)}>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">
                  {isQueue
                    ? `BEGIN;\nSELECT id FROM jobs\n WHERE status = 'pending'\n ORDER BY id LIMIT 1\n FOR UPDATE${o.skipLocked ? " SKIP LOCKED" : ""};\n-- run the job, then\nUPDATE jobs SET status = 'done' WHERE id = $1;\nCOMMIT;`
                    : `BEGIN;\n${txns[0].steps[0].sql};\n-- ${o.hold} ms of work\nCOMMIT;`}
                </pre>
                <Slider label={isQueue ? "Time per job" : `${text.a} holds the lock for`} value={o.hold} min={100} max={1000} step={50} format={(v) => `${v} ms`} onChange={(v) => set({ hold: v })} accent={ACCENT} />
              </FlowStep>
              <FlowArrow label="someone else wants the row" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Check the request against the held lock" what="Postgres has four row-lock modes. A plain UPDATE that doesn't touch a key takes FOR NO KEY UPDATE; a foreign-key check takes FOR KEY SHARE on the parent row. Two requests only wait for each other when their modes conflict." accent={ACCENT} active={at(1)}>
                {o.scenario === "fk" && (
                  <Choices<Mode> accent={ACCENT} value={o.adminMode} onChange={(v) => set({ adminMode: v })} options={[{ id: "noKeyUpdate", label: "Admin: UPDATE … SET email" }, { id: "update", label: "Admin: SELECT … FOR UPDATE" }]} />
                )}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[19rem] border-collapse font-mono text-[10px]">
                    <thead>
                      <tr>
                        <th className="p-1 text-left font-normal text-[var(--faint)]">asks ↓ / holds →</th>
                        {MODES.map((m) => (
                          <th key={m} className="p-1 font-normal text-[var(--muted)]" style={{ outline: m === aMode ? `1px solid ${ACCENT}` : undefined }}>{MODE_SQL[m].replace("FOR ", "")}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODES.map((r) => (
                        <tr key={r}>
                          <th className="p-1 text-left font-normal text-[var(--muted)]" style={{ outline: r === bMode ? `1px solid ${ACCENT}` : undefined }}>{MODE_SQL[r].replace("FOR ", "")}</th>
                          {MODES.map((h) => {
                            const x = conflicts(r, h);
                            const here = r === bMode && h === aMode;
                            return (
                              <td key={h} className="p-1 text-center" style={{ color: x ? "var(--bad)" : "var(--good)", background: here ? "color-mix(in srgb, var(--db) 22%, transparent)" : undefined, fontWeight: here ? 700 : 400 }}>
                                {x ? "wait" : "ok"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FlowStep>
              <FlowArrow label={clash ? "conflict: queue" : "no conflict"} accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Wait in line" what="Conflicting requests queue in arrival order. In pg_stat_activity they show wait_event_type = 'Lock'; pg_locks and pg_blocking_pids() say who they're waiting for." accent={ACCENT} active={at(2)}>
                <ol className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-[11px]">
                  {(isQueue ? [] : sim.log).map((l, i) => (
                    <li key={i} style={{ color: l.bad ? "var(--bad)" : "var(--muted)" }}>
                      {String(l.t).padStart(4, " ")} ms {lanes[txns.findIndex((t) => t.id === l.txn)]?.label}: {l.text}
                    </li>
                  ))}
                  {isQueue && q.perWorker.map((w) => <li key={w.id} className="text-[var(--muted)]">{w.id}: {w.jobs} job{w.jobs === 1 ? "" : "s"}</li>)}
                </ol>
                <p className="font-mono text-xs" style={{ color: waited ? "var(--bad)" : "var(--good)" }}>
                  {(waited / 1000).toFixed(2)} s spent waiting
                </p>
              </FlowStep>
              <FlowArrow label="how long to wait?" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Decide how long to wait" what="By default a transaction waits forever. NOWAIT fails at once; lock_timeout fails after a limit; both raise an error the app must handle. SKIP LOCKED doesn't wait at all: it skips rows someone else holds, which is how a jobs table becomes a queue." accent={ACCENT} active={at(3)}>
                {isQueue ? (
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" checked={o.skipLocked} onChange={(e) => set({ skipLocked: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                    FOR UPDATE SKIP LOCKED
                  </label>
                ) : (
                  <>
                    <Choices<Policy> accent={ACCENT} value={o.policy} onChange={(v) => set({ policy: v })} options={[{ id: "wait", label: "Wait (default)" }, { id: "nowait", label: "NOWAIT" }, { id: "timeout", label: "lock_timeout" }]} />
                    {o.policy === "timeout" && <Slider label="lock_timeout" value={o.lockTimeout} min={50} max={500} step={25} format={(v) => `${v} ms`} onChange={(v) => set({ lockTimeout: v })} accent={ACCENT} />}
                    {failed.map((f) => (
                      <p key={f.txn} className="font-mono text-[11px] text-[var(--bad)]">{lanes[txns.findIndex((t) => t.id === f.txn)].label}: ERROR: {f.error}</p>
                    ))}
                  </>
                )}
              </FlowStep>
              <FlowArrow label="COMMIT" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Release everything at COMMIT" what="Row locks are only released when the transaction ends. Every millisecond of work inside the transaction, like calling a payment API, is a millisecond everyone behind you waits. Keep slow work outside the transaction." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs">
                  {isQueue
                    ? `6 jobs × ${o.hold} ms with 3 workers: ${(q.end / 1000).toFixed(1)} s (best possible ${((Math.ceil(6 / 3) * o.hold) / 1000).toFixed(1)} s)`
                    : `finished at ${sim.end} ms · ${sim.outcomes.filter((x) => x.committedAt !== null).length} committed · ${failed.length} failed`}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The lock queue is simulated millisecond by millisecond with Postgres&apos;s row-lock conflict table; work times are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
