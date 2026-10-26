"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { LEVEL_LABEL, START, TOTAL, TRANSFER_SQL, WAL_WRITER_DELAY, atomicity, consistency, durability, isolation, type Level, type Outcome, type Sync } from "@/lib/acidTxn";

const ACCENT = "var(--db)";

type Opts = { amount: number; atomic: boolean; check: boolean; level: Level; outcome: Outcome; sync: Sync; cutMs: number };
const NONE: Opts = { amount: 100, atomic: false, check: false, level: "dirty", outcome: "rollback", sync: "fsyncOff", cutMs: 50 };
const PG: Opts = { amount: 100, atomic: true, check: true, level: "readCommitted", outcome: "commit", sync: "on", cutMs: 50 };

const usd = (n: number) => (n < 0 ? `−$${(-n).toLocaleString("en-US")}` : `$${n.toLocaleString("en-US")}`);

export default function AcidDemo() {
  const [o, setO] = useState<Opts>(NONE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const a = atomicity(o.atomic, o.amount);
  const c = consistency(o.check, o.amount);
  const iso = isolation(o.level, o.outcome, 100);
  const d = durability(o.sync, o.cutMs);
  const cBroken = c.after.alice < 0;

  const results = [
    { letter: "A", what: "crash mid-transfer", ok: a.total === TOTAL, text: a.total === TOTAL ? `total still ${usd(TOTAL)}` : `total ${usd(a.total)}` },
    { letter: "C", what: `send ${usd(o.amount)} from ${usd(START.alice)}`, ok: !cBroken, text: c.error ? "rejected" : cBroken ? `Alice at ${usd(c.after.alice)}` : "allowed" },
    { letter: "I", what: "report during transfer", ok: iso.wrongBy === 0, text: `report says ${usd(iso.total)}` },
    { letter: "D", what: `power cut ${o.cutMs} ms after COMMIT`, ok: d.survives, text: d.survives ? "transfer kept" : d.corruptionRisk ? "lost, maybe corrupt" : "transfer lost" },
  ];

  const nodes: MapNode[] = [
    { id: "app", label: "Transfer", sub: `Alice → Bob ${usd(o.amount)}`, at: [13, 25], mobileAt: [25, 12], state: "active" },
    { id: "report", label: "Report", sub: `sum = ${usd(iso.total)}`, at: [13, 75], mobileAt: [75, 12], state: iso.wrongBy ? "bad" : "good" },
    { id: "pg", label: "Postgres", sub: o.atomic ? "one transaction" : "autocommit", at: [48, 50], mobileAt: [50, 45], state: a.total === TOTAL ? "good" : "bad" },
    { id: "check", label: "CHECK", sub: o.check ? "balance ≥ 0" : "none declared", at: [85, 18], mobileAt: [20, 80], state: cBroken ? "bad" : o.check ? "good" : "idle" },
    { id: "wal", label: "WAL", sub: o.sync === "on" ? "fsync at COMMIT" : o.sync === "off" ? "async commit" : "fsync = off", at: [85, 50], mobileAt: [50, 80], state: d.survives ? "good" : "bad" },
    { id: "disk", label: "Disk", sub: d.survives ? "transfer on disk" : "not there yet", at: [85, 82], mobileAt: [80, 80], state: d.survives ? "good" : "bad" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("b", ["app", "pg"], { label: o.atomic ? "BEGIN … COMMIT" : "2 statements" })
    : stage === 1 ? hops("a", ["app", "pg", "wal"], { label: a.total === TOTAL ? "no COMMIT: ignored" : "debit kept", tone: a.total === TOTAL ? "good" : "bad" })
    : stage === 2 ? hops("c", ["app", "pg", "check"], { label: c.error ? "violates CHECK" : cBroken ? "overdrawn" : "ok", tone: cBroken ? "bad" : "good" })
    : stage === 3 ? hops("i", ["report", "pg"], { label: usd(iso.total), tone: iso.wrongBy ? "bad" : "good" })
    : stage === 4 ? hops("d", ["pg", "wal", "disk"], { label: d.survives ? "flushed" : "lost", tone: d.survives ? "good" : "bad" })
    : [];

  const captions = [
    o.atomic ? "Step 1: both UPDATEs run inside BEGIN … COMMIT, so the database treats them as one unit." : "Step 1: without BEGIN, each UPDATE is its own transaction (autocommit) and commits on its own.",
    `Step 2: the server crashes after the debit. ${a.note}.`,
    `Step 3: ${c.error ? `ERROR: ${c.error}. ${c.note}` : c.note}.`,
    `Step 4: the report reads Alice, then Bob and Carol, while the transfer ${o.outcome === "commit" ? "commits" : "rolls back"} in between: it adds up to ${usd(iso.total)}${iso.wrongBy ? `, ${usd(Math.abs(iso.wrongBy))} ${iso.wrongBy > 0 ? "too much" : "too little"}` : ", which is right"}.`,
    `Step 5: ${d.note}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${results.filter((r) => r.ok).length} of 4 guarantees held: ${results.map((r) => `${r.letter} ${r.ok ? "✓" : "✗"}`).join(" · ")}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="ACID in practice"
        blurb="Atomicity, consistency, isolation and durability are four separate promises, and each one is kept by a different part of the database. Move $100 from Alice to Bob, then crash the server, overdraw the account, run a report mid-transfer and pull the power, with each guarantee on or off."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A transfer and a report both talk to Postgres; Postgres checks constraints, writes the WAL and flushes it to disk"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "pg", label: "SQL" },
                  { from: "report", to: "pg", label: "SELECT" },
                  { from: "pg", to: "check", label: "validate" },
                  { from: "pg", to: "wal", label: "log" },
                  { from: "wal", to: "disk", label: "fsync" },
                ]}
                packets={packets}
                aspect={1.7}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Which guarantees held">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Four things that can go wrong · start: Alice {usd(START.alice)}, Bob {usd(START.bob)}, Carol {usd(START.carol)}</p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {results.map((r) => (
                    <li key={r.letter} className="flex items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2">
                      <span className="font-mono text-lg font-semibold" style={{ color: r.ok ? "var(--good)" : "var(--bad)" }}>{r.letter}</span>
                      <span className="min-w-0 text-xs">
                        <span className="block text-[var(--muted)]">{r.what}</span>
                        <span className="block font-medium" style={{ color: r.ok ? "var(--good)" : "var(--bad)" }}>{r.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NONE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  No guarantees
                </button>
                <button type="button" onClick={() => setO(PG)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Postgres defaults
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Transferring…">
                Run the transfer
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Group the changes into one transaction" what="A transfer is two writes: take money from Alice, give it to Bob. BEGIN … COMMIT tells the database they belong together. Without it, most drivers run in autocommit mode: every statement commits on its own." accent={ACCENT} active={at(0)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.atomic} onChange={(e) => set({ atomic: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Wrap both UPDATEs in BEGIN … COMMIT
                </label>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">
                  {TRANSFER_SQL(o.amount).filter((l) => o.atomic || !/^(BEGIN|COMMIT)/.test(l)).join("\n")}
                </pre>
              </FlowStep>
              <FlowArrow label="crash after the first UPDATE" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Atomicity: all of it or none of it" what="The server dies after the debit. On restart, Postgres replays the log, and a transaction with no COMMIT record stays invisible: as if it never started. In autocommit the debit was already its own committed transaction." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  Alice {usd(a.after.alice)} · Bob {usd(a.after.bob)} · Carol {usd(a.after.carol)} ={" "}
                  <span style={{ color: a.total === TOTAL ? "var(--good)" : "var(--bad)" }}>{usd(a.total)}</span>
                </p>
              </FlowStep>
              <FlowArrow label="every write is checked" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Consistency: only valid states" what="The database rejects any change that breaks a rule you declared: types, NOT NULL, foreign keys, UNIQUE, CHECK. It knows nothing about rules you didn't write down; those are the application's job." accent={ACCENT} active={at(2)}>
                <Slider label="Amount" value={o.amount} min={50} max={500} step={50} format={usd} onChange={(v) => set({ amount: v })} accent={ACCENT} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.check} onChange={(e) => set({ check: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  <code className="font-mono text-xs">CHECK (balance &gt;= 0)</code>
                </label>
                <p className="text-xs" style={{ color: c.error ? "var(--good)" : cBroken ? "var(--bad)" : "var(--muted)" }}>
                  {c.error ? `ERROR: ${c.error}` : `Alice ${usd(c.after.alice)}, Bob ${usd(c.after.bob)}: ${c.note}`}
                </p>
              </FlowStep>
              <FlowArrow label="a report reads at the same time" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Isolation: what others see meanwhile" what="A report adds up all balances in three statements while a $100 transfer runs between them. The isolation level decides which row versions each statement may see. The total should always be $1,000." accent={ACCENT} active={at(3)}>
                <Choices<Level> accent={ACCENT} value={o.level} onChange={(v) => set({ level: v })} options={(Object.keys(LEVEL_LABEL) as Level[]).map((id) => ({ id, label: LEVEL_LABEL[id] }))} />
                <Choices<Outcome> accent={ACCENT} value={o.outcome} onChange={(v) => set({ outcome: v })} options={[{ id: "commit", label: "Transfer commits" }, { id: "rollback", label: "Transfer rolls back" }]} />
                <ol className="space-y-0.5 font-mono text-[11px]">
                  {iso.events.map((e) => (
                    <li key={e.t} style={{ color: e.who === "report" ? "var(--text)" : "var(--muted)" }}>
                      t{e.t} {e.who === "report" ? "report  " : "transfer"} {e.text}
                    </li>
                  ))}
                </ol>
                <p className="font-mono text-xs">
                  saw Alice {usd(iso.seen.alice)} + Bob {usd(iso.seen.bob)} + Carol {usd(iso.seen.carol)} ={" "}
                  <span style={{ color: iso.wrongBy ? "var(--bad)" : "var(--good)" }}>{usd(iso.total)}</span>
                </p>
                <p className="text-[11px] text-[var(--faint)]">
                  {o.level === "dirty"
                    ? "Postgres never shows uncommitted rows, even at READ UNCOMMITTED; some other databases do."
                    : o.level === "readCommitted"
                      ? "Each statement gets a fresh snapshot, so one report can mix before and after (read skew). Run it as one SELECT, or at REPEATABLE READ."
                      : "One snapshot for the whole transaction: every statement sees the database as it was at the first one."}
                </p>
              </FlowStep>
              <FlowArrow label="COMMIT returns, then the power goes" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Durability: committed means on disk" what="COMMIT normally waits until the WAL record is flushed to disk with fsync. Turning that off makes commits faster by acknowledging work that is still only in memory." accent={ACCENT} active={at(4)}>
                <Choices<Sync> accent={ACCENT} value={o.sync} onChange={(v) => set({ sync: v })} options={[{ id: "on", label: "synchronous_commit = on" }, { id: "off", label: "synchronous_commit = off" }, { id: "fsyncOff", label: "fsync = off" }]} />
                <Slider label="Power cut after COMMIT returned" value={o.cutMs} min={0} max={1000} step={10} format={(v) => `${v} ms`} onChange={(v) => set({ cutMs: v })} accent={ACCENT} />
                <p className="text-xs" style={{ color: d.survives ? "var(--good)" : "var(--bad)" }}>{d.note}.</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  Balances and what the report sees are computed from row versions. The flush times follow Postgres defaults (wal_writer_delay {WAL_WRITER_DELAY} ms) and Linux&apos;s 30 s dirty-page expiry.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
