"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ANSWER, CHUNKS, QUESTION, STYLES, THRESHOLD, check, visible, words, type Style } from "@/lib/citations";

const ACCENT = "var(--sys)";
const STATUS_LABEL = { ok: "supported", "wrong-source": "cited the wrong chunk", "no-source": "nothing supports it" } as const;

export default function CitationsDemo() {
  const [style, setStyle] = useState<Style>("none");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const checks = check();
  const v = visible(style);
  const num = (id: string) => CHUNKS.findIndex((c) => c.id === id) + 1;

  const captions = [
    `Step 1: the question retrieves ${CHUNKS.length} chunks from 3 documents.`,
    "Step 2: the model writes four sentences. They all sound equally sure.",
    `Step 3: ${STYLES.find((s) => s.id === style)!.label.toLowerCase()}: ${v.checkable ? `every sentence points at a source` : "the reader can't tell which sentence came from where"}.`,
    `Step 4: checked against the chunks, ${checks.filter((c) => c.status === "ok").length} are supported, 1 cites the wrong chunk and 1 has no source at all.`,
    style === "verified" ? `Step 5: ${v.note}` : `Step 5: ${v.shownWrong} wrong sentences reach the reader.`,
  ];
  const caption = stage !== null ? captions[stage] : `${STYLES.find((s) => s.id === style)!.label}: ${v.shownWrong ? `${v.shownWrong} wrong sentences shown, looking as sure as the right ones` : "every sentence shown is backed by the chunk it cites"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Citations and source attribution"
        blurb={`An HR assistant answers “${QUESTION}” from four retrieved chunks. Two of its four sentences are right, one cites the wrong source, and one isn't in any source. How the answer cites its sources decides whether anyone can tell.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The answer as the reader sees it">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">the answer · {STYLES.find((s) => s.id === style)!.label.toLowerCase()}</p>
              <p className="mt-3 text-sm leading-relaxed">
                {checks.map((c, i) => {
                  if (style === "verified" && c.status === "no-source")
                    return (
                      <span key={i} className="mr-1 rounded px-1 text-xs" style={{ border: "1px dashed var(--bad)", color: "var(--bad)" }}>
                        [removed: no source says this]
                      </span>
                    );
                  const id = style === "verified" ? c.best.id : c.s.cites!;
                  return (
                    <span key={i} className="mr-1">
                      {c.s.text}
                      {(style === "inline" || style === "verified") && (
                        <sup className="ml-0.5 font-mono text-[10px]" style={{ color: style === "verified" && c.status === "wrong-source" ? "var(--good)" : ACCENT }}>
                          [{num(id)}]
                        </sup>
                      )}
                    </span>
                  );
                })}
              </p>
              {style !== "none" && (
                <ol className="mt-3 space-y-0.5 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--muted)]">
                  {CHUNKS.map((c, i) => (
                    <li key={c.id}>
                      [{i + 1}] {c.doc}, {c.section}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Citations" accent={ACCENT} value={style} onChange={setStyle} options={STYLES.map((s) => ({ id: s.id, label: s.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Answering…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Retrieve, and keep where each chunk came from" what="Every chunk carries its document, section and a stable id through retrieval. Without that metadata there is nothing to cite later." accent={ACCENT} active={at(0)}>
                <ul className="space-y-1 text-xs">
                  {CHUNKS.map((c, i) => (
                    <li key={c.id}>
                      <span className="font-mono" style={{ color: ACCENT }}>
                        [{i + 1}]
                      </span>{" "}
                      <span className="text-[var(--muted)]">
                        {c.doc} {c.section}:
                      </span>{" "}
                      {c.text}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="chunks in the prompt" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Ask for a source per claim" what="Number the chunks in the prompt and ask for the number after each sentence. Models do this well, and still sometimes cite the wrong number or write a sentence no chunk contains." accent={ACCENT} active={at(1)}>
                <ol className="space-y-0.5 text-xs">
                  {ANSWER.map((s, i) => (
                    <li key={i}>
                      {s.text} <span className="font-mono" style={{ color: ACCENT }}>[{num(s.cites!)}]</span>
                    </li>
                  ))}
                </ol>
              </FlowStep>
              <FlowArrow label="show them" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Show citations where they can be checked" what="A list of sources under the answer says what was read, not what supports each sentence. Inline markers let a reader check one claim in one click." accent={ACCENT} active={at(2)}>
                <Choices label="Citations" accent={ACCENT} value={style} onChange={setStyle} options={STYLES.map((s) => ({ id: s.id, label: s.label }))} />
                <p className="mt-2 text-xs">{STYLES.find((s) => s.id === style)!.one}</p>
              </FlowStep>
              <FlowArrow label="check them" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Verify each citation before showing it" what={`Readers rarely click. So check automatically: does the cited chunk support the sentence? Here, the share of the sentence's content words found in the chunk, at least ${Math.round(THRESHOLD * 100)}%; in production, an entailment model or an LLM judge. If another chunk supports it, re-point the citation; if none does, drop or flag the sentence.`} accent={ACCENT} active={at(3)}>
                <ul className="space-y-1 text-xs">
                  {checks.map((c, i) => (
                    <li key={i}>
                      <span className="font-mono" style={{ color: c.status === "ok" ? "var(--good)" : "var(--bad)" }}>
                        {STATUS_LABEL[c.status]}
                      </span>
                      : cited [{num(c.s.cites!)}] {Math.round(c.citedSupport * 100)}%{c.status !== "ok" ? ` · best [${num(c.best.id)}] ${Math.round(c.bestSupport * 100)}%` : ""}
                      <span className="block font-mono text-[10px] text-[var(--faint)]">{words(c.s.text).join(" ")}</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="what the reader gets" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Make the wrong ones visible" what="An answer with a wrong sentence and no way to see which is worse than no answer. Verified citations make the system's errors visible, and countable: track the share of sentences that fail verification as a quality metric." accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">checkable</span>
                  <span className="text-right text-[var(--faint)]">wrong shown</span>
                  {STYLES.map((s) => {
                    const y = visible(s.id);
                    return <Row key={s.id} cells={[s.label, `${y.checkable}/${ANSWER.length}`, String(y.shownWrong)]} bad={y.shownWrong > 0} bold={s.id === style} />;
                  })}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Support is word overlap, a simple stand-in for an entailment check; the counts are computed from the text above.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, bad, bold }: { cells: string[]; bad: boolean; bold: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: bold ? 700 : 400, color: i === 2 ? (bad ? "var(--bad)" : "var(--good)") : "var(--text)" }}>
          {c}
        </span>
      ))}
    </>
  );
}
