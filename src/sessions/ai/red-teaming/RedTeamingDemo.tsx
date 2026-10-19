"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ATTACKS, BIG_REFUNDS, DEFENSES, NONE, NORMAL, REFUND_LIMIT, SECRET, TRIES, campaign, leaked, sideEffects, type DefenseId, type Defenses } from "@/lib/redTeaming";

const ACCENT = "var(--ai)";
const ALL: Defenses = { classifier: true, outputFilter: true, spotlight: true, toolGate: true };
const GOAL = { leak: { label: "leak the code", color: "var(--c1)" }, refund: { label: `refund > $${REFUND_LIMIT}`, color: "var(--c4)" } };

export default function RedTeamingDemo() {
  const [d, setD] = useState<Defenses>(NONE);
  const { stage, busy, run } = useWalk(5, 1100);
  const c = campaign(d);
  const fx = sideEffects(d);
  const baseline = campaign(NONE);
  const at = (i: number) => stage === i;
  const preset = Object.values(d).every(Boolean) ? "all" : Object.values(d).every((v) => !v) ? "none" : null;
  const set = (id: DefenseId, v: boolean) => setD((cur) => ({ ...cur, [id]: v }));
  const worst = [...c.rows].sort((a, b) => b.hits.filter(Boolean).length - a.hits.filter(Boolean).length)[0];
  const asr = (x: number) => `${Math.round(x * 100)}%`;

  const captions = [
    `Step 1: ${ATTACKS.length} techniques, aimed at two things the bot must protect.`,
    `Step 2: each attack tried ${TRIES} times. The same prompt works on some tries and not others.`,
    `Step 3: ${c.successes} of ${c.total} tries got through, checked by code.`,
    preset === "none" ? "Step 4: no defenses yet beyond the system prompt's rules." : `Step 4: with these defenses the success rate goes from ${asr(baseline.asr)} to ${asr(c.asr)}.`,
    `Step 5: ${fx.blocked} honest requests in ${NORMAL.toLocaleString("en-US")} refused${fx.toPerson ? `, ${fx.toPerson} genuine refunds waiting for a person` : ""}.`,
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : c.successes === 0
        ? "Nothing got through in this run. That is not proof: a new technique tomorrow might."
        : `${c.successes} of ${c.total} attempts got through (${asr(c.asr)}). Most effective: ${worst.attack.technique.toLowerCase()}. ${worst.attack.why}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Red-teaming"
        blurb="Before launch, attack your own bot the way users will. This support bot must never reveal a staff discount code or refund more than $100 on its own. Run eight attack techniques ten times each, grade the results with code, then add defenses and count what they cost."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Each attack and which of its ten tries succeeded">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {ATTACKS.length} attacks × {TRIES} tries
                </p>
                <p className="font-mono text-sm" style={{ color: c.asr > 0.15 ? "var(--bad)" : c.asr > 0.05 ? "var(--text)" : "var(--good)" }}>
                  {c.successes}/{c.total} got through · {asr(c.asr)}
                </p>
              </div>
              <ul className="mt-3 space-y-2">
                {c.rows.map((r) => {
                  const hits = r.hits.filter(Boolean).length;
                  return (
                    <li key={r.attack.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                      <span className="min-w-0 text-sm">
                        {r.attack.technique}{" "}
                        <span className="font-mono text-[11px]" style={{ color: GOAL[r.attack.goal].color }}>
                          {GOAL[r.attack.goal].label}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        {r.hits.map((h, i) => (
                          <span key={i} className="h-3 w-3 rounded-full" style={{ background: h ? "var(--bad)" : "var(--track)" }} />
                        ))}
                        <span className="ml-1 w-6 text-right font-mono text-xs">{hits}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-y-1 border-t border-[var(--line)] pt-3 text-sm">
                <dt className="text-[var(--muted)]">Honest requests refused (of {NORMAL.toLocaleString("en-US")})</dt>
                <dd className="font-mono">{fx.blocked}</dd>
                <dt className="text-[var(--muted)]">Genuine big refunds sent to a person</dt>
                <dd className="font-mono">
                  {fx.toPerson} / {BIG_REFUNDS}
                </dd>
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Defenses" accent={ACCENT} value={preset} onChange={(id) => setD(id === "all" ? ALL : NONE)} options={[{ id: "none", label: "System prompt only" }, { id: "all", label: "Every defense" }]} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Attacking…">
                Run the campaign
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Write the attacks" what="Start from what must never happen, then list the ways people try: plain asking, role-play, encoding, splitting, slow escalation, other languages, false authority, and instructions hidden in documents." accent={ACCENT} active={at(0)}>
                <ul className="space-y-1.5 text-sm">
                  {ATTACKS.map((a) => (
                    <li key={a.id}>
                      <span className="font-medium">{a.technique}</span>
                      <span className="block font-mono text-xs text-[var(--muted)]">{a.example}</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label={`${ATTACKS.length} attacks`} accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Run each one many times" what="The model samples, so one try proves little. An attack that works 2 times in 10 will work thousands of times a day in production." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-sm">
                  {ATTACKS.length} × {TRIES} = {c.total} attempts
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Tools such as garak and PyRIT generate and replay attack sets like this automatically.</p>
              </FlowStep>
              <FlowArrow label="replies and tool calls" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Grade with code" what="Did the reply contain the code? Did the refund tool run above the limit? Check it in code, and normalize first, so a spaced-out or split leak still counts." accent={ACCENT} active={at(2)}>
                <ul className="space-y-1 font-mono text-xs">
                  <li>
                    “{SECRET}” → {leaked([SECRET]) ? "leak ✓" : "no"}
                  </li>
                  <li>“S T A F F - 7 Q 2 X” → {leaked(["S T A F F - 7 Q 2 X"]) ? "leak ✓" : "no"}</li>
                  <li>
                    “STAFF-”, then “7Q2X” → {leaked(["STAFF-", "7Q2X"]) ? "leak ✓" : "no"}
                  </li>
                  <li>refund(amount: 250) → over ${REFUND_LIMIT} ✓</li>
                </ul>
              </FlowStep>
              <FlowArrow label={`${c.successes} successes`} accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Add defenses, run it again" what="Layer them. Filters on words are easy to dodge; limits enforced in your own code are not." accent={ACCENT} active={at(3)}>
                <ul className="space-y-2">
                  {DEFENSES.map((def) => (
                    <li key={def.id}>
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="checkbox" checked={d[def.id]} onChange={(e) => set(def.id, e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                        {def.label}
                      </label>
                      <p className="pl-6 text-xs text-[var(--muted)]">{def.what}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-mono text-xs">
                  success rate {asr(baseline.asr)} → {asr(c.asr)}
                </p>
              </FlowStep>
              <FlowArrow label="safer, at a cost" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Count the cost, and keep it running" what="Every defense also catches some honest users. Track both numbers, keep the attacks as a regression suite, and rerun it on every new model or prompt." accent={ACCENT} active={at(4)}>
                <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-y-1 text-sm">
                  <dt className="text-[var(--muted)]">Attack success rate</dt>
                  <dd className="font-mono">{asr(c.asr)}</dd>
                  <dt className="text-[var(--muted)]">Honest requests refused</dt>
                  <dd className="font-mono">
                    {fx.blocked} / {NORMAL.toLocaleString("en-US")}
                  </dd>
                  <dt className="text-[var(--muted)]">Refunds waiting for a person</dt>
                  <dd className="font-mono">{fx.toPerson}</dd>
                </dl>
                {c.successes > 0 && (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Still getting through: {c.rows.filter((r) => r.hits.some(Boolean)).map((r) => r.attack.technique.toLowerCase()).join(", ")}. {worst.attack.why}
                  </p>
                )}
                <p className="mt-1 text-xs text-[var(--faint)]">Success rates are a teaching model; the techniques and defenses are the standard ones (OWASP Top 10 for LLM apps).</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
