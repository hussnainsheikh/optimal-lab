"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { ACCOUNTS, DESIGNS, EVENTS, FEE_RATE, fmt, frames, reconcile, rounding, sum, type Design, type Faults, type Frame } from "@/lib/paymentsLedger";

const ACCENT = "var(--sys)";
const R = rounding();

export default function PaymentsLedgerDemo() {
  const [design, setDesign] = useState<Design>("balances");
  const [faults, setFaults] = useState<Faults>({ duplicate: true, crash: false });
  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Payments and ledgers"
        blurb={`A marketplace takes two card payments, keeps a ${FEE_RATE * 100}% fee, gets the money from the card processor and pays the seller. The processor retries webhooks, and servers die halfway through. Keep the books with balance columns or with a double-entry ledger, and see which one still matches the bank at the end of the day.`}
      />
      <div className="mt-6">
        <Run key={`${design}-${faults.duplicate}-${faults.crash}`} design={design} setDesign={setDesign} faults={faults} setFaults={setFaults} />
      </div>
    </SessionPage>
  );
}

function Run({ design, setDesign, faults, setFaults }: { design: Design; setDesign: (d: Design) => void; faults: Faults; setFaults: (f: Faults) => void }) {
  const list = frames(design, faults);
  const playback = usePlayback(list.length, 1500);
  const f = list[playback.i];
  const started = playback.i > 0 || playback.playing;
  const kind = f.event?.kind;
  const at = (...k: string[]) => !!kind && k.includes(kind);
  const rec = reconcile(f.balances, f.sentToSeller);
  const bad = f.tone === "bad";

  const packets: Packet[] = !started || !f.event
    ? []
    : kind === "pay" || kind === "dup"
      ? hops(`w${f.i}`, ["processor", "payments", "ledger"], { label: `webhook ${f.event.key}`, tone: bad ? "bad" : "accent" })
      : kind === "settle"
        ? hops(`s${f.i}`, ["processor", "bank"], { label: "€65.00" }).concat(hops(`s2${f.i}`, ["payments", "ledger"], { label: "settled", start: 1 }))
        : kind === "payout"
          ? hops(`p${f.i}`, ["ledger", "payments", "bank"], { label: fmt(f.sentToSeller), tone: bad ? "bad" : "good" })
          : hops(`r${f.i}`, ["bank", "recon"], { label: "statement" }).concat(hops(`r2${f.i}`, ["ledger", "recon"], { label: "balances" }));

  const toggle = (k: keyof Faults) => setFaults({ ...faults, [k]: !faults[k] });

  return (
    <SessionLayout
      visual={
        <div className="space-y-3">
          <SystemMap
            title="The card processor, the payments service, the ledger database, the bank and the reconciliation job"
            accent={ACCENT}
            chrome="split"
            nodes={[
              { id: "processor", label: "Card processor", sub: "webhooks", at: [12, 28], mobileAt: [22, 10], state: at("pay", "dup", "settle") ? "active" : "idle" },
              { id: "payments", label: "Payments service", sub: kind === "payout" && faults.crash ? "crashes" : "API", at: [42, 28], mobileAt: [22, 45], state: kind === "payout" && faults.crash ? "bad" : at("pay", "dup", "payout") ? "active" : "idle" },
              { id: "ledger", label: design === "ledger" ? "Ledger" : "Balances", sub: `books ${sum(f.balances) === 0 ? "balance" : `off ${fmt(sum(f.balances))}`}`, at: [72, 28], mobileAt: [78, 45], state: sum(f.balances) === 0 ? "good" : "bad" },
              { id: "bank", label: "Bank", sub: fmt(f.balances.bank), at: [27, 78], mobileAt: [22, 85], state: at("settle", "payout") ? "active" : "idle" },
              { id: "recon", label: "Reconciliation", sub: kind === "reconcile" ? (rec.ok ? "all match" : "mismatch") : "end of day", at: [72, 78], mobileAt: [78, 85], state: kind === "reconcile" ? (rec.ok ? "good" : "bad") : "idle" },
            ]}
            links={[
              { from: "processor", to: "payments", label: "webhook" },
              { from: "payments", to: "ledger", label: "write" },
              { from: "processor", to: "bank", label: "settlement" },
              { from: "payments", to: "bank", label: "payout" },
              { from: "bank", to: "recon", label: "statement", dashed: true },
              { from: "ledger", to: "recon", label: "balances", dashed: true },
            ]}
            packets={packets}
            aspect={1.9}
            mobileAspect={0.9}
          />
          <Books f={f} design={design} />
        </div>
      }
      panel={
        <SystemMapPanel caption={`${f.event ? `${f.i}. ${f.event.label}. ` : ""}${f.note}`}>
          <div className="w-full">
            <Choices label="Books" accent={ACCENT} value={design} onChange={setDesign} options={DESIGNS.map((d) => ({ id: d.id, label: d.label }))} />
          </div>
          <FaultBoxes faults={faults} toggle={toggle} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next event" status={`event ${f.i} of ${EVENTS.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Record every movement as two sides" what="Money never appears or disappears: it moves from one account to another. A payment is a debit to what the processor owes us and credits to what we owe the seller and to our fee. Each transaction's entries add up to zero, so the whole book does too." accent={ACCENT} active={at("pay")}>
            <Choices label="Books" accent={ACCENT} value={design} onChange={setDesign} options={DESIGNS.map((d) => ({ id: d.id, label: d.label }))} />
            <p className="mt-2 text-xs">{DESIGNS.find((d) => d.id === design)!.one}</p>
            <p className="mt-1 font-mono text-xs">{EVENTS[0].entries!.map((e) => `${e.account} ${fmt(e.amount)}`).join(" · ")} = {fmt(EVENTS[0].entries!.reduce((s, e) => s + e.amount, 0))}</p>
          </FlowStep>
          <FlowArrow label="the same webhook again" accent={ACCENT} active={at("dup")} />

          <FlowStep n={2} title="Make every write idempotent" what="Processors deliver webhooks at least once. Store the event id as a unique key on the transaction: the retry hits the constraint and is acknowledged without writing anything. Without a key, the retry is a second payment in your books." accent={ACCENT} active={at("dup")}>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={faults.duplicate} onChange={() => toggle("duplicate")} className="h-4 w-4" style={{ accentColor: ACCENT }} />
              The processor retries order B&rsquo;s webhook
            </label>
            {at("dup") && <Writes f={f} />}
          </FlowStep>
          <FlowArrow label="amounts in cents" accent={ACCENT} active={at("settle")} />

          <FlowStep n={3} title="Store money as integers in the smallest unit" what="A 10% fee on €19.99 is not a number a bank can pay. Floating point hides that and drifts; integer cents force you to decide where the half cent goes, once, in code, and make every split add back up exactly." accent={ACCENT} active={at("settle")}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
              <span />
              <span className="text-right text-[var(--faint)]">fee</span>
              <span className="text-right text-[var(--faint)]">seller</span>
              <span className="font-sans">float euros</span>
              <span className="text-right" style={{ color: "var(--bad)" }}>{R.feeFloat}</span>
              <span className="text-right" style={{ color: "var(--bad)" }}>{R.sellerFloat}</span>
              <span className="font-sans">integer cents</span>
              <span className="text-right" style={{ color: "var(--good)" }}>{R.fee}</span>
              <span className="text-right" style={{ color: "var(--good)" }}>{R.seller}</span>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {R.fee} + {R.seller} = {R.cents} cents exactly. A thousand float fees add up to {R.thousandFloat}, not {R.thousandCents / 100}.
            </p>
          </FlowStep>
          <FlowArrow label="money leaves" accent={ACCENT} active={at("payout")} />

          <FlowStep n={4} title="Write each transaction atomically" what="Both sides of a movement are written in one database transaction, or neither is. The call to the bank carries its own idempotency key, so a retry after a crash gets the first transfer back instead of making a second one." accent={ACCENT} active={at("payout")}>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={faults.crash} onChange={() => toggle("crash")} className="h-4 w-4" style={{ accentColor: ACCENT }} />
              The server dies in the middle of the payout
            </label>
            {at("payout") && <Writes f={f} />}
          </FlowStep>
          <FlowArrow label="compare with outside" accent={ACCENT} active={at("reconcile")} />

          <FlowStep n={5} title="Reconcile against the outside world" what="Balanced books can still be wrong: a duplicate written on both sides balances perfectly. Every day, match each account against the processor's report and the bank statement, line by line, and investigate every difference." accent={ACCENT} active={at("reconcile")}>
            {at("reconcile") ? (
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                <span />
                <span className="text-right text-[var(--faint)]">books</span>
                <span className="text-right text-[var(--faint)]">outside</span>
                {rec.lines.map((l) => (
                  <Line key={l.label} label={l.label} books={l.books} outside={l.outside} ok={l.ok} />
                ))}
              </div>
            ) : (
              <p className="font-mono text-xs text-[var(--muted)]">Runs after the last event of the day: play to the end.</p>
            )}
            <p className="mt-2 text-[11px] text-[var(--faint)]">Simplified: one seller, no processor fees, no currencies. Real ledgers also hold pending and settled states, and post corrections as new entries instead of editing old ones.</p>
          </FlowStep>
        </>
      }
    />
  );
}

