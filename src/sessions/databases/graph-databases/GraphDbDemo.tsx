"use client";

import { useMemo, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { ANA, CELEB, HOBBIES, PEOPLE, degree, farPerson, graph, nameOf, relationalCost, shortestPath, suggestions, walk } from "@/lib/graphDb";

const ACCENT = "var(--db)";
const CAP = 500;

type Opts = { hobby: string; depth: number; cap: boolean; bidirectional: boolean };
const NAIVE: Opts = { hobby: "climbing", depth: 2, cap: false, bidirectional: false };
const TUNED: Opts = { hobby: "climbing", depth: 2, cap: true, bidirectional: true };

export default function GraphDbDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const g = graph();
  const cap = o.cap ? CAP : null;
  const w = useMemo(() => walk(ANA, o.depth, o.cap ? CAP : null), [o.depth, o.cap]);
  const sg = useMemo(() => suggestions(ANA, o.hobby, o.cap ? CAP : null), [o.hobby, o.cap]);
  const rel = relationalCost(w.expanded, w.edgesRead);
  const target = useMemo(() => farPerson(), []);
  const sp = useMemo(() => shortestPath(ANA, target, o.bidirectional), [target, o.bidirectional]);
  const reached = w.dist.size - 1;

  const nodes: MapNode[] = [
    { id: "app", label: "App", sub: `“people Ana may know”`, at: [12, 30], mobileAt: [25, 10], state: "active" },
    { id: "graph", label: "Graph database", sub: `${w.edgesRead.toLocaleString("en-US")} edges walked`, at: [50, 30], mobileAt: [75, 10], state: w.edgesRead > 5000 ? "wait" : "good" },
    { id: "pg", label: "Postgres", sub: `${rel.probes.toLocaleString("en-US")} index probes`, at: [88, 30], mobileAt: [75, 50], state: rel.probes > 500 ? "wait" : "good" },
    { id: "ana", label: "Ana", sub: `${degree(ANA)} friends`, at: [30, 80], mobileAt: [25, 50], state: "active" },
    { id: "celeb", label: "The celebrity", sub: `${degree(CELEB).toLocaleString("en-US")} friends`, at: [70, 80], mobileAt: [50, 88], state: o.cap ? "dim" : "bad" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("s", ["app", "graph"], { label: `${PEOPLE.toLocaleString("en-US")} people` })
    : stage === 1 ? hops("q", ["app", "graph", "ana"], { label: "MATCH (ana)-[:FRIEND*2]-…" })
    : stage === 2 ? [...hops("g", ["graph", "ana"], { label: `${reached.toLocaleString("en-US")} reached` }), ...hops("p", ["app", "pg"], { label: `${rel.probes} probes`, start: 0.2 })]
    : stage === 3 ? hops("c", ["ana", "celeb"], { label: o.cap ? "not expanded" : `+${degree(CELEB).toLocaleString("en-US")}`, tone: o.cap ? "good" : "bad" })
    : stage === 4 ? hops("sp", ["app", "graph"], { label: `${sp.path.length - 1} hops`, tone: "good" })
    : [];

  const captions = [
    `Step 1: ${PEOPLE.toLocaleString("en-US")} people and ${g.edges.toLocaleString("en-US")} friendships. Each person stores the list of their friends right beside them.`,
    `Step 2: friends of Ana's friends who like ${o.hobby} and aren't her friends yet: ${sg.list.length} people, ranked by mutual friends.`,
    `Step 3: ${o.depth} hop${o.depth === 1 ? "" : "s"} from Ana reaches ${reached.toLocaleString("en-US")} people by walking ${w.edgesRead.toLocaleString("en-US")} edges. The same walk on a table is ${rel.probes.toLocaleString("en-US")} index probes and about ${rel.pages.toLocaleString("en-US")} page reads.`,
    o.cap ? `Step 4: people with more than ${CAP} friends aren't expanded, so the celebrity doesn't drag in everyone they know.` : `Step 4: Ana is friends with a celebrity who has ${degree(CELEB).toLocaleString("en-US")} friends, so two hops from Ana is suddenly a third of the network.`,
    `Step 5: the shortest path from Ana to ${nameOf(target)} is ${sp.path.length - 1} hops; ${o.bidirectional ? "searching from both ends" : "searching from Ana alone"} reads ${sp.edges.toLocaleString("en-US")} edges.`,
  ];
  const caption = stage !== null ? captions[stage] : `${sg.list.length} suggestions · ${o.depth} hops reach ${reached.toLocaleString("en-US")} people over ${w.edgesRead.toLocaleString("en-US")} edges · shortest path ${sp.path.length - 1} hops, ${sp.edges.toLocaleString("en-US")} edges read.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Graph databases"
        blurb="A graph database stores relationships as first-class edges, so following them is a pointer hop rather than an index lookup and a join. That makes friends-of-friends and shortest paths natural to ask and cheap to run, until a hop reaches someone with a thousand friends. Run the queries over a 3,000-person social graph."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The app asks a graph database and, for comparison, Postgres; the walk starts at Ana and may pass through a celebrity"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "graph", label: "Cypher" },
                  { from: "app", to: "pg", label: "SQL", dim: true },
                  { from: "graph", to: "ana", label: "start" },
                  { from: "ana", to: "celeb", label: "FRIEND", dim: o.cap },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="People reached per hop">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Rings around Ana · people reached per hop</p>
                <div className="mt-2 space-y-1.5">
                  {w.perHop.map((h, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[var(--muted)]">hop {i + 1}</span>
                        <span className="font-mono">{h.reached.toLocaleString("en-US")} new · {h.edges.toLocaleString("en-US")} edges</span>
                      </div>
                      <div className="h-2 rounded bg-[var(--inset)]">
                        <div className="h-full rounded" style={{ width: `${Math.max(0.5, (h.reached / PEOPLE) * 100)}%`, background: ACCENT }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-[var(--muted)]">Suggested for Ana ({o.hobby}):</p>
                <ul className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                  {sg.list.slice(0, 6).map((s) => (
                    <li key={s.id} className="rounded border border-[var(--line)] px-1.5 py-0.5">
                      {nameOf(s.id)} <span className="text-[var(--muted)]">· {s.mutual} mutual</span>
                    </li>
                  ))}
                  {sg.list.length > 6 && <li className="px-1.5 py-0.5 text-[var(--muted)]">+{sg.list.length - 6} more</li>}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Walk everything
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Cap supernodes
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Walking…">
                Run the query
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Store people and friendships as nodes and edges" what="Each node keeps direct references to its edges (index-free adjacency), so going from a person to their friends doesn't search an index. In a relational database the same data is a friendships(user_id, friend_id) table with an index." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {PEOPLE.toLocaleString("en-US")} people · {g.edges.toLocaleString("en-US")} friendships · Ana has {degree(ANA)} friends
                </p>
              </FlowStep>
              <FlowArrow label="a question about relationships" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Ask across relationships" what="The query describes a pattern of nodes and edges. Variable-length paths like [:FRIEND*1..4] are one line in Cypher and a recursive CTE in SQL." accent={ACCENT} active={at(1)}>
                <Choices<string> accent={ACCENT} value={o.hobby} onChange={(v) => set({ hobby: v })} options={HOBBIES.slice(0, 4).map((h) => ({ id: h, label: h }))} />
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">
                  {`MATCH (ana:Person {name: 'Ana'})-[:FRIEND]-(f)-[:FRIEND]-(fof)\nWHERE '${o.hobby}' IN fof.likes AND NOT (ana)-[:FRIEND]-(fof) AND fof <> ana\nRETURN fof, count(f) AS mutual ORDER BY mutual DESC`}
                </pre>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed text-[var(--muted)]">
                  {`SELECT f2.friend_id, count(*) AS mutual\nFROM friendships f1 JOIN friendships f2 ON f2.user_id = f1.friend_id\nJOIN likes l ON l.user_id = f2.friend_id AND l.hobby = '${o.hobby}'\nWHERE f1.user_id = :ana AND f2.friend_id <> :ana\n  AND f2.friend_id NOT IN (SELECT friend_id FROM friendships WHERE user_id = :ana)\nGROUP BY f2.friend_id ORDER BY mutual DESC`}
                </pre>
                <p className="font-mono text-xs">{sg.list.length} people suggested</p>
              </FlowStep>
              <FlowArrow label="walk it" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Walk hop by hop" what="Each hop expands every person in the frontier. The graph store reads their adjacency list directly; the table needs a B-tree probe per person. Either way, the frontier grows by roughly the average number of friends each hop." accent={ACCENT} active={at(2)}>
                <Slider label="Hops from Ana" value={o.depth} min={1} max={4} step={1} format={(v) => String(v)} onChange={(v) => set({ depth: v })} accent={ACCENT} />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded border border-[var(--line)] p-2">
                    <p className="text-[var(--muted)]">graph database</p>
                    <p className="font-mono">{w.expanded.toLocaleString("en-US")} adjacency reads</p>
                    <p className="font-mono">{w.edgesRead.toLocaleString("en-US")} edges walked</p>
                  </div>
                  <div className="rounded border border-[var(--line)] p-2">
                    <p className="text-[var(--muted)]">friendships table</p>
                    <p className="font-mono">{rel.probes.toLocaleString("en-US")} index probes</p>
                    <p className="font-mono">≈ {rel.pages.toLocaleString("en-US")} page reads</p>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--muted)]">{reached.toLocaleString("en-US")} of {PEOPLE.toLocaleString("en-US")} people within {o.depth} hop{o.depth === 1 ? "" : "s"}</p>
              </FlowStep>
              <FlowArrow label="someone very popular" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Watch out for supernodes" what="A node with thousands of edges makes every walk through it explode, in any database. Graph queries usually cap fan-out, skip nodes above a degree, or treat 'follows a celebrity' as a different, weaker relationship." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.cap} onChange={(e) => set({ cap: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Don&apos;t expand people with over {CAP} friends
                </label>
                <p className="font-mono text-xs" style={{ color: cap ? "var(--good)" : "var(--bad)" }}>
                  {sg.list.length} suggestions from {sg.edgesRead.toLocaleString("en-US")} edges
                </p>
              </FlowStep>
              <FlowArrow label="how are two people connected?" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Find the shortest path" what="Breadth-first search from one person finds the shortest chain of friends, but the frontier grows each hop. Searching from both ends and meeting in the middle touches far fewer edges, because two small balls are smaller than one big one." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.bidirectional} onChange={(e) => set({ bidirectional: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Search from both ends
                </label>
                <p className="text-xs">{sp.path.map(nameOf).join(" → ")}</p>
                <p className="font-mono text-xs">{sp.edges.toLocaleString("en-US")} edges read</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The graph is generated by preferential attachment; walks, suggestions and paths really run on it. Page counts for the table are estimates.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
