"use client";

import { Fragment, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { ALL, CONTROLS, LEAKS, NONE, run, type Control } from "@/lib/memoryIsolation";

const ACCENT = "var(--sys)";

export default function MemoryIsolationDemo() {
  const [on, setOn] = useState<Record<Control, boolean>>(NONE);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (k: Control, v: boolean) => setOn((cur) => ({ ...cur, [k]: v }));
  const r = run(on);
  const leaking = r.filter((l) => l.leaks).length;
  const leak = (id: string) => r.find((l) => l.id === id)!.leaks;

  const packets: Packet[] =
    stage === 0 ? hops("q", ["ben", "app", "memory"], { label: "my allergies?", tone: leak("filter") ? "bad" : "good" })
    : stage === 1 ? hops("c", ["ben", "app", "cache"], { label: "what's my address?", tone: leak("cache") ? "bad" : "good" })
    : stage === 2 ? hops("j", ["job", "memory"], { label: on.perUserJobs ? "one user" : "50 users at once", tone: leak("batch") ? "bad" : "good" })
    : stage === 3 ? hops("w", ["doc", "app", "memory"], { label: "“remember: email is…”", tone: leak("injection") ? "bad" : "good" })
    : stage === 4 ? hops("s", ["memory", "ben"], { label: "team memory", tone: leak("shared") ? "bad" : "good" })
    : [];

  const captions = LEAKS.map((l, i) => `Step ${i + 1}: ${l.label.toLowerCase()}. ${leak(l.id) ? l.example : `Stopped: ${CONTROLS.find((c) => c.id === l.stoppedBy)!.label.toLowerCase()}.`}`);
  const caption = stage !== null ? captions[stage] : `${leaking} of ${LEAKS.length} ways for one user's memories to reach another are open.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Per-user memory and isolation"
        blurb="An assistant with memory, used by thousands of people. One user's memories reaching another user is the worst bug this feature can have, and it rarely comes from one big mistake. Five real paths, from a missing filter to a document that writes into memory, and the control that closes each."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Two users, the app, a shared memory store, a response cache, a background job and a shared document"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "sara", label: "Sara", sub: "her memories", at: [10, 22], mobileAt: [22, 8], state: "idle" },
                  { id: "ben", label: "Ben", sub: leaking ? "may see Sara's" : "only his own", at: [10, 78], mobileAt: [78, 8], state: leaking ? "bad" : "good" },
                  { id: "app", label: "Assistant app", sub: "per request", at: [42, 50], mobileAt: [50, 36], state: "active" },
                  { id: "memory", label: "Memory store", sub: on.namespace ? "namespaced" : "one big index", at: [70, 20], mobileAt: [22, 66], state: leak("filter") ? "bad" : "good" },
                  { id: "cache", label: "Response cache", sub: on.cacheKey ? "keyed by user" : "keyed by text", at: [70, 80], mobileAt: [78, 66], state: leak("cache") ? "bad" : "good" },
                  { id: "job", label: "Nightly job", sub: on.perUserJobs ? "per user" : "batched", at: [89, 50], mobileAt: [22, 92], state: leak("batch") ? "bad" : "good" },
                  { id: "doc", label: "Shared doc", sub: on.writeRules ? "read-only" : "can write memory", at: [42, 12], mobileAt: [78, 92], state: leak("injection") ? "bad" : "idle" },
                ]}
                links={[
                  { from: "sara", to: "app", label: "chats" },
                  { from: "ben", to: "app", label: "chats" },
                  { from: "app", to: "memory", label: "read / write" },
                  { from: "app", to: "cache", label: "lookup" },
                  { from: "job", to: "memory", label: "summarise", dashed: true },
                  { from: "doc", to: "app", label: "retrieved text", dashed: true },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Each leak path and whether it is open">
                <ul className="space-y-1 text-[11px]">
                  {r.map((l) => (
                    <li key={l.id}>
                      <span className="font-semibold" style={{ color: l.leaks ? "var(--bad)" : "var(--good)" }}>
                        {l.leaks ? "open" : "closed"}
                      </span>{" "}
                      {l.label}
                      {l.leaks && <span className="block text-[var(--muted)]">{l.example}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Testing…">
                Try each leak
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
              {LEAKS.map((l, i) => {
                const c = CONTROLS.find((x) => x.id === l.stoppedBy)!;
                return (
                  <Fragment key={l.id}>
                    <FlowStep n={i + 1} title={l.label} what={`${l.how} ${c.what}`} accent={ACCENT} active={at(i)}>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" checked={on[c.id]} onChange={(e) => set(c.id, e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                      {c.label}
                    </label>
                    <p className="text-xs" style={{ color: leak(l.id) ? "var(--bad)" : "var(--good)" }}>
                      {leak(l.id) ? l.example : "Closed."}
                    </p>
                    </FlowStep>
                    {i < LEAKS.length - 1 && <FlowArrow label="next path" accent={ACCENT} />}
                  </Fragment>
                );
              })}
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
