"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { SCENARIOS, crdt, naive, opLabel, ot } from "@/lib/collaborativeEditing";

const ACCENT = "var(--sys)";
type Method = "naive" | "ot" | "crdt";
const METHODS: { id: Method; label: string }[] = [
  { id: "naive", label: "Apply as sent" },
  { id: "ot", label: "Operational transform" },
  { id: "crdt", label: "CRDT" },
];

export default function CollaborativeEditingDemo() {
  const [sid, setSid] = useState(SCENARIOS[0].id);
  const [method, setMethod] = useState<Method>("naive");
  const { stage, busy, run } = useWalk(5, 1200);
  const at = (i: number) => stage === i;
  const s = SCENARIOS.find((x) => x.id === sid)!;
  const runs = { naive: naive(s), ot: ot(s), crdt: crdt(s) };
  const r = runs[method];
  const c = runs.crdt;
  const phase = stage === null ? 3 : stage <= 1 ? 1 : stage === 2 ? 2 : 3; // 1: local edits, 2: in flight, 3: applied

  const captions = [
    `Step 1: both start from “${s.start}”. ${s.what}`,
    `Step 2: each sees their own edit at once: Ann “${r.annLocal}”, Ben “${r.benLocal}”.`,
    `Step 3: each edit travels to the other person as an operation.`,
    `Step 4: ${METHODS.find((m) => m.id === method)!.label.toLowerCase()}: Ann ends with “${r.ann}”, Ben with “${r.ben}”${r.converged ? "." : ". They disagree, and nothing will fix it."}`,
    `Step 5: ${r.converged ? "converged" : "diverged"}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${s.label}, ${METHODS.find((m) => m.id === method)!.label.toLowerCase()}: Ann “${r.ann}”, Ben “${r.ben}”: ${r.converged ? "the same" : "different"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Collaborative editing"
        blurb="Two people edit the same document at the same moment. Each sees their own change instantly, then receives the other's. Applied as sent, positions point at the wrong letters and the two copies drift apart for good. Operational transformation fixes the positions; a CRDT gives every character an identity so positions never matter. Both algorithms run here on real edits."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Ann's and Ben's copies of the document">
              <div className="grid gap-3 sm:grid-cols-2">
                {(["Ann", "Ben"] as const).map((who) => {
                  const text = phase === 1 ? (who === "Ann" ? r.annLocal : r.benLocal) : phase === 2 ? (who === "Ann" ? r.annLocal : r.benLocal) : who === "Ann" ? r.ann : r.ben;
                  const incoming = who === "Ann" ? r.annReceives : r.benReceives;
                  return (
                    <div key={who} className="rounded-md border border-[var(--line)] p-3">
                      <p className="text-xs text-[var(--muted)]">{who}&rsquo;s screen</p>
                      <p className="mt-1 font-mono text-2xl tracking-[0.2em]" style={{ color: phase === 3 ? (r.converged ? "var(--good)" : "var(--bad)") : "var(--text)" }}>
                        {text || "∅"}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
                        {phase === 1 ? `own edit: ${opLabel(who === "Ann" ? s.a : s.b)}` : `receives: ${opLabel(incoming)}`}
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-center font-mono text-sm" style={{ color: r.converged ? "var(--good)" : "var(--bad)" }}>
                {phase < 3 ? `started from “${s.start}”` : r.converged ? "same document on both screens" : "the copies have diverged"}
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Edits" accent={ACCENT} value={sid} onChange={setSid} options={SCENARIOS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <div className="w-full">
                <Choices label="Method" accent={ACCENT} value={method} onChange={setMethod} options={METHODS} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Typing…">
                Type at the same time
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Apply your own edit at once" what="Waiting for a server round trip before a keystroke appears feels broken, so every editor applies local edits immediately. That's what makes concurrent edits possible: both people change the document before either hears of the other." accent={ACCENT} active={at(0) || at(1)}>
                <p className="font-mono text-xs">
                  “{s.start}” → Ann “{r.annLocal}” ({opLabel(s.a)}) · Ben “{r.benLocal}” ({opLabel(s.b)})
                </p>
              </FlowStep>
              <FlowArrow label="operations cross" accent={ACCENT} active={at(2)} />

              <FlowStep n={2} title="Applied as sent, positions go stale" what="“Insert at 3” meant position 3 in the text Ann had. In Ben's text, position 3 is a different place. Apply the operation anyway and each copy gets a different result, with no way to tell which is right." accent={ACCENT} active={at(2) || (at(3) && method === "naive")}>
                <Result r={runs.naive} />
                {s.id === "insert-delete" && <p className="mt-1 text-[11px] text-[var(--muted)]">This pair happens to land right as sent. Others don&rsquo;t, so it can&rsquo;t be relied on.</p>}
              </FlowStep>
              <FlowArrow label="fix the positions" accent={ACCENT} active={at(3)} />

              <FlowStep n={3} title="Operational transformation: shift what you missed" what="Before applying an incoming operation, transform it against the ones it didn't know about: an insert before your position shifts you right, a delete before it shifts you left. Ties at the same spot need a fixed rule (here, Ann's goes first). A central server usually orders operations; Google Docs works this way." accent={ACCENT} active={at(3) && method === "ot"}>
                <p className="font-mono text-[11px] text-[var(--muted)]">
                  Ann applies {opLabel(runs.ot.annReceives)} · Ben applies {opLabel(runs.ot.benReceives)}
                </p>
                <Result r={runs.ot} />
              </FlowStep>
              <FlowArrow label="or drop positions entirely" accent={ACCENT} active={at(4)} />

              <FlowStep n={4} title="CRDT: every character has an identity" what="Each character gets a unique id (a counter and the author) and records which character it was typed after. An insert says “after character 3@init”, which means the same thing on every copy. Concurrent inserts in the same spot are ordered by id. Deletes leave tombstones so later edits can still find their anchors. No server needs to order anything." accent={ACCENT} active={at(4) && method === "crdt"}>
                <div className="flex flex-wrap gap-1">
                  {c.chars.map((ch) => (
                    <span key={ch.id} className="rounded border px-1.5 py-0.5 text-center font-mono text-[10px]" style={{ borderColor: ch.deleted ? "var(--line)" : ACCENT, opacity: ch.deleted ? 0.5 : 1, textDecoration: ch.deleted ? "line-through" : "none" }}>
                      <span className="block text-sm">{ch.ch}</span>
                      {ch.id}
                    </span>
                  ))}
                </div>
                <Result r={c} />
              </FlowStep>
              <FlowArrow label="the cost" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Pay for convergence" what="OT needs every pair of operation types transformed correctly, and a server to keep one order. CRDTs need no coordinator and work offline, but carry an id per character and keep deleted ones around; production libraries compress that heavily." accent={ACCENT} active={at(4)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {METHODS.map((m) => (
                    <li key={m.id} style={{ color: runs[m.id].converged ? "var(--good)" : "var(--bad)", fontWeight: m.id === method ? 700 : 400 }}>
                      {m.label}: {runs[m.id].converged ? "converges" : "diverges"} (“{runs[m.id].ann}” / “{runs[m.id].ben}”)
                    </li>
                  ))}
                  <li className="text-[var(--muted)]">
                    CRDT metadata here: {c.metadataBytes} bytes for {c.ann.length} visible characters · {c.tombstones} tombstone{c.tombstones === 1 ? "" : "s"}
                  </li>
                </ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Result({ r }: { r: { ann: string; ben: string; converged: boolean } }) {
  return (
    <p className="mt-1 font-mono text-xs" style={{ color: r.converged ? "var(--good)" : "var(--bad)" }}>
      Ann “{r.ann}” · Ben “{r.ben}” · {r.converged ? "converged" : "diverged"}
    </p>
  );
}
