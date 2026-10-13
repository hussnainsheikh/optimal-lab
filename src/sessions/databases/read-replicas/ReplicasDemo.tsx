"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, Slider } from "@/components/session/ui";
import { LAG, MODES, run, type Mode } from "@/lib/replicas";

const ACCENT = "var(--db)";

export default function ReplicasDemo() {
  const [mode, setMode] = useState<Mode>("any");
  const [at, setAt] = useState(200);
  const r = run(mode, at);
  return (
    <SessionPage>
      <SessionHeader kicker="Databases · interactive" title="Read replicas and replication lag" blurb="Writes go to the primary; reads are spread across replicas that copy its log a moment later. Ada renames herself and the page reloads straight away. Does she see her new name?" />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Primary and replicas">
              <div className="grid gap-2 sm:grid-cols-3">
                {[{ name: "primary", lag: 0 }, { name: "replica 1", lag: LAG[0] }, { name: "replica 2", lag: LAG[1] }].map((n) => {
                  const has = at >= n.lag; const serving = r.source === n.name;
                  return (
                    <div key={n.name} className="rounded-lg border-2 p-2.5" style={{ borderColor: serving ? ACCENT : "var(--line)", background: "var(--inset)" }}>
                      <p className="text-sm font-medium">{n.name}</p>
                      <p className="font-mono text-[11px] text-[var(--faint)]">{n.lag ? `lags ${n.lag} ms` : "takes the write at 0 ms"}</p>
                      <p className="mt-1 font-mono text-sm" style={{ color: has ? "var(--good)" : "var(--auto)" }}>name = &quot;{has ? "Ada Lovelace" : "Ada"}&quot;</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-lg border-2 p-3" style={{ borderColor: r.fresh ? "var(--good)" : "var(--bad)" }}>
                <p className="font-mono text-xs text-[var(--faint)]">profile page, read at {at} ms · served by {r.source} in {r.latency} ms</p>
                <p className="mt-1 text-lg">Hello, {r.value}</p>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={r.note}>
              <Choices label="Route reads to" accent={ACCENT} value={mode} onChange={setMode} options={MODES} />
              <Slider label="Read after the write" accent={ACCENT} value={at} min={100} max={1500} step={100} format={(v) => `${v} ms`} onChange={setAt} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Replicas scale reads" what="Each replica streams the primary's write-ahead log and applies it. Add more for more read capacity." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Writes still all go to one primary.</p></FlowStep>
              <FlowArrow label="asynchronous" accent={ACCENT} />
              <FlowStep n={2} title="They're always a little behind" what="Usually milliseconds; under load or a long query, seconds or more. Reads can go back in time between replicas." accent={ACCENT} active={mode === "any" && !r.fresh}><p className="text-sm text-[var(--muted)]">Monitor replication lag.</p></FlowStep>
              <FlowArrow label="fix the user's view" accent={ACCENT} />
              <FlowStep n={3} title="Read your own writes" what="After a user writes, send their reads to the primary for a short time, or wait until the replica has applied their write's log position." accent={ACCENT} active={mode !== "any"}><p className="font-mono text-xs">pg_last_wal_replay_lsn() ≥ write LSN</p></FlowStep>
              <FlowArrow label="where staleness is fine" accent={ACCENT} />
              <FlowStep n={4} title="Pick per query" what="Dashboards, search and other users' content tolerate a little lag. Balances, permissions and “did my edit save?” don't." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Synchronous replicas trade write latency for zero lag.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
