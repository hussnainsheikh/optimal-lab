"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { DEFAULT_OPTS, deadlockTxns, simulate, type DeadlockScenario } from "@/lib/rowLocks";
import { LockTimeline } from "../row-locks/LockTimeline";

const ACCENT = "var(--db)";

type Opts = { scenario: DeadlockScenario; fixed: boolean; deadlockTimeout: number; retry: boolean };
const NAIVE: Opts = { scenario: "transfers", fixed: false, deadlockTimeout: 1000, retry: false };
const TUNED: Opts = { scenario: "transfers", fixed: true, deadlockTimeout: 1000, retry: true };

const SCENARIOS: Record<DeadlockScenario, { label: string; fix: string; why: string }> = {
  transfers: { label: "Two transfers", fix: "Lock accounts in id order", why: "T1 moves money 1 → 2 and T2 moves it 2 → 1, each locking the sender first." },
  three: { label: "A ring of three", fix: "Lock accounts in id order", why: "T1 locks 1 then 2, T2 locks 2 then 3, T3 locks 3 then 1." },
  upgrade: { label: "Share, then update", fix: "Take FOR NO KEY UPDATE up front", why: "Both read the same row FOR SHARE (shared locks don't conflict), then both try to update it." },
};

/** The wait-for graph: one circle per transaction, an arrow from each waiter to the one it waits for. */
function WaitForGraph({ ids, edges, victim }: { ids: string[]; edges: [string, string, string][]; victim: string | null }) {
  const pos = (i: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / ids.length;
    return [100 + 58 * Math.cos(a), 78 + 52 * Math.sin(a)];
  };
  const p = Object.fromEntries(ids.map((id, i) => [id, pos(i)]));
  return (
    <svg viewBox="0 0 200 156" className="h-40 w-full max-w-xs" role="img" aria-label={edges.length ? `Wait-for graph: ${edges.map(([a, b, r]) => `${a} waits for ${b} on ${r}`).join("; ")}` : "Wait-for graph: no waits"}>
      <defs>
        <marker id="dl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--bad)" />
        </marker>
      </defs>
      {edges.map(([a, b, r], i) => {
        const [x1, y1] = p[a];
        const [x2, y2] = p[b];
        const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
        // Bend each arrow to its left so a pair waiting on each other shows two arrows.
        const nx = -dy / len, ny = dx / len;
        const sx = x1 + (dx / len) * 20, sy = y1 + (dy / len) * 20, ex = x2 - (dx / len) * 22, ey = y2 - (dy / len) * 22;
        const cx = (sx + ex) / 2 + nx * 16, cy = (sy + ey) / 2 + ny * 16;
        return (
          <g key={i}>
            <path d={`M${sx} ${sy} Q${cx} ${cy} ${ex} ${ey}`} fill="none" stroke="var(--bad)" strokeWidth="1.5" markerEnd="url(#dl-arrow)" />
            <text x={cx + nx * 8} y={cy + ny * 8} fontSize="8" textAnchor="middle" fill="var(--muted)">{r}</text>
          </g>
        );
      })}
      {ids.map((id) => (
        <g key={id}>
          <circle cx={p[id][0]} cy={p[id][1]} r="17" fill="var(--panel)" stroke={id === victim ? "var(--bad)" : "var(--db)"} strokeWidth={id === victim ? 2.5 : 1.5} />
          <text x={p[id][0]} y={p[id][1] + 4} fontSize="11" textAnchor="middle" fill="var(--text)" fontFamily="var(--font-mono)">{id}</text>
        </g>
      ))}
    </svg>
  );
}

