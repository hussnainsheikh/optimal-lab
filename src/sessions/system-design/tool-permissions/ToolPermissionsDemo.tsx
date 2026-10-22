"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState, type Packet } from "@/components/system/SystemMap";
import { ALL_PERMS, DANGEROUS, MODELS, TASKS, attempt, harmCount, type Model, type TaskId } from "@/lib/toolPermissions";

const ACCENT = "var(--sys)";
const APPS = [
  { id: "mail", label: "Mail", at: [86, 14] as [number, number], mobileAt: [18, 72] as [number, number] },
  { id: "cal", label: "Calendar", at: [86, 38] as [number, number], mobileAt: [50, 72] as [number, number] },
  { id: "files", label: "Files", at: [86, 62] as [number, number], mobileAt: [82, 72] as [number, number] },
  { id: "pay", label: "Payments", at: [86, 86] as [number, number], mobileAt: [50, 94] as [number, number] },
];

export default function ToolPermissionsDemo() {
  const [m, setM] = useState<Model>("user");
  const [t, setT] = useState<TaskId>("summarise");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const task = TASKS.find((x) => x.id === t)!;
  const r = attempt(m, t);
  const appOf = (p: string) => p.split(".")[0];
  const appState = (app: string): NodeState => {
    const has = r.granted.some((p) => appOf(p) === app);
    if (!has) return "dim";
    if (r.succeeded.some((p) => appOf(p) === app)) return "bad";
    if (r.confirmed.some((p) => appOf(p) === app)) return "wait";
    return "active";
  };
  const attackApp = appOf(task.attempts[0]);

  const packets: Packet[] =
    stage === 0 ? hops("ask", ["user", "agent"], { label: "task" })
    : stage === 1 ? hops("grant", ["auth", "agent"], { label: `${r.granted.length} permissions` })
    : stage === 2 ? hops("inj", ["mailsrc", "agent"], { label: "injected", tone: "bad" })
    : stage === 3 ? hops("try", ["agent", attackApp], { label: task.attempts.join(", "), tone: r.succeeded.length ? "bad" : "good" })
    : stage === 4 && r.confirmed.length ? hops("conf", ["agent", "user"], { label: "confirm?", tone: "good" })
    : [];

  const captions = [
    `Step 1: the user asks: “${task.label}”.`,
    `Step 2: ${MODELS.find((x) => x.id === m)!.label.toLowerCase()}: the agent holds ${r.granted.length} permissions, ${r.dangerousGranted.length} of them able to send, share, delete or pay.`,
    `Step 3: ${task.injected}`,
    `Step 4: ${r.note}`,
    `Step 5: across all three tasks, ${harmCount(m)} hijacked action${harmCount(m) === 1 ? "" : "s"} would succeed.`,
  ];
  const caption = stage !== null ? captions[stage] : `${MODELS.find((x) => x.id === m)!.label}, “${task.label}”: ${r.note} Across all three tasks: ${harmCount(m)} hijacked actions succeed.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Tool permissions and least privilege"
        blurb="A workplace assistant can reach mail, calendar, files and payments. Assume that sooner or later it reads an injected instruction. What it can then do is whatever its permissions allow, so the design question is what to grant, for how long, and when to ask the user. Three tasks, one hijack attempt in each."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The user, an identity service issuing tokens, the agent, a source of injected text, and mail, calendar, files and payments"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "user", label: "User", sub: "asks a task", at: [10, 22], mobileAt: [22, 8], state: "active" },
                  { id: "auth", label: "Identity service", sub: m === "user" || m === "tool" ? "standing grant" : "token per task", at: [10, 78], mobileAt: [78, 8], state: "idle" },
                  { id: "mailsrc", label: "Untrusted input", sub: "email, PDF", at: [38, 88], mobileAt: [78, 40], state: "bad" },
                  { id: "agent", label: "Agent", sub: `${r.granted.length} permissions`, at: [44, 46], mobileAt: [22, 40], state: r.succeeded.length ? "bad" : "active" },
                  ...APPS.map((a) => ({ id: a.id, label: a.label, sub: r.granted.filter((p) => appOf(p) === a.id).map((p) => p.split(".")[1]).join(", ") || "no access", at: a.at, mobileAt: a.mobileAt, state: appState(a.id) })),
                ]}
                links={[
                  { from: "user", to: "agent", label: "task" },
                  { from: "auth", to: "agent", label: "token" },
                  { from: "mailsrc", to: "agent", label: "read", dashed: true },
                  ...APPS.map((a) => ({ from: "agent", to: a.id, label: "API", dim: appState(a.id) === "dim" })),
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Permissions held for this task">
                <div className="flex flex-wrap gap-1">
                  {ALL_PERMS.map((p) => {
                    const has = r.granted.includes(p);
                    const needed = task.needs.includes(p);
                    return (
                      <span key={p} className="rounded px-1.5 py-0.5 font-mono text-[10px]" style={{ border: `1px solid ${has ? (DANGEROUS.includes(p) && !needed ? "var(--bad)" : ACCENT) : "var(--line)"}`, color: has ? "var(--text)" : "var(--faint)", textDecoration: has ? "none" : "line-through" }}>
                        {p}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--muted)]">Red border: a dangerous permission this task doesn&rsquo;t need. Struck through: not granted.</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Task" accent={ACCENT} value={t} onChange={setT} options={TASKS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Running…">
                Run the task
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Start from what the task needs" what="Summarising email needs to read mail and nothing else. Scheduling needs the calendar and to read mail. Paying an invoice needs payments, and that's exactly why it needs more care." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {TASKS.map((x) => (
                    <li key={x.id} style={{ fontWeight: x.id === t ? 700 : 400 }}>
                      {x.label}: {x.needs.join(", ")}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="grant it" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Grant per task, not per user" what="An agent with the user's full grant can do anything the user can, for as long as the token lives. Read-mostly scopes help a little. A token minted for one task, with that task's permissions and a short lifetime, shrinks what a hijack can reach." accent={ACCENT} active={at(1)}>
                <Choices label="Permissions" accent={ACCENT} value={m} onChange={setM} options={MODELS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{MODELS.find((x) => x.id === m)!.one}</p>
              </FlowStep>
              <FlowArrow label="an injection arrives" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Assume the agent will be told to misbehave" what="The injected instruction comes in through the data the task itself requires reading. You can't keep it out; you can only limit what it can do." accent={ACCENT} active={at(2)}>
                <p className="text-xs">{task.injected}</p>
              </FlowStep>
              <FlowArrow label="the attempt" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Confirm what the task can't avoid" what="Paying an invoice needs payments.send, so scoping can't block a changed IBAN. That's where a confirmation earns its place: show the payee, amount and account, compared with what's on file, and let the user decide." accent={ACCENT} active={at(3)}>
                <p className="text-xs" style={{ color: r.succeeded.length ? "var(--bad)" : "var(--good)" }}>
                  {r.note}
                </p>
              </FlowStep>
              <FlowArrow label="across tasks" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Measure the blast radius" what="Count what a hijacked agent could do in each task under each model. Least privilege plus confirmation of irreversible actions is what takes that to zero." accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  {MODELS.map((x) => (
                    <Row key={x.id} a={x.label} b={`${harmCount(x.id)} hijacked actions`} bad={harmCount(x.id) > 0} bold={x.id === m} />
                  ))}
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ a, b, bad, bold }: { a: string; b: string; bad: boolean; bold: boolean }) {
  return (
    <>
      <span className="font-sans" style={{ fontWeight: bold ? 700 : 400 }}>
        {a}
      </span>
      <span className="text-right" style={{ fontWeight: bold ? 700 : 400, color: bad ? "var(--bad)" : "var(--good)" }}>
        {b}
      </span>
    </>
  );
}
