"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { BOXES, INDEXES, ORIGIN, POSTS, QUERIES, answer, bucket, postings, verdict, type IndexType, type Post, type QueryId } from "@/lib/otherIndexes";

const ACCENT = "var(--db)";
const STEP_OF: Record<IndexType, number> = { btree: 1, hash: 2, gin: 3, gist: 4 };
const label = "font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]";

function keyOf(p: Post, q: QueryId) {
  switch (q) {
    case "eq":
      return p.email;
    case "range":
      return p.day;
    case "tags":
      return `{${p.tags.join(",")}}`;
    case "text":
      return p.title;
    case "near":
      return `(${p.at[0]},${p.at[1]})`;
  }
}

export default function OtherIndexesDemo() {
  const [q, setQ] = useState<QueryId>("tags");
  const [ix, setIx] = useState<IndexType>("gin");
  const walk = useWalk(3, 1100);
  const query = QUERIES.find((x) => x.id === q)!;
  const v = verdict(q, ix);
  const hits = new Set(answer(q));
  const path = [0, STEP_OF[ix], 5];
  const activeStep = walk.stage === null ? STEP_OF[ix] : path[walk.stage];
  const indexName = INDEXES.find((x) => x.id === ix)!;
  const column = q === "near" ? "at" : query.column;
  const caption = v.ok
    ? `${indexName.label} can answer ${query.op}. ${v.how} Rows: ${[...hits].join(", ")}.`
    : `${indexName.label} can't answer ${query.op}. ${v.how} The database falls back to reading all ${POSTS.length} rows.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Hash, GIN and GiST indexes"
        blurb="A B-tree handles equality and ranges, but not 'which arrays contain sql', 'which titles mention fast' or 'what is nearest to me'. Postgres has other index types for those. Pick a query and an index, and see whether the index can help."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={`${indexName.label} index for this query`}>
              <pre className="whitespace-pre-wrap break-words rounded-md bg-[var(--inset)] p-2 font-mono text-xs">
                SELECT id FROM posts{"\n"}
                {query.sql};
              </pre>
              <p className={`mt-3 ${label}`}>
                {indexName.label} index on {column}
              </p>
              <div className="mt-2">
                {ix === "btree" && <Btree q={q} hits={v.ok ? hits : new Set()} />}
                {ix === "hash" && <Hash q={q} hits={v.ok ? hits : new Set()} />}
                {ix === "gin" && <Gin q={q} />}
                {ix === "gist" &&
                  (q === "text" ? (
                    <p className="text-sm text-[var(--muted)]">A GiST index on to_tsvector(title) keeps a short, lossy signature of each title&apos;s words. It narrows the rows, then each one is rechecked.</p>
                  ) : (
                    <Gist on={q === "near"} />
                  ))}
              </div>
              <p className="mt-3 rounded-md px-2 py-1.5 font-mono text-xs" style={{ background: "var(--inset)", color: v.ok ? "var(--good)" : "var(--bad)" }}>
                {v.ok ? `Index used (${v.reads}) → rows ${[...hits].join(", ")}` : `Seq Scan: read all ${POSTS.length} rows → rows ${[...hits].join(", ")}`}
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={<span style={{ color: v.ok ? undefined : "var(--bad)" }}>{caption}</span>}>
              <Choices label="Query" accent={ACCENT} value={q} onChange={setQ} options={QUERIES.map((x) => ({ id: x.id, label: x.label }))} />
              <Choices label="Index type" accent={ACCENT} value={ix} onChange={setIx} options={INDEXES.map((x) => ({ id: x.id, label: x.label }))} />
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT}>
                Run the query
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Find the operator in the query" what="An index helps only if its type supports the operator. =, <, @>, @@ and <-> each need a different kind of structure." accent={ACCENT} active={activeStep === 0}>
                <p className="font-mono text-xs">
                  operator <span style={{ color: ACCENT }}>{query.op}</span> on {query.column}
                </p>
              </FlowStep>
              <FlowArrow label="the operator" accent={ACCENT} />
              <FlowStep n={2} title="Use a B-tree for equality and ranges" what="Keys are kept sorted, so the database can jump to one value or read a range in order. It is the default for a reason." accent={ACCENT} active={activeStep === 1}>
                <p className="font-mono text-xs">= &lt; &lt;= &gt; &gt;= BETWEEN, ORDER BY</p>
              </FlowStep>
              <FlowArrow label="equality only?" accent={ACCENT} />
              <FlowStep n={3} title="Use a hash index for equality only" what="Each key is hashed to a bucket. One bucket read finds a value, but hashing destroys order, so ranges and sorting can't use it." accent={ACCENT} active={activeStep === 2}>
                <p className="font-mono text-xs">= only. Often no faster than a B-tree in practice.</p>
              </FlowStep>
              <FlowArrow label="values with parts inside" accent={ACCENT} />
              <FlowStep n={4} title="Use GIN for elements and words" what="GIN stores one entry per element (an array item, a word, a JSON key) pointing to every row that has it, like the index at the back of a book." accent={ACCENT} active={activeStep === 3}>
                <p className="font-mono text-xs">@&gt; &lt;@ &amp;&amp; on arrays and jsonb, @@ for full text</p>
              </FlowStep>
              <FlowArrow label="shapes and distance" accent={ACCENT} />
              <FlowStep n={5} title="Use GiST for shapes and nearness" what="GiST groups nearby values into boxes inside bigger boxes. A search skips any box that can't overlap or be closer than what it already found." accent={ACCENT} active={activeStep === 4}>
                <p className="font-mono text-xs">&amp;&amp; overlap, @&gt; contains, &lt;-&gt; nearest; points, ranges, PostGIS shapes</p>
              </FlowStep>
              <FlowArrow label="an index type" accent={ACCENT} />
              <FlowStep n={6} title="Create it and check EXPLAIN" what="Build the index with USING, then run EXPLAIN. If the plan still says Seq Scan, the index doesn't support the operator, or the table is small enough that scanning is cheaper." accent={ACCENT} active={activeStep === 5}>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                  CREATE INDEX ON posts USING {indexName.using} ({q === "text" ? "to_tsvector('english', title)" : column});
                </pre>
                <p className="mt-1 font-mono text-xs" style={{ color: v.ok ? "var(--good)" : "var(--bad)" }}>
                  {v.ok ? planLine(q, ix, column) : "Seq Scan on posts"}
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function planLine(q: QueryId, ix: IndexType, column: string) {
  const name = `posts_${q === "text" ? "to_tsvector" : column}_idx`;
  // GIN can only be read through a bitmap scan; the others here use a plain index scan.
  return ix === "gin" || (ix === "gist" && q === "text") ? `Bitmap Index Scan on ${name}` : `Index Scan using ${name}`;
}

function Btree({ q, hits }: { q: QueryId; hits: Set<number> }) {
  const sorted = [...POSTS].sort((a, b) => keyOf(a, q).localeCompare(keyOf(b, q)));
  return (
    <ol className="grid gap-1 font-mono text-[11px] sm:grid-cols-2">
      {sorted.map((p) => (
        <li key={p.id} className="flex min-w-0 justify-between gap-2 rounded px-2 py-1" style={{ background: hits.has(p.id) ? ACCENT : "var(--inset)", color: hits.has(p.id) ? "var(--on-accent)" : undefined }}>
          <span className="truncate">{keyOf(p, q)}</span>
          <span className="shrink-0 opacity-70">→ {p.id}</span>
        </li>
      ))}
    </ol>
  );
}

function Hash({ q, hits }: { q: QueryId; hits: Set<number> }) {
  const target = q === "eq" ? bucket("di@x.io") : -1;
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {[0, 1, 2, 3].map((b) => (
        <div key={b} className="min-w-0 rounded-md border p-1.5" style={{ borderColor: b === target ? ACCENT : "var(--line)", background: "var(--inset)" }}>
          <p className="font-mono text-[10px] text-[var(--faint)]">bucket {b}</p>
          <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
            {POSTS.filter((p) => bucket(keyOf(p, q)) === b).map((p) => (
              <li key={p.id} className="truncate" style={{ color: hits.has(p.id) ? ACCENT : undefined, fontWeight: hits.has(p.id) ? 700 : 400 }}>
                {keyOf(p, q)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Gin({ q }: { q: QueryId }) {
  if (q !== "tags" && q !== "text")
    return <p className="text-sm text-[var(--muted)]">This column holds one plain value per row, so there are no elements to put in a GIN index.</p>;
  const want = q === "tags" ? ["sql", "index"] : ["index", "fast"];
  return (
    <ul className="grid gap-1 font-mono text-[11px] sm:grid-cols-2">
      {postings(q === "tags" ? "tags" : "words").map(([term, ids]) => {
        const on = want.includes(term);
        return (
          <li key={term} className="flex min-w-0 justify-between gap-2 rounded px-2 py-0.5" style={{ background: on ? `color-mix(in srgb, ${ACCENT} 22%, transparent)` : "var(--inset)", fontWeight: on ? 700 : 400 }}>
            <span className="truncate">{term}</span>
            <span className="shrink-0">→ {ids.join(", ")}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Gist({ on }: { on: boolean }) {
  const s = 22; // px per unit in a 0..10 grid
  const px = (v: number) => 10 + v * s;
  const py = (v: number) => 10 + (10 - v) * s;
  const near = new Set(answer("near"));
  return (
    <>
      <svg viewBox="0 0 240 240" className="mx-auto h-auto w-full max-w-[16rem]" role="img" aria-label="Points grouped into two bounding boxes">
        <rect x="10" y="10" width="220" height="220" style={{ fill: "none", stroke: "var(--line)" }} />
        {BOXES.map((b) => {
          const skipped = on && b.minDist > 0;
          return (
            <g key={b.name}>
              <rect
                x={px(b.x0) - 6}
                y={py(b.y1) - 6}
                width={(b.x1 - b.x0) * s + 12}
                height={(b.y1 - b.y0) * s + 12}
                rx="4"
                strokeDasharray={skipped ? "4 3" : undefined}
                style={{ fill: skipped ? "none" : `color-mix(in srgb, ${ACCENT} 10%, transparent)`, stroke: skipped ? "var(--faint)" : ACCENT }}
              />
              <text x={px(b.x0) - 2} y={py(b.y1) - 9} fontSize="10" style={{ fill: skipped ? "var(--faint)" : ACCENT }}>
                box {b.name}
                {on ? ` · min dist ${b.minDist}` : ""}
              </text>
            </g>
          );
        })}
        {POSTS.map((p) => (
          <g key={p.id}>
            <circle cx={px(p.at[0])} cy={py(p.at[1])} r="5" style={{ fill: on && near.has(p.id) ? "var(--good)" : "var(--muted)" }} />
            <text x={px(p.at[0]) + 7} y={py(p.at[1]) + 4} fontSize="10" style={{ fill: "var(--text)" }}>
              {p.id}
            </text>
          </g>
        ))}
        {on && (
          <g>
            <path d={`M${px(ORIGIN[0]) - 5} ${py(ORIGIN[1])} h10 M${px(ORIGIN[0])} ${py(ORIGIN[1]) - 5} v10`} strokeWidth="2" style={{ stroke: "var(--bad)" }} />
          </g>
        )}
      </svg>
      {!on && <p className="mt-1 text-sm text-[var(--muted)]">This GiST index is on the at column. The query filters a different column, so the boxes don&apos;t help.</p>}
    </>
  );
}
