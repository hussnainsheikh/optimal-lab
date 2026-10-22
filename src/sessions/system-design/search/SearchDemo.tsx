"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { B, DOCS, K1, QUERIES, RANKINGS, TOTAL_INDEX_TERMS, analyze, buildIndex, search, type Analyzer, type Filter, type Ranking } from "@/lib/search";

const ACCENT = "var(--sys)";
const CATS: { id: Filter["category"]; label: string }[] = [
  { id: "all", label: "All" },
  { id: "shoes", label: "Shoes" },
  { id: "jackets", label: "Jackets" },
  { id: "bags", label: "Bags" },
];

export default function SearchDemo() {
  const [q, setQ] = useState(QUERIES[0].id);
  const [a, setA] = useState<Analyzer>({ stem: false, stopwords: false, typos: false });
  const [ranking, setRanking] = useState<Ranking>("none");
  const [f, setF] = useState<Filter>({ category: "all", maxPrice: null });
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const query = QUERIES.find((x) => x.id === q)!.text;
  const r = search(query, a, ranking, f);
  const index = buildIndex(a);
  const setAn = (patch: Partial<Analyzer>) => setA((cur) => ({ ...cur, ...patch }));
  const sample = DOCS[0];

  const captions = [
    `Step 1: “${query}” becomes ${r.terms.length} term${r.terms.length === 1 ? "" : "s"}: ${r.terms.join(", ")}.`,
    `Step 2: the index maps each of ${TOTAL_INDEX_TERMS(a)} terms to the listings that contain it.`,
    `Step 3: ${r.postingsRead} postings read; ${r.candidates} listing${r.candidates === 1 ? "" : "s"} contain a query term.`,
    `Step 4: filters remove ${r.filteredOut}; ${r.hits.length} left.`,
    `Step 5: ${RANKINGS.find((x) => x.id === ranking)!.label}: ${r.hits[0] ? `“${r.hits[0].doc.title}” comes first` : "nothing to rank"}.`,
  ];
  const caption = stage !== null ? captions[stage] : `“${query}”: ${r.hits.length} result${r.hits.length === 1 ? "" : "s"}${r.hits[0] ? `, top: ${r.hits[0].doc.title}` : ""}. SQL LIKE would return ${r.likeMatches.length}, unranked, after reading all ${r.likeRowsScanned} rows.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Search: indexing, filtering and ranking"
        blurb={`A shop with ${DOCS.length} listings. Search them the way Elasticsearch, OpenSearch and Postgres full-text search do: turn text into terms, build an inverted index, look the query's terms up, filter, and rank with BM25. Every number is computed from the listings, including what SQL LIKE would have done instead.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={`Results for ${query}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">“{query}”</p>
                <p className="font-mono text-xs text-[var(--muted)]">
                  {r.hits.length} results · LIKE: {r.likeMatches.length}
                </p>
              </div>
              <ol className="mt-3 space-y-1.5">
                {r.hits.slice(0, 6).map((h, i) => {
                  const max = r.hits[0].score || 1;
                  return (
                    <li key={h.doc.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs">
                      <span className="font-mono text-[var(--faint)]">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{h.doc.title}</span>
                        <span className="block truncate text-[11px] text-[var(--muted)]">
                          {h.doc.category} · ${h.doc.price} · matched {h.matched.join(", ")}
                        </span>
                        {ranking !== "none" && (
                          <span className="mt-0.5 block h-1.5 rounded bg-[var(--track)]">
                            <span className="block h-full rounded" style={{ width: `${(h.score / max) * 100}%`, background: ACCENT }} />
                          </span>
                        )}
                      </span>
                      <span className="text-right font-mono">{ranking === "none" ? "–" : h.score.toFixed(2)}</span>
                    </li>
                  );
                })}
                {r.hits.length === 0 && <li className="text-xs text-[var(--bad)]">No results.</li>}
              </ol>
              {r.hits.length > 6 && <p className="mt-1 text-[11px] text-[var(--faint)]">+{r.hits.length - 6} more</p>}
              <p className="mt-3 font-mono text-[11px] text-[var(--muted)]">
                SQL WHERE text LIKE each word: {r.likeMatches.length ? r.likeMatches.map((id) => DOCS.find((d) => d.id === id)!.title).join(", ") : "nothing"}
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Query" accent={ACCENT} value={q} onChange={setQ} options={QUERIES.map((x) => ({ id: x.id, label: x.text }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Searching…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Analyse text into terms" what="The same steps run on every listing when it's indexed and on every query: lowercase, split into words, drop words that carry no meaning, and reduce words to a stem so “running”, “runner” and “runs” meet. Typo tolerance lets a term match index terms one edit away." accent={ACCENT} active={at(0)}>
                <Toggle checked={a.stopwords} onChange={(v) => setAn({ stopwords: v })} label="Drop stop words (the, for, a…)" />
                <Toggle checked={a.stem} onChange={(v) => setAn({ stem: v })} label="Stem words" />
                <Toggle checked={a.typos} onChange={(v) => setAn({ typos: v })} label="Allow one typo per term" />
                <p className="font-mono text-xs">
                  “{query}” → {r.terms.map((t) => (r.expanded[t].length && r.expanded[t][0] !== t ? `${t}≈${r.expanded[t].join("/")}` : t)).join(" · ")}
                </p>
                <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">
                  “{sample.title}” → {analyze(sample.title, a).join(" · ")}
                </p>
              </FlowStep>
              <FlowArrow label="terms" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Build an inverted index" what="For every term, the list of listings that contain it (its postings), with how often and in which field. Built once when listings change; a query never reads the listings themselves." accent={ACCENT} active={at(1)}>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {r.terms.flatMap((t) => r.expanded[t]).slice(0, 5).map((t) => (
                    <li key={t} className="break-words">
                      {t} → {[...(index.postings.get(t)?.keys() ?? [])].map((id) => `#${id}`).join(" ")}
                    </li>
                  ))}
                  {r.terms.every((t) => r.expanded[t].length === 0) && <li className="text-[var(--bad)]">no query term is in the index</li>}
                </ul>
                <p className="mt-1 text-[11px] text-[var(--muted)]">{TOTAL_INDEX_TERMS(a)} distinct terms across {DOCS.length} listings.</p>
              </FlowStep>
              <FlowArrow label="postings" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Look up only the query's terms" what={`The engine reads the postings for the query's terms and nothing else, however big the catalogue. LIKE '%word%' has to read every row, can't use an ordinary index, and only finds the exact letters typed.`} accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs">
                  index: {r.postingsRead} postings read → {r.candidates} candidates · LIKE: {r.likeRowsScanned} rows read → {r.likeMatches.length} matches
                </p>
              </FlowStep>
              <FlowArrow label="candidates" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Filter on structured fields" what="Category and price aren't text to score; they're yes-or-no filters, applied to the candidates before ranking. The counts per category are what a sidebar of facets shows." accent={ACCENT} active={at(3)}>
                <Choices label="Category" accent={ACCENT} value={f.category} onChange={(v) => setF((c) => ({ ...c, category: v }))} options={CATS} />
                <Toggle checked={f.maxPrice !== null} onChange={(v) => setF((c) => ({ ...c, maxPrice: v ? 100 : null }))} label="Under $100" />
                <p className="font-mono text-xs">
                  {r.candidates} candidates − {r.filteredOut} filtered = {r.hits.length}
                </p>
              </FlowStep>
              <FlowArrow label="matches" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Rank the matches" what={`BM25 scores each match: a term that appears in few listings counts more (inverse document frequency); each extra occurrence counts less (k1 = ${K1}); long text is discounted (b = ${B}). Real shops add field boosts and business signals like sales on top.`} accent={ACCENT} active={at(4)}>
                <Choices label="Ranking" accent={ACCENT} value={ranking} onChange={setRanking} options={RANKINGS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{RANKINGS.find((x) => x.id === ranking)!.one}</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  Keyword search matches words, not meaning: for “waterproof jacket” the insulated jacket scores high because its description says “not waterproof”. Hybrid search with embeddings (see the AI track) helps with that.
                </p>
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
