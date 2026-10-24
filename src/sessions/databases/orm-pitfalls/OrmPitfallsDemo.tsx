"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { PAGE, cost, plan, type Count, type Strategy } from "@/lib/ormQueries";

const ACCENT = "var(--db)";

type Opts = { strategy: Strategy; count: Count; narrow: boolean; rtt: number };
const NAIVE: Opts = { strategy: "lazy", count: "load", narrow: false, rtt: 1 };
const TUNED: Opts = { strategy: "selectin", count: "aggregate", narrow: true, rtt: 1 };

const STRATEGY: Record<Strategy, string> = { lazy: "Lazy loading (default)", joined: "Eager: one big JOIN", selectin: "Eager: one query per relation" };
const kb = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(2)} MB` : `${(b / 1e3).toFixed(1)} KB`);
const ms = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(2)} s` : `${x.toFixed(1)} ms`);

export default function OrmPitfallsDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const stmts = plan(o.strategy, o.count, o.narrow);
  const c = cost(stmts, o.rtt);
  const all = (Object.keys(STRATEGY) as Strategy[]).map((k) => ({ k, ...cost(plan(k, o.count, o.narrow), o.rtt) }));
  const best = Math.min(...all.map((x) => x.ms));

  const nodes: MapNode[] = [
    { id: "page", label: "Page code", sub: `${PAGE} posts`, at: [12, 50], mobileAt: [50, 8], state: "active" },
    { id: "orm", label: "ORM", sub: STRATEGY[o.strategy], at: [40, 50], mobileAt: [50, 34], state: "active" },
    { id: "net", label: "Network", sub: `${o.rtt} ms round trip`, at: [66, 50], mobileAt: [50, 60], state: c.queries > 10 ? "wait" : "good" },
    { id: "pg", label: "Postgres", sub: `${c.queries} quer${c.queries === 1 ? "y" : "ies"} · ${c.rows.toLocaleString("en-US")} rows`, at: [90, 50], mobileAt: [50, 88], state: c.queries > 10 || c.rows > 500 ? "bad" : "good" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("p", ["page", "orm"], { label: "post.author.name" })
    : stage === 1 ? Array.from({ length: Math.min(6, c.queries) }, (_, i) => hops(`q${i}`, ["orm", "net", "pg"], { label: i === 0 ? `${c.queries} queries` : "", tone: c.queries > 10 ? "bad" : "good", start: i * 0.15 })).flat()
    : stage === 2 ? hops("r", ["pg", "net", "orm"], { label: `${c.rows.toLocaleString("en-US")} rows`, tone: c.rows > 500 ? "bad" : "good" })
    : stage === 3 ? hops("t", ["orm", "net", "pg"], { label: `${c.queries} × ${o.rtt} ms`, tone: c.queries > 10 ? "bad" : "good" })
    : stage === 4 ? hops("b", ["pg", "net", "orm", "page"], { label: kb(c.bytes), tone: c.bytes > 200_000 ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: the page shows ${PAGE} posts, each with its author, tags and number of comments. The code reads like plain object access.`,
    o.strategy === "lazy" ? `Step 2: lazy loading fires a query each time the template touches a relation: 1 for the posts, then ${PAGE} for authors, ${PAGE} for tags and ${PAGE} for comments. That's the N+1 problem: ${c.queries} queries.` : o.strategy === "joined" ? "Step 2: one query joins posts to authors, tags and comments." : `Step 2: one query for the posts, then one per relation with WHERE … IN (the ${PAGE} ids): ${c.queries} queries.`,
    o.strategy === "joined" && o.count === "load" ? `Step 3: joining two one-to-many relations multiplies them: every tag row pairs with every comment row, so ${PAGE} posts come back as ${c.rows.toLocaleString("en-US")} rows.` : `Step 3: ${c.rows.toLocaleString("en-US")} rows come back for ${PAGE} posts.`,
    `Step 4: at ${o.rtt} ms per round trip, ${c.queries} queries spend ${ms(c.queries * o.rtt)} just waiting on the network; the page's queries take ${ms(c.ms)} in all.`,
    `Step 5: ${o.narrow ? "selecting only the columns the page shows" : "SELECT * drags every column, including the post bodies"}${o.count === "load" ? ", and counting comments by loading them all" : ", and comment counts come from count(*)"}: ${kb(c.bytes)} over the wire.`,
  ];
  const caption = stage !== null ? captions[stage] : `${STRATEGY[o.strategy]}: ${c.queries} quer${c.queries === 1 ? "y" : "ies"}, ${c.rows.toLocaleString("en-US")} rows, ${kb(c.bytes)}, ${ms(c.ms)}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="ORMs and N+1 queries"
        blurb="An ORM turns post.author.name into SQL for you, which is convenient until a page of 20 posts quietly sends 61 queries. Load one page of a blog through three loading strategies and see the SQL, the rows and the bytes each sends, and what network distance does to it."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Page code asks the ORM for posts and their relations; the ORM sends SQL over the network to Postgres"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "page", to: "orm", label: "objects" },
                  { from: "orm", to: "net", label: "SQL" },
                  { from: "net", to: "pg", label: "round trip" },
                ]}
                packets={packets}
                aspect={2.2}
                mobileAspect={0.8}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The SQL the ORM sends">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">What reaches Postgres · {c.queries} statement{c.queries === 1 ? "" : "s"}</p>
                <ol className="mt-2 max-h-72 space-y-1 overflow-y-auto text-[11px]">
                  {stmts.slice(0, 8).map((st, i) => (
                    <li key={i} className="min-w-0">
                      <code className="block break-words font-mono">{st.sql}</code>
                      <span className="text-[var(--muted)]">→ {st.rows.toLocaleString("en-US")} row{st.rows === 1 ? "" : "s"}, {kb(st.bytes)}</span>
                    </li>
                  ))}
                  {stmts.length > 8 && <li className="text-[var(--bad)]">… and {stmts.length - 8} more like them</li>}
                </ol>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO({ ...NAIVE, rtt: o.rtt })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  ORM defaults
                </button>
                <button type="button" onClick={() => setO({ ...TUNED, rtt: o.rtt })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Eager, counted, narrow
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Rendering…">
                Render the page
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Write the page code" what="The code reads the latest posts, then for each one its author, its tags and how many comments it has. Nothing here looks like a query, which is the point and the trap." accent={ACCENT} active={at(0)}>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">
                  {`posts = Post.latest(${PAGE})\nfor post in posts:\n    show(post.title, post.author.name)\n    show(post.tags)\n    show(${o.count === "load" ? "len(post.comments)      # loads every comment" : "post.comment_count       # annotated count(*)"})`}
                </pre>
                <Choices<Count> accent={ACCENT} value={o.count} onChange={(v) => set({ count: v })} options={[{ id: "load", label: "Count by loading comments" }, { id: "aggregate", label: "Count in SQL" }]} />
              </FlowStep>
              <FlowArrow label="the ORM writes SQL" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="See the SQL it sends" what="Lazy loading fetches a relation the first time you touch it: one query per post per relation. Every ORM can load relations eagerly instead, either joined into the first query or as one extra query per relation." accent={ACCENT} active={at(1)}>
                <Choices<Strategy> accent={ACCENT} value={o.strategy} onChange={(v) => set({ strategy: v })} options={(Object.keys(STRATEGY) as Strategy[]).map((id) => ({ id, label: STRATEGY[id] }))} />
                <p className="font-mono text-xs" style={{ color: c.queries > 10 ? "var(--bad)" : "var(--good)" }}>{c.queries} quer{c.queries === 1 ? "y" : "ies"} for one page</p>
              </FlowStep>
              <FlowArrow label="rows come back" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Don't join two lists in one query" what="A JOIN repeats the parent row for each child. Join two one-to-many relations at once and they multiply: 3 tags × 25 comments is 75 rows for one post. Load each relation separately instead." accent={ACCENT} active={at(2)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[17rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">strategy</th>
                        <th className="py-1 text-right font-normal">queries</th>
                        <th className="py-1 text-right font-normal">rows</th>
                        <th className="py-1 text-right font-normal">bytes</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {all.map((x) => (
                        <tr key={x.k} className="border-t border-[var(--line)]" style={{ fontWeight: x.k === o.strategy ? 600 : 400 }}>
                          <td className="py-1 font-sans text-[var(--muted)]">{STRATEGY[x.k]}</td>
                          <td className="py-1 text-right">{x.queries}</td>
                          <td className="py-1 text-right">{x.rows.toLocaleString("en-US")}</td>
                          <td className="py-1 text-right">{kb(x.bytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FlowStep>
              <FlowArrow label="each query is a round trip" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Count the round trips" what="Each query waits for the network both ways before the next one can start. On the same machine that's a fraction of a millisecond; across availability zones about 1 ms; from another region 20 ms or more." accent={ACCENT} active={at(3)}>
                <Slider label="Round trip to the database" value={o.rtt} min={0.2} max={30} step={0.2} format={(v) => `${v.toFixed(1)} ms`} onChange={(v) => set({ rtt: Math.round(v * 10) / 10 })} accent={ACCENT} />
                <ul className="space-y-0.5 font-mono text-xs">
                  {all.map((x) => (
                    <li key={x.k} className="flex justify-between gap-2" style={{ color: x.ms === best ? "var(--good)" : x.ms > best * 5 ? "var(--bad)" : "var(--muted)" }}>
                      <span className="font-sans">{STRATEGY[x.k]}</span>
                      <span>{ms(x.ms)}</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="bytes over the wire" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Fetch only what the page shows" what="SELECT * sends every column, including large text the list page never displays. Ask for the columns you show, and let the database count rather than shipping every comment to count them in code." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.narrow} onChange={(e) => set({ narrow: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Select only id, title, author_id, created_at
                </label>
                <p className="font-mono text-xs" style={{ color: c.bytes > 200_000 ? "var(--bad)" : "var(--good)" }}>{kb(c.bytes)} for one page</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The SQL and row counts come from 2,000 generated posts with 0–40 comments and 1–4 tags each; row widths, per-row cost and link speed are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
