"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DESIGNS, EXTRACTED, QUESTIONS, ask, score, storedRows, type Design } from "@/lib/memoryUpdates";

const ACCENT = "var(--sys)";

export default function MemoryUpdatesDemo() {
  const [d, setD] = useState<Design>("append");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const rows = storedRows(d);
  const label = DESIGNS.find((x) => x.id === d)!.label;

  const captions = [
    `Step 1: over 85 days the assistant hears ${EXTRACTED.length} things it might remember.`,
    `Step 2: ${label.toLowerCase()}: the store ends with ${rows.length} memories.`,
    `Step 3: “Where do I live?” → ${ask(d, QUESTIONS[0]).answer}.`,
    `Step 4: “Suggest something I enjoy.” → ${ask(d, QUESTIONS[3]).answer}.`,
    `Step 5: “What do you know about my health?” → ${ask(d, QUESTIONS[4]).answer}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${label}: ${score(d)} of ${QUESTIONS.length} questions answered correctly from ${rows.length} stored memories.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Memory extraction, updates and conflicts"
        blurb="An assistant pulls memories out of chats. Over three months the user moves to another city, changes their name, makes a sarcastic remark, mentions a diagnosis and then asks the assistant to forget it. Store what's extracted four ways and ask the same five questions on day 90."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The memory store after 90 days, and the answers it gives">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">memory store · day 90</p>
                <p className="font-mono text-xs" style={{ color: score(d) === QUESTIONS.length ? "var(--good)" : "var(--bad)" }}>
                  {score(d)} / {QUESTIONS.length} right
                </p>
              </div>
              <ul className="mt-3 space-y-0.5 font-mono text-[11px]">
                {rows.map((r, i) => (
                  <li key={i} className="grid grid-cols-[3.5rem_minmax(0,1fr)_6rem] gap-2" style={{ color: r.to !== null ? "var(--muted)" : "var(--text)", textDecoration: r.to !== null ? "line-through" : "none" }}>
                    <span>{r.key}</span>
                    <span className="min-w-0 truncate">{r.value}</span>
                    <span className="text-right text-[var(--faint)]">
                      day {r.from}
                      {r.to !== null ? `–${r.to}` : "–"}
                    </span>
                  </li>
                ))}
                {rows.length === 0 && <li className="text-[var(--muted)]">(empty)</li>}
              </ul>
              <ul className="mt-4 space-y-1 text-xs">
                {QUESTIONS.map((q) => {
                  const x = ask(d, q);
                  return (
                    <li key={q.text}>
                      <span className="font-semibold">{q.text}</span>{" "}
                      <span className="font-mono" style={{ color: x.ok ? "var(--good)" : "var(--bad)" }}>
                        {x.answer}
                      </span>
                      {!x.ok && <span className="block text-[11px] text-[var(--muted)]">{x.why}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Store" accent={ACCENT} value={d} onChange={setD} options={DESIGNS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Remembering…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Extract candidate memories" what="After each conversation, a model reads it and proposes facts worth keeping, each with a key, a value, the date and the sentence it came from. Extraction is fallible: it reads jokes literally and misses context." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 text-xs">
                  {EXTRACTED.map((e) => (
                    <li key={e.day}>
                      <span className="font-mono text-[var(--faint)]">day {e.day}</span> “{e.said}” → <span className="font-mono">{e.key === "forget" ? `forget ${e.value}` : `${e.key} = ${e.value}`}</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="store them" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Decide what a new value does to an old one" what="Appending everything leaves contradictions for the model to sort out at answer time. Overwriting keeps one truth but loses history. Versioning closes the old value with an end date, so “where did I live in January?” still has an answer." accent={ACCENT} active={at(1)}>
                <Choices label="Store" accent={ACCENT} value={d} onChange={setD} options={DESIGNS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{DESIGNS.find((x) => x.id === d)!.one}</p>
              </FlowStep>
              <FlowArrow label="contradictions" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Resolve conflicts by time and source" what="Leeds then Bristol isn't a contradiction; it's a move. Keep when each fact was said and where it came from, and let the newer one win for “now” while the older one stays true for its period." accent={ACCENT} active={at(2)}>
                {[QUESTIONS[0], QUESTIONS[2]].map((q) => {
                  const x = ask(d, q);
                  return (
                    <p key={q.text} className="font-mono text-xs" style={{ color: x.ok ? "var(--good)" : "var(--bad)" }}>
                      {q.text} → {x.answer}
                    </p>
                  );
                })}
              </FlowStep>
              <FlowArrow label="bad extractions" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Check before you remember" what="A second pass (or the user) should confirm a memory before it's stored: sarcasm, hypotheticals and other people's details don't belong. Showing users what was remembered lets them fix mistakes." accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs" style={{ color: ask(d, QUESTIONS[3]).ok ? "var(--good)" : "var(--bad)" }}>
                  {QUESTIONS[3].text} → {ask(d, QUESTIONS[3]).answer}
                </p>
              </FlowStep>
              <FlowArrow label="forgetting" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Forget for real" what="“Forget that” has to delete the memory, from the store and from any index or cache built from it, not just stop mentioning it. Sensitive categories like health are better not stored without explicit consent." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs" style={{ color: ask(d, QUESTIONS[4]).ok ? "var(--good)" : "var(--bad)" }}>
                  {QUESTIONS[4].text} → {ask(d, QUESTIONS[4]).answer}
                </p>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  {DESIGNS.map((x) => (
                    <Row key={x.id} a={x.label} b={`${score(x.id)}/${QUESTIONS.length}`} good={score(x.id) === QUESTIONS.length} bold={x.id === d} />
                  ))}
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ a, b, good, bold }: { a: string; b: string; good: boolean; bold: boolean }) {
  return (
    <>
      <span className="font-sans" style={{ fontWeight: bold ? 700 : 400 }}>
        {a}
      </span>
      <span className="text-right" style={{ fontWeight: bold ? 700 : 400, color: good ? "var(--good)" : "var(--bad)" }}>
        {b}
      </span>
    </>
  );
}
