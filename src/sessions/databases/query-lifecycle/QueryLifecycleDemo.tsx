"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type NodeState, type Packet } from "@/components/system/SystemMap";
import { QUERIES, path, type QueryId } from "@/lib/queryLifecycle";

const ACCENT = "var(--db)";
const NODE_FOR_STEP = ["client", "parser", "analyzer", "planner", "executor", "client"];

export default function QueryLifecycleDemo() {
  const [id, setId] = useState<QueryId>("by-id");
  const [prepared, setPrepared] = useState(false);
  const q = QUERIES.find((x) => x.id === id)!;
  const steps = path(q, prepared && q.failsAt === undefined);
  const walk = useWalk(steps.length, 1300);
  const cur = walk.stage === null ? null : steps[walk.stage];
  const done = new Set(walk.stage === null ? [] : steps.slice(0, walk.stage));
  const failed = cur !== null && cur === q.failsAt;
  const usePrepared = prepared && q.failsAt === undefined;
  const runId = `${id}-${prepared}-${walk.busy}`;

  const packets: Packet[] = (() => {
    if (cur === null) return [];
    const k = `${runId}-${cur}`;
    switch (cur) {
      case 0:
        return hops(k, ["client", "parser"], { label: usePrepared ? "EXECUTE" : "SQL text" });
      case 1:
        return failed ? hops(k, ["parser", "client"], { label: "ERROR", tone: "bad" }) : hops(k, ["parser", "analyzer"], { label: "parse tree" });
      case 2:
        return failed ? hops(k, ["analyzer", "parser", "client"], { label: "ERROR", tone: "bad" }) : hops(k, ["analyzer", "planner"], { label: "query tree" });
      case 3:
        return hops(k, ["planner", "executor"], { label: "plan" });
      case 4:
        return usePrepared
          ? [...hops(`${k}-c`, ["planner", "executor"], { label: "cached plan" }), ...hops(k, ["executor", "storage", "executor"], { label: "pages", start: 0.45 })]
          : hops(k, ["executor", "storage", "executor"], { label: "pages" });
      default:
        return hops(k, ["executor", "client"], { label: `${q.rows.toLocaleString()} ${q.rows === 1 ? "row" : "rows"}`, tone: "good" });
    }
  })();

  const state = (nodeId: string, sub?: string): Pick<MapNode, "state" | "sub"> => {
    let s: NodeState = "idle";
    const skipped = usePrepared && (nodeId === "analyzer" || nodeId === "planner");
    if (cur !== null && NODE_FOR_STEP[cur] === nodeId) s = failed ? "bad" : "active";
    else if ([...done].some((d) => NODE_FOR_STEP[d] === nodeId)) s = "good";
    if (skipped && s === "idle") s = "dim";
    if (q.failsAt !== undefined && cur !== null && NODE_FOR_STEP.indexOf(nodeId) > q.failsAt && nodeId !== "client") s = "dim";
    return { state: s, sub };
  };

  const nodes: MapNode[] = [
    { id: "client", label: "Client", at: [10, 50], mobileAt: [25, 10], ...state("client", "app or psql") },
    { id: "parser", label: "Parser", at: [32, 20], mobileAt: [75, 10], ...state("parser", "grammar") },
    { id: "analyzer", label: "Analyzer", at: [57, 20], mobileAt: [75, 37], ...state("analyzer", usePrepared ? "skipped" : "catalog") },
    { id: "planner", label: "Planner", at: [84, 20], mobileAt: [75, 64], ...state("planner", usePrepared ? "plan cached" : "statistics") },
    { id: "executor", label: "Executor", at: [62, 80], mobileAt: [25, 64], ...state("executor", "runs the plan") },
    { id: "storage", label: "Storage", at: [90, 80], mobileAt: [25, 90], ...state("storage", "pages in memory or disk") },
  ];
  if (cur === 4) nodes[5].state = "active";

  const captions = [
    `The client sends ${usePrepared ? "EXECUTE for a statement prepared earlier" : "the SQL as plain text"}.`,
    failed ? "The parser can't match SELEC to any statement. Nothing else runs." : "The parser splits the text into tokens and builds a tree from the grammar.",
    failed ? "The grammar is fine, but the catalog has no column nmae. The query stops before planning." : "The analyzer looks up users, name and id in the catalog and checks their types.",
    "The planner prices a few ways to run it and keeps the cheapest.",
    usePrepared ? "The cached plan runs straight away. Parse, analyze and plan were skipped." : "The executor runs the plan and reads pages from memory or disk.",
    `${q.rows.toLocaleString()} ${q.rows === 1 ? "row goes" : "rows go"} back to the client.`,
  ];
  const caption = cur === null ? `Press Run to send ${q.sql}` : captions[cur];

  const live = (n: number) => cur === n;
  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Parse, plan, execute"
        blurb="Your SQL arrives as a string. The database parses it, checks every name, picks a plan, runs it and streams rows back. Send a good query, a typo and a missing column, and see which step stops each one."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <SystemMap
              chrome="split"
              title="Client, parser, analyzer, planner, executor and storage"
              accent={ACCENT}
              nodes={nodes}
              links={[
                { from: "client", to: "parser", label: usePrepared ? "EXECUTE" : "SQL text" },
                { from: "parser", to: "analyzer", label: "parse tree", dim: usePrepared },
                { from: "analyzer", to: "planner", label: "query tree", dim: usePrepared },
                { from: "planner", to: "executor", label: "plan" },
                { from: "executor", to: "storage", label: "page reads" },
                { from: "executor", to: "client", label: "rows" },
              ]}
              packets={packets}
              aspect={2.4}
              mobileAspect={0.85}
            />
          }
          panel={
            <SystemMapPanel caption={<span style={{ color: failed ? "var(--bad)" : undefined }}>{caption}</span>}>
              <Choices label="Query" accent={ACCENT} value={id} onChange={setId} options={QUERIES.map((x) => ({ id: x.id, label: x.label }))} />
              <Choices
                label="Statement"
                accent={ACCENT}
                value={prepared ? "prepared" : "plain"}
                onChange={(v) => setPrepared(v === "prepared")}
                options={[
                  { id: "plain", label: "Plain query" },
                  { id: "prepared", label: "Prepared, run again" },
                ]}
              />
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT}>
                Run
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Send the SQL text" what="The client sends the query over its connection as a string. The database knows nothing about it yet." accent={ACCENT} active={live(0)}>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">{usePrepared ? "EXECUTE get_user(42);" : q.sql}</pre>
              </FlowStep>
              <FlowArrow label="SQL text" accent={ACCENT} />
              <FlowStep n={2} title="Parse it into a tree" what="The parser cuts the text into tokens and checks them against the SQL grammar. A typo fails here." accent={ACCENT} active={live(1)}>
                <ul className="flex flex-wrap gap-1 font-mono text-[11px]">
                  {q.tokens.map((t, i) => (
                    <li key={i} className="rounded bg-[var(--inset)] px-1.5 py-0.5" style={{ color: q.failsAt === 1 && i === 0 ? "var(--bad)" : undefined }}>
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-mono text-xs text-[var(--muted)]">{q.failsAt === 1 ? q.error : q.tree}</p>
              </FlowStep>
              <FlowArrow label="parse tree" accent={ACCENT} />
              <FlowStep n={3} title="Look up every name" what="The analyzer finds each table, column and operator in the system catalog and checks the types. A misspelled column fails here." accent={ACCENT} active={live(2)}>
                <p className="whitespace-pre-wrap font-mono text-xs" style={{ color: q.failsAt === 2 ? "var(--bad)" : undefined }}>
                  {q.failsAt === 2 ? q.error : q.resolved || "Not reached."}
                </p>
              </FlowStep>
              <FlowArrow label="query tree" accent={ACCENT} />
              <FlowStep n={4} title="Pick the cheapest plan" what="The planner lists ways to run the query, estimates each one's cost from table statistics, and keeps the cheapest." accent={ACCENT} active={live(3)}>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">{q.plan || "Not reached."}</pre>
              </FlowStep>
              <FlowArrow label="plan" accent={ACCENT} />
              <FlowStep n={5} title="Run the plan" what="The executor walks the plan, asks storage for pages, and tests each row against the filter." accent={ACCENT} active={live(4)}>
                <p className="font-mono text-xs">{q.execute || "Not reached."}</p>
              </FlowStep>
              <FlowArrow label="result rows" accent={ACCENT} />
              <FlowStep n={6} title="Stream rows back" what="Rows go back to the client as they are produced. The next query starts at step 1, unless it is a prepared statement whose plan is reused." accent={ACCENT} active={live(5)}>
                <p className="font-mono text-xs">{q.failsAt === undefined ? `${q.rows.toLocaleString()} ${q.rows === 1 ? "row" : "rows"}` : "Only the error came back."}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
