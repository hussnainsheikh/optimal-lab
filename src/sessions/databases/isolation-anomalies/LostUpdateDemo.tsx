"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { STRATEGIES, runLostUpdate, type Strategy } from "@/lib/lostUpdate";

const ACCENT = "var(--db)";

export default function LostUpdateDemo() {
  const [s, setS] = useState<Strategy>("naive");
  const frames = runLostUpdate(s);
  const playback = usePlayback(frames.length, 1300);
  const f = frames[playback.i];
  const st = STRATEGIES.find((x) => x.id === s)!;
  const final = frames.at(-1)!.balance;
  return (
    <SessionPage>
      <SessionHeader kicker="Databases · interactive" title="The lost update" blurb="Two requests add money to the same account at the same moment. Each reads the balance, adds in the application, and writes it back. The database did exactly what it was told, and one deposit vanished. Four ways to stop it." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Two transactions on one row">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">balance</p>
                <p className="font-mono text-3xl tabular-nums" style={{ color: playback.atEnd ? (final === 180 ? "var(--good)" : "var(--bad)") : "var(--text)" }}>{f.balance}</p>
              </div>
              <ol className="mt-3 space-y-1.5">
                {frames.slice(0, playback.i + 1).map((x, i) => (
                  <li key={i} className="rounded-md border px-2.5 py-1.5 text-sm" style={{ borderColor: x.error ? "var(--bad)" : i === playback.i ? ACCENT : "var(--line)", background: "var(--inset)", marginLeft: x.who === "T2" ? "25%" : 0, marginRight: x.who === "T1" ? "25%" : 0 }}>
                    <span className="font-mono text-[11px] text-[var(--faint)]">{x.who}</span> <span style={{ color: x.error ? "var(--bad)" : undefined }}>{x.text}</span>
                  </li>
                ))}
              </ol>
            </section>
          }
          panel={
            <SystemMapPanel caption={f.text}>
              <Choices label="How the code updates" accent={ACCENT} value={s} onChange={(v) => { setS(v); playback.reset(); }} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
              <p className="w-full font-mono text-xs text-[var(--muted)]">{st.sql}</p>
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next" status={`step ${playback.i + 1} of ${frames.length}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Read, change in code, write back" what="The common pattern: SELECT, compute in the app, UPDATE with the new number. Fine alone; broken when two run at once." accent={ACCENT} active={s === "naive"}><p className="text-sm text-[var(--muted)]">Read Committed (the default) allows this.</p></FlowStep>
              <FlowArrow label="lock the row" accent={ACCENT} />
              <FlowStep n={2} title="Lock what you read: FOR UPDATE" what="The second transaction waits at its read until the first commits, then reads the new value." accent={ACCENT} active={s === "for-update"}><p className="text-sm text-[var(--muted)]">Costs some waiting; always correct.</p></FlowStep>
              <FlowArrow label="or let the database detect it" accent={ACCENT} />
              <FlowStep n={3} title="Stronger isolation: SERIALIZABLE" what="The database spots the conflict and fails one transaction. The app must catch the error and retry." accent={ACCENT} active={s === "serializable"}><p className="text-sm text-[var(--muted)]">Correct, but only if you write the retry.</p></FlowStep>
              <FlowArrow label="or don't read at all" accent={ACCENT} />
              <FlowStep n={4} title="Do the math in the database" what="balance = balance + 30 reads and writes under one row lock. Simplest fix when the change is a plain addition." accent={ACCENT} active={s === "atomic"}>
                <ul className="space-y-1 text-sm">{STRATEGIES.map((x) => <li key={x.id} className="flex justify-between gap-3"><span>{x.label}</span><span className="font-mono" style={{ color: runLostUpdate(x.id).at(-1)!.balance === 180 ? "var(--good)" : "var(--bad)" }}>{runLostUpdate(x.id).at(-1)!.balance}</span></li>)}</ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
