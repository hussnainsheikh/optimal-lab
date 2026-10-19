"use client";

import { Fragment, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { ALL, LAYERS, NONE, PROPOSALS, REFUNDS_PER_DAY, SHARE_ABOVE, THRESHOLDS, check, type Layer } from "@/lib/outputValidation";

const ACCENT = "var(--sys)";

export default function OutputValidationDemo() {
  const [on, setOn] = useState<Record<Layer, boolean>>(NONE);
  const [pi, setPi] = useState("toomuch");
  const [threshold, setThreshold] = useState(500);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (k: Layer, v: boolean) => setOn((cur) => ({ ...cur, [k]: v }));
  const p = PROPOSALS.find((x) => x.id === pi)!;
  const o = check(p, on);
  const harmful = PROPOSALS.filter((x) => check(x, on).harmful).length;
  const layerIdx = o.stoppedBy ? LAYERS.findIndex((l) => l.id === o.stoppedBy) : -1;

  const packets: Packet[] =
    stage === 0 ? hops("p", ["llm", "schema"], { label: "JSON" })
    : stage !== null && stage >= 1 && stage <= 4 ? (() => {
        const ids = ["schema", "rules", "allow", "human"];
        const i = stage - 1;
        if (layerIdx >= 0 && layerIdx < i) return [];
        const stopsHere = layerIdx === i;
        return hops(`l${i}`, [ids[i], i < 3 ? ids[i + 1] : "backend"], { label: stopsHere ? "rejected" : "passes", tone: stopsHere ? "good" : i === 3 && o.harmful ? "bad" : "accent" });
      })()
    : [];

  const captions = [
    `Step 1: the model proposes ${p.json}`,
    `Step 2: schema validation ${on.schema ? (o.stoppedBy === "schema" ? "rejects it" : "passes it") : "is off"}.`,
    `Step 3: business rules ${on.rules ? (o.stoppedBy === "rules" ? "reject it" : "pass it") : "are off"}.`,
    `Step 4: allowlists ${on.allowlist ? (o.stoppedBy === "allowlist" ? "reject it" : "pass it") : "are off"}.`,
    o.stoppedBy === "approval" ? "Step 5: it waits for a person, who sees the order and decides." : o.executed ? (o.harmful ? `Step 5: it runs: ${p.harm}.` : "Step 5: it runs, correctly.") : `Step 5: stopped earlier by ${LAYERS[layerIdx].label.toLowerCase()}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${p.label}: ${o.executed ? (o.harmful ? `executed, and ${p.harm}` : "executed correctly") : `stopped by ${LAYERS[layerIdx].label.toLowerCase()}`}. ${harmful} of ${PROPOSALS.length} proposals would cause harm.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Output validation and action approval"
        blurb="A support agent doesn't act directly: it proposes actions as JSON and the backend executes them. Six proposals, each wrong the way models really get things wrong: malformed, over the limit, out of scope, or simply big. Four layers of checks between the model and the action, each catching a different kind of mistake."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The model proposes an action; schema validation, business rules, allowlists and a human approval step sit before the backend"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "llm", label: "Model", sub: "proposes JSON", at: [12, 22], mobileAt: [50, 6], state: "active" },
                  { id: "schema", label: "Schema", sub: on.schema ? "on" : "off", at: [38, 22], mobileAt: [50, 24], state: !on.schema ? "dim" : o.stoppedBy === "schema" ? "good" : "idle" },
                  { id: "rules", label: "Rules", sub: on.rules ? "on" : "off", at: [64, 22], mobileAt: [50, 42], state: !on.rules ? "dim" : o.stoppedBy === "rules" ? "good" : "idle" },
                  { id: "allow", label: "Allowlist", sub: on.allowlist ? "on" : "off", at: [88, 46], mobileAt: [50, 60], state: !on.allowlist ? "dim" : o.stoppedBy === "allowlist" ? "good" : "idle" },
                  { id: "human", label: "Approval", sub: on.approval ? `> €${threshold}` : "off", at: [64, 80], mobileAt: [24, 82], state: !on.approval ? "dim" : o.stoppedBy === "approval" ? "wait" : "idle" },
                  { id: "backend", label: "Backend", sub: o.executed ? (o.harmful ? "harm done" : "executed") : "nothing to do", at: [30, 80], mobileAt: [76, 82], state: o.harmful ? "bad" : o.executed ? "good" : "idle" },
                ]}
                links={[
                  { from: "llm", to: "schema", label: "JSON" },
                  { from: "schema", to: "rules", label: "valid" },
                  { from: "rules", to: "allow", label: "allowed" },
                  { from: "allow", to: "human", label: "big ones" },
                  { from: "allow", to: "backend", label: "the rest" },
                  { from: "human", to: "backend", label: "approved", dashed: true },
                ]}
                packets={packets}
                aspect={1.7}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="All six proposals and what happens to each">
                <ul className="space-y-1 text-[11px]">
                  {PROPOSALS.map((x) => {
                    const y = check(x, on);
                    return (
                      <li key={x.id} style={{ fontWeight: x.id === pi ? 700 : 400 }}>
                        <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span>{x.label}</span>
                          <span className="font-mono" style={{ color: y.harmful ? "var(--bad)" : "var(--good)" }}>
                            {y.executed ? (y.harmful ? "harm" : "ok") : `stopped: ${LAYERS.find((l) => l.id === y.stoppedBy)!.label.toLowerCase()}`}
                          </span>
                        </span>
                        <span className="block truncate font-mono text-[10px] text-[var(--faint)]">{x.json}</span>
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
                <Choices label="Proposal" accent={ACCENT} value={pi} onChange={setPi} options={PROPOSALS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Checking…">
                Check it
              </RunButton>
              <button type="button" onClick={() => setOn(ALL)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                All layers
              </button>
              <button type="button" onClick={() => setOn(NONE)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                None
              </button>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Have the model propose, not act" what="The model returns a structured proposal; your code decides whether to execute it. That one boundary is where every check below can live." accent={ACCENT} active={at(0)}>
                <pre className="overflow-x-auto rounded bg-[var(--inset)] px-2 py-1.5 font-mono text-[11px]">{p.json}</pre>
              </FlowStep>
              {LAYERS.map((l, i) => (
                <Fragment key={l.id}>
                  <FlowArrow label={i === 0 ? "parse it" : i === 1 ? "is it allowed?" : i === 2 ? "in scope?" : "big enough to ask?"} accent={ACCENT} active={at(i + 1)} />
                  <FlowStep n={i + 2} title={l.label} what={l.what} accent={ACCENT} active={at(i + 1)}>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" checked={on[l.id]} onChange={(e) => set(l.id, e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                    {l.label}
                  </label>
                  {l.id === "approval" && (
                    <>
                      <Choices label="Ask a person for refunds over" accent={ACCENT} value={String(threshold)} onChange={(v) => setThreshold(Number(v))} options={THRESHOLDS.map((t) => ({ id: String(t), label: `€${t.toLocaleString("en-US")}` }))} />
                      <p className="mt-2 font-mono text-xs">
                        {Math.round(REFUNDS_PER_DAY * SHARE_ABOVE[threshold])} approvals a day out of {REFUNDS_PER_DAY.toLocaleString("en-US")} refunds
                      </p>
                    </>
                  )}
                  </FlowStep>
                </Fragment>
              ))}
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
