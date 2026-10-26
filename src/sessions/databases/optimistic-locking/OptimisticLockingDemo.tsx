"use client";

import { useMemo, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { ANA, BEN, LOADED, contention, editors, type Strategy } from "@/lib/versionLocking";

const ACCENT = "var(--db)";

type Opts = { strategy: Strategy; timeout: boolean; clients: number; rows: number; workMs: number };
const NAIVE: Opts = { strategy: "none", timeout: false, clients: 20, rows: 5, workMs: 20 };
const TUNED: Opts = { strategy: "optimistic", timeout: false, clients: 20, rows: 100, workMs: 20 };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function OptimisticLockingDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const e = editors(o.strategy, o.timeout ? 10 : null);
  const load = useMemo(() => {
    const l = { clients: o.clients, rows: o.rows, workMs: o.workMs };
    return { opt: contention("optimistic", l), pes: contention("pessimistic", l) };
  }, [o.clients, o.rows, o.workMs]);
  const lost = e.lost.length > 0;
  const benLine = e.lines.find((l) => l.who === "Ben" && l.sql.startsWith(o.strategy === "pessimistic" ? "BEGIN" : "UPDATE"));
  const label = o.strategy === "none" ? "No check" : o.strategy === "optimistic" ? "Version column" : "SELECT … FOR UPDATE";

  const nodes: MapNode[] = [
    { id: "ana", label: "Ana", sub: `price → ${money(ANA.change.priceCents)}`, at: [13, 25], mobileAt: [25, 12], state: lost ? "bad" : "good" },
    { id: "ben", label: "Ben", sub: e.benFailed ? "lock timeout" : e.benWaitedS ? `waited ${e.benWaitedS} s` : `stock → ${BEN.change.stock}`, at: [13, 75], mobileAt: [75, 12], state: e.benFailed ? "bad" : e.benWaitedS ? "wait" : "good" },
    { id: "app", label: "Back office", sub: o.strategy === "optimistic" ? "checks rows updated" : "sends the form", at: [50, 50], mobileAt: [50, 45], state: "active" },
    { id: "pg", label: "Postgres", sub: `${money(e.final.priceCents)} · stock ${e.final.stock}${o.strategy === "none" ? "" : ` · v${e.final.version}`}`, at: [86, 50], mobileAt: [50, 82], state: lost ? "bad" : "good" },
  ];
  const packets: Packet[] =
    stage === 0 ? [...hops("la", ["ana", "app", "pg"], { label: o.strategy === "pessimistic" ? "FOR UPDATE" : "SELECT" }), ...hops("lb", ["ben", "app", "pg"], { label: o.strategy === "pessimistic" ? "waits" : "SELECT", tone: o.strategy === "pessimistic" ? "bad" : "accent", start: 0.3 })]
    : stage === 1 ? hops("sa", ["ana", "app", "pg"], { label: "UPDATE 1", tone: "good" })
    : stage === 2 ? hops("sb", ["ben", "app", "pg"], { label: o.strategy === "none" ? "overwrites" : o.strategy === "optimistic" ? "UPDATE 0" : e.benFailed ? "timeout" : "after Ana", tone: o.strategy === "none" || e.benFailed ? "bad" : o.strategy === "optimistic" ? "bad" : "good" })
    : stage === 3 ? hops("r", ["pg", "app", "ben"], { label: lost ? "Ana's price gone" : o.strategy === "optimistic" ? "reload, reapply" : "saved", tone: lost ? "bad" : "good" })
    : stage === 4 ? hops("x", ["app", "pg"], { label: `${o.clients} clients`, tone: "accent" })
    : [];

  const captions = [
    o.strategy === "pessimistic" ? `Step 1: Ana opens the product with SELECT … FOR UPDATE and starts editing. Ben opens it ${BEN.loadsAt} s later and his page hangs.` : `Step 1: Ana and Ben both load product 42: ${money(LOADED.priceCents)}, stock ${LOADED.stock}${o.strategy === "optimistic" ? `, version ${LOADED.version}` : ""}.`,
    `Step 2: Ana saves her price change at ${ANA.savesAt} s.`,
    o.strategy === "none" ? "Step 3: Ben saves his whole form, which still has the old price, and it succeeds." : o.strategy === "optimistic" ? `Step 3: Ben's UPDATE … AND version = ${LOADED.version} matches no row: someone changed it since he loaded it.` : e.benFailed ? "Step 3: Ben gave up waiting after 10 s with a lock timeout." : `Step 3: Ben's form loads only when Ana commits, after waiting ${e.benWaitedS} s.`,
    lost ? `Step 4: the product says ${money(e.final.priceCents)} again. Nobody got an error; Ana's change is just gone.` : o.strategy === "optimistic" ? `Step 4: the app reloads version ${LOADED.version + 1}, reapplies Ben's stock change and saves: ${money(e.final.priceCents)}, stock ${e.final.stock}.` : `Step 4: both changes are in: ${money(e.final.priceCents)}, stock ${e.final.stock}, but Ben spent ${e.benWaitedS} s blocked.`,
    `Step 5: ${o.clients} clients on ${o.rows} hot row${o.rows === 1 ? "" : "s"}: optimistic ${load.opt.perSec}/s with ${load.opt.retries.toLocaleString("en-US")} retries; pessimistic ${load.pes.perSec}/s with ${(load.pes.waitMs / 1000).toFixed(0)} s of waiting.`,
  ];
  const caption = stage !== null ? captions[stage] : `${label}: ${lost ? "Ana's price change was silently lost" : e.benFailed ? "Ben got a lock-timeout error" : e.benWaitedS ? `no lost update, Ben waited ${e.benWaitedS} s` : "no lost update, nobody waited"}.`;

  const rowsTable = [
    { name: "Commits per second", opt: `${load.opt.perSec}`, pes: `${load.pes.perSec}` },
    { name: "Attempts thrown away", opt: load.opt.retries.toLocaleString("en-US"), pes: "0" },
    { name: "Most attempts for one update", opt: `${load.opt.worstAttempts}`, pes: "1" },
    { name: "Time spent waiting for locks", opt: "0 s", pes: `${(load.pes.waitMs / 1000).toFixed(1)} s` },
    { name: "Transactions open on average", opt: load.opt.openTxns.toFixed(1), pes: load.pes.openTxns.toFixed(1) },
  ];

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Optimistic vs pessimistic locking"
        blurb="Two people edit the same product. Pessimistic locking locks the row when the first one opens it, so the second waits. Optimistic locking lets both edit and checks a version number when they save, so the second gets a conflict instead of silently undoing the first. Then put 50 clients on a few hot rows and compare."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Ana and Ben edit product 42 through a back office that talks to Postgres"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "ana", to: "app", label: "form" },
                  { from: "ben", to: "app", label: "form" },
                  { from: "app", to: "pg", label: "SQL" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The SQL each save sends">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{label} · what reaches the database</p>
                <ol className="mt-2 space-y-1.5 text-[11px]">
                  {e.lines.map((l, i) => (
                    <li key={i} className="min-w-0">
                      <span className="font-mono text-[var(--faint)]">{l.t}s </span>
                      <span className="font-medium">{l.who}</span> <code className="break-words font-mono text-[var(--muted)]">{l.sql}</code>
                      <span className="block pl-6" style={{ color: l.bad ? "var(--bad)" : "var(--good)" }}>→ {l.result}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs font-medium" style={{ color: lost ? "var(--bad)" : "var(--good)" }}>
                  Final row: {money(e.final.priceCents)}, stock {e.final.stock}
                  {lost ? ` · lost ${e.lost.join(", ")}` : " · both changes kept"}
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Save the whole form
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Version column
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Editing…">
                Run both edits
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Load the row into a form" what="A person reads a row, thinks for half a minute, then saves. Pessimistic locking locks the row at read time and holds the lock (and a database connection) while they think. Optimistic locking reads the row and its version number and holds nothing." accent={ACCENT} active={at(0)}>
                <Choices<Strategy> accent={ACCENT} value={o.strategy} onChange={(v) => set({ strategy: v })} options={[{ id: "none", label: "No check" }, { id: "optimistic", label: "Optimistic: version column" }, { id: "pessimistic", label: "Pessimistic: FOR UPDATE" }]} />
              </FlowStep>
              <FlowArrow label={`Ana saves at ${ANA.savesAt} s`} accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="The first save goes through" what="Ana changes the price. With a version column, her UPDATE also checks the version she loaded and bumps it, in the same statement, so the check and the write can't be split." accent={ACCENT} active={at(1)}>
                <code className="block break-words font-mono text-[11px] text-[var(--muted)]">{e.lines.find((l) => l.who === "Ana" && l.sql.startsWith("UPDATE"))?.sql ?? "UPDATE …; COMMIT"}</code>
              </FlowStep>
              <FlowArrow label={`Ben saves at ${BEN.savesAt} s`} accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="The second save: overwrite, conflict or wait" what="Ben's form still holds the price he loaded. With no check his save quietly puts it back. With a version check his UPDATE matches 0 rows, and the app knows. With FOR UPDATE he was never allowed to load it in the first place." accent={ACCENT} active={at(2)}>
                {o.strategy === "pessimistic" && (
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" checked={o.timeout} onChange={(ev) => set({ timeout: ev.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                    SET lock_timeout = &apos;10s&apos;
                  </label>
                )}
                <p className="font-mono text-[11px]" style={{ color: benLine?.bad || lost ? "var(--bad)" : "var(--muted)" }}>
                  {benLine ? `${benLine.sql} → ${benLine.result}` : ""}
                </p>
              </FlowStep>
              <FlowArrow label={lost ? "nothing noticed" : "handled"} accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Resolve the conflict" what="Zero rows updated means someone else saved first. The app reloads, then retries if the changes touch different fields, or shows both versions if they don't. The point is that it gets to choose; nothing is lost silently." accent={ACCENT} active={at(3)}>
                <p className="text-xs" style={{ color: lost ? "var(--bad)" : "var(--good)" }}>
                  {lost ? `Lost: ${e.lost[0]}.` : `Kept both: ${money(e.final.priceCents)} and stock ${e.final.stock}.`}
                  {o.strategy === "pessimistic" && e.connectionsHeldS ? ` Transactions stayed open for ${e.connectionsHeldS} s of people thinking.` : ""}
                </p>
              </FlowStep>
              <FlowArrow label="now with many clients" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Compare them under contention" what="Many clients read a row, do some work, and write it back. Optimistic attempts that lose the race are thrown away and redone. Pessimistic clients queue for the lock, each holding a transaction open while it waits." accent={ACCENT} active={at(4)}>
                <Slider label="Clients" value={o.clients} min={2} max={50} step={1} format={(v) => String(v)} onChange={(v) => set({ clients: v })} accent={ACCENT} />
                <Slider label="Rows they update" value={o.rows} min={1} max={100} step={1} format={(v) => String(v)} onChange={(v) => set({ rows: v })} accent={ACCENT} />
                <Slider label="Work between read and write" value={o.workMs} min={5} max={200} step={5} format={(v) => `${v} ms`} onChange={(v) => set({ workMs: v })} accent={ACCENT} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[17rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">5 seconds of load</th>
                        <th className="py-1 text-right font-normal">optimistic</th>
                        <th className="py-1 text-right font-normal">pessimistic</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {rowsTable.map((r) => (
                        <tr key={r.name} className="border-t border-[var(--line)]">
                          <td className="py-1 font-sans text-[var(--muted)]">{r.name}</td>
                          <td className="py-1 text-right">{r.opt}</td>
                          <td className="py-1 text-right">{r.pes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">A seeded simulation, 1 ms at a time: conflicts, retries and lock waits are counted; a read or write takes 2 ms. The editors&apos; SQL and results are computed.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
