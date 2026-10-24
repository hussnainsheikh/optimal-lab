"use client";

import { useMemo, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { N_DOCS, QUERIES, SEGMENT_DOCS, analyze, compressed, docs, index, indexBytes, search, segments, type QueryId } from "@/lib/invertedIndex";

const ACCENT = "var(--db)";

type Opts = { query: QueryId; leapfrog: boolean; factor: number; deletedPct: number; merged: boolean };
const NAIVE: Opts = { query: "legalCrash", leapfrog: false, factor: 4, deletedPct: 20, merged: false };
const TUNED: Opts = { query: "legalCrash", leapfrog: true, factor: 10, deletedPct: 20, merged: true };

const kb = (b: number) => (b >= 1000 ? `${(b / 1000).toFixed(1)} KB` : `${b} B`);

/** One row of ticks per posting list, positioned by document id; matches are lit. */
function Postings({ lists, hits }: { lists: { term: string; ids: number[] }[]; hits: Set<number> }) {
  return (
    <div className="space-y-2">
      {lists.map((l) => (
        <div key={l.term}>
          <p className="flex justify-between font-mono text-[11px]">
            <span>{l.term}</span>
            <span className="text-[var(--muted)]">{l.ids.length.toLocaleString("en-US")} tickets</span>
          </p>
          <svg viewBox={`0 0 ${N_DOCS} 10`} preserveAspectRatio="none" className="h-4 w-full rounded bg-[var(--inset)]" aria-hidden>
            {l.ids.map((id) => (
              <rect key={id} x={id} y={hits.has(id) ? 0 : 3} width={hits.has(id) ? 8 : 4} height={hits.has(id) ? 10 : 4} fill={hits.has(id) ? "var(--good)" : "color-mix(in srgb, var(--db) 55%, transparent)"} />
            ))}
          </svg>
        </div>
      ))}
    </div>
  );
}

export default function InvertedIndexDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const ix = index();
  const r = useMemo(() => search(o.query, o.leapfrog), [o.query, o.leapfrog]);
  const other = useMemo(() => search(o.query, !o.leapfrog), [o.query, o.leapfrog]);
  const all = useMemo(() => indexBytes(), []);
  const seg = segments(o.factor, o.deletedPct, o.merged);
  const sample = docs()[1];
  const an = analyze(sample);
  const lists = r.terms.map((t) => ({ term: t, ids: ix.get(t) ?? [] }));
  const qBytes = lists.reduce((a, l) => {
    const c = compressed(l.ids);
    return { raw: a.raw + c.raw, packed: a.packed + c.packed };
  }, { raw: 0, packed: 0 });
  const top = useMemo(() => [...index()].sort((a, b) => b[1].length - a[1].length).slice(0, 8), []);
  const hits = new Set(r.ids);

  const nodes: MapNode[] = [
    { id: "app", label: "Help desk", sub: `${N_DOCS.toLocaleString("en-US")} tickets`, at: [12, 25], mobileAt: [25, 10], state: "active" },
    { id: "an", label: "Analyzer", sub: "lowercase · stop words · stem", at: [45, 25], mobileAt: [75, 10], state: "active" },
    { id: "seg", label: "Segments", sub: `${seg.count} on disk`, at: [82, 25], mobileAt: [75, 50], state: seg.count > 3 ? "wait" : "good" },
    { id: "search", label: "Searcher", sub: `${r.comparisons.toLocaleString("en-US")} comparisons`, at: [45, 78], mobileAt: [25, 50], state: "good" },
    { id: "user", label: "Agent searching", sub: `“${QUERIES[o.query]}”`, at: [12, 78], mobileAt: [50, 88], state: "active" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["app", "an"], { label: `${an.terms.length} terms` })
    : stage === 1 ? hops("b", ["an", "seg"], { label: `${ix.size} posting lists` })
    : stage === 2 ? hops("q", ["user", "search", "seg"], { label: `${r.ids.length} matches`, tone: "good" })
    : stage === 3 ? hops("c", ["seg", "search"], { label: `${kb(qBytes.packed)} read`, tone: "good" })
    : stage === 4 ? hops("m", ["app", "an", "seg"], { label: o.merged ? "1 segment" : `segment ${seg.count + 1}`, tone: o.merged ? "good" : "accent" })
    : [];

  const captions = [
    `Step 1: "${sample}" becomes ${an.terms.map((t) => `“${t}”`).join(", ")}: lowercased, stop words dropped, suffixes stripped so “crashed” and “crashing” match.`,
    `Step 2: each of the ${ix.size} terms gets a sorted list of the tickets that contain it: ${all.postings.toLocaleString("en-US")} entries in total.`,
    `Step 3: “${QUERIES[o.query]}” intersects ${r.sizes.map((s) => s.toLocaleString("en-US")).join(" × ")} ids ${o.leapfrog ? "by leapfrogging through the longer list" : "by walking both lists"}: ${r.comparisons.toLocaleString("en-US")} comparisons for ${r.ids.length} matches (the other way: ${other.comparisons.toLocaleString("en-US")}).`,
    `Step 4: stored as gaps in variable-length bytes, these lists take ${kb(qBytes.packed)} instead of ${kb(qBytes.raw)} as 4-byte integers.`,
    o.merged ? "Step 5: after a merge there's one segment, and deleted tickets are finally dropped from it." : `Step 5: ${seg.count} segments must each be searched, and ${seg.dead.toLocaleString("en-US")} postings of deleted tickets are still read and skipped until a merge.`,
  ];
  const caption = stage !== null ? captions[stage] : `“${QUERIES[o.query]}”: ${r.ids.length} tickets from ${r.comparisons.toLocaleString("en-US")} comparisons, against ${r.scanAll.toLocaleString("en-US")} terms to check by scanning every ticket · ${seg.count} segment${seg.count === 1 ? "" : "s"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Inverted indexes for search"
        blurb="Full-text search doesn't read documents to find words; it reads a list, kept per word, of the documents that contain it. Elasticsearch, OpenSearch, Lucene and Postgres's GIN indexes all work this way. Build one over 3,000 support tickets, intersect lists for a query, compress them, and see why the index lives in segments."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Tickets go through an analyzer into index segments; a searcher reads posting lists from the segments to answer an agent's query"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "an", label: "text" },
                  { from: "an", to: "seg", label: "terms" },
                  { from: "user", to: "search", label: "query" },
                  { from: "search", to: "seg", label: "postings" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Posting lists for the query">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Posting lists · ticket 0 → {N_DOCS.toLocaleString("en-US")} · green = in every list</p>
                <div className="mt-2">
                  <Postings lists={lists} hits={hits} />
                </div>
                <ul className="mt-3 space-y-0.5 text-[11px]">
                  {r.results.map((x) => (
                    <li key={x.id} className="break-words">
                      <span className="font-mono text-[var(--faint)]">#{x.id}</span> {x.text}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices<QueryId> accent={ACCENT} value={o.query} onChange={(v) => set({ query: v })} options={(Object.keys(QUERIES) as QueryId[]).map((id) => ({ id, label: QUERIES[id] }))} />
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Walk lists, many segments
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Leapfrog, merged
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Searching…">
                Index and search
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Analyze text into terms" what="The analyzer splits text into tokens, lowercases them, drops words too common to help (stop words) and strips suffixes (stemming), so a search for “crashed” also finds “crashing”. Queries go through the same analyzer." accent={ACCENT} active={at(0)}>
                <p className="text-xs">“{sample}”</p>
                <p className="font-mono text-[11px] text-[var(--muted)]">tokens: {an.tokens.join(" · ")}</p>
                <p className="font-mono text-[11px]">terms: {an.terms.join(" · ")}</p>
              </FlowStep>
              <FlowArrow label="term → ticket ids" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Keep a sorted list of tickets per term" what="The index maps each term to its posting list: the ids of the tickets that contain it, in order. Ids are handed out as tickets arrive, so lists are appended to and stay sorted." accent={ACCENT} active={at(1)}>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[11px] sm:grid-cols-4">
                  {top.map(([t, l]) => (
                    <li key={t} className="flex justify-between gap-2">
                      <span>{t}</span>
                      <span className="text-[var(--muted)]">{l.length}</span>
                    </li>
                  ))}
                </ul>
                <p className="font-mono text-xs">{ix.size} terms · {all.postings.toLocaleString("en-US")} postings</p>
              </FlowStep>
              <FlowArrow label="AND query" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Intersect the lists" what="An AND query keeps ids that are in every list. Start from the rarest list. Walking both lists step by step costs about the length of both; leapfrogging calls advance(id) to jump ahead in the long list, which wins when one list is much rarer." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.leapfrog} onChange={(e) => set({ leapfrog: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Leapfrog with advance()
                </label>
                <p className="font-mono text-xs">
                  {r.sizes.map((s) => s.toLocaleString("en-US")).join(" ∩ ")} → {r.ids.length} · {r.comparisons.toLocaleString("en-US")} comparisons (walk: {(o.leapfrog ? other : r).comparisons.toLocaleString("en-US")}, leapfrog: {(o.leapfrog ? r : other).comparisons.toLocaleString("en-US")})
                </p>
                <p className="text-[11px] text-[var(--muted)]">Without an index: read all {N_DOCS.toLocaleString("en-US")} tickets, {r.scanAll.toLocaleString("en-US")} terms.</p>
              </FlowStep>
              <FlowArrow label="lists on disk" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Compress the lists" what="Sorted ids are stored as gaps from the previous id, and small gaps fit in one byte of a variable-length encoding. Smaller lists mean fewer bytes read from disk and more of the index in memory." accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs">
                  this query: {kb(qBytes.raw)} → {kb(qBytes.packed)} · whole index: {kb(all.raw)} → {kb(all.packed)} ({(all.raw / all.packed).toFixed(1)}× smaller)
                </p>
                <p className="font-mono text-[11px] text-[var(--muted)]">
                  {lists[0]?.term}: {lists[0]?.ids.slice(0, 6).join(", ")} … → gaps {lists[0]?.ids.slice(0, 6).map((id, i, a) => (i ? id - a[i - 1] : id)).join(", ")} …
                </p>
              </FlowStep>
              <FlowArrow label="new and deleted tickets" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Write segments, merge them later" what={`Rewriting sorted lists for every new ticket would be slow, so the index buffers ${SEGMENT_DOCS} tickets and writes them as a new, immutable segment. Deletes only mark ids as gone. Background merges combine segments and drop deleted entries.`} accent={ACCENT} active={at(4)}>
                <Choices<string> accent={ACCENT} value={String(o.factor)} onChange={(v) => set({ factor: Number(v) })} options={[{ id: "4", label: "Merge every 4 segments" }, { id: "10", label: "Merge every 10" }]} />
                <Slider label="Tickets deleted since" value={o.deletedPct} min={0} max={40} step={5} format={(v) => `${v}%`} onChange={(v) => set({ deletedPct: v })} accent={ACCENT} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.merged} onChange={(e) => set({ merged: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Force-merge to one segment
                </label>
                <p className="font-mono text-xs">
                  {seg.count} segment{seg.count === 1 ? "" : "s"}: every term is looked up {seg.lookupsPerTerm}× · {seg.dead.toLocaleString("en-US")} deleted postings still read
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The tickets are generated; analysis, posting lists, intersections and byte counts are computed from them.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
