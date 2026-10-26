"use client";

import { useMemo, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { BACKUP_AT, DELETE_AT, GAP_AT, NOTICED_AT, SEGMENT_S, around, clock, events, restore, type Source, type Where } from "@/lib/pitrRestore";

const ACCENT = "var(--db)";

type Opts = { source: Source; gap: boolean; target: number; where: Where };
const NAIVE: Opts = { source: "dump", gap: false, target: DELETE_AT - 60, where: "over" };
const TUNED: Opts = { source: "pitr", gap: false, target: DELETE_AT - 1, where: "side" };

const pct = (t: number) => `${(t / NOTICED_AT) * 100}%`;

export default function BackupsPitrDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const evs = useMemo(() => events(), []);
  const r = restore(o.source, o.target, o.gap, o.where, evs);
  const near = around(evs, Math.min(o.target, DELETE_AT) - 25, DELETE_AT + 30);
  const pitr = o.source === "pitr";
  const good = r.lost === 0;

  const nodes: MapNode[] = [
    { id: "prod", label: "Production", sub: `${r.afterDeleteInProd} orders since the DELETE`, at: [14, 24], mobileAt: [25, 10], state: "bad" },
    { id: "base", label: pitr ? "Base backup" : "pg_dump file", sub: `02:00 · ${r.backupRows.toLocaleString("en-US")} orders`, at: [50, 24], mobileAt: [75, 10], state: "good" },
    { id: "arch", label: "WAL archive", sub: pitr ? `${r.segments} segments${o.gap ? ", 1 missing" : ""}` : "not used", at: [86, 24], mobileAt: [75, 45], state: !pitr ? "dim" : o.gap ? "bad" : "good" },
    { id: "restore", label: o.where === "side" ? "Restore server" : "Production, restored", sub: r.error ? "stopped early" : `${r.restored.toLocaleString("en-US")} orders at ${clock(r.reached)}`, at: [50, 78], mobileAt: [25, 45], state: r.error || r.includesDelete ? "bad" : "good" },
    { id: "shop", label: "Shop", sub: `${r.finalRows.toLocaleString("en-US")} of ${r.goodNow.toLocaleString("en-US")} orders`, at: [14, 78], mobileAt: [50, 82], state: good ? "good" : "bad" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("b", ["prod", "base"], { label: pitr ? "pg_basebackup" : "pg_dump" })
    : stage === 1 ? hops("a", ["prod", "base", "arch"], { label: pitr ? (o.gap ? "segment lost" : "every segment") : "no WAL kept", tone: !pitr || o.gap ? "bad" : "good" })
    : stage === 2 ? hops("t", ["arch", "restore"], { label: clock(o.target), tone: "accent" })
    : stage === 3 ? [...hops("c", ["base", "restore"], { label: "copy" }), ...(pitr ? hops("w", ["arch", "restore"], { label: `${r.replaySegments} segments`, tone: r.error ? "bad" : "good", start: 0.4 }) : [])]
    : stage === 4 ? hops("p", ["restore", "shop"], { label: `${r.lost.toLocaleString("en-US")} lost`, tone: good ? "good" : "bad" })
    : [];

  const captions = [
    pitr ? `Step 1: a base backup at 02:00 copies the data files while the database runs: ${r.backupRows.toLocaleString("en-US")} orders.` : `Step 1: pg_dump at 02:00 writes the data out as SQL: ${r.backupRows.toLocaleString("en-US")} orders, and nothing after.`,
    pitr ? (o.gap ? `Step 2: every WAL segment is archived, but the one for ${clock(GAP_AT)}–${clock(GAP_AT + SEGMENT_S)} was deleted by a bucket lifecycle rule, and nobody noticed.` : `Step 2: every WAL segment since the backup is in the archive: ${r.segments} segments, at least one every ${SEGMENT_S / 60} minutes.`) : "Step 2: a dump is a snapshot; there's no log to roll it forward.",
    `Step 3: the DELETE committed at ${clock(DELETE_AT)}. The target is ${clock(o.target)}, ${o.target < DELETE_AT ? `${DELETE_AT - o.target} s before it` : `${o.target - DELETE_AT} s after it`}.`,
    r.error ? `Step 4: ${r.error}.` : pitr ? `Step 4: restore the base backup, replay ${r.replaySegments} segments and stop at ${clock(r.reached)}: ${r.restored.toLocaleString("en-US")} orders${r.includesDelete ? ", but the DELETE was replayed too" : ""}.` : `Step 4: load the dump: ${r.restored.toLocaleString("en-US")} orders as of 02:00.`,
    `Step 5: ${o.where === "side" ? "copy the restored orders back into production, next to the orders taken since" : "replace production with the restored copy"}: ${r.finalRows.toLocaleString("en-US")} orders, ${r.lost.toLocaleString("en-US")} lost.`,
  ];
  const caption = stage !== null ? captions[stage] : `${r.lost ? `${r.lost.toLocaleString("en-US")} real orders lost` : "every real order is back"} · restore takes about ${Math.round(r.minutes)} min.`;

  const segs = Array.from({ length: r.segments }, (_, i) => BACKUP_AT + i * SEGMENT_S);

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Backups and point-in-time recovery"
        blurb="At 10:42:31 someone runs DELETE FROM orders without a WHERE. The shop keeps taking orders until 11:30, when someone notices. A nightly dump gets you back to 02:00. A base backup plus every archived WAL segment gets you back to the second before the mistake, if the archive is complete and you restore it the right way."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Production is backed up to object storage as a base backup plus archived WAL; a restore server replays them to a target time and the data goes back to the shop"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "prod", to: "base", label: "02:00" },
                  { from: "prod", to: "arch", label: "WAL", dim: !pitr },
                  { from: "base", to: "restore", label: "copy" },
                  { from: "arch", to: "restore", label: "replay", dim: !pitr },
                  { from: "restore", to: "shop", label: o.where === "side" ? "copy table back" : "becomes prod" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Timeline from midnight to 11:30">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">00:00 → 11:30 · what the restore brings back</p>
                <div className="relative mt-6 h-6 rounded bg-[var(--inset)]">
                  <span className="absolute top-0 h-full rounded-l" style={{ left: 0, width: pct(r.reached), background: r.includesDelete ? "color-mix(in srgb, var(--bad) 40%, transparent)" : "color-mix(in srgb, var(--db) 45%, transparent)" }} />
                  {pitr && o.gap && <span className="absolute top-0 h-full bg-[var(--bad)]" style={{ left: pct(GAP_AT), width: pct(SEGMENT_S) }} />}
                  {[{ t: BACKUP_AT, label: "backup" }, { t: DELETE_AT, label: "DELETE" }].map((m) => (
                    <span key={m.label} className="absolute -top-5 -translate-x-1/2 font-mono text-[10px] text-[var(--muted)]" style={{ left: pct(m.t) }}>
                      {m.label}
                    </span>
                  ))}
                  <span className="absolute top-[-4px] h-[calc(100%+8px)] w-0.5 bg-[var(--bad)]" style={{ left: pct(DELETE_AT) }} />
                  <span className="absolute top-[-4px] h-[calc(100%+8px)] w-0.5 bg-[var(--text)]" style={{ left: pct(BACKUP_AT) }} />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]">
                  <span>00:00</span>
                  <span>restored to {clock(r.reached)}</span>
                  <span>11:30</span>
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Nightly dump
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  PITR, side restore
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Restoring…">
                Restore the orders
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Take a backup" what="pg_dump writes the data out as SQL: easy to move, but it's a snapshot of one moment. A base backup (pg_basebackup) copies the data files themselves, and is the starting point for replaying the log." accent={ACCENT} active={at(0)}>
                <Choices<Source> accent={ACCENT} value={o.source} onChange={(v) => set({ source: v })} options={[{ id: "dump", label: "pg_dump at 02:00" }, { id: "pitr", label: "Base backup + WAL archive" }]} />
              </FlowStep>
              <FlowArrow label="all day" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Archive every WAL segment" what="archive_command (or a tool like WAL-G or pgBackRest) copies each finished 16 MB WAL segment to object storage, and archive_timeout forces one at least every few minutes. Replay needs every segment, in order: one missing file ends recovery there." accent={ACCENT} active={at(1)}>
                {pitr ? (
                  <>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" checked={o.gap} onChange={(e) => set({ gap: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                      A lifecycle rule deleted the {clock(GAP_AT).slice(0, 5)} segment
                    </label>
                    <div className="flex flex-wrap gap-px" aria-label={`${r.segments} archived segments`}>
                      {segs.map((t) => (
                        <span key={t} title={clock(t)} className="h-3 w-1.5 rounded-sm" style={{ background: o.gap && t === GAP_AT ? "var(--bad)" : t < o.target ? "color-mix(in srgb, var(--db) 70%, transparent)" : "var(--line)" }} />
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[var(--muted)]">A dump has no log after it, so everything since 02:00 is out of reach.</p>
                )}
              </FlowStep>
              <FlowArrow label="pick the moment" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Find the second before the mistake" what="recovery_target_time stops replay at a timestamp. The log shows the DELETE's commit time; aim just before it. Too early loses good orders; too late replays the DELETE." accent={ACCENT} active={at(2)}>
                <Slider label="recovery_target_time" value={o.target} min={DELETE_AT - 300} max={DELETE_AT + 60} step={1} format={clock} onChange={(v) => set({ target: v })} accent={ACCENT} />
                <ol className="max-h-36 space-y-0.5 overflow-y-auto font-mono text-[11px]">
                  {near.map((e) => (
                    <li key={`${e.t}-${e.id ?? "d"}`} style={{ color: e.kind === "delete" ? "var(--bad)" : e.t <= o.target ? "var(--text)" : "var(--faint)" }}>
                      {clock(e.t)} {e.kind === "delete" ? `DELETE FROM orders;  -- DELETE ${(r.goodNow - r.afterDeleteInProd).toLocaleString("en-US")}` : `INSERT order ${e.id}`}
                    </li>
                  ))}
                </ol>
              </FlowStep>
              <FlowArrow label="replay" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Restore and replay to the target" what="Copy the base backup to a server, point restore_command at the archive, set the target, start Postgres. It replays segment after segment and stops at the target, ready to promote." accent={ACCENT} active={at(3)}>
                <p className="text-xs" style={{ color: r.error || r.includesDelete ? "var(--bad)" : "var(--good)" }}>
                  {r.error ?? (pitr ? `${r.replaySegments} segments replayed · ${r.restored.toLocaleString("en-US")} orders at ${clock(r.reached)}${r.includesDelete ? " · the DELETE is in it" : ""}` : `${r.restored.toLocaleString("en-US")} orders as of 02:00`)}
                </p>
                <p className="font-mono text-[11px] text-[var(--muted)]">about {Math.round(r.minutes)} min: a 40 GB copy, then replay</p>
              </FlowStep>
              <FlowArrow label="put the data back" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Put the data back without losing new orders" what="Restoring over production takes the whole database back in time, throwing away the real orders taken since. Restoring to a side server and copying just the deleted table back keeps them." accent={ACCENT} active={at(4)}>
                <Choices<Where> accent={ACCENT} value={o.where} onChange={(v) => set({ where: v })} options={[{ id: "over", label: "Restore over production" }, { id: "side", label: "Side server, copy the table back" }]} />
                <p className="font-mono text-xs" style={{ color: good ? "var(--good)" : "var(--bad)" }}>
                  {r.finalRows.toLocaleString("en-US")} of {r.goodNow.toLocaleString("en-US")} real orders · {r.lost.toLocaleString("en-US")} lost
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The orders are a seeded stream replayed for real. Segment timing follows archive_timeout; copy and replay speeds are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
