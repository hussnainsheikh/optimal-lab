"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { ALL, ATTACKS, BYPASS, DEFENSES, NONE, PROMPT_ONLY, outcome, type AttackId, type Defense } from "@/lib/promptInjection";

const ACCENT = "var(--sys)";

export default function PromptInjectionDemo() {
  const [a, setA] = useState<AttackId>("email");
  const [on, setOn] = useState<Record<Defense, boolean>>(NONE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (k: Defense, v: boolean) => setOn((cur) => ({ ...cur, [k]: v }));
  const atk = ATTACKS.find((x) => x.id === a)!;
  const o = outcome(a, on);
  const harmed = ATTACKS.filter((x) => outcome(x.id, on).harmed).length;
  const sep = on.separation;

  const packets: Packet[] =
    stage === 0 ? hops("in", [atk.kind === "direct" ? "user" : "attacker", atk.kind === "direct" ? "agent" : "inbox"], { label: atk.kind === "direct" ? "prompt" : "planted text", tone: "bad" })
    : stage === 1 ? hops("read", atk.kind === "direct" ? ["user", "agent"] : sep ? ["inbox", "reader"] : ["inbox", "agent"], { label: sep && atk.kind !== "direct" ? "into the quarantined reader" : "into the agent's context", tone: sep ? "good" : "bad" })
    : stage === 2 ? (sep && atk.kind !== "direct" ? hops("data", ["reader", "agent"], { label: "fields only", tone: "good" }) : hops("act", ["agent", "tools"], { label: "tool call", tone: o.harmed ? "bad" : "good" }))
    : stage === 3 ? hops("out", ["tools", "outside"], { label: o.harmed ? "data leaves" : "blocked", tone: o.harmed ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: ${atk.kind === "direct" ? "the user types the attack" : "the attacker plants text where the agent will read it"}: ${atk.payload}`,
    sep && atk.kind !== "direct" ? "Step 2: untrusted text goes to a quarantined model with no tools." : "Step 2: the text lands in the same context as the user's request and the agent's tools.",
    `Step 3: ${o.harmed ? `it works ${o.chance < 1 ? `about ${Math.round(o.chance * 100)}% of the time` : "every time"}` : "the attack has nothing to act through"}.`,
    o.harmed ? `Step 4: ${atk.harm}.` : `Step 4: stopped by ${DEFENSES.find((d) => d.id === o.by)!.label.toLowerCase()}.`,
    `Step 5: ${harmed} of ${ATTACKS.length} attacks still cause harm.`,
  ];
  const caption = stage !== null ? captions[stage] : `${atk.label}: ${o.harmed ? `succeeds ${o.chance < 1 ? `about ${Math.round(o.chance * 100)}% of the time` : "every time"} (${atk.harm})` : `stopped by ${DEFENSES.find((d) => d.id === o.by)!.label.toLowerCase()}`}. ${harmed} of ${ATTACKS.length} attacks still work.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Prompt injection, direct and indirect"
        blurb="An email assistant reads your inbox and web pages, searches your files and can send email. A model can't reliably tell your instructions from instructions that arrive inside the data it reads. Six attacks, and defences from a line in the system prompt to an architecture that leaves the attack nothing to act through."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The user, an attacker, the inbox, a quarantined reader model, the agent, its tools and the outside world"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "user", label: "User", sub: "asks for help", at: [10, 22], mobileAt: [22, 8], state: "active" },
                  { id: "attacker", label: "Attacker", sub: "writes an email", at: [10, 78], mobileAt: [78, 8], state: "bad" },
                  { id: "inbox", label: "Inbox / web", sub: "untrusted text", at: [34, 78], mobileAt: [78, 34], state: "wait" },
                  { id: "reader", label: "Quarantined reader", sub: sep ? "no tools" : "not used", at: [60, 80], mobileAt: [78, 62], state: sep ? "good" : "dim" },
                  { id: "agent", label: "Agent", sub: "has tools", at: [46, 30], mobileAt: [22, 40], state: o.harmed ? "bad" : "active" },
                  { id: "tools", label: "Tools", sub: on.approval ? "send needs a click" : "send, share, search", at: [70, 30], mobileAt: [22, 72], state: o.harmed ? "bad" : "idle" },
                  { id: "outside", label: "Outside", sub: on.egress ? "allowlist" : "anywhere", at: [88, 56], mobileAt: [50, 92], state: o.harmed ? "bad" : "good" },
                ]}
                links={[
                  { from: "user", to: "agent", label: "request" },
                  { from: "attacker", to: "inbox", label: "plants" },
                  { from: "inbox", to: "agent", label: "read", dim: sep },
                  { from: "inbox", to: "reader", label: "read", dim: !sep },
                  { from: "reader", to: "agent", label: "fields", dashed: true, dim: !sep },
                  { from: "agent", to: "tools", label: "calls" },
                  { from: "tools", to: "outside", label: "email, links" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Each attack and whether it still works">
                <ul className="space-y-0.5 text-[11px]">
                  {ATTACKS.map((x) => {
                    const y = outcome(x.id, on);
                    return (
                      <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-x-2" style={{ fontWeight: x.id === a ? 700 : 400 }}>
                        <span>
                          {x.label} <span className="text-[var(--faint)]">({x.kind})</span>
                        </span>
                        <span className="font-mono" style={{ color: y.harmed ? "var(--bad)" : "var(--good)" }}>
                          {y.harmed ? `works ${Math.round(y.chance * 100)}%` : "stopped"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Attack" accent={ACCENT} value={a} onChange={setA} options={ATTACKS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Attacking…">
                Run the attack
              </RunButton>
              <button type="button" onClick={() => setOn(PROMPT_ONLY)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                Prompt defences only
              </button>
              <button type="button" onClick={() => setOn(ALL)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                All
              </button>
              <button type="button" onClick={() => setOn(NONE)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                None
              </button>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Know the two kinds" what="Direct injection is the user attacking your app. Indirect injection is a third party attacking your user, through any text the agent reads: an email, a web page, a PDF, a tool result. Indirect is the dangerous one, because the user isn't the attacker and doesn't see it." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-[11px]">{atk.payload}</p>
              </FlowStep>
              <FlowArrow label="ask the model to resist" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Prompt-level defences lower the odds" what={`Telling the model to ignore instructions in data, and marking data clearly, helps; attackers rephrase until it doesn't. In this model they let an attack through ${Math.round(BYPASS.instruction * 100)}% and ${Math.round(BYPASS.delimiters * 100)}% of the time. Use them, and don't rely on them.`} accent={ACCENT} active={at(1)}>
                {(["instruction", "delimiters"] as Defense[]).map((d) => (
                  <Toggle key={d} checked={on[d]} onChange={(v) => set(d, v)} label={DEFENSES.find((x) => x.id === d)!.label} />
                ))}
              </FlowStep>
              <FlowArrow label="detect it" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Detect attempts" what={`A classifier trained on injection attempts catches most known patterns (it misses about ${Math.round(BYPASS.classifier * 100)}% here) and gives you a signal to log and review. Encoded and multi-step attacks get past it.`} accent={ACCENT} active={at(2)}>
                <Toggle checked={on.classifier} onChange={(v) => set("classifier", v)} label={DEFENSES.find((x) => x.id === "classifier")!.label} />
              </FlowStep>
              <FlowArrow label="design it out" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Give injected text nothing to act through" what="The reliable defences are architectural. A model that reads untrusted text gets no tools and returns only structured fields. Actions with consequences need the user's confirmation with the details shown. Data can only go to known destinations." accent={ACCENT} active={at(3)}>
                {(["separation", "approval", "egress"] as Defense[]).map((d) => (
                  <Toggle key={d} checked={on[d]} onChange={(v) => set(d, v)} label={DEFENSES.find((x) => x.id === d)!.label} />
                ))}
              </FlowStep>
              <FlowArrow label="the result" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Assume some attacks get through" what="Design so that a successful injection can't do much: least privilege for tools (next session), confirmation for anything irreversible, and logs to spot it afterwards." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs" style={{ color: harmed ? "var(--bad)" : "var(--good)" }}>
                  {harmed} of {ATTACKS.length} attacks still cause harm
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Bypass rates for prompt-level defences and classifiers are illustrative; which defence can stop which attack is the point.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}
