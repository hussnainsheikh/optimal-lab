"use client";

import { useState } from "react";
import { FlowArrow, FlowSequence, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { COMPETITORS, DESIGNS, INSTRUCTIONS, RESEARCH_TOKENS, k, run, type Design } from "@/lib/multiAgent";

const ACCENT = "var(--sys)";

export default function MultiAgentDemo() {
  const [locking, setLocking] = useState(false);
  const results = Object.fromEntries(DESIGNS.map((d) => [d.id, run(d.id, locking)])) as Record<Design, ReturnType<typeof run>>;
  const caption = `One agent reads ${k(results.single.inputTokens)} tokens and takes ${results.single.minutes} min; an orchestrator with ${COMPETITORS} workers reads ${k(results.orchestrator.inputTokens)} in ${results.orchestrator.minutes} min; peers on a shared document ${locking ? "wait for locks" : `collide ${results.peers.conflicts} times`}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Multi-agent coordination"
        blurb={`“Write a market report on ${COMPETITORS} competitors.” One agent can do it all, a lead agent can hand each competitor to a worker and merge the results, or several agents can share one document and hand work to each other. Count the tokens read, the time taken, the messages and the edits that collide.`}
      />

      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p aria-live="polite" className="min-h-10 text-sm">
          {caption}
        </p>
        <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={locking} onChange={(e) => setLocking(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
          Lock a section of the shared document while one agent edits it
        </label>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {DESIGNS.map((d) => {
          const r = results[d.id];
          const best = Math.min(...DESIGNS.map((x) => results[x.id].inputTokens)) === r.inputTokens;
          return (
            <section key={d.id} aria-label={d.label} className="min-w-0 rounded-xl border bg-[var(--panel)] p-4" style={{ borderColor: best ? "var(--good)" : "var(--line)" }}>
              <h2 className="font-semibold">{d.label}</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">{d.one}</p>
              <Diagram d={d.id} />
              <dl className="mt-3 space-y-1 text-xs">
                <Row k="tokens read" v={k(r.inputTokens)} bad={r.inputTokens > 300_000} />
                <Row k="largest context" v={k(r.peakContext)} bad={r.peakContext > 100_000} />
                <Row k="minutes" v={String(r.minutes)} bad={r.minutes > 20} />
                <Row k="messages between agents" v={String(r.messages)} />
                <Row k="conflicting edits" v={String(r.conflicts)} bad={r.conflicts > 0} />
                <Row k="input cost" v={`$${r.cost.toFixed(2)}`} />
              </dl>
              <p className="mt-2 text-[11px]" style={{ color: r.conflicts ? "var(--bad)" : "var(--muted)" }}>
                {r.quality}
              </p>
            </section>
          );
        })}
      </div>

      <div className="mt-6">
        <FlowSequence mode="stage" accent={ACCENT}>
          <FlowStep n={1} title="One agent until it doesn't fit" what={`A single loop keeps one voice and needs no coordination. But every competitor's research (${k(RESEARCH_TOKENS)} tokens each) stays in its context, so each later turn rereads everything before it, and early details blur.`} accent={ACCENT}>
            <p className="font-mono text-xs">
              context grows to {k(results.single.peakContext)} · {k(results.single.inputTokens)} tokens read in all
            </p>
          </FlowStep>
          <FlowArrow label="split the work" accent={ACCENT} />
          <FlowStep n={2} title="An orchestrator gives each worker a clean context" what={`Each worker gets only the instructions (${k(INSTRUCTIONS)}) and its own competitor. Workers run in parallel and return a short section; the lead only reads the sections. This is the pattern most production systems use.`} accent={ACCENT}>
            <p className="font-mono text-xs">
              {k(results.orchestrator.inputTokens)} tokens · {results.orchestrator.minutes} min · {results.orchestrator.messages} messages
            </p>
          </FlowStep>
          <FlowArrow label="share state" accent={ACCENT} />
          <FlowStep n={3} title="Peers need rules for shared state" what="Agents editing one document at once is a concurrency problem like any other: two writers to the same paragraph, last write wins. Lock sections, or give each agent its own part and one agent the merge." accent={ACCENT}>
            <p className="font-mono text-xs" style={{ color: results.peers.conflicts ? "var(--bad)" : "var(--good)" }}>
              {results.peers.conflicts} conflicting edits · {results.peers.messages} hand-off messages
            </p>
          </FlowStep>
          <FlowArrow label="choose" accent={ACCENT} />
          <FlowStep n={4} title="Add agents for parallel, separable work" what="Multiple agents pay off when the work splits cleanly and runs in parallel, like research per topic. They cost more messages and more places to fail. If the subtasks depend on each other step by step, one agent is usually better." accent={ACCENT}>
            <p className="text-[11px] text-[var(--faint)]">Token counts follow from the sizes above; the quality notes describe the typical failure of each design.</p>
          </FlowStep>
        </FlowSequence>
      </div>
    </SessionPage>
  );
}

function Diagram({ d }: { d: Design }) {
  const box = "rounded border px-1.5 py-1 text-center font-mono text-[9px]";
  if (d === "single")
    return (
      <div className="mt-3 flex justify-center">
        <span className={box} style={{ borderColor: ACCENT }}>
          agent: A → B → C → D
        </span>
      </div>
    );
  if (d === "orchestrator")
    return (
      <div className="mt-3 space-y-1">
        <div className="flex justify-center">
          <span className={box} style={{ borderColor: ACCENT }}>
            lead
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {["A", "B", "C", "D"].map((x) => (
            <span key={x} className={box} style={{ borderColor: "var(--line-strong)" }}>
              {x}
            </span>
          ))}
        </div>
      </div>
    );
  return (
    <div className="mt-3 space-y-1">
      <div className="grid grid-cols-4 gap-1">
        {["A", "B", "C", "D"].map((x) => (
          <span key={x} className={box} style={{ borderColor: "var(--line-strong)" }}>
            {x}
          </span>
        ))}
      </div>
      <div className={box} style={{ borderColor: ACCENT }}>
        shared doc
      </div>
    </div>
  );
}

function Row({ k: key, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[var(--muted)]">{key}</dt>
      <dd className="font-mono" style={{ color: bad ? "var(--bad)" : "var(--text)" }}>
        {v}
      </dd>
    </div>
  );
}
