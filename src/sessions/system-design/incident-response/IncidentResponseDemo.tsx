"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ALL, AVG_ORDER, CHECKOUTS_PER_MIN, ERROR_SHARE, NONE, PRACTICES, clock, run, type Practices } from "@/lib/incidentResponse";

const ACCENT = "var(--sys)";
const PHASE_COLOR = { detect: "var(--c1)", ack: "var(--c2)", diagnose: "var(--c3)", mitigate: "var(--c4)" } as const;

export default function IncidentResponseDemo() {
  const [p, setP] = useState<Practices>(NONE);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const r = run(p);
  const best = run(ALL);
  const at = (i: number) => stage === i;
  const set = (k: keyof Practices, v: boolean) => setP((cur) => ({ ...cur, [k]: v }));
  const ph = (id: (typeof r.phases)[number]["id"]) => r.phases.find((x) => x.id === id)!;
  const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

  const captions = [
    `Step 1: 14:00, a deploy breaks checkout for ${Math.round(ERROR_SHARE * 100)}% of customers. Detected at ${clock(ph("detect").end)} by ${ph("detect").who}.`,
    `Step 2: acknowledged at ${clock(ph("ack").end)} by ${ph("ack").who}.`,
    `Step 3: cause found at ${clock(ph("diagnose").end)}, ${ph("diagnose").who}.`,
    `Step 4: mitigated at ${clock(ph("mitigate").end)} by ${ph("mitigate").who}. ${r.failed.toLocaleString("en-US")} checkouts failed.`,
    `Step 5: the postmortem lists ${r.actions.length} action${r.actions.length === 1 ? "" : "s"}, about systems, not people.`,
  ];
  const caption = stage !== null ? captions[stage] : `Broken from 14:00 to ${clock(r.totalMin)}: ${r.totalMin} minutes, ${r.failed.toLocaleString("en-US")} failed checkouts (${money(r.revenue)}), ${r.tickets} support tickets.`;

  const toggle = (k: keyof Practices) => {
    const x = PRACTICES.find((y) => y.id === k)!;
    return (
      <>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={p[k]} onChange={(e) => set(k, e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
          {x.label}
        </label>
        <p className="text-xs text-[var(--muted)]">{p[k] ? x.on : x.off}</p>
      </>
    );
  };

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Incident response and postmortems"
        blurb={`At 14:00 a deploy breaks checkout for ${Math.round(ERROR_SHARE * 100)}% of customers, ${CHECKOUTS_PER_MIN} checkouts a minute. How long it lasts depends less on the bug than on how the team responds: what alerts, who is paged, who coordinates, how fast you can undo, and whether customers are told. Turn each practice on and watch the timeline shrink.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The incident timeline, phase by phase">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">14:00 → {clock(r.totalMin)}</p>
                <p className="font-mono text-sm" style={{ color: r.totalMin > 60 ? "var(--bad)" : "var(--text)" }}>
                  {r.totalMin} min broken
                </p>
              </div>
              <Timeline phases={r.phases} scale={run(NONE).totalMin} stage={stage} />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]">
                <span>14:00</span>
                <span>{clock(run(NONE).totalMin)}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <Stat label="minutes broken" value={String(r.totalMin)} bad={r.totalMin > best.totalMin} />
                <Stat label="failed checkouts" value={r.failed.toLocaleString("en-US")} bad={r.totalMin > best.totalMin} />
                <Stat label="revenue lost" value={money(r.revenue)} />
                <Stat label="support tickets" value={String(r.tickets)} bad={!p.statusPage} />
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Responding…">
                Replay the incident
              </RunButton>
              <button type="button" onClick={() => setP(ALL)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                All practices on
              </button>
              <button type="button" onClick={() => setP(NONE)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                All off
              </button>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Detect it from what users feel" what="Causes are many and hard to predict; symptoms are few. A bad deploy can leave CPU and memory perfectly normal while a third of checkouts fail. Alert on error rate and latency of the things users do." accent={ACCENT} active={at(0)}>
                {toggle("symptomAlert")}
                <p className="mt-1 font-mono text-xs">detected at {clock(ph("detect").end)}</p>
              </FlowStep>
              <FlowArrow label="an alert" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Get one person to own it" what="An alert in a busy channel is everyone's and no one's. Paging an on-call engineer, who must acknowledge, turns it into one person's job within minutes." accent={ACCENT} active={at(1)}>
                {toggle("paging")}
                <p className="mt-1 font-mono text-xs">acknowledged at {clock(ph("ack").end)}</p>
              </FlowStep>
              <FlowArrow label="someone's on it" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Coordinate, and talk to customers" what="An incident commander doesn't fix anything: they assign who investigates what, keep a timeline, and decide. A separate person updates the status page, so engineers aren't interrupted and customers stop guessing." accent={ACCENT} active={at(2)}>
                {toggle("commander")}
                <div className="mt-2">
                  {toggle("statusPage")}
                </div>
                <p className="mt-1 font-mono text-xs">
                  cause found at {clock(ph("diagnose").end)} · {r.tickets} tickets
                </p>
              </FlowStep>
              <FlowArrow label="the cause" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Mitigate first, fix later" what="Stop the damage before understanding it fully. Rolling back the deploy is usually fastest, if every deploy can be rolled back. The proper fix can then be written calmly." accent={ACCENT} active={at(3)}>
                {toggle("rollback")}
                <p className="mt-1 font-mono text-xs">
                  mitigated at {clock(ph("mitigate").end)} · {r.failed.toLocaleString("en-US")} failed checkouts × ${AVG_ORDER} = {money(r.revenue)}
                </p>
              </FlowStep>
              <FlowArrow label="afterwards" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Write a blameless postmortem" what="A timeline, the impact, the contributing causes, and actions with owners. Blameless means asking what let a reasonable person make this mistake, because “be more careful” doesn't change anything and blame makes people hide the next one." accent={ACCENT} active={at(4)}>
                <div className="rounded-md border border-[var(--line)] bg-[var(--inset)] p-3 text-xs">
                  <p className="font-mono font-semibold">Postmortem: checkout errors after deploy</p>
                  <p className="mt-1 text-[var(--muted)]">
                    Impact: {r.totalMin} minutes, {Math.round(ERROR_SHARE * 100)}% of checkouts, {r.failed.toLocaleString("en-US")} failed, {r.tickets} tickets.
                  </p>
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                    {r.phases.map((x) => (
                      <li key={x.id}>
                        {clock(x.start)}–{clock(x.end)} {x.label.toLowerCase()} ({x.who})
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-semibold">Actions</p>
                  <ol className="list-decimal space-y-0.5 pl-5">
                    {r.actions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ol>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Phase lengths are illustrative; detection, acknowledgement, diagnosis and mitigation are the standard way to break down time to recover.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Timeline({ phases, scale, stage }: { phases: ReturnType<typeof run>["phases"]; scale: number; stage: number | null }) {
  return (
    <div className="mt-3 flex h-10 overflow-hidden rounded bg-[var(--track)]">
      {phases.map((x, i) => (
        <span
          key={x.id}
          className="flex h-full items-center justify-center overflow-hidden px-1 font-mono text-[10px] text-[var(--on-accent)] transition-[width] duration-300"
          style={{ width: `${((x.end - x.start) / scale) * 100}%`, background: PHASE_COLOR[x.id], opacity: stage === null || stage === i ? 1 : 0.45 }}
          title={`${x.label}: ${x.end - x.start} min`}
        >
          <span className="truncate">
            {x.label} {x.end - x.start}m
          </span>
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="font-mono text-sm" style={{ color: bad ? "var(--bad)" : "var(--text)" }}>
        {value}
      </dd>
    </div>
  );
}
