"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState, type Packet } from "@/components/system/SystemMap";
import { BOTTLENECKS, CORES, FAST_MS, ITEMS_PER_PAGE, MAX_CONNECTIONS, NONE, POOL, READ_SHARE, REPLICA_CHOICES, SERVERS, SLOW_MS, TRAFFIC, ms, pct, run, type Fixes } from "@/lib/databaseBottlenecks";

const ACCENT = "var(--sys)";

export default function DatabaseBottlenecksDemo() {
  const [pages, setPages] = useState(50);
  const [f, setF] = useState<Fixes>(NONE);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const r = run(pages, f);
  const at = (i: number) => stage === i;
  const set = (patch: Partial<Fixes>) => setF((cur) => ({ ...cur, ...patch }));
  const dbState: NodeState = r.overloaded ? "bad" : r.queued ? "wait" : "good";
  const fixed = BOTTLENECKS.filter((b) => (b.id === "replicas" ? f.replicas > 0 : f[b.id])).length;

  const packets: Packet[] =
    stage === 0 ? hops("req", ["users", "app"], { label: `${pages}/s` })
    : stage === 1 ? hops("q", ["app", "pool", "db"], { label: `${r.queriesPerPage} queries` })
    : stage === 2 ? hops("slow", ["pool", "db"], { label: ms(r.avgQueryMs), tone: f.index ? "good" : "bad" })
    : stage === 3 ? hops("conn", ["app", "pool"], { label: `${Math.round(r.wanted)} conns`, tone: r.refused ? "bad" : "accent" })
    : stage === 4 && f.replicas > 0 ? hops("read", ["pool", "replica"], { label: "reads", tone: "good" })
    : stage === 4 ? hops("read", ["pool", "db"], { label: "reads too", tone: "bad" })
    : [];

  const captions = [
    `Step 1: ${pages} page loads a second.`,
    `Step 2: each page runs ${r.queriesPerPage} queries: ${r.queriesPerSec.toLocaleString("en-US")} queries a second.`,
    `Step 3: the items query takes ${f.index ? FAST_MS : SLOW_MS} ms, so ${r.busy.toFixed(1)} queries are running at once on ${CORES} cores: ${pct(r.utilization)} busy.`,
    r.refused ? `Step 4: the app servers want ${Math.round(r.wanted)} connections; the database allows ${MAX_CONNECTIONS}. ${r.refused} page loads a second fail with “too many connections”.` : `Step 4: ${Math.round(r.wanted)} connections open, under the limit of ${f.pooler ? SERVERS * POOL : MAX_CONNECTIONS}.`,
    f.replicas > 0 ? `Step 5: ${pct(READ_SHARE)} of queries go to ${f.replicas} replicas; the primary runs ${Math.round(r.primaryQps)} a second.` : "Step 5: every read still lands on the primary.",
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : r.overloaded
        ? `Overloaded: ${r.busy.toFixed(0)} queries want to run at once on ${CORES} cores. Queues grow without bound; pages take seconds, then time out. ${fixed} of 4 fixes on.`
        : `A page loads in ${ms(r.latencyMs)}; the database is ${pct(r.utilization)} busy${r.refused ? `; ${r.refused} page loads a second refused` : ""}. ${fixed} of 4 fixes on.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Database bottlenecks"
        blurb={`Six app servers share one database with ${CORES} cores. A product page lists ${ITEMS_PER_PAGE} items. Raise the traffic and watch the four usual things go wrong: a query per item, a query with no index, more connections than the database allows, and every read landing on one machine. Then fix them one at a time.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <SystemMap
              title="Users, app servers, a connection pool, the primary database and its replicas"
              accent={ACCENT}
              chrome="split"
              nodes={[
                { id: "users", label: "Users", sub: `${pages} pages/s`, at: [10, 50], mobileAt: [20, 12], state: "idle" },
                { id: "app", label: `${SERVERS} app servers`, sub: `${r.queriesPerPage} queries/page`, at: [34, 50], mobileAt: [75, 12], state: r.refused ? "bad" : "active" },
                { id: "pool", label: f.pooler ? "PgBouncer" : "Pools", sub: `${Math.round(r.wanted)} conns`, at: [58, 50], mobileAt: [50, 48], state: r.refused ? "bad" : "idle" },
                { id: "db", label: "Primary", sub: `${pct(r.utilization)} busy · ${Math.round(r.primaryQps)} q/s`, at: [86, 28], mobileAt: [25, 86], state: dbState },
                { id: "replica", label: f.replicas ? `${f.replicas} replicas` : "No replicas", sub: f.replicas ? `${Math.round(r.replicaQps)} q/s` : "", at: [86, 76], mobileAt: [75, 86], state: f.replicas ? "good" : "dim" },
              ]}
              links={[
                { from: "users", to: "app", label: "pages" },
                { from: "app", to: "pool", label: "queries" },
                { from: "pool", to: "db", label: "all queries" },
                { from: "pool", to: "replica", label: "reads", dim: !f.replicas },
                { from: "db", to: "replica", label: "replication", dashed: true, dim: !f.replicas },
              ]}
              packets={packets}
              aspect={2.2}
              mobileAspect={1}
            />
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Page loads a second" accent={ACCENT} value={String(pages)} onChange={(v) => setPages(Number(v))} options={TRAFFIC.map((t) => ({ id: String(t), label: String(t) }))} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Loading…">
                Load the page
              </RunButton>
              <p className="w-full font-mono text-sm" style={{ color: r.overloaded ? "var(--bad)" : r.latencyMs > 300 ? "var(--text)" : "var(--good)" }}>
                {r.overloaded ? "overloaded" : `page in ${ms(r.latencyMs)}`} · DB {pct(r.utilization)} busy
              </p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Traffic arrives" what="Each page load becomes queries. How many, and how long each takes, decide everything below." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {pages} pages/s × {r.queriesPerPage} queries = {r.queriesPerSec.toLocaleString("en-US")} queries/s
                </p>
              </FlowStep>
              <FlowArrow label="queries" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title={BOTTLENECKS[0].label} what={`${BOTTLENECKS[0].symptom} Each one is a round trip and a slot in the pool, and it's invisible in the code: an ORM does it for you.`} accent={ACCENT} active={at(1)}>
                <Toggle checked={f.join} onChange={(v) => set({ join: v })} label={BOTTLENECKS[0].fix} />
                <p className="font-mono text-xs">
                  {r.queriesPerPage} queries per page
                </p>
              </FlowStep>
              <FlowArrow label={`${ms(r.avgQueryMs)} each`} accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title={BOTTLENECKS[1].label} what={`${BOTTLENECKS[1].symptom} Little's law: queries a second × seconds each = queries running at once. Past the cores, they queue.`} accent={ACCENT} active={at(2)}>
                <Toggle checked={f.index} onChange={(v) => set({ index: v })} label={BOTTLENECKS[1].fix} />
                <p className="font-mono text-xs">
                  {Math.round(r.primaryQps)} q/s × {ms(r.avgQueryMs)} = {r.busy.toFixed(1)} running at once · {CORES} cores · {pct(r.utilization)}
                </p>
              </FlowStep>
              <FlowArrow label="connections" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title={BOTTLENECKS[2].label} what={`${BOTTLENECKS[2].symptom} Beyond the limit, new connections are refused and page loads fail outright.`} accent={ACCENT} active={at(3)}>
                <Toggle checked={f.pooler} onChange={(v) => set({ pooler: v })} label={BOTTLENECKS[2].fix} />
                <p className="font-mono text-xs">
                  wanted {Math.round(r.wanted)} · limit {f.pooler ? `${SERVERS * POOL} (pooler)` : MAX_CONNECTIONS} · refused {r.refused}/s
                </p>
              </FlowStep>
              <FlowArrow label="reads and writes" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title={BOTTLENECKS[3].label} what={`${BOTTLENECKS[3].symptom} Replicas copy the primary with a small lag; reads that can tolerate it move there.`} accent={ACCENT} active={at(4)}>
                <Choices label="Read replicas" accent={ACCENT} value={String(f.replicas)} onChange={(v) => set({ replicas: Number(v) })} options={REPLICA_CHOICES.map((n) => ({ id: String(n), label: String(n) }))} />
                <p className="mt-2 font-mono text-xs">
                  primary {Math.round(r.primaryQps)} q/s · replicas {Math.round(r.replicaQps)} q/s
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">Find the bottleneck before fixing it: pg_stat_statements for the slow query, the query log for N+1, connection counts for the pool. Fixing the wrong one changes nothing.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}
