"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { DOCS, K, STRATEGIES, SYNC, USER, run, type Strategy } from "@/lib/permissionRetrieval";

const ACCENT = "var(--sys)";
const allowed = (groups: string[]) => groups.some((g) => USER.groups.includes(g));
const dur = (m: number) => (m === 0 ? "0" : m < 60 ? `${m} min` : `${Math.round(m / 60)} h`);

export default function PermissionRetrievalDemo() {
  const [s, setS] = useState<Strategy>("none");
  const [sync, setSync] = useState<(typeof SYNC)[number]["id"]>("nightly");
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const r = run(s);
  const syn = SYNC.find((x) => x.id === sync)!;

  const packets: Packet[] =
    stage === 0 ? hops("q", ["user", "app"], { label: "refund policy, enterprise?" })
    : stage === 1 ? hops("ids", ["app", "idp"], { label: `${USER.name}: ${USER.groups.join(", ")}` })
    : stage === 2 ? hops("s", ["app", "vdb"], { label: s === "pre" ? "search + filter: support, all" : "search everything" })
    : stage === 3 ? hops("ctx", ["vdb", "app", "llm"], { label: `${r.inContext.length} chunks`, tone: r.leaked.length ? "bad" : "good" })
    : stage === 4 ? hops("a", ["llm", "user"], { label: r.leaked.length ? "quotes margins" : "answer", tone: r.leaked.length ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: ${USER.name}, in support, asks about the enterprise refund policy.`,
    `Step 2: the identity provider says ${USER.name} is in: ${USER.groups.join(", ")}.`,
    s === "pre" ? "Step 3: the vector search filters by the user's groups before ranking." : "Step 3: the vector search ranks every team's documents together.",
    `Step 4: the model's context holds ${r.inContext.length} chunks, ${r.leaked.length} that ${USER.name} isn't allowed to open.`,
    `Step 5: ${r.note}`,
  ];
  const caption = stage !== null ? captions[stage] : `${STRATEGIES.find((x) => x.id === s)!.label}: ${r.leaked.length} forbidden documents in the context, ${r.inContext.length - r.leaked.length} allowed, ${r.missedAllowed.length} better allowed ones lost.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Tenant-aware retrieval"
        blurb={`A company assistant searches every team's documents. Each document has an access list. When ${USER.name} from support asks a question, the assistant must only use what ${USER.name} could open themselves. The most similar documents are the contract template, the finance margins and the board notes. Four ways to enforce access, and what happens when access is revoked.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The user, the assistant app, the identity provider, the vector database and the model"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "user", label: USER.name, sub: "support", at: [10, 50], mobileAt: [50, 8], state: "active" },
                  { id: "app", label: "Assistant", sub: "retrieval", at: [38, 50], mobileAt: [50, 36], state: "active" },
                  { id: "idp", label: "Identity provider", sub: "groups", at: [38, 12], mobileAt: [18, 64], state: "idle" },
                  { id: "vdb", label: "Vector DB", sub: s === "pre" ? "ACL filter" : "no filter", at: [70, 22], mobileAt: [82, 64], state: s === "pre" ? "good" : "wait" },
                  { id: "llm", label: "Model", sub: `${r.leaked.length} forbidden in context`, at: [70, 80], mobileAt: [50, 92], state: r.leaked.length ? "bad" : "good" },
                ]}
                links={[
                  { from: "user", to: "app", label: "question" },
                  { from: "app", to: "idp", label: "who is this?" },
                  { from: "app", to: "vdb", label: "search" },
                  { from: "app", to: "llm", label: "context" },
                  { from: "llm", to: "user", label: "answer", dashed: true },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Documents ranked by similarity, and which reach the model">
                <ul className="space-y-0.5 text-[11px]">
                  {[...DOCS].sort((a, b) => b.score - a.score).map((d) => {
                    const ok = allowed(d.groups);
                    const used = r.inContext.includes(d);
                    return (
                      <li key={d.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)_5rem] gap-2" style={{ opacity: used ? 1 : 0.45 }}>
                        <span className="font-mono text-[var(--faint)]">{d.score.toFixed(2)}</span>
                        <span className="min-w-0 truncate" style={{ color: used && !ok ? "var(--bad)" : "var(--text)" }}>
                          {d.title}
                        </span>
                        <span className="text-right font-mono" style={{ color: ok ? "var(--good)" : "var(--bad)" }}>
                          {used ? (ok ? "in context" : "LEAKED") : ok ? "allowed" : "forbidden"}
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
                <Choices label="Enforcement" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Searching…">
                Ask the question
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Similarity doesn't know about permissions" what="The documents most similar to a question about enterprise refunds include ones only legal, finance and the board may read. Search ranks by meaning; access has to be enforced separately." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  top {K} by similarity: {[...DOCS].sort((a, b) => b.score - a.score).slice(0, K).filter((d) => !allowed(d.groups)).length} forbidden to {USER.name}
                </p>
              </FlowStep>
              <FlowArrow label="who is asking" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Resolve the user's groups" what="Use the same identity and groups the source systems use (SSO groups, folder permissions), copied onto every chunk as metadata at indexing time." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  {USER.name}: {USER.groups.join(", ")}
                </p>
              </FlowStep>
              <FlowArrow label="enforce it" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Filter inside the search, not after it" what="A prompt instruction is not access control. Filtering the top results afterwards is safe but loses answers. Filtering in the vector query returns the best documents the user may actually open." accent={ACCENT} active={at(2) || at(3)}>
                <Choices label="Enforcement" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{STRATEGIES.find((x) => x.id === s)!.one}</p>
                <p className="mt-1 font-mono text-xs" style={{ color: r.leaked.length ? "var(--bad)" : "var(--good)" }}>
                  {r.leaked.length} leaked · {r.inContext.length - r.leaked.length} useful · {r.missedAllowed.length} lost
                </p>
              </FlowStep>
              <FlowArrow label="the answer" accent={ACCENT} active={at(4)} />

              <FlowStep n={4} title="Check what the answer can reveal" what="Anything in the context can come out in the answer, a summary or a follow-up. Treat the context window as readable by the user." accent={ACCENT} active={at(4)}>
                <p className="text-xs" style={{ color: r.leaked.length ? "var(--bad)" : "var(--good)" }}>
                  {r.note}
                </p>
              </FlowStep>
              <FlowArrow label="permissions change" accent={ACCENT} />

              <FlowStep n={5} title="Keep permissions fresh" what={`${USER.name} moves out of support at 10:00. Until the index learns that, ${USER.name} can still retrieve support documents. Sync on group-change events, or check the source of truth at query time for sensitive sources.`} accent={ACCENT}>
                <Choices label="Permission sync" accent={ACCENT} value={sync} onChange={setSync} options={SYNC.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 font-mono text-xs" style={{ color: syn.minutes > 60 ? "var(--bad)" : "var(--good)" }}>
                  revoked access keeps working for {dur(syn.minutes)}
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
