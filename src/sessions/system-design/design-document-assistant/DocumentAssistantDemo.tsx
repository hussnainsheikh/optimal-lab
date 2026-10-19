"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { CHUNKS, CHUNKS_PER_DOC, DIMS, DOC_COUNTS, K, MODELS, QUESTION, QUESTIONS_PER_DAY, SYNCS, USERS, answer, index, perQuestion, type ModelId, type Precision, type Sync, type UserId } from "@/lib/documentAssistant";

const ACCENT = "var(--sys)";
const fmt = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);
const stale = (m: number) => (m < 60 ? `${m} min` : `${m / 60} h`);

export default function DocumentAssistantDemo() {
  const [sync, setSync] = useState<Sync>("nightly");
  const [docs, setDocs] = useState(1_000_000);
  const [dims, setDims] = useState(1536);
  const [precision, setPrecision] = useState<Precision>("float32");
  const [user, setUser] = useState<UserId>("contractor");
  const [filter, setFilter] = useState(false);
  const [verify, setVerify] = useState(false);
  const [model, setModel] = useState<ModelId>("small");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const ix = index(docs, dims, precision);
  const a = answer(user, filter, verify);
  const q = perQuestion(model, verify);
  const sy = SYNCS.find((x) => x.id === sync)!;
  const u = USERS.find((x) => x.id === user)!;

  const packets: Packet[] =
    stage === 0 ? hops("i", ["sources", "ingest"], { label: "docs + who can read" })
    : stage === 1 ? hops("e", ["ingest", "index"], { label: `${fmt(ix.chunks)} vectors` })
    : stage === 2 ? hops("q", ["user", "app", "index"], { label: filter ? `filter: ${u.groups.join(", ")}` : "no filter", tone: a.leaked.length ? "bad" : "good" })
    : stage === 3 ? hops("m", ["app", "llm", "app"], { label: `${K} chunks → answer` })
    : stage === 4 ? hops("r", ["app", "user"], { label: `${a.shown.length} cited claims`, tone: a.leaked.length || a.unsupportedShown ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: sources are synced with their sharing settings; ${sy.label.toLowerCase()} means changes take up to ${stale(sy.staleMin)} to show.`,
    `Step 2: ${fmt(docs)} documents → ${fmt(ix.chunks)} chunks → ${ix.gb.toFixed(0)} GB of ${dims}-dimension ${precision} vectors.`,
    `Step 3: the ${u.label.toLowerCase()} asks; ${a.leaked.length ? `${a.leaked.length} of the ${a.context.length} chunks retrieved are ones they can't open` : `all ${a.context.length} chunks are ones they can open`}.`,
    `Step 4: the model writes ${a.claims.length} claims, each citing a chunk.`,
    `Step 5: ${a.shown.length} claims shown${a.flagged ? `, ${a.flagged} dropped because its citation doesn't support it` : ""}${a.unsupportedShown ? `, ${a.unsupportedShown} unsupported claim shown` : ""}; ${(q.ms / 1000).toFixed(1)} s and $${q.cost.toFixed(4)} a question.`,
  ];
  const caption = stage !== null ? captions[stage] : `${u.label}: ${a.leaked.length} forbidden chunk${a.leaked.length === 1 ? "" : "s"} used · ${a.unsupportedShown} unsupported claim${a.unsupportedShown === 1 ? "" : "s"} shown · ${(q.ms / 1000).toFixed(1)} s · $${Math.round(q.monthly).toLocaleString("en-US")} a month.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design a document assistant"
        blurb={`Employees ask questions about the company's documents and get answers with sources. Sync documents with their permissions, store them as vectors, retrieve only what the asker can open, and check every citation before showing it. Then count what it costs at ${fmt(QUESTIONS_PER_DAY)} questions a day.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Document sources, ingestion, vector index, the user, the assistant and the model"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "sources", label: "Sources", sub: "Drive, wiki, tickets", at: [12, 22], mobileAt: [22, 9], state: "idle" },
                  { id: "ingest", label: "Ingestion", sub: sy.label.toLowerCase(), at: [44, 22], mobileAt: [78, 9], state: sync === "webhooks" ? "good" : "wait" },
                  { id: "index", label: "Vector index", sub: `${ix.gb.toFixed(0)} GB + ACLs`, at: [80, 22], mobileAt: [78, 45], state: "active" },
                  { id: "user", label: u.label, sub: u.groups.join(", "), at: [12, 80], mobileAt: [22, 45], state: "active" },
                  { id: "app", label: "Assistant", sub: filter ? "filters by group" : "no filter", at: [44, 80], mobileAt: [22, 88], state: a.leaked.length ? "bad" : "good" },
                  { id: "llm", label: "Model", sub: MODELS.find((m) => m.id === model)!.label.toLowerCase(), at: [80, 80], mobileAt: [78, 88], state: "active" },
                ]}
                links={[
                  { from: "sources", to: "ingest", label: "sync" },
                  { from: "ingest", to: "index", label: "embed" },
                  { from: "user", to: "app", label: "question" },
                  { from: "app", to: "index", label: "search" },
                  { from: "app", to: "llm", label: "context" },
                ]}
                packets={packets}
                aspect={2}
                mobileAspect={0.95}
              />
              <Answer a={a} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Asked by" accent={ACCENT} value={user} onChange={setUser} options={USERS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Answering…">
                Ask the question
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Sync documents with their permissions" what="Connectors read each source and copy two things: the content and who may read it (users, groups, sharing links). Permissions change as often as content; both need to reach the index quickly." accent={ACCENT} active={at(0)}>
                <Choices label="Sync" accent={ACCENT} value={sync} onChange={setSync} options={SYNCS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{sy.one}</p>
                <p className="mt-1 font-mono text-xs" style={{ color: sy.staleMin > 60 ? "var(--bad)" : "var(--good)" }}>
                  a document unshared at 9:00 stays searchable for up to {stale(sy.staleMin)}
                </p>
              </FlowStep>
              <FlowArrow label="chunks" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Chunk, embed and size the index" what={`About ${CHUNKS_PER_DOC} chunks a document, each stored as a vector with its source and permission groups as metadata. Vector size sets memory: quantizing to 8 bits cuts it by four for a small loss in recall.`} accent={ACCENT} active={at(1)}>
                <Choices label="Documents" accent={ACCENT} value={String(docs)} onChange={(v) => setDocs(Number(v))} options={DOC_COUNTS.map((n) => ({ id: String(n), label: fmt(n) }))} />
                <div className="mt-2">
                  <Choices label="Dimensions" accent={ACCENT} value={String(dims)} onChange={(v) => setDims(Number(v))} options={DIMS.map((n) => ({ id: String(n), label: String(n) }))} />
                </div>
                <div className="mt-2">
                  <Choices label="Stored as" accent={ACCENT} value={precision} onChange={setPrecision} options={[{ id: "float32" as Precision, label: "float32" }, { id: "int8" as Precision, label: "int8" }]} />
                </div>
                <p className="mt-2 font-mono text-xs">
                  {fmt(ix.chunks)} vectors · {ix.gb.toFixed(1)} GB · ${Math.round(ix.embedCost).toLocaleString("en-US")} to embed everything once
                </p>
              </FlowStep>
              <FlowArrow label="retrieve" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Retrieve only what the asker can open" what="The most similar chunks are often the most sensitive: contracts, finance, board notes. Resolve the asker's groups and filter inside the vector search, so a forbidden chunk never reaches the model, whose context the user can read through the answer." accent={ACCENT} active={at(2)}>
                <Choices label="Asked by" accent={ACCENT} value={user} onChange={setUser} options={USERS.map((x) => ({ id: x.id, label: x.label }))} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={filter} onChange={(e) => setFilter(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Filter by the asker&rsquo;s groups in the search
                </label>
                <ul className="space-y-0.5 text-[11px]">
                  {CHUNKS.map((c) => {
                    const inCtx = a.context.includes(c);
                    const ok = a.can(c);
                    return (
                      <li key={c.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)_4.5rem] gap-2" style={{ opacity: inCtx ? 1 : 0.45 }}>
                        <span className="font-mono text-[var(--faint)]">{c.score.toFixed(2)}</span>
                        <span className="min-w-0 truncate">{c.title}</span>
                        <span className="text-right font-mono" style={{ color: ok ? "var(--good)" : "var(--bad)" }}>
                          {inCtx ? (ok ? "used" : "LEAKED") : ok ? "allowed" : "forbidden"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </FlowStep>
              <FlowArrow label="answer" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Answer with citations, then check them" what="Ask the model to cite a chunk for every claim. Citations are only useful if they're true: check each claim against the chunk it cites (a string match, an entailment model or a second LLM call) and drop or flag what isn't supported." accent={ACCENT} active={at(3) || at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Check each claim against its cited chunk
                </label>
                <p className="font-mono text-xs" style={{ color: a.unsupportedShown ? "var(--bad)" : "var(--good)" }}>
                  {a.claims.length} claims · {a.flagged} dropped · {a.unsupportedShown} unsupported shown
                </p>
              </FlowStep>
              <FlowArrow label="at scale" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Count the cost and the wait" what="Each question is a search, a rerank, a prompt of retrieved chunks and a generated answer. The model choice dominates both the bill and the time to the last word; checking citations adds a little of each." accent={ACCENT} active={at(4)}>
                <Choices label="Model" accent={ACCENT} value={model} onChange={setModel} options={MODELS.map((m) => ({ id: m.id, label: m.label }))} />
                <p className="mt-2 font-mono text-xs">
                  {q.inTok.toLocaleString("en-US")} tokens in · ${q.cost.toFixed(4)} a question · ${Math.round(q.monthly).toLocaleString("en-US")} a month · {(q.ms / 1000).toFixed(1)} s to a full answer
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Similarity scores, prices and speeds are illustrative. Retrieval, citations and permission filtering each have their own session in this track.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Answer({ a }: { a: ReturnType<typeof answer> }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The assistant's answer with citations">
      <p className="text-xs text-[var(--muted)]">{QUESTION}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {a.claims.map((c) => {
          const hidden = !a.shown.includes(c);
          return (
            <li key={c.text} className="flex items-start gap-2" style={{ opacity: hidden ? 0.45 : 1 }}>
              <span className={hidden ? "line-through" : ""} style={{ color: c.leaked ? "var(--bad)" : "var(--text)" }}>
                {c.text}
              </span>
              <span className="mt-0.5 shrink-0 rounded px-1 font-mono text-[10px]" style={{ background: "var(--inset)", color: !c.supported ? "var(--bad)" : c.leaked ? "var(--bad)" : "var(--muted)" }}>
                [{c.cites}]{!c.supported ? (hidden ? " dropped" : " unsupported") : c.leaked ? " forbidden" : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
