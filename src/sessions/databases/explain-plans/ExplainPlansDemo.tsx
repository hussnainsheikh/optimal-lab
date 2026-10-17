"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { FIELDS, PLANS, QUERY, line, misestimate, type Field, type Variant } from "@/lib/explainPlans";

const ACCENT = "var(--db)";

export default function ExplainPlansDemo() {
  const [variant, setVariant] = useState<Variant>("no-index");
  const [analyze, setAnalyze] = useState(true);
  const [field, setField] = useState<Field>("order");
  const [picked, setPicked] = useState(0);
  const plan = PLANS[variant];
  const sel = Math.min(picked, plan.nodes.length - 1);
  const node = plan.nodes[sel];
  const hot = (f: Field) => (field === f ? { background: `color-mix(in srgb, ${ACCENT} 22%, transparent)`, color: "var(--text)", borderRadius: 4 } : undefined);
  const byRun = [...plan.nodes].sort((a, b) => a.runs - b.runs);

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Reading EXPLAIN"
        blurb="EXPLAIN prints the plan the database chose: a tree of nodes, each with a cost and a row estimate. EXPLAIN ANALYZE also runs the query and prints what really happened. Read the same join with and without an index, one part at a time."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="EXPLAIN output">
              <pre className="whitespace-pre-wrap break-words rounded-md bg-[var(--inset)] p-2 font-mono text-xs">
                {analyze ? "EXPLAIN ANALYZE\n" : "EXPLAIN\n"}
                {QUERY}
              </pre>
              <ol className="mt-3 space-y-1.5 font-mono text-[11px] sm:text-xs">
                {plan.nodes.map((n, i) => {
                  const l = line(n, analyze);
                  const off = analyze && misestimate(n) >= 10;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => setPicked(i)}
                        aria-pressed={sel === i}
                        className="block min-h-11 w-full rounded-md border px-2 py-1.5 text-left"
                        style={{ marginLeft: `${n.depth * 0.9}rem`, width: `calc(100% - ${n.depth * 0.9}rem)`, borderColor: sel === i ? ACCENT : "var(--line)", background: "var(--inset)" }}
                      >
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          {n.depth > 0 && <span style={hot("order")}>-&gt;</span>}
                          <span className="font-semibold" style={hot("type")}>
                            {l.name}
                          </span>
                          {field === "order" && <span className="text-[10px] text-[var(--faint)]">runs #{n.runs + 1}</span>}
                        </span>
                        <span className="mt-0.5 block break-words text-[var(--muted)]">
                          (<span style={hot("cost")}>cost={n.startup.toFixed(2)}..{n.total.toFixed(2)}</span> <span style={hot("rows")}>rows={n.rows}</span> width={n.width})
                        </span>
                        {analyze && (
                          <span className="block break-words text-[var(--muted)]">
                            (actual time={n.actualStart.toFixed(3)}..{n.actualEnd.toFixed(3)}{" "}
                            <span style={{ ...hot("rows"), color: off ? "var(--bad)" : undefined }}>rows={n.actualRows}</span> <span style={hot("loops")}>loops={n.loops}</span>)
                          </span>
                        )}
                        {n.extra && <span className="block break-words text-[var(--faint)]">{n.extra}</span>}
                      </button>
                    </li>
                  );
                })}
              </ol>
              {analyze && <p className="mt-2 font-mono text-xs">Execution Time: {plan.time} ms</p>}
            </section>
          }
          panel={
            <SystemMapPanel caption={`${node.type}: ${node.note}`}>
              <Choices
                label="Schema"
                accent={ACCENT}
                value={variant}
                onChange={(v) => {
                  setVariant(v);
                  setPicked(0);
                }}
                options={[
                  { id: "no-index", label: "No index" },
                  { id: "index", label: "Index on customer_id" },
                ]}
              />
              <Choices
                label="Command"
                accent={ACCENT}
                value={analyze ? "analyze" : "plain"}
                onChange={(v) => setAnalyze(v === "analyze")}
                options={[
                  { id: "plain", label: "EXPLAIN" },
                  { id: "analyze", label: "EXPLAIN ANALYZE" },
                ]}
              />
              <Choices label="Look at" accent={ACCENT} value={field} onChange={setField} options={FIELDS.map((f) => ({ id: f.id, label: f.label }))} />
              <p className="w-full text-xs text-[var(--faint)]">Tap a plan line to read that node.</p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title={FIELDS[0].title} what={FIELDS[0].text} accent={ACCENT} active={field === "order"}>
                <p className="font-mono text-xs">{byRun.map((n) => n.type).join(" → ")}</p>
              </FlowStep>
              <FlowArrow label="the node that runs first" accent={ACCENT} />
              <FlowStep n={2} title={FIELDS[1].title} what={FIELDS[1].text} accent={ACCENT} active={field === "type"}>
                <p className="text-sm text-[var(--muted)]">{plan.summary}</p>
              </FlowStep>
              <FlowArrow label="its cost" accent={ACCENT} />
              <FlowStep n={3} title={FIELDS[2].title} what={FIELDS[2].text} accent={ACCENT} active={field === "cost"}>
                <p className="text-sm">
                  Top node: <span className="font-mono">{plan.nodes[0].total.toLocaleString()}</span> units. Without the index{" "}
                  <span className="font-mono">{PLANS["no-index"].nodes[0].total.toLocaleString()}</span>, with it{" "}
                  <span className="font-mono">{PLANS.index.nodes[0].total.toLocaleString()}</span>. The planner keeps the cheaper plan it can use.
                </p>
              </FlowStep>
              <FlowArrow label="its row estimate" accent={ACCENT} />
              <FlowStep n={4} title={FIELDS[3].title} what={FIELDS[3].text} accent={ACCENT} active={field === "rows"}>
                <p className="text-sm">
                  {node.type}: estimated <span className="font-mono">{node.rows.toLocaleString()}</span>
                  {analyze ? (
                    <>
                      , actual <span className="font-mono">{node.actualRows.toLocaleString()}</span> per loop. Off by {misestimate(node).toFixed(2)}×.
                    </>
                  ) : (
                    ". Switch to EXPLAIN ANALYZE to see the actual count."
                  )}
                </p>
              </FlowStep>
              <FlowArrow label="per-loop numbers" accent={ACCENT} />
              <FlowStep n={5} title={FIELDS[4].title} what={FIELDS[4].text} accent={ACCENT} active={field === "loops"}>
                <p className="text-sm">
                  {node.type}: {node.loops} {node.loops === 1 ? "loop" : "loops"} × {node.actualRows.toLocaleString()} rows ={" "}
                  <span className="font-mono">{(node.loops * node.actualRows).toLocaleString()}</span> rows, {node.loops} × {node.actualEnd.toFixed(3)} ms ={" "}
                  <span className="font-mono">{(node.loops * node.actualEnd).toFixed(1)}</span> ms.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
