"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { BGWRITER_FLUSH, INTERVALS, LOG, PAGES, REPLAY_MB_S, UPDATES_PER_S, atScale, recover, type Action, type Checkpoint } from "@/lib/crashRecovery";

const ACCENT = "var(--db)";

type Opts = { checkpoint: Checkpoint; crashAfter: number; fpw: boolean; torn: boolean; interval: number };
const NAIVE: Opts = { checkpoint: 80, crashAfter: 130, fpw: false, torn: true, interval: 30 };
const TUNED: Opts = { checkpoint: 80, crashAfter: 130, fpw: true, torn: true, interval: 300 };

const ACTION: Record<Action, { label: string; color: string }> = {
  before: { label: "on disk", color: "var(--faint)" },
  fpi: { label: "page image", color: "var(--good)" },
  skip: { label: "skip", color: "var(--muted)" },
  apply: { label: "redo", color: "var(--db)" },
  torn: { label: "torn page", color: "var(--bad)" },
  commit: { label: "commit", color: "var(--good)" },
};
const dur = (s: number) => (s < 1 ? "under 1 s" : s < 90 ? `${Math.round(s)} s` : `${(s / 60).toFixed(1)} min`);
const ivl = (s: number) => (s < 60 ? `${s} s` : `${s / 60} min`);