function FaultBoxes({ faults, toggle }: { faults: Faults; toggle: (k: keyof Faults) => void }) {
  return (
    <div className="flex w-full flex-wrap gap-x-4">
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={faults.duplicate} onChange={() => toggle("duplicate")} className="h-4 w-4" style={{ accentColor: ACCENT }} />
        Duplicate webhook
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={faults.crash} onChange={() => toggle("crash")} className="h-4 w-4" style={{ accentColor: ACCENT }} />
        Crash mid-payout
      </label>
    </div>
  );
}

function Writes({ f }: { f: Frame }) {
  return (
    <ul className="mt-2 space-y-0.5 font-mono text-[11px]" style={{ color: f.tone === "bad" ? "var(--bad)" : "var(--muted)" }}>
      {f.writes.map((w) => (
        <li key={w}>{w}</li>
      ))}
    </ul>
  );
}

function Line({ label, books, outside, ok }: { label: string; books: number; outside: number; ok: boolean }) {
  return (
    <>
      <span className="font-sans">{label}</span>
      <span className="text-right" style={{ color: ok ? "var(--text)" : "var(--bad)" }}>
        {fmt(books)}
      </span>
      <span className="text-right">{fmt(outside)}</span>
    </>
  );
}

// The accounts and, for the ledger, the journal of transactions behind them.
function Books({ f, design }: { f: Frame; design: Design }) {
  const total = sum(f.balances);
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Account balances and the transactions behind them">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{design === "ledger" ? "balances = sum of entries" : "balance columns"}</p>
        <p className="font-mono text-xs" style={{ color: total === 0 ? "var(--good)" : "var(--bad)" }}>
          sum {fmt(total)}
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACCOUNTS.map((a) => (
          <div key={a.id} className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
            <dt className="text-[11px] text-[var(--muted)]">{a.label}</dt>
            <dd className="font-mono text-sm">{fmt(f.balances[a.id])}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-[var(--faint)]">
        {design === "ledger"
          ? f.journal.length
            ? `Journal: ${f.journal.map((j) => j.key).join(", ")}. Nothing is ever updated or deleted.`
            : "Journal: empty."
          : "No history: only the current number in each row. Positive is money held or owed to us; negative is money we owe."}
      </p>
    </section>
  );
}
