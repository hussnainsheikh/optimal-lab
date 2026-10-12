"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DOC, QUESTIONS, SIZES, STRATEGIES, chunk, retrieve, type Chunk, type Match, type Strategy } from "@/lib/chunking";

const ACCENT = "var(--ai)";

const VERDICT = {
  whole: { label: "Whole answer retrieved", color: "var(--good)" },
  partial: { label: "Answer cut in half", color: "var(--bad)" },
  missing: { label: "Answer not retrieved", color: "var(--bad)" },
};

export default function ChunkingDemo() {
  const [strategy, setStrategy] = useState<Strategy>("fixed");
  const [size, setSize] = useState(200);
  const [qId, setQId] = useState(QUESTIONS[0].id);
  const q = QUESTIONS.find((x) => x.id === qId) ?? QUESTIONS[0];
  const chunks = chunk(strategy, size);
  const r = retrieve(chunks, q);
  const stored = chunks.reduce((s, c) => s + c.text.length, 0);
  const strat = STRATEGIES.find((s) => s.id === strategy)!;
  const verdict = VERDICT[r.verdict];

  // how each strategy does on all three questions, at the current size
  const scoreboard = STRATEGIES.map((s) => {
    const cs = chunk(s.id, size);
    return { ...s, whole: QUESTIONS.filter((x) => retrieve(cs, x).verdict === "whole").length };
  });

  const caption =
    r.verdict === "whole"
      ? `${strat.label}: chunk ${r.top[0] + 1} is retrieved and holds the whole answer.`
      : r.verdict === "partial"
        ? `${strat.label}: the answer sits across a chunk boundary. The model only gets part of it, so it may guess the rest.`
        : `${strat.label}: no retrieved chunk contains the answer.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Chunking strategies"
        blurb="Before retrieval can work, documents are cut into chunks, and the model only ever sees the chunks that come back. Cut in the wrong place and the answer is split in half. Try three ways to cut the same help page."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The document, split into chunks">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {chunks.length} chunks · {stored} characters stored
                </p>
                <p className="font-mono text-xs" style={{ color: verdict.color }}>
                  {verdict.label}
                </p>
              </div>
              <ol className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {chunks.map((c) => (
                  <ChunkCard key={c.i} c={c} match={r.scores[c.i]} retrieved={r.top.includes(c.i)} answer={[r.answerStart, r.answerEnd]} />
                ))}
              </ol>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Question" accent={ACCENT} value={qId} onChange={setQId} options={QUESTIONS.map((x) => ({ id: x.id, label: x.text }))} />
              <Choices label="Strategy" accent={ACCENT} value={strategy} onChange={setStrategy} options={STRATEGIES.map((s) => ({ id: s.id, label: s.label }))} />
              {strategy !== "heading" && (
                <Choices
                  label="Chunk size (characters)"
                  accent={ACCENT}
                  value={String(size)}
                  onChange={(v) => setSize(Number(v))}
                  options={SIZES.map((s) => ({ id: String(s), label: String(s) }))}
                />
              )}
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Split the document into chunks" what={strat.note} accent={ACCENT}>
                <p className="font-mono text-sm">
                  {chunks.length} chunks{strategy === "heading" ? ", one per section" : ` of up to ${size} characters`}
                  {strategy === "overlap" ? `, each overlapping the last by ${size / 2}` : ""}
                </p>
              </FlowStep>
              <FlowArrow label="chunks" accent={ACCENT} />

              <FlowStep n={2} title="Index every chunk" what="Each chunk is turned into an embedding and stored. Here we count shared words instead, so you can check every number by hand." accent={ACCENT}>
                <p className="font-mono text-sm">{stored} characters stored{strategy === "overlap" ? `: overlap stores ${(stored / DOC.length).toFixed(1)}× the document` : ""}</p>
              </FlowStep>
              <FlowArrow label="a searchable index" accent={ACCENT} />

              <FlowStep n={3} title="Retrieve the best chunk for the question" what="The question is scored against every chunk, and the best one is pasted into the prompt. The model sees nothing else. Real systems fetch a few, but the problem is the same." accent={ACCENT}>
                <p className="font-mono text-sm">
                  words matched per chunk: {r.scores.map((s) => s.words).join(" · ")} → chunk {r.top[0] + 1}
                </p>
              </FlowStep>
              <FlowArrow label="the retrieved text" accent={ACCENT} />

              <FlowStep n={4} title="Does the model get the whole answer?" what="An answer cut across two chunks reaches the model only partly. Bigger or overlapping chunks fix that, but every extra character is more to read and pay for." accent={ACCENT} active>
                <p className="text-sm" style={{ color: verdict.color }}>
                  {verdict.label}. {r.extraChars} characters of other text came along with it.
                </p>
                <ul className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                  {scoreboard.map((s) => (
                    <li key={s.id} className="flex justify-between gap-3">
                      <span>{s.label}{s.id === "heading" ? "" : ` (${size})`}</span>
                      <span className="font-mono text-[var(--text)]">{s.whole} of {QUESTIONS.length} answered whole</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function ChunkCard({ c, match, retrieved, answer }: { c: Chunk; match: Match; retrieved: boolean; answer: [number, number] }) {
  const [a0, a1] = answer;
  const s = Math.max(c.start, a0);
  const e = Math.min(c.end, a1);
  const parts = e > s ? [c.text.slice(0, s - c.start), c.text.slice(s - c.start, e - c.start), c.text.slice(e - c.start)] : [c.text, "", ""];
  return (
    <li
      className="rounded-lg border p-2.5"
      style={{
        borderColor: retrieved ? ACCENT : "var(--line)",
        background: retrieved ? "color-mix(in srgb, var(--ai) 8%, transparent)" : "var(--inset)",
        opacity: retrieved ? 1 : 0.7,
      }}
    >
      <p className="flex flex-wrap justify-between gap-2 font-mono text-[11px] text-[var(--faint)]">
        <span>
          chunk {c.i + 1} · chars {c.start}–{c.end}
        </span>
        <span style={{ color: retrieved ? ACCENT : undefined }}>
          {match.words} words matched{match.hits > match.words ? ` (${match.hits}×)` : ""}
          {retrieved ? " · retrieved" : ""}
        </span>
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5">
        {parts[0]}
        {parts[1] && (
          <mark className="rounded px-0.5 text-[var(--text)]" style={{ background: "color-mix(in srgb, var(--good) 30%, transparent)" }}>
            {parts[1]}
          </mark>
        )}
        {parts[2]}
      </p>
    </li>
  );
}