export default function CrashRecoveryDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const r = recover(o.checkpoint, o.crashAfter, o.fpw, o.torn);
  const scale = INTERVALS.map((i) => atScale(i, o.fpw));
  const cur = atScale(o.interval, o.fpw);
  const ok = !r.failed;

  const nodes: MapNode[] = [
    { id: "app", label: "Transactions", sub: `${LOG.filter((l) => l.lsn <= o.crashAfter && !l.page).length} committed`, at: [12, 22], mobileAt: [25, 10], state: "active" },
    { id: "buf", label: "Buffer pool", sub: "dirty pages in RAM", at: [46, 22], mobileAt: [75, 10], state: stage === 2 ? "bad" : "active" },
    { id: "wal", label: "WAL", sub: `LSN 10–${o.crashAfter}`, at: [84, 22], mobileAt: [75, 45], state: "good" },
    { id: "ckpt", label: "Checkpointer", sub: r.redo ? `redo point ${r.redo}` : "startup only", at: [12, 78], mobileAt: [25, 45], state: r.redo ? "good" : "idle" },
    { id: "data", label: "Data files", sub: r.torn ? `page ${r.torn} torn` : "pages A–F", at: [46, 78], mobileAt: [25, 82], state: r.torn && !ok ? "bad" : "good" },
    { id: "rec", label: "Recovery", sub: ok ? `${r.replayed} redone` : "failed", at: [84, 78], mobileAt: [75, 82], state: ok ? "good" : "bad" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("w", ["app", "buf", "wal"], { label: "record + LSN" })
    : stage === 1 ? hops("c", ["ckpt", "buf", "data"], { label: r.redo ? `flush ≤ ${r.redo}` : "no checkpoint", tone: r.redo ? "good" : "bad" })
    : stage === 2 ? hops("x", ["buf", "data"], { label: r.torn ? `page ${r.torn} half-written` : "power lost", tone: "bad" })
    : stage === 3 ? hops("r", ["wal", "rec", "data"], { label: ok ? `${r.replayed} records` : "checksum fails", tone: ok ? "good" : "bad" })
    : stage === 4 ? hops("s", ["ckpt", "data"], { label: `every ${ivl(o.interval)}`, tone: "accent" })
    : [];

  const captions = [
    `Step 1: every change is appended to the WAL with an increasing LSN before COMMIT returns; the data pages are only changed in memory.`,
    r.redo ? `Step 2: the checkpoint noted redo point ${r.redo} and flushed every page dirty at that moment. Later the background writer also flushed page ${BGWRITER_FLUSH.page}.` : "Step 2: no checkpoint since startup, so recovery must start at the very beginning of the log.",
    `Step 3: power lost after LSN ${o.crashAfter}. ${r.torn ? `Page ${r.torn} was being written: half of its 8 KB is new, half old.` : "Every page on disk is whole."}`,
    ok ? `Step 4: replay from LSN ${r.redo}: ${r.replayed} records redone, ${r.skipped} skipped. ${r.lost.length ? `${r.lost.join(", ")} has no COMMIT record, so it stays invisible.` : "Every transaction that committed is back."}` : `Step 4: ${r.failed}.`,
    `Step 5: with a checkpoint every ${ivl(o.interval)}, the WAL grows ${cur.walPerHourGB.toFixed(1)} GB an hour and recovery can take up to ${dur(cur.recoveryS)}.`,
  ];
  const caption = stage !== null ? captions[stage] : ok ? `Recovered: replayed from LSN ${r.redo}, ${r.replayed} records redone${r.lost.length ? `, ${r.lost.join(", ")} rolled back` : ""}.` : "Recovery failed: a torn page with no full-page image to rebuild it from.";

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Checkpoints and crash recovery"
        blurb="A database changes pages in memory and writes them out later; only the log is on disk at COMMIT. After a crash it replays the log, but from where? A checkpoint marks a point after which the data files are known to be up to date. Pick where it happened, pull the power, and watch recovery redo, skip and rebuild pages."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Transactions change pages in the buffer pool and append to the WAL; the checkpointer flushes pages to the data files; after a crash, recovery replays the WAL into the data files"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "buf", label: "change" },
                  { from: "buf", to: "wal", label: "log first" },
                  { from: "ckpt", to: "buf", label: "flush" },
                  { from: "buf", to: "data", label: "write pages" },
                  { from: "wal", to: "rec", label: "replay" },
                  { from: "rec", to: "data", label: "redo" },
                ]}
                packets={packets}
                aspect={1.7}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Pages on disk at the crash and after recovery">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Page LSN on disk · at the crash → after recovery</p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {PAGES.map((p) => {
                    const torn = r.torn === p;
                    const bad = torn && !ok;
                    return (
                      <div key={p} className="rounded-lg border px-2 py-1.5 text-center" style={{ borderColor: bad ? "var(--bad)" : "var(--line)" }}>
                        <p className="font-mono text-sm font-semibold">{p}</p>
                        <p className="font-mono text-[11px] text-[var(--muted)]">{torn ? "torn" : r.pageLsn[p]}</p>
                        <p className="font-mono text-[11px]" style={{ color: bad ? "var(--bad)" : r.live[p] !== r.pageLsn[p] || torn ? "var(--good)" : "var(--faint)" }}>
                          → {bad ? "??" : r.live[p]}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Full-page writes off
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Postgres defaults
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Recovering…">
                Crash and recover
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Log every change before the page" what="Each change becomes a WAL record with an LSN, its byte position in the log. Each data page stores the LSN of the last change written into it, so recovery can tell whether a page already has a change." accent={ACCENT} active={at(0)}>
                <ol className="space-y-0.5 font-mono text-[11px]">
                  {LOG.map((l) => (
                    <li key={l.lsn} className="flex gap-2" style={{ color: l.lsn > o.crashAfter ? "var(--faint)" : "var(--text)", textDecoration: l.lsn > o.crashAfter ? "line-through" : undefined }}>
                      <span className="w-8 shrink-0 text-right text-[var(--muted)]">{l.lsn}</span>
                      <span className="w-6 shrink-0">{l.txn}</span>
                      <span className="w-4 shrink-0">{l.page ?? ""}</span>
                      <span className="min-w-0">{l.text}</span>
                      {l.lsn === r.redo && <span className="text-[var(--good)]">← checkpoint</span>}
                    </li>
                  ))}
                </ol>
              </FlowStep>
              <FlowArrow label="periodically" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Checkpoint: mark a redo point, flush pages" what="A checkpoint writes down the current LSN as the redo point, then writes every page that was dirty at that moment to the data files. Everything before the redo point is now safely in the data files, and older WAL can be recycled." accent={ACCENT} active={at(1)}>
                <Choices<string> accent={ACCENT} value={String(o.checkpoint)} onChange={(v) => set({ checkpoint: Number(v) as Checkpoint })} options={[{ id: "0", label: "None since startup" }, { id: "50", label: "After LSN 50" }, { id: "80", label: "After LSN 80" }]} />
                {o.checkpoint > o.crashAfter && <p className="text-xs text-[var(--bad)]">The crash comes first, so this checkpoint never happens.</p>}
              </FlowStep>
              <FlowArrow label="power lost" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Crash" what="RAM is gone: every dirty page that wasn't written is lost, and a page being written at that instant can be torn: disks only promise 512 bytes or 4 KB at a time, and a Postgres page is 8 KB." accent={ACCENT} active={at(2)}>
                <Slider label="Crash after LSN" value={o.crashAfter} min={60} max={130} step={10} format={(v) => String(v)} onChange={(v) => set({ crashAfter: v })} accent={ACCENT} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.torn} onChange={(e) => set({ torn: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The crash tears the page being written
                </label>
              </FlowStep>
              <FlowArrow label={`replay from LSN ${r.redo}`} accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Redo from the checkpoint" what="Recovery reads the WAL from the redo point. A record is redone only if the page's LSN is older. With full_page_writes on, the first change to each page after a checkpoint carries a copy of the whole page, so even a torn page can be rebuilt." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.fpw} onChange={(e) => set({ fpw: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  full_page_writes = on
                </label>
                <ol className="space-y-0.5 text-[11px]">
                  {r.steps.filter((s) => s.action !== "before").map((s) => (
                    <li key={s.rec.lsn} className="flex gap-2">
                      <span className="w-8 shrink-0 text-right font-mono text-[var(--muted)]">{s.rec.lsn}</span>
                      <span className="w-20 shrink-0 font-mono" style={{ color: ACTION[s.action].color }}>{ACTION[s.action].label}</span>
                      <span className="min-w-0 text-[var(--muted)]">{s.note}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-xs" style={{ color: ok ? "var(--good)" : "var(--bad)" }}>
                  {ok ? `${r.replayed} redone · ${r.skipped} skipped${r.lost.length ? ` · ${r.lost.join(", ")} never committed: invisible` : ""}` : r.failed}
                </p>
              </FlowStep>
              <FlowArrow label="how often to checkpoint?" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Choose the checkpoint interval" what="Frequent checkpoints keep recovery short, but every checkpoint writes all dirty pages, and the first change to each page afterwards logs a full 8 KB image. Rare checkpoints write less, but leave more log to replay." accent={ACCENT} active={at(4)}>
                <Choices<string> accent={ACCENT} value={String(o.interval)} onChange={(v) => set({ interval: Number(v) })} options={INTERVALS.map((i) => ({ id: String(i), label: `checkpoint_timeout ${ivl(i)}` }))} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[19rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">every</th>
                        <th className="py-1 text-right font-normal">WAL / hour</th>
                        <th className="py-1 text-right font-normal">page images</th>
                        <th className="py-1 text-right font-normal">worst recovery</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {scale.map((s) => (
                        <tr key={s.intervalS} className="border-t border-[var(--line)]" style={{ color: s.intervalS === o.interval ? "var(--text)" : "var(--muted)", fontWeight: s.intervalS === o.interval ? 600 : 400 }}>
                          <td className="py-1">{ivl(s.intervalS)}</td>
                          <td className="py-1 text-right">{s.walPerHourGB.toFixed(1)} GB</td>
                          <td className="py-1 text-right">{Math.round(s.fpiShare * 100)}%</td>
                          <td className="py-1 text-right">{dur(s.recoveryS)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  The replay decisions are computed record by record. The table assumes {UPDATES_PER_S.toLocaleString("en-US")} random updates a second over 200,000 pages, 120-byte records and redo at {REPLAY_MB_S} MB/s: illustrative rates, real formulas.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