export default function DbDeadlocksDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const txns = deadlockTxns(o.scenario, o.fixed);
  const sim = simulate(txns, { ...DEFAULT_OPTS, deadlockTimeout: o.deadlockTimeout, retry: o.retry });
  const dl = sim.deadlocks[0] ?? null;
  const sc = SCENARIOS[o.scenario];
  const failed = sim.outcomes.filter((x) => x.error);
  const committed = sim.outcomes.filter((x) => x.committedAt !== null);
  const ids = txns.map((t) => t.id);
  const lockRows = [...new Set(txns.flatMap((t) => t.steps.map((s) => s.row)))];

  const nodes: MapNode[] = [
    ...txns.map((t, i) => {
      const out = sim.outcomes[i];
      return { id: t.id, label: t.id, sub: out.error ? "aborted" : out.attempts > 1 ? `retried, done at ${out.committedAt} ms` : `done at ${out.committedAt} ms`, at: [14, ids.length === 2 ? 28 + i * 44 : 16 + i * 34] as [number, number], mobileAt: [ids.length === 2 ? 28 + i * 44 : 16 + i * 34, 12] as [number, number], state: (out.error ? "bad" : out.attempts > 1 ? "wait" : "good") as MapNode["state"] };
    }),
    { id: "rows", label: "accounts", sub: lockRows.join(" · "), at: [50, 50], mobileAt: [50, 45], state: dl ? "bad" : "good" },
    { id: "det", label: "Deadlock detector", sub: dl ? `cycle at ${dl.at} ms` : "no cycle", at: [86, 28], mobileAt: [25, 82], state: dl ? "bad" : "good" },
    { id: "app", label: "App", sub: o.retry ? "retries 40P01" : "shows an error", at: [86, 76], mobileAt: [75, 82], state: failed.length ? "bad" : "good" },
  ];
  const links = [
    ...txns.map((t) => ({ from: t.id, to: "rows", label: "UPDATE" })),
    { from: "rows", to: "det", label: "wait-for graph", dim: !dl },
    { from: "det", to: "app", label: "40P01", dim: !dl },
  ];

  const packets: Packet[] =
    stage === 0 ? txns.flatMap((t, i) => hops(`l${i}`, [t.id, "rows"], { label: t.steps[0].row }))
    : stage === 1 ? txns.flatMap((t, i) => hops(`w${i}`, [t.id, "rows"], { label: t.steps[1].row, tone: dl ? "bad" : "good" }))
    : stage === 2 ? hops("d", ["rows", "det"], { label: dl ? "cycle!" : "no cycle", tone: dl ? "bad" : "good" })
    : stage === 3 ? (dl ? hops("v", ["det", dl.victim], { label: "abort", tone: "bad" }) : [])
    : stage === 4 ? hops("r", ["det", "app"], { label: o.retry ? "retry" : "error", tone: failed.length ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: ${sc.why}${o.fixed ? ` With the fix, ${o.scenario === "upgrade" ? "each takes the strong lock first" : "every transaction locks the lower id first"}.` : ""}`,
    dl ? `Step 2: ${dl.edges.map(([a, b, r]) => `${a} waits for ${b} (${r})`).join(", ")}: nobody can move.` : "Step 2: one transaction waits for the other, then goes on: a wait, not a deadlock.",
    dl ? `Step 3: after deadlock_timeout (${o.deadlockTimeout} ms) of waiting, ${dl.victim} checks the wait-for graph and finds the cycle ${[...dl.cycle, dl.cycle[0]].join(" → ")}.` : "Step 3: the detector would only run after deadlock_timeout, and there's no cycle to find.",
    dl ? `Step 4: ${dl.victim} is rolled back with ERROR: deadlock detected (SQLSTATE 40P01), releasing its locks so the others continue.` : "Step 4: nobody is aborted.",
    failed.length ? `Step 5: the app shows the error: ${failed.map((f) => f.txn).join(", ")} never happened.` : `Step 5: all ${committed.length} transactions committed by ${sim.end} ms${dl ? `, ${dl.victim} on its second attempt` : ""}.`,
  ];
  const caption = stage !== null ? captions[stage] : dl ? `Deadlock at ${dl.at} ms: ${dl.victim} aborted${o.retry ? " and retried" : ""} · finished at ${sim.end} ms.` : `No deadlock · finished at ${sim.end} ms.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Deadlocks"
        blurb="Two transactions each hold a row the other needs, so both wait forever. The database can't prevent this, but it notices: after deadlock_timeout it looks for a cycle in who waits for whom and aborts one transaction. Make deadlocks, watch the detector, then remove the cause."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap title="Transactions lock account rows; the deadlock detector reads the wait-for graph and aborts a victim; the app retries" accent={ACCENT} chrome="split" nodes={nodes} links={links} packets={packets} aspect={1.8} mobileAspect={0.9} />
              <section className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:grid-cols-[auto_1fr] sm:items-center" aria-label="Wait-for graph at the check">
                <WaitForGraph ids={ids} edges={dl?.edges ?? []} victim={dl?.victim ?? null} />
                <div className="min-w-0 text-xs">
                  <p className="font-mono uppercase tracking-[0.16em] text-[var(--faint)]">Wait-for graph</p>
                  <p className="mt-1 text-[var(--muted)]">
                    {dl ? `At ${dl.at} ms: ${dl.edges.map(([a, b, r]) => `${a} → ${b} (wants ${r})`).join(", ")}. A cycle means nobody can ever proceed.` : "No cycle: every waiter is waiting for someone who can finish."}
                  </p>
                </div>
              </section>
              <LockTimeline lanes={txns.map((t) => ({ id: t.id, label: t.id }))} segs={sim.segs} end={sim.end} title={`${sc.label} · timeline`} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices<DeadlockScenario> accent={ACCENT} value={o.scenario} onChange={(v) => set({ scenario: v })} options={(Object.keys(SCENARIOS) as DeadlockScenario[]).map((id) => ({ id, label: SCENARIOS[id].label }))} />
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO({ ...NAIVE, scenario: o.scenario })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  As written
                </button>
                <button type="button" onClick={() => setO({ ...TUNED, scenario: o.scenario })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Ordered, with retry
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Running…">
                Run the transactions
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Lock rows one statement at a time" what="Each UPDATE locks its row and keeps it until COMMIT. A transaction that touches two rows holds the first while it asks for the second." accent={ACCENT} active={at(0)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.fixed} onChange={(e) => set({ fixed: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  {sc.fix}
                </label>
                <ul className="space-y-1 font-mono text-[11px]">
                  {txns.map((t) => (
                    <li key={t.id}>
                      <span className="text-[var(--text)]">{t.id}</span>{" "}
                      <span className="text-[var(--muted)]">{t.steps.map((s) => s.sql).join("; ")}</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="each holds one, wants another" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Wait for each other" what="A wait is normal: the holder commits and the waiter goes on. A deadlock is a wait that loops back: T1 waits for T2, which waits for T1. Nobody in the loop can ever commit." accent={ACCENT} active={at(1)}>
                <ol className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-[11px]">
                  {sim.log.map((l, i) => (
                    <li key={i} style={{ color: l.bad ? "var(--bad)" : "var(--muted)" }}>
                      {String(l.t).padStart(4, " ")} ms {l.txn}: {l.text}
                    </li>
                  ))}
                </ol>
              </FlowStep>
              <FlowArrow label={`after ${o.deadlockTimeout} ms of waiting`} accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Look for a cycle" what="Checking for deadlocks means walking the whole wait-for graph, so Postgres doesn't do it on every wait. A transaction that has waited deadlock_timeout (1 s by default) runs the check. Most waits end sooner." accent={ACCENT} active={at(2)}>
                <Slider label="deadlock_timeout" value={o.deadlockTimeout} min={100} max={2000} step={100} format={(v) => `${v} ms`} onChange={(v) => set({ deadlockTimeout: v })} accent={ACCENT} />
                <p className="font-mono text-xs" style={{ color: dl ? "var(--bad)" : "var(--good)" }}>
                  {dl ? `cycle: ${[...dl.cycle, dl.cycle[0]].join(" → ")}, found at ${dl.at} ms` : "no cycle"}
                </p>
              </FlowStep>
              <FlowArrow label={dl ? `abort ${dl.victim}` : "nothing to abort"} accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Abort one transaction" what="The transaction that found the cycle is rolled back with SQLSTATE 40P01, and its locks are released so the rest of the cycle can finish. Its work is lost unless the app runs it again." accent={ACCENT} active={at(3)}>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed" style={{ color: dl ? "var(--bad)" : "var(--muted)" }}>
                  {dl
                    ? `ERROR:  deadlock detected\nDETAIL: ${dl.edges.map(([a, b]) => `${a} waits for a lock held by ${b}`).join(";\n        ")}.\nHINT:   See server log for query details.`
                    : "(no error)"}
                </pre>
              </FlowStep>
              <FlowArrow label="40P01 reaches the app" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Retry, then remove the cause" what="A deadlock error is safe to retry: the whole transaction was rolled back. But the lasting fix is to stop the cycle forming: lock rows in the same order everywhere, or take the strongest lock you'll need first." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.retry} onChange={(e) => set({ retry: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Retry on 40P01
                </label>
                <p className="font-mono text-xs" style={{ color: failed.length ? "var(--bad)" : "var(--good)" }}>
                  {committed.length} of {txns.length} committed by {sim.end} ms{failed.length ? ` · lost: ${failed.map((f) => f.txn).join(", ")}` : ""}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Locks, waits and the cycle search are simulated millisecond by millisecond; statement times are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
