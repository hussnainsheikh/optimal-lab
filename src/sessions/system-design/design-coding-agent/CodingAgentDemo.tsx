"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { CONTEXTS, NAIVE, PRICE_IN_PER_M, REPO_TOKENS, WINDOW, cost, type Context, type Design } from "@/lib/codingAgent";

const ACCENT = "var(--sys)";
const k = (n: number) => `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;

export default function CodingAgentDemo() {
  const [d, setD] = useState<Design>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Design>) => setD((c) => ({ ...c, ...p }));
  const r = cost(d);
  const other = cost({ ...d, context: d.context === "dump" ? "search" : "dump" });

  const packets: Packet[] =
    stage === 0 ? hops("s", ["dev", "agent", "box"], { label: d.sandbox ? "clone into container" : "your machine" })
    : stage === 1 ? hops("c", ["box", "agent", "llm"], { label: `${k(r.peak)} tokens`, tone: d.context === "dump" ? "bad" : "good" })
    : stage === 2 ? hops("e", ["llm", "agent", "box"], { label: "edit src/date.ts" })
    : stage === 3 ? hops("t", ["box", "agent"], { label: d.verify ? "npm test: 48 passed" : "tests not run", tone: d.verify ? "good" : "bad" })
    : stage === 4 ? hops("p", ["agent", "git", "dev"], { label: d.approval ? "pull request" : "pushed to main", tone: d.approval ? "good" : "bad" })
    : [];

  const captions = [
    d.sandbox ? "Step 1: the agent works in a container with a copy of the repo, no network and no credentials." : "Step 1: the agent works directly on the developer's machine, with their credentials and network.",
    `Step 2: ${CONTEXTS.find((x) => x.id === d.context)!.label.toLowerCase()}: the prompt peaks at ${k(r.peak)} tokens of a ${k(WINDOW)} window.`,
    `Step 3: one-line edit to src/date.ts. ${r.injected ? "Earlier, a README told it to pipe a script from the internet into a shell, and it did." : ""}`,
    d.verify ? "Step 4: the tests catch a timezone bug the first edit introduced; a second edit fixes it and all 48 pass." : "Step 4: the agent never runs the tests; one is still failing.",
    `Step 5: ${d.approval ? "it opens a pull request with the diff and the test run" : "it force-pushes to main"}. ${r.steps.length} steps, $${r.usd.toFixed(2)}, about ${Math.round(r.seconds / 60) || 1} min.`,
  ];
  const caption = stage !== null ? captions[stage] : `${r.steps.length} steps · ${k(r.inTok)} tokens in · $${r.usd.toFixed(2)} · ${r.fixed ? "fixed, with passing tests" : "claims fixed, a test still fails"}${r.injected ? " · ran an untrusted script" : ""}${d.approval ? "" : " · pushed to main"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design a coding agent"
        blurb="A developer asks an agent to fix a failing test. The agent has to find the right code in a large repo, change it, prove the change works, and hand it back for review, without spending a fortune on tokens, running instructions it found in a file, or pushing to main. One run of tool calls, five design choices."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Developer, agent loop, model, sandbox and git host"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "dev", label: "Developer", sub: "asks, reviews", at: [12, 50], mobileAt: [22, 9], state: "active" },
                  { id: "agent", label: "Agent loop", sub: `${r.steps.length} steps`, at: [42, 50], mobileAt: [50, 45], state: "active" },
                  { id: "llm", label: "Model", sub: `${k(r.peak)} / ${k(WINDOW)} tokens`, at: [72, 18], mobileAt: [78, 9], state: d.context === "dump" ? "wait" : "good" },
                  { id: "box", label: d.sandbox ? "Sandbox" : "Your machine", sub: d.sandbox ? "no network, no secrets" : "network + credentials", at: [72, 82], mobileAt: [78, 82], state: r.injected ? "bad" : "good" },
                  { id: "git", label: "Git host", sub: d.approval ? "pull request" : "main", at: [90, 50], mobileAt: [22, 82], state: d.approval ? "good" : "bad" },
                ]}
                links={[
                  { from: "dev", to: "agent", label: "task" },
                  { from: "agent", to: "llm", label: "prompt" },
                  { from: "agent", to: "box", label: "tools" },
                  { from: "agent", to: "git", label: d.approval ? "PR" : "push" },
                ]}
                packets={packets}
                aspect={2}
                mobileAspect={0.95}
              />
              <Trace d={d} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Context" accent={ACCENT} value={d.context} onChange={(v: Context) => set({ context: v })} options={CONTEXTS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Working…">
                Fix the failing test
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Run in a sandbox" what="The agent executes commands. Give it a container with a copy of the repo, its dependencies, no network by default and no real credentials, so a bad command or a hostile instruction in a file can only damage the copy." accent={ACCENT} active={at(0)}>
                <Toggle on={d.sandbox} set={(v) => set({ sandbox: v })} label="Work in a container: no network, no credentials" />
              </FlowStep>
              <FlowArrow label="find the code" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Build context by searching, not pasting" what={`The repo is ${k(REPO_TOKENS)} tokens. Pasting it all fits the window, and every step resends it. Starting from a file tree and grep, then reading the two files that matter, gives the model what it needs in a few thousand tokens.`} accent={ACCENT} active={at(1)}>
                <Choices label="Context" accent={ACCENT} value={d.context} onChange={(v: Context) => set({ context: v })} options={CONTEXTS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{CONTEXTS.find((x) => x.id === d.context)!.one}</p>
                <p className="mt-1 font-mono text-xs">
                  {k(r.inTok)} tokens in over the run · ${r.usd.toFixed(2)} · the other way: ${other.usd.toFixed(2)}
                </p>
              </FlowStep>
              <FlowArrow label="change it" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Make a small edit, and treat files as data" what="Edit with a diff, not by rewriting files, so the change is reviewable. Text the agent reads (a README, an issue, a web page) is input, never an instruction: commands that would run it go through the sandbox or the developer." accent={ACCENT} active={at(2)}>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">
                  {d.verify ? "-  return new Date(y, m, d)\n+  return new Date(Date.UTC(y, m - 1, d))" : "-  return new Date(y, m, d)\n+  return new Date(y, m - 1, d)"}
                </pre>
                <p className="mt-1 font-mono text-xs" style={{ color: r.injected ? "var(--bad)" : "var(--good)" }}>
                  {r.injected ? "it ran curl … | sh from a vendored README" : "the README's curl … | sh never ran"}
                </p>
              </FlowStep>
              <FlowArrow label="prove it" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Run the tests, and loop until they pass" what="The model believes its fix works; the tests know. Run them after every edit and feed the failures back in. Here the first edit fixes the month and breaks a timezone test that only the test run reveals." accent={ACCENT} active={at(3)}>
                <Toggle on={d.verify} set={(v) => set({ verify: v })} label="Run the tests before reporting" />
                <p className="font-mono text-xs" style={{ color: r.fixed ? "var(--good)" : "var(--bad)" }}>
                  {r.fixed ? "48 passed, after a second edit" : "reports “fixed”; 1 of 48 tests still fails"}
                </p>
              </FlowStep>
              <FlowArrow label="hand it back" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Report with evidence, ask before risky actions" what="End with something a person can check: the diff, the commands run and their output, in a pull request. Pushing, deleting, migrating or spending money waits for a person to say yes." accent={ACCENT} active={at(4)}>
                <Toggle on={d.approval} set={(v) => set({ approval: v })} label="Ask before running untrusted or destructive commands; open a PR" />
                <p className="font-mono text-xs" style={{ color: d.approval ? "var(--good)" : "var(--bad)" }}>
                  {d.approval ? "pull request: diff + npm test output" : "git push --force origin main"}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Token counts are illustrative; prices at ${PRICE_IN_PER_M} per million input tokens, without prompt caching, which cuts the cost of resending the same context.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}

// The run, tool call by tool call.
function Trace({ d }: { d: Design }) {
  const r = cost(d);
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Every tool call in the run">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">the run</p>
        <p className="font-mono text-xs" style={{ color: r.fixed && !r.injected && d.approval ? "var(--good)" : "var(--bad)" }}>
          ${r.usd.toFixed(2)} · {r.fixed ? "tests pass" : "1 test failing"}
        </p>
      </div>
      <ol className="mt-3 space-y-1">
        {r.steps.map((s, i) => (
          <li key={i} className="grid grid-cols-[1.25rem_4.5rem_minmax(0,1fr)] gap-2 text-[11px]">
            <span className="font-mono text-[var(--faint)]">{i + 1}</span>
            <span className="font-mono" style={{ color: ACCENT }}>
              {s.tool}
            </span>
            <span className="min-w-0 break-words" style={{ color: s.tone === "bad" ? "var(--bad)" : s.tone === "good" ? "var(--good)" : "var(--text)" }}>
              {s.detail}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
