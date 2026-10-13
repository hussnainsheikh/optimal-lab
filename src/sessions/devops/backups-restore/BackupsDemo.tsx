"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { clock, DISASTER, evaluate, STRATEGIES, type Strategy } from "@/lib/backupsRpo";

const ACCENT = "var(--ops)";
const X = (h: number) => `${(h / 24) * 100}%`;

export default function BackupsDemo() {
  const [s, setS] = useState<Strategy>("nightly");
  const e = evaluate(s);
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Backups, RPO and RTO" blurb={`At ${clock(DISASTER)} a bad migration drops the orders table. Two numbers decide how bad the day gets: RPO, how much data you lose (back to your last restore point), and RTO, how long you're down while restoring.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Timeline">
              <div className="relative mt-6 h-10 rounded bg-[var(--inset)]">
                {s === "pitr" ? <span className="absolute inset-y-2 rounded" style={{ left: 0, width: X(DISASTER), background: ACCENT, opacity: 0.35 }} /> : e.points.map((h) => <span key={h} className="absolute inset-y-1 w-1 rounded" style={{ left: X(h), background: ACCENT }} />)}
                <span className="absolute inset-y-0 rounded" style={{ left: X(e.restorePoint), width: X(DISASTER - e.restorePoint), background: "var(--bad)", opacity: 0.5 }} />
                <span className="absolute -top-5 -translate-x-1/2 font-mono text-[10px] text-[var(--bad)]" style={{ left: X(DISASTER) }}>drop table at {clock(DISASTER)}</span>
                <span className="absolute inset-y-0 w-0.5 bg-[var(--bad)]" style={{ left: X(DISASTER) }} />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>00:00</span><span>12:00</span><span>24:00</span></div>
              <p className="mt-1 text-xs text-[var(--muted)]">{s === "pitr" ? "Shaded: every moment is restorable." : "Ticks: restore points."} Red: data lost.</p>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {[["Restore to", clock(e.restorePoint)], ["RPO (data lost)", e.lostH < 0.1 ? "~seconds" : `${e.lostH.toFixed(1)} h`], ["RTO (downtime)", `~${e.rtoMin} min`]].map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono text-lg">{v}</dd></div>)}
              </dl>
              <p className="mt-3 font-mono text-sm" style={{ color: e.lostOrders > 1000 ? "var(--bad)" : e.lostOrders > 100 ? "var(--auto)" : "var(--good)" }}>~{e.lostOrders.toLocaleString()} orders lost</p>
            </section>
          }
          panel={<SystemMapPanel caption={s === "nightly" ? "The last backup is from 02:00, so twelve and a half hours of orders are gone, and restoring a full dump is slow." : s === "hourly" ? "Snapshots every hour: you lose up to an hour (here 30 minutes), and snapshot restores are quick." : "Base backups plus a continuous stream of the WAL let you restore to 14:29:59, just before the DROP. Replaying the log takes a while."}><Choices label="Backup strategy" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="RPO: how much can you lose?" what="The gap between the last restorable point and the disaster. Set it with the business: an hour of orders? A minute?" accent={ACCENT}><p className="text-sm text-[var(--muted)]">Recovery Point Objective.</p></FlowStep>
              <FlowArrow label="and" accent={ACCENT} />
              <FlowStep n={2} title="RTO: how long can you be down?" what="Time to provision, restore, replay and verify. Big databases take hours to restore from scratch." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Recovery Time Objective.</p></FlowStep>
              <FlowArrow label="replicas aren't backups" accent={ACCENT} />
              <FlowStep n={3} title="Replication copies mistakes too" what="A DROP TABLE reaches every replica in milliseconds. Only point-in-time backups take you back before the mistake." accent={ACCENT} active={s === "pitr"}><p className="text-sm text-[var(--muted)]">Keep copies in another account and region.</p></FlowStep>
              <FlowArrow label="the real test" accent={ACCENT} />
              <FlowStep n={4} title="An untested backup is a hope" what="Restore regularly into a scratch environment, time it, and check the data. That's your real RTO." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Automate the restore drill.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
