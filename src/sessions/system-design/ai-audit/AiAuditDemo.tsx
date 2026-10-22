"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ASKED_AFTER, DECISIONS_PER_DAY, DESIGNS, FIELDS, QUESTIONS, answerable, cost, score, type Design } from "@/lib/aiAudit";

const ACCENT = "var(--sys)";

export default function AiAuditDemo() {
  const [d, setD] = useState<Design>("rawLogs");
  const [after, setAfter] = useState(90);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const des = DESIGNS.find((x) => x.id === d)!;
  const c = cost(d);

  const captions = [
    `Step 1: ${DECISIONS_PER_DAY.toLocaleString("en-US")} loan pre-approvals a day are made with an AI model.`,
    `Step 2: ${des.label.toLowerCase()}: ${des.fields.length ? `${des.fields.length} kinds of information per decision` : "nothing about the decision"}.`,
    `Step 3: kept ${des.days} days.`,
    `Step 4: a complaint arrives ${after} days later: ${score(d, after)} of ${QUESTIONS.length} questions can be answered.`,
    `Step 5: the price: ${c.gb.toFixed(1)} GB and ${c.personalRecords.toLocaleString("en-US")} records holding personal data.`,
  ];
  const caption = stage !== null ? captions[stage] : `${des.label}: ${score(d, after)} of ${QUESTIONS.length} questions answerable after ${after} days · ${c.gb.toFixed(1)} GB · ${c.personalRecords.toLocaleString("en-US")} records with personal data.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="AI auditability and data retention"
        blurb={`An AI system pre-approves loans, ${DECISIONS_PER_DAY.toLocaleString("en-US")} a day. Months later a customer complains and a regulator asks what the system decided, why, with which model and which policy, and whether a person checked. What you can answer depends on what you recorded and how long you kept it, and keeping it has a cost of its own.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The questions an auditor asks and whether each can be answered">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">asked {after} days later</p>
                <p className="font-mono text-xs" style={{ color: score(d, after) === QUESTIONS.length ? "var(--good)" : "var(--bad)" }}>
                  {score(d, after)}/{QUESTIONS.length} answerable
                </p>
              </div>
              <ul className="mt-3 space-y-1 text-xs">
                {QUESTIONS.map((q, i) => {
                  const ok = answerable(d, i, after);
                  return (
                    <li key={q.text} className="flex items-baseline gap-2">
                      <span className="font-mono" style={{ color: ok ? "var(--good)" : "var(--bad)" }}>
                        {ok ? "✓" : "✗"}
                      </span>
                      <span>{q.text}</span>
                    </li>
                  );
                })}
              </ul>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
                <Stat label="stored" value={`${c.gb.toFixed(1)} GB`} />
                <Stat label="per decision" value={`${c.perRecordKB.toFixed(1)} KB`} />
                <Stat label="records with personal data" value={c.personalRecords.toLocaleString("en-US")} />
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="What's recorded" accent={ACCENT} value={d} onChange={setD} options={DESIGNS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <div className="w-full">
                <Choices label="Asked after" accent={ACCENT} value={String(after)} onChange={(v) => setAfter(Number(v))} options={ASKED_AFTER.map((a) => ({ id: String(a), label: `${a} days` }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Auditing…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Decide what an AI decision needs to explain" what="Not “what did the model say” but: what went in, which model and prompt version, what it retrieved, what tools returned, what it decided, and who reviewed it. Raw prompts have some of that and miss the versions and the reviewer entirely." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 text-[11px]">
                  {FIELDS.map((f) => (
                    <li key={f.id} className="flex justify-between gap-2" style={{ opacity: des.fields.includes(f.id) ? 1 : 0.4 }}>
                      <span>{f.label}</span>
                      <span className="font-mono">
                        {(f.bytes / 1000).toFixed(1)} KB{f.personal ? " · personal" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="record it" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Write a structured decision record" what="One record per decision with versions and IDs, written by the system at the moment it decides. It's smaller than raw prompts and answers more, because it stores the things a prompt doesn't contain." accent={ACCENT} active={at(1)}>
                <Choices label="What's recorded" accent={ACCENT} value={d} onChange={setD} options={DESIGNS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{des.one}</p>
              </FlowStep>
              <FlowArrow label="keep it" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Keep it as long as you'll be asked" what="Complaints and audits arrive months later. Debug logs kept 30 days are gone by then. Retention for decision records follows the rules for the decision (lending, hiring, insurance), not the logging budget." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs">kept {des.days} days</p>
              </FlowStep>
              <FlowArrow label="the question" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Answer the auditor" what="With versions recorded you can rerun the same inputs against the same prompt and model and show the result; without them you can only guess what the system was at the time." accent={ACCENT} active={at(3)}>
                <Choices label="Asked after" accent={ACCENT} value={String(after)} onChange={(v) => setAfter(Number(v))} options={ASKED_AFTER.map((a) => ({ id: String(a), label: `${a} days` }))} />
                <p className="mt-2 font-mono text-xs">
                  {DESIGNS.map((x) => `${x.label}: ${score(x.id, after)}/${QUESTIONS.length}`).join(" · ")}
                </p>
              </FlowStep>
              <FlowArrow label="and the cost" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Hold as little personal data as you can" what="Every record kept is personal data kept: subject to access requests, deletion, breach rules. Redact what the record doesn't need, restrict and log access, and delete on schedule. Auditability and data minimisation pull in opposite directions; design for both." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs">
                  {c.personalRecords.toLocaleString("en-US")} records with personal data · {c.gb.toFixed(1)} GB
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Record sizes are typical; the EU AI Act asks high-risk systems to keep automatically generated logs, and lending rules set their own periods.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="font-mono text-sm">{value}</dd>
    </div>
  );
}
