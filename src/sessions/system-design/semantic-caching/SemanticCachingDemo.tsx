"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { CACHE_MS, LLM_COST, LLM_MS, STREAM, THRESHOLDS, run, tokens, type Mode } from "@/lib/semanticCache";

const ACCENT = "var(--sys)";
const MODES: { id: Mode; label: string }[] = [
  { id: "none", label: "No cache" },
  { id: "exact", label: "Exact match" },
  { id: "semantic", label: "Semantic" },
];

export default function SemanticCachingDemo() {
  const [mode, setMode] = useState<Mode>("semantic");
  const [threshold, setThreshold] = useState(0.8);
  const [skipPersonal, setSkipPersonal] = useState(true);
  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Semantic caching"
        blurb={`A support bot gets ${STREAM.length} questions. Most are the same few questions in different words. An exact-match cache barely helps; a semantic cache embeds each question and reuses an earlier answer when the meaning is close enough. How close is close enough decides how much you save, and how many people get someone else's answer.`}
      />
      <div className="mt-6">
        <Run key={`${mode}-${threshold}-${skipPersonal}`} mode={mode} setMode={setMode} threshold={threshold} setThreshold={setThreshold} skipPersonal={skipPersonal} setSkipPersonal={setSkipPersonal} />
      </div>
    </SessionPage>
  );
}

