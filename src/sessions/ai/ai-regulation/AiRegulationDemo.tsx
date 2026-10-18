"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CHECKED, GPAI, ROLES, TIERS, USE_CASES, classify, dutiesFor, type Role, type Tier } from "@/lib/aiRegulation";

const ACCENT = "var(--ai)";
const ORDER: Tier[] = ["prohibited", "high", "transparency", "minimal"];

export default function AiRegulationDemo() {
  const [useCaseId, setUseCaseId] = useState("chatbot");
  const [role, setRole] = useState<Role>("provider");
  const [gpai, setGpai] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const u = classify(useCaseId);
  const tier = TIERS[u.tier];
  const duties = dutiesFor(u.tier, role);
  const at = (i: number) => stage === i;
  const roleInfo = ROLES.find((r) => r.id === role)!;

  const captions = [
    `Step 1: “${u.label}”.`,
    `Step 2: ${u.why}`,
    `Step 3: ${tier.label.toLowerCase()}. ${tier.what}`,
    `Step 4: as ${role === "provider" ? "the provider" : "a deployer"}, ${duties.length} ${duties.length === 1 ? "duty" : "duties"}${u.tier === "high" ? ", before and after launch" : ""}.`,
    `Step 5: applies from ${tier.from}${gpai ? `; the model duties since ${GPAI.from}` : ""}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${tier.label}: ${u.why}${gpai ? " Plus the general-purpose model duties." : ""}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="AI regulation"
        blurb="The EU AI Act sorts AI systems by what they are used for: a few uses are banned, a list of sensitive ones carries strict duties, some only have to be disclosed, and most get no new rules. Pick what you're building and your role, and see which tier you land in, what it asks of you, and when."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The four risk tiers of the EU AI Act, with your use case placed in one">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">four risk tiers · EU AI Act</p>
              <ol className="mt-3 space-y-2">
                {ORDER.map((t) => {
                  const on = t === u.tier;
                  return (
                    <li key={t} className="rounded-lg border p-3 transition-colors" style={{ borderColor: on ? TIERS[t].color : "var(--line)", background: on ? `color-mix(in srgb, ${TIERS[t].color} 10%, transparent)` : "transparent", opacity: on ? 1 : 0.6 }}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-sm font-medium" style={{ color: TIERS[t].color }}>
                          {TIERS[t].label}
                        </span>
                        <span className="font-mono text-[11px] text-[var(--muted)]">
                          {USE_CASES.filter((c) => c.tier === t).length} of the {USE_CASES.length} examples
                        </span>
                      </div>
                      {on && (
                        <>
                          <p className="mt-1 text-sm">{u.label}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">{u.why}</p>
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
              {gpai && (
                <p className="mt-3 rounded-md bg-[var(--inset)] px-3 py-2 text-xs">
                  <span className="font-medium">Plus:</span> you provide a general-purpose model, so the model duties apply on top, since {GPAI.from}.
                </p>
              )}
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Your role" accent={ACCENT} value={role} onChange={setRole} options={ROLES.map((r) => ({ id: r.id, label: r.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Classifying…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Say what it's for" what="The Act regulates uses, not techniques. The same model is minimal-risk writing code and high-risk ranking job applicants." accent={ACCENT} active={at(0)}>
                <Choices accent={ACCENT} value={useCaseId} onChange={setUseCaseId} options={USE_CASES.map((c) => ({ id: c.id, label: c.label }))} />
              </FlowStep>
              <FlowArrow label="the use" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Check the banned list, then the high-risk list" what="Nine practices are prohibited outright: social scoring, emotion recognition at work or school, scraping faces, manipulation, and others. Then the Act lists areas where AI is high-risk: hiring, credit, education, critical infrastructure, biometrics, law enforcement, migration, justice, and safety parts of regulated products." accent={ACCENT} active={at(1)}>
                <p className="text-sm">{u.why}</p>
              </FlowStep>
              <FlowArrow label="a tier" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Land in a tier" what="Not banned and not high-risk? Then if people interact with it or it generates content, transparency duties apply. Otherwise the Act adds nothing, which is where most systems are." accent={ACCENT} active={at(2)}>
                <p className="text-sm font-medium" style={{ color: tier.color }}>
                  {tier.label}
                </p>
                <p className="mt-1 text-sm">{tier.what}</p>
              </FlowStep>
              <FlowArrow label="duties" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="See what it asks of your role" what="Providers build and sell the system; deployers use it. High-risk duties split between them: the provider proves the system is fit, the deployer uses it properly and keeps people in the loop." accent={ACCENT} active={at(3)}>
                <p className="text-xs text-[var(--muted)]">{roleInfo.what}</p>
                <ul className="mt-2 space-y-0.5 text-sm">
                  {duties.map((d) => (
                    <li key={d}>· {d}</li>
                  ))}
                </ul>
                <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={gpai} onChange={(e) => setGpai(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  We also train and release a general-purpose model
                </label>
                {gpai && (
                  <ul className="space-y-0.5 text-sm">
                    {[...GPAI.duties, ...GPAI.systemic].map((d) => (
                      <li key={d}>· {d}</li>
                    ))}
                  </ul>
                )}
              </FlowStep>
              <FlowArrow label="when" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Check the dates, and the rest of the world" what="The Act phased in from 2025 and was amended by the AI Omnibus in 2026, which pushed the high-risk dates out. Other places have frameworks rather than one law: NIST's risk framework in the US, the OECD principles, and sector rules everywhere." accent={ACCENT} active={at(4)}>
                <dl className="space-y-1.5 text-xs">
                  {ORDER.map((t) => (
                    <Dates key={t} label={TIERS[t].label} from={TIERS[t].from} bold={t === u.tier} />
                  ))}
                  <Dates label="General-purpose models" from={GPAI.from} bold={gpai} />
                </dl>
                <p className="mt-2 text-xs text-[var(--faint)]">
                  Summarized from the European Commission&rsquo;s description of the Act, checked {CHECKED}. It is a teaching summary, not legal advice: the tiers depend on details, and the dates have already moved once.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Dates({ label, from, bold }: { label: string; from: string; bold: boolean }) {
  const w = bold ? 700 : 400;
  return (
    <div>
      <dt className="text-[var(--muted)]" style={{ fontWeight: w }}>
        {label}
      </dt>
      <dd className="font-mono" style={{ fontWeight: w }}>
        {from}
      </dd>
    </div>
  );
}
