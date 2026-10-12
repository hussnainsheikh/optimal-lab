"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DOCS, EXAMPLES, MODES, queryFor, rankOf, search, terms, type Mode } from "@/lib/queryRewrite";

const ACCENT = "var(--ai)";

export default function QueryRewriteDemo() {
  const [exId, setExId] = useState(EXAMPLES[0].id);
  const [mode, setMode] = useState<Mode>("raw");
  const ex = EXAMPLES.find((e) => e.id === exId) ?? EXAMPLES[0];
  const query = queryFor(ex, mode);
  const results = search(query);
  const rank = rankOf(ex, mode);
  const top = results[0].score;
  const qWords = [...new Set(query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/))].filter((w) => terms(w).length > 0);
  const m = MODES.find((x) => x.id === mode)!;
  const target = DOCS.find((d) => d.id === ex.target)!;

  const caption =
    rank === 1
      ? `“${target.title}” comes back first, matching on ${results[0].shared.join(", ")}.`
      : rank === null
        ? `Nothing in the help centre shares a single word with the question as typed, so the right page never comes back.`
        : `The right page comes back at #${rank}, below pages that only share common words.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Query rewriting and HyDE"
        blurb="People ask in their own words; documents use product words. Search with the question as typed and the right page may never come back. Let a model rewrite the question first, or even write a fake answer and search with that."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The search query and what comes back">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">User typed</p>
              <p className="mt-1">{ex.raw}</p>
              <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Search query sent ({m.label})</p>
              <p className="mt-1 rounded-md bg-[var(--inset)] px-2 py-1.5 font-mono text-sm">{query}</p>

              <ol className="mt-4 space-y-2">
                {results.map((r, i) => {
                  const isTarget = r.doc.id === ex.target;
                  return (
                    <li
                      key={r.doc.id}
                      className="rounded-lg border p-2.5"
                      style={{ borderColor: isTarget ? "var(--good)" : "var(--line)", background: "var(--inset)", opacity: r.score === 0 ? 0.55 : 1 }}
                    >
                      <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">
                          <span className="mr-1.5 font-mono text-xs text-[var(--faint)]">#{i + 1}</span>
                          {r.doc.title}
                          {isTarget && <span className="ml-2 text-xs" style={{ color: "var(--good)" }}>the answer</span>}
                        </span>
                        <span className="font-mono text-xs text-[var(--muted)]">{r.score} words shared</span>
                      </p>
                      <span className="mt-1.5 block h-1.5 rounded bg-[var(--track)]">
                        <span className="block h-full rounded" style={{ width: `${top ? (r.score / top) * 100 : 0}%`, background: isTarget ? "var(--good)" : ACCENT }} />
                      </span>
                      {r.shared.length > 0 && <p className="mt-1 font-mono text-[11px] text-[var(--faint)]">{r.shared.join(" · ")}</p>}
                    </li>
                  );
                })}
              </ol>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Question" accent={ACCENT} value={exId} onChange={setExId} options={EXAMPLES.map((e) => ({ id: e.id, label: e.label }))} />
              <Choices label="Search with" accent={ACCENT} value={mode} onChange={setMode} options={MODES.map((x) => ({ id: x.id, label: x.label }))} />
              <p className="w-full text-xs text-[var(--muted)]">{m.note}</p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Start from the user's question" what="Short, chatty, full of words the docs never use: “stuff”, “saying no”, “stopped answering”." accent={ACCENT}>
                <p className="font-mono text-sm">{ex.raw}</p>
              </FlowStep>
              <FlowArrow label="the question" accent={ACCENT} />

              <FlowStep n={2} title="Rewrite it before searching" what="One cheap model call turns the question into search terms (rewriting), or into a short made-up answer (HyDE). Answers use the same words as documents do." accent={ACCENT} active={mode !== "raw"}>
                <p className="font-mono text-sm">{mode === "raw" ? "Skipped: searching with the question as typed." : query}</p>
              </FlowStep>
              <FlowArrow label="a search query" accent={ACCENT} />

              <FlowStep n={3} title="Search the documents" what="Every document is scored against the query. Here a score is the number of shared words, standing in for embedding similarity." accent={ACCENT}>
                <p className="font-mono text-sm">query words: {qWords.join(" · ") || "none"}</p>
              </FlowStep>
              <FlowArrow label="ranked results" accent={ACCENT} />

              <FlowStep n={4} title="Did the right page come first?" what="Only the top results reach the model. A page at #5 might as well not exist. HyDE can also mislead: if the fake answer is wrong, it finds documents about the wrong thing." accent={ACCENT} active>
                <ul className="space-y-1 text-sm text-[var(--muted)]">
                  {EXAMPLES.map((e) => (
                    <li key={e.id} className="flex flex-wrap justify-between gap-x-3">
                      <span className="min-w-0">{e.raw}</span>
                      <span className="font-mono text-[var(--text)]">
                        {MODES.map((x) => {
                          const r = rankOf(e, x.id);
                          return `${x.label}: ${r === null ? "—" : `#${r}`}`;
                        }).join(" · ")}
                      </span>
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
