"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { ALL, CONTROLS, ITEMS, NONE, SINKS, TICKETS, reach, totalItems, type Control } from "@/lib/dataLeakage";

const ACCENT = "var(--sys)";
const n = (v: number) => Math.round(v).toLocaleString("en-US");

export default function DataLeakageDemo() {
  const [on, setOn] = useState<Record<Control, boolean>>(NONE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (k: Control, v: boolean) => setOn((cur) => ({ ...cur, [k]: v }));
  const r = reach(on);
  const before = reach(NONE);
  const total = totalItems();

  const packets: Packet[] =
    stage === 0 ? hops("t", ["customer", "app"], { label: "ticket text", tone: "bad" })
    : stage === 1 ? hops("p", ["app", "redact", "provider"], { label: on.redact ? "[CARD]" : "4111 1111…", tone: on.redact ? "good" : "bad" })
    : stage === 2 ? hops("l", ["app", "logs"], { label: on.logScrub ? "metadata" : "full prompt", tone: on.logScrub ? "good" : "bad" })
    : stage === 3 ? hops("c", ["app", "cache"], { label: on.noShare ? "per user" : "shared", tone: on.noShare ? "good" : "bad" })
    : stage === 4 ? hops("o", ["provider", "app", "customer"], { label: on.outputFilter ? "masked reply" : "reply", tone: on.outputFilter ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: ${n(TICKETS)} tickets a day carry about ${n(total)} sensitive items: card numbers, IDs, pasted passwords, keys, health details.`,
    `Step 2: ${n(r.provider)} of them reach the model provider${on.redact ? " (what the detector missed)" : ""}.`,
    `Step 3: ${n(r.logs)} end up in your logs.`,
    `Step 4: ${n(r.otherUsers)} reach another customer; ${n(r.training)} may be used for training.`,
    `Step 5: ${n(r.tickets)} are repeated in replies or summaries.`,
  ];
  const caption = stage !== null ? captions[stage] : `Of ${n(total)} sensitive items a day: ${SINKS.map((s) => `${n(r[s.id])} to ${s.label.toLowerCase()}`).join(", ")}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Sensitive-data leakage"
        blurb={`A support assistant handles ${n(TICKETS)} tickets a day. Customers paste card numbers and passwords; engineers paste API keys into debug notes. None of it is an attack. Follow those items to the five places they shouldn't end up, and turn on the control for each.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A customer, your app, a redaction step, the model provider, your logs and a shared cache"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "customer", label: "Customer", sub: "pastes anything", at: [10, 50], mobileAt: [50, 8], state: "active" },
                  { id: "app", label: "Support app", sub: `${n(TICKETS)} tickets/day`, at: [36, 50], mobileAt: [50, 34], state: "active" },
                  { id: "redact", label: "Redaction", sub: on.redact ? "on" : "off", at: [62, 18], mobileAt: [20, 60], state: on.redact ? "good" : "dim" },
                  { id: "provider", label: "Model provider", sub: `${n(r.provider)} items · ${on.zdr ? "no retention" : "may retain"}`, at: [90, 18], mobileAt: [80, 60], state: r.provider > 200 ? "bad" : "wait" },
                  { id: "logs", label: "Logs", sub: `${n(r.logs)} items`, at: [62, 84], mobileAt: [20, 90], state: r.logs > 50 ? "bad" : "good" },
                  { id: "cache", label: "Shared cache", sub: on.noShare ? "per user" : "shared", at: [90, 84], mobileAt: [80, 90], state: on.noShare ? "good" : "bad" },
                ]}
                links={[
                  { from: "customer", to: "app", label: "ticket" },
                  { from: "app", to: "redact", label: "prompt", dim: !on.redact },
                  { from: "redact", to: "provider", label: "masked", dim: !on.redact },
                  { from: "app", to: "provider", label: "prompt", dim: on.redact },
                  { from: "app", to: "logs", label: "log" },
                  { from: "app", to: "cache", label: "cache" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Sensitive items reaching each place, per day">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">no controls</span>
                  <span className="text-right text-[var(--faint)]">now</span>
                  {SINKS.map((s) => (
                    <Row key={s.id} cells={[s.label, n(before[s.id]), n(r[s.id])]} good={r[s.id] < before[s.id] * 0.2} />
                  ))}
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Following…">
                Follow a ticket
              </RunButton>
              <button type="button" onClick={() => setOn(ALL)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                All controls
              </button>
              <button type="button" onClick={() => setOn(NONE)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                None
              </button>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Expect sensitive data in every input" what="Users paste what they have. Nobody asked for a card number, and it arrives anyway, at a steady rate." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {ITEMS.map((i) => (
                    <li key={i.id}>
                      {i.label}: {n(TICKETS * i.perTicket)} a day · detector finds {Math.round(i.detectable * 100)}%
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="before the prompt" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Redact before it reaches the model" what="Replace what a detector can find (card numbers, IDs, keys) with placeholders before building the prompt. Formats are caught reliably; free text like a pasted password or a health detail much less so." accent={ACCENT} active={at(1)}>
                <Toggle on={on} set={set} id="redact" />
                <Toggle on={on} set={set} id="zdr" />
              </FlowStep>
              <FlowArrow label="your own systems" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Don't log what you redacted" what="Prompt logs and traces are the most common leak: full text, kept for months, readable by many engineers. Keep metadata and redacted text, for days, with access control." accent={ACCENT} active={at(2)}>
                <Toggle on={on} set={set} id="logScrub" />
              </FlowStep>
              <FlowArrow label="other customers" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Never share personal context between users" what="Caches and memories keyed without the user turn one customer's details into another's answer. Rare, and the worst kind of incident when it happens." accent={ACCENT} active={at(3)}>
                <Toggle on={on} set={set} id="noShare" />
              </FlowStep>
              <FlowArrow label="the reply" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Filter what comes out" what="The model repeats what it was given: “I see your card ending 4242…” is fine, the full number isn't. Mask sensitive values in replies and summaries before they're sent or stored." accent={ACCENT} active={at(4)}>
                <Toggle on={on} set={set} id="outputFilter" />
                <p className="mt-2 text-[11px] text-[var(--faint)]">Frequencies and detection rates are illustrative; the point is that each control protects specific places, and none protects them all.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Toggle({ on, set, id }: { on: Record<Control, boolean>; set: (k: Control, v: boolean) => void; id: Control }) {
  const c = CONTROLS.find((x) => x.id === id)!;
  return (
    <>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={on[id]} onChange={(e) => set(id, e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
        {c.label}
      </label>
      <p className="text-[11px] text-[var(--muted)]">{c.what}</p>
    </>
  );
}

function Row({ cells, good }: { cells: string[]; good: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ color: i === 2 ? (good ? "var(--good)" : "var(--bad)") : "var(--text)" }}>
          {c}
        </span>
      ))}
    </>
  );
}