function Run(props: { mode: Mode; setMode: (m: Mode) => void; threshold: number; setThreshold: (t: number) => void; skipPersonal: boolean; setSkipPersonal: (v: boolean) => void }) {
  const { mode, setMode, threshold, setThreshold, skipPersonal, setSkipPersonal } = props;
  const r = run(mode, threshold, skipPersonal);
  const playback = usePlayback(STREAM.length, 900);
  const l = r.lookups[playback.i];
  const started = playback.i > 0 || playback.playing;
  const packets: Packet[] = !started ? [] : l.hit ? hops(`h-${playback.i}`, ["user", "embed", "cache", "user"], { label: l.wrong ? "wrong answer" : "cached", tone: l.wrong ? "bad" : "good" }) : hops(`m-${playback.i}`, mode === "semantic" && !l.skipped ? ["user", "embed", "cache", "llm", "user"] : ["user", "cache", "llm", "user"], { label: "miss", step: 0.35 });
  const caption = !l
    ? ""
    : l.skipped
      ? `“${l.q.text}” is about one customer's order: skipped the cache and asked the model.`
      : l.hit
        ? `“${l.q.text}” matched “${l.matched!.text}” (similarity ${l.score.toFixed(2)}): ${l.wrong ? "a different question, answered wrongly" : "same meaning, answered from cache"} in ${CACHE_MS} ms.`
        : `“${l.q.text}”: ${mode === "none" ? "no cache" : `nothing above ${threshold}`}, so the model answers in ${(LLM_MS / 1000).toFixed(1)} s and the answer is stored.`;

  return (
    <SessionLayout
      visual={
        <div className="space-y-3">
          <SystemMap
            title="A user, an embedding model, the semantic cache and the LLM"
            accent={ACCENT}
            chrome="split"
            nodes={[
              { id: "user", label: "User", sub: `q${playback.i + 1}`, at: [10, 50], mobileAt: [50, 8], state: "active" },
              { id: "embed", label: "Embed", sub: mode === "semantic" ? "question → vector" : "unused", at: [36, 22], mobileAt: [20, 40], state: mode === "semantic" ? "active" : "dim" },
              { id: "cache", label: "Cache", sub: `${r.lookups.slice(0, playback.i + 1).filter((x) => !x.hit && !x.skipped && mode !== "none").length} stored`, at: [62, 22], mobileAt: [80, 40], state: l?.hit ? (l.wrong ? "bad" : "good") : mode === "none" ? "dim" : "idle" },
              { id: "llm", label: "LLM", sub: `${(LLM_MS / 1000).toFixed(1)} s · $${LLM_COST}`, at: [62, 80], mobileAt: [50, 88], state: l && !l.hit ? "active" : "idle" },
            ]}
            links={[
              { from: "user", to: "embed", label: "question", dim: mode !== "semantic" },
              { from: "embed", to: "cache", label: "nearest", dim: mode !== "semantic" },
              { from: "user", to: "cache", label: "exact key", dim: mode !== "exact" },
              { from: "cache", to: "llm", label: "miss" },
              { from: "cache", to: "user", label: "hit", dashed: true },
              { from: "llm", to: "user", label: "answer" },
            ]}
            packets={packets}
            aspect={1.8}
            mobileAspect={0.95}
          />
          <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Every question and whether it hit the cache">
            <ol className="space-y-0.5 text-[11px]">
              {r.lookups.map((x, i) => (
                <li key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)_4rem] gap-2" style={{ opacity: i <= playback.i ? 1 : 0.45, fontWeight: i === playback.i ? 700 : 400 }}>
                  <span className="font-mono text-[var(--faint)]">{i + 1}</span>
                  <span className="min-w-0 truncate">{x.q.text}</span>
                  <span className="text-right font-mono" style={{ color: x.wrong ? "var(--bad)" : x.hit ? "var(--good)" : "var(--muted)" }}>
                    {x.skipped ? "skip" : x.hit ? (x.wrong ? "wrong" : x.score.toFixed(2)) : "miss"}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      }
      panel={
        <SystemMapPanel caption={caption}>
          <div className="w-full">
            <Choices label="Cache" accent={ACCENT} value={mode} onChange={setMode} options={MODES} />
          </div>
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next question" status={`${playback.i + 1} of ${STREAM.length}`} />
          <p className="w-full font-mono text-xs" style={{ color: r.wrong ? "var(--bad)" : "var(--text)" }}>
            {r.hits} hits · {r.wrong} wrong · ${r.cost.toFixed(3)} · avg {(r.avgMs / 1000).toFixed(2)} s
          </p>
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Try an exact-match cache first" what="Hash the question text and look it up. It's free and never wrong, and it almost never hits: people don't type the same sentence twice." accent={ACCENT} active={mode === "exact"}>
            <Summary m="exact" t={threshold} sp={skipPersonal} />
          </FlowStep>
          <FlowArrow label="compare meanings" accent={ACCENT} />

          <FlowStep n={2} title="Embed the question" what="An embedding model turns text into a vector so that questions that mean the same thing land close together. Here a small stand-in does it: words, minus filler words, with a few synonyms merged." accent={ACCENT} active={mode === "semantic" && !!l && !l.hit}>
            <p className="font-mono text-[11px]">
              “{STREAM[2].text}” → {tokens(STREAM[2].text).join(" · ")}
              <br />“{STREAM[0].text}” → {tokens(STREAM[0].text).join(" · ")}
            </p>
          </FlowStep>
          <FlowArrow label="nearest neighbour" accent={ACCENT} />

          <FlowStep n={3} title="Pick a similarity threshold" what="Reuse the nearest cached answer only if it's similar enough. Lower thresholds hit more and save more, until near-misses get through: gift-card refunds are not ordinary refunds, Mexico is not Canada." accent={ACCENT} active={mode === "semantic" && !!l?.hit}>
            <Choices label="Threshold" accent={ACCENT} value={String(threshold)} onChange={(v) => setThreshold(Number(v))} options={THRESHOLDS.map((t) => ({ id: String(t), label: String(t) }))} />
            <ul className="mt-2 space-y-0.5 font-mono text-xs">
              {THRESHOLDS.map((t) => {
                const y = run("semantic", t, skipPersonal);
                return (
                  <li key={t} style={{ fontWeight: t === threshold ? 700 : 400, color: y.wrong ? "var(--bad)" : "var(--text)" }}>
                    {t}: {y.hits} hits, {y.wrong} wrong, ${y.cost.toFixed(3)}
                  </li>
                );
              })}
            </ul>
          </FlowStep>
          <FlowArrow label="whose answer?" accent={ACCENT} />

          <FlowStep n={4} title="Never share personal answers" what="“Where is my order 4471?” and “Where is my order 9930?” look alike to an embedding and have different answers for different people. Skip the cache for anything personal, or key the cache by user." accent={ACCENT} active={!!l?.q.personal}>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={skipPersonal} onChange={(e) => setSkipPersonal(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
              Skip the cache for questions about one customer
            </label>
            <p className="font-mono text-xs" style={{ color: r.leaked ? "var(--bad)" : "var(--good)" }}>
              {r.leaked ? `${r.leaked} customer shown someone else's order` : "no answers shared across customers"}
            </p>
          </FlowStep>
          <FlowArrow label="the bill" accent={ACCENT} />

          <FlowStep n={5} title="Expire answers when the facts change" what="A cached answer is only as current as the day it was generated. Give entries a TTL, and clear the ones that depend on a policy when the policy changes." accent={ACCENT} active={playback.atEnd}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
              <span />
              <span className="text-right text-[var(--faint)]">hits</span>
              <span className="text-right text-[var(--faint)]">wrong</span>
              <span className="text-right text-[var(--faint)]">cost</span>
              {MODES.map((m) => {
                const y = run(m.id, threshold, skipPersonal);
                return <Row key={m.id} cells={[m.label, String(y.hits), String(y.wrong), `$${y.cost.toFixed(3)}`]} bad={y.wrong > 0} bold={m.id === mode} />;
              })}
            </div>
            <p className="mt-2 text-[11px] text-[var(--faint)]">Similarity is computed with a bag-of-words stand-in for an embedding model; real embeddings are better at meaning, and the threshold trade-off is the same.</p>
          </FlowStep>
        </>
      }
    />
  );
}

function Summary({ m, t, sp }: { m: Mode; t: number; sp: boolean }) {
  const y = run(m, t, sp);
  return (
    <p className="font-mono text-xs">
      {y.hits} of {STREAM.length} hit · ${y.cost.toFixed(3)} · avg {(y.avgMs / 1000).toFixed(2)} s
    </p>
  );
}

function Row({ cells, bad, bold }: { cells: string[]; bad: boolean; bold: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: bold ? 700 : 400, color: i === 2 && bad ? "var(--bad)" : "var(--text)" }}>
          {c}
        </span>
      ))}
    </>
  );
}
