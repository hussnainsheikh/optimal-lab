"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { ADD_RATE, CHUNKS_PER_DOC, DELETE_RATE, DOCS, EDIT_RATE, SAMPLE, SAMPLE_EDITED, STRATEGIES, hash, money, n, run, type Strategy } from "@/lib/incrementalIndexing";

const ACCENT = "var(--sys)";

export default function IncrementalIndexingDemo() {
  const [s, setS] = useState<Strategy>("nightly");
  const [deletes, setDeletes] = useState(false);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const r = run(s, deletes);
  const nightly = s === "nightly";

  const packets: Packet[] =
    stage === 0 ? hops("edit", ["cms", nightly ? "cms" : "events"], { label: "doc 4812 edited" }).filter((p) => p.from !== p.to)
    : stage === 1 ? (nightly ? hops("batch", ["cms", "indexer"], { label: `all ${n(DOCS)} docs` }) : hops("evt", ["events", "indexer"], { label: "updated 4812" }))
    : stage === 2 ? hops("emb", ["indexer", "embed"], { label: `${n(r.chunksPerDay)} chunks/day`, tone: nightly ? "bad" : "good" })
    : stage === 3 ? hops("up", ["embed", "vdb"], { label: nightly ? "swap index" : "upsert" })
    : stage === 4 ? hops("del", [nightly ? "cms" : "events", nightly ? "indexer" : "indexer", "vdb"].filter((x, i, a) => a.indexOf(x) === i), { label: deletes || nightly ? "delete" : "missed delete", tone: deletes || nightly ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: ${n(DOCS * EDIT_RATE)} documents are edited today, ${n(DOCS * ADD_RATE)} added, ${n(DOCS * DELETE_RATE)} deleted.`,
    nightly ? "Step 2: nothing happens until 02:00, when the whole corpus is read again." : "Step 2: each change is published as an event the moment it's saved.",
    `Step 3: ${n(r.chunksPerDay)} chunks re-embedded a day: ${money(r.costPerDay)}.`,
    nightly ? "Step 4: a new index is built and swapped in; edits made at 09:00 show up tomorrow." : "Step 4: the changed vectors are upserted; search sees the edit within a minute.",
    deletes || nightly ? "Step 5: deleted documents leave the index." : `Step 5: deletes aren't handled: ${n(r.deletedStillServed)} queries a day are answered from documents that no longer exist.`,
  ];
  const caption = stage !== null ? captions[stage] : `${STRATEGIES.find((x) => x.id === s)!.label}: ${n(r.chunksPerDay)} chunks a day (${money(r.costPerMonth)} a month), changes visible after ${r.avgStalenessHours >= 1 ? `${r.avgStalenessHours} h` : "about a minute"} on average.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Incremental indexing"
        blurb={`A help centre with ${n(DOCS)} articles of about ${CHUNKS_PER_DOC} chunks each, searched by a RAG assistant. Every day 1% of articles are edited, a few are added and a few deleted. Keep the vector index current by rebuilding it, by re-embedding what changed, or by re-embedding only the paragraphs that changed, and see what each costs and how stale answers get.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <SystemMap
              title="The content system, a change-event stream, the indexer, the embedding model and the vector database"
              accent={ACCENT}
              chrome="split"
              nodes={[
                { id: "cms", label: "Help centre CMS", sub: `${n(DOCS)} articles`, at: [10, 30], mobileAt: [24, 8], state: "active" },
                { id: "events", label: "Change events", sub: nightly ? "unused" : "created · updated · deleted", at: [10, 78], mobileAt: [76, 8], state: nightly ? "dim" : "active" },
                { id: "indexer", label: "Indexer", sub: nightly ? "nightly job" : s === "perChunk" ? "hash per chunk" : "per document", at: [42, 54], mobileAt: [50, 40], state: "active" },
                { id: "embed", label: "Embedding model", sub: `${n(r.chunksPerDay)}/day`, at: [72, 22], mobileAt: [24, 72], state: nightly ? "wait" : "good" },
                { id: "vdb", label: "Vector DB", sub: !nightly && !deletes ? `${n(DOCS * DELETE_RATE * 30)} ghosts/month` : "current", at: [88, 74], mobileAt: [76, 92], state: !nightly && !deletes ? "bad" : "good" },
              ]}
              links={[
                { from: "cms", to: "events", label: "on save", dim: nightly },
                { from: "cms", to: "indexer", label: "full export", dim: !nightly },
                { from: "events", to: "indexer", label: "changes", dim: nightly },
                { from: "indexer", to: "embed", label: "chunks" },
                { from: "embed", to: "vdb", label: "vectors" },
                { from: "indexer", to: "vdb", label: "delete", dashed: true },
              ]}
              packets={packets}
              aspect={1.8}
              mobileAspect={0.95}
            />
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="How the index stays current" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Indexing…">
                Edit an article
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Rebuilding is simple and slow to reflect changes" what="Re-reading and re-embedding everything every night is easy to get right: the index always matches a snapshot. But a fix made in the morning is invisible until tomorrow, and you pay to re-embed the 99% that didn't change." accent={ACCENT} active={at(0)}>
                <Choices label="How the index stays current" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{STRATEGIES.find((x) => x.id === s)!.one}</p>
              </FlowStep>
              <FlowArrow label="react to changes" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Index from change events" what="Have the content system publish created, updated and deleted events (or read its database's change log with CDC). The indexer handles each one in seconds, so search reflects an edit almost at once." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  per day: {n(DOCS * EDIT_RATE)} edits · {n(DOCS * ADD_RATE)} adds · {n(DOCS * DELETE_RATE)} deletes
                </p>
              </FlowStep>
              <FlowArrow label="only what changed" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Re-embed only changed chunks" what="An edit usually changes one paragraph. Hash each chunk's text; when the document changes, only chunks whose hash changed need a new embedding. The rest keep their vectors." accent={ACCENT} active={at(2)}>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {SAMPLE.map((line, i) => {
                    const changed = hash(line) !== hash(SAMPLE_EDITED[i]);
                    return (
                      <li key={i} style={{ color: changed ? "var(--bad)" : "var(--muted)" }}>
                        {hash(SAMPLE_EDITED[i])} {changed ? "≠" : "="} {hash(line)} · {SAMPLE_EDITED[i]}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1 text-xs">1 of {SAMPLE.length} chunks re-embedded for this edit.</p>
              </FlowStep>
              <FlowArrow label="the cost" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Compare the bill and the freshness" what="The work is proportional to what changed, not to the size of the corpus. That's the difference between a nightly batch job and a few seconds of work spread across the day." accent={ACCENT} active={at(3)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">chunks/day</span>
                  <span className="text-right text-[var(--faint)]">per month</span>
                  <span className="text-right text-[var(--faint)]">fresh after</span>
                  {STRATEGIES.map((x) => {
                    const y = run(x.id, deletes);
                    return <Row key={x.id} cells={[x.label, n(y.chunksPerDay), money(y.costPerMonth), y.avgStalenessHours >= 1 ? `${y.avgStalenessHours} h` : "~1 min"]} bold={x.id === s} />;
                  })}
                </div>
              </FlowStep>
              <FlowArrow label="and the deletes" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Handle deletes, or answer from ghosts" what="A rebuild drops deleted documents by itself. An event-driven indexer only removes what it's told to remove; miss the delete events and retracted articles keep answering questions." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={deletes} onChange={(e) => setDeletes(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Remove vectors on delete events
                </label>
                <p className="font-mono text-xs" style={{ color: r.deletedStillServed > 100 ? "var(--bad)" : "var(--good)" }}>
                  {n(r.deletedStillServed)} queries a day answered from deleted articles
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Embedding price and chunk sizes are typical for small embedding models; the change rates are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, bold }: { cells: string[]; bold: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: bold ? 700 : 400 }}>
          {c}
        </span>
      ))}
    </>
  );
}
