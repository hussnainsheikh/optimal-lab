"use client";

import { useMemo, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { HOURS, IDLE_TIMEOUT_MIN, LONG_TXN, ROWS, THRESHOLD, hhmm, simulate, trigger } from "@/lib/vacuumBloat";

const ACCENT = "var(--db)";

type Opts = { updatesPerS: number; scaleFactor: number; longTxn: boolean; idleTimeout: boolean };
const NAIVE: Opts = { updatesPerS: 2000, scaleFactor: 0.2, longTxn: true, idleTimeout: false };
const TUNED: Opts = { updatesPerS: 2000, scaleFactor: 0.02, longTxn: true, idleTimeout: true };

const size = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(2)} GB` : `${Math.round(mb)} MB`);
const count = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

/** Table size (line) and dead rows (shaded) across the day, with a tick at each autovacuum run. */
function Chart({ series, maxMB, maxDead }: { series: ReturnType<typeof simulate>["series"]; maxMB: number; maxDead: number }) {
  const W = 600, H = 150;
  const x = (m: number) => (m / (HOURS * 60 - 1)) * W;
  const ySize = (mb: number) => H - (mb / maxMB) * (H - 8);
  const yDead = (d: number) => H - (d / Math.max(1, maxDead)) * (H - 8);
  const sizePath = series.map((p, i) => `${i ? "L" : "M"}${x(p.minute).toFixed(1)} ${ySize(p.sizeMB).toFixed(1)}`).join(" ");
  const deadPath = `M0 ${H} ` + series.map((p) => `L${x(p.minute).toFixed(1)} ${yDead(p.dead).toFixed(1)}`).join(" ") + ` L${W} ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label="Table size and dead rows over twelve hours">
      <path d={deadPath} fill="color-mix(in srgb, var(--bad) 22%, transparent)" />
      {series.filter((p) => p.vacuumed).map((p) => (
        <line key={p.minute} x1={x(p.minute)} x2={x(p.minute)} y1={H - 6} y2={H} stroke="var(--good)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={sizePath} fill="none" stroke="var(--db)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function VacuumDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const r = useMemo(() => simulate(o), [o]);
  const maxMB = Math.max(...r.series.map((p) => p.sizeMB));
  const holding = o.longTxn && !o.idleTimeout;
  const txnEnd = o.idleTimeout ? LONG_TXN.from + IDLE_TIMEOUT_MIN : LONG_TXN.to;

  const nodes: MapNode[] = [
    { id: "app", label: "App", sub: `${o.updatesPerS.toLocaleString("en-US")} UPDATEs/s`, at: [13, 25], mobileAt: [25, 10], state: "active" },
    { id: "table", label: "orders table", sub: `${size(r.minMB)} → ${size(r.finalMB)}`, at: [50, 50], mobileAt: [50, 45], state: r.bloatPct > 50 ? "bad" : r.bloatPct > 20 ? "wait" : "good" },
    { id: "av", label: "Autovacuum", sub: `${r.vacuums} runs${r.emptyVacuums ? `, ${r.emptyVacuums} freed nothing` : ""}`, at: [87, 25], mobileAt: [75, 10], state: r.emptyVacuums ? "bad" : "good" },
    { id: "sess", label: "Idle session", sub: !o.longTxn ? "none" : o.idleTimeout ? `killed at ${hhmm(txnEnd)}` : `open ${hhmm(LONG_TXN.from)}–${hhmm(LONG_TXN.to)}`, at: [13, 78], mobileAt: [25, 82], state: !o.longTxn ? "dim" : holding ? "bad" : "good" },
    { id: "fsm", label: "Free space map", sub: "space to reuse", at: [87, 78], mobileAt: [75, 82], state: "active" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("u", ["app", "table"], { label: "new version + dead one" })
    : stage === 1 ? hops("v", ["av", "table"], { label: `≥ ${count(trigger(o.scaleFactor))} dead` })
    : stage === 2 ? hops("h", ["sess", "table"], { label: holding ? `snapshot from ${hhmm(LONG_TXN.from)}` : "no old snapshot", tone: holding ? "bad" : "good" })
    : stage === 3 ? hops("f", ["table", "fsm"], { label: "freed slots", tone: "good" })
    : stage === 4 ? hops("x", ["app", "table"], { label: `${r.bloatPct}% bloat`, tone: r.bloatPct > 20 ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: ${o.updatesPerS.toLocaleString("en-US")} updates a second each write a new row version and leave the old one dead: ${count(o.updatesPerS * 3600)} dead versions an hour.`,
    `Step 2: autovacuum runs when dead rows pass ${THRESHOLD} + ${o.scaleFactor} × ${count(ROWS)} = ${count(trigger(o.scaleFactor))}: ${r.vacuums} runs in 12 hours.`,
    holding ? `Step 3: a session sits idle in transaction from ${hhmm(LONG_TXN.from)} to ${hhmm(LONG_TXN.to)}. Its snapshot might still need every version that died since, so ${r.emptyVacuums} vacuum runs free nothing, and dead rows reach ${count(r.maxDead)}.` : o.longTxn ? `Step 3: idle_in_transaction_session_timeout ends the forgotten session at ${hhmm(txnEnd)}, and vacuum can clean up again.` : "Step 3: no old snapshots, so every vacuum can remove all the dead rows it finds.",
    `Step 4: freed space is reused by later updates, but the file never gives it back: ${size(r.minMB)} of live rows in a ${size(r.finalMB)} file.`,
    r.bloatPct > 20 ? `Step 5: ${r.bloatPct}% of the table is empty space. VACUUM FULL would rewrite it in about ${r.vacuumFullS} s, holding a lock that blocks every read and write.` : `Step 5: ${r.bloatPct}% bloat: the table stays near its natural size and nothing needs rewriting.`,
  ];
  const caption = stage !== null ? captions[stage] : `After 12 hours: ${size(r.finalMB)} on disk for ${size(r.minMB)} of live rows (${r.bloatPct}% bloat) · ${r.vacuums} autovacuum runs.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Vacuum and bloat"
        blurb="Postgres never overwrites a row: an UPDATE writes a new version and leaves the old one behind, dead. Autovacuum clears dead versions so their space can be reused, but only once no transaction could still see them. Run twelve hours of updates on a 10-million-row table and watch the file grow, settle or explode."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The app updates the orders table; autovacuum removes dead versions into the free space map, unless an old session's snapshot still needs them"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "table", label: "UPDATE" },
                  { from: "av", to: "table", label: "vacuum" },
                  { from: "sess", to: "table", label: "old snapshot", dim: !holding },
                  { from: "table", to: "fsm", label: "free space" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Table size over twelve hours">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">00:00 → 12:00 · table size and dead rows</p>
                <div className="mt-2">
                  <Chart series={r.series} maxMB={maxMB} maxDead={r.maxDead} />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
                  <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5" style={{ background: ACCENT }} />size on disk (max {size(maxMB)})</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm" style={{ background: "color-mix(in srgb, var(--bad) 22%, transparent)" }} />dead rows (max {count(r.maxDead)})</span>
                  <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-0.5" style={{ background: "var(--good)" }} />autovacuum run</span>
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Defaults, forgotten session
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Tuned, with a timeout
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Vacuuming…">
                Run twelve hours
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Every UPDATE leaves a dead row" what="MVCC keeps the old version so transactions that started earlier can still read it. The old version gets xmax set to the updating transaction; once that commits and nobody needs the old version, it's dead weight." accent={ACCENT} active={at(0)}>
                <div className="space-y-1 font-mono text-[11px]">
                  <p className="text-[var(--faint)]">(xmin 9001, xmax 9002) order 42 · status = &apos;pending&apos;  ← dead</p>
                  <p>(xmin 9002, xmax 0)    order 42 · status = &apos;shipped&apos;</p>
                </div>
                <Slider label="Updates per second" value={o.updatesPerS} min={200} max={5000} step={100} format={(v) => v.toLocaleString("en-US")} onChange={(v) => set({ updatesPerS: v })} accent={ACCENT} />
              </FlowStep>
              <FlowArrow label="dead rows pile up" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Autovacuum wakes past a threshold" what="Every minute the launcher checks each table. It vacuums one when dead rows exceed 50 + scale_factor × rows. The default 0.2 means waiting for 20% of a big table to be dead; per-table settings lower it." accent={ACCENT} active={at(1)}>
                <Choices<string> accent={ACCENT} value={String(o.scaleFactor)} onChange={(v) => set({ scaleFactor: Number(v) })} options={[{ id: "0.2", label: "scale_factor 0.2 (default)" }, { id: "0.05", label: "0.05" }, { id: "0.02", label: "0.02" }]} />
                <p className="font-mono text-xs">vacuum at {count(trigger(o.scaleFactor))} dead rows · {r.vacuums} runs in 12 h</p>
              </FlowStep>
              <FlowArrow label="but who can still see them?" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Remove only rows nobody can see" what="Vacuum can't remove a version that died after the oldest open snapshot started. One session left idle in transaction, a long report or a stale replication slot holds that horizon back for the whole database." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.longTxn} onChange={(e) => set({ longTxn: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  A session runs BEGIN at {hhmm(LONG_TXN.from)} and is forgotten
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.idleTimeout} onChange={(e) => set({ idleTimeout: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  idle_in_transaction_session_timeout = &apos;{IDLE_TIMEOUT_MIN}min&apos;
                </label>
                <p className="font-mono text-xs" style={{ color: r.emptyVacuums ? "var(--bad)" : "var(--good)" }}>
                  {r.emptyVacuums ? `${r.emptyVacuums} runs found only rows they couldn't remove · peak ${count(r.maxDead)} dead` : `peak ${count(r.maxDead)} dead rows`}
                </p>
              </FlowStep>
              <FlowArrow label="freed space" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Reuse the space; the file stays big" what="Vacuum records freed space in the free space map, and new versions go there instead of growing the file. But plain VACUUM almost never returns space to the operating system: a table that ballooned stays that size." accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs">
                  live rows {size(r.minMB)} · file {size(r.finalMB)} · <span style={{ color: r.bloatPct > 20 ? "var(--bad)" : "var(--good)" }}>{r.bloatPct}% bloat</span>
                </p>
              </FlowStep>
              <FlowArrow label="shrink or prevent" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Shrink it, or don't let it grow" what="VACUUM FULL rewrites the table compactly but takes an ACCESS EXCLUSIVE lock for the whole rewrite. pg_repack does it online. Better: vacuum more often on busy tables, and time out forgotten transactions." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs">
                  VACUUM FULL: about {r.vacuumFullS} s with every query on the table blocked, then {size(r.minMB)}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  Simulated minute by minute with Postgres&apos;s autovacuum trigger and visibility horizon. It ignores page pruning between vacuums and index bloat; the rewrite speed is illustrative.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
