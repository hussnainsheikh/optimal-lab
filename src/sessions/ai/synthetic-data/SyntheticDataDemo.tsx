"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { GENERATIONS, MIX_CHOICES, REAL, SAMPLE_COUNTS, TOPICS, pct, simulate, type Settings } from "@/lib/syntheticData";

const ACCENT = "var(--ai)";

export default function SyntheticDataDemo() {
  const [s, setS] = useState<Settings>({ n: 2000, mix: 0, verify: false, sharpen: true });
  const set = (patch: Partial<Settings>) => setS((cur) => ({ ...cur, ...patch }));
  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Synthetic data"
        blurb="Let a model write your training examples and you get thousands in an hour. Train on them, generate again from the new model, and two things creep in: the rare cases disappear, and errors feed on themselves. Run eight generations, then mix real data back in and verify what you keep."
      />
      <div className="mt-6">
        <Run key={`${s.n}-${s.mix}-${s.verify}-${s.sharpen}`} s={s} set={set} />
      </div>
    </SessionPage>
  );
}

function Run({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const frames = simulate(s);
  const playback = usePlayback(frames.length, 1200);
  const i = playback.i;
  const f = frames[i];
  const last = frames[frames.length - 1];
  const max = Math.max(...f.dist, ...REAL);
  const packets: Packet[] =
    i === 0
      ? []
      : hops(`g${i}`, ["model", "gen", "filter", "train", "model"], { label: `gen ${i}`, tone: f.error > 0.2 ? "bad" : "accent", step: 0.3 });

  const caption =
    i === 0
      ? `Generation 0 is the real data: all ${TOPICS} topics, with a long tail of rare ones, and ${pct(f.error)} of examples wrong.`
      : `Generation ${i}: ${f.distinct} of ${TOPICS} topics still appear, the top 5 make up ${pct(f.top5)} of the data, and ${pct(f.error)} of examples are wrong.`;

  return (
    <SessionLayout
      visual={
        <div className="space-y-4">
          <SystemMap
            title="A model generates examples, a filter keeps some, a new model trains on them and generates the next batch"
            accent={ACCENT}
            chrome="split"
            nodes={[
              { id: "real", label: "Real data", sub: `${pct(s.mix)} mixed in`, at: [14, 78], mobileAt: [22, 88], state: s.mix > 0 ? "good" : "dim" },
              { id: "model", label: "Model", sub: `gen ${i} · ${f.distinct} topics`, at: [14, 26], mobileAt: [22, 12], state: f.error > 0.2 ? "bad" : "active" },
              { id: "gen", label: "Generate", sub: `${s.n.toLocaleString("en-US")} examples`, at: [42, 26], mobileAt: [76, 12], state: "idle" },
              { id: "filter", label: "Verify", sub: s.verify ? "keeps what passes" : "off", at: [70, 26], mobileAt: [76, 50], state: s.verify ? "active" : "dim" },
              { id: "train", label: "Train the next", sub: `gen ${Math.min(i + 1, GENERATIONS)}`, at: [70, 78], mobileAt: [76, 88], state: "idle" },
            ]}
            links={[
              { from: "model", to: "gen", label: "samples" },
              { from: "gen", to: "filter", label: "examples", dim: !s.verify },
              { from: "filter", to: "train", label: "kept" },
              { from: "real", to: "train", label: "real examples", dim: s.mix === 0 },
              { from: "train", to: "model", label: "new model", dashed: true },
            ]}
            packets={packets}
            aspect={2.2}
            mobileAspect={1}
          />
          <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="How often each topic appears in this generation's data">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                topics in generation {i} · {f.distinct} of {TOPICS}
              </p>
              <p className="font-mono text-sm" style={{ color: f.error > 0.2 ? "var(--bad)" : "var(--text)" }}>
                {pct(f.error)} wrong
              </p>
            </div>
            <div className="mt-3 flex h-24 items-end gap-px" role="img" aria-label={`${f.distinct} of ${TOPICS} topics present; the top five topics are ${pct(f.top5)} of the data`}>
              {f.dist.map((v, t) => (
                <span key={t} className="min-w-0 flex-1 rounded-t-[1px]" style={{ height: `${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%`, background: v === 0 ? "transparent" : t < 5 ? ACCENT : "var(--c3)" }} />
              ))}
            </div>
            <div className="flex h-3 items-end gap-px opacity-40" aria-hidden>
              {REAL.map((v, t) => (
                <span key={t} className="min-w-0 flex-1" style={{ height: `${(v / max) * 100}%`, background: "var(--muted)" }} />
              ))}
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-[var(--muted)]">
              <span>common topics ← → rare topics</span>
              <span>grey: the real data</span>
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="topics left" value={`${f.distinct}/${TOPICS}`} bad={f.distinct < 30} />
              <Stat label="top 5 topics" value={pct(f.top5)} bad={f.top5 > 0.8} />
              <Stat label="wrong examples" value={pct(f.error)} bad={f.error > 0.1} />
            </dl>
          </section>
        </div>
      }
      panel={
        <SystemMapPanel caption={caption}>
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next generation" status={`generation ${i} of ${GENERATIONS}`} />
          <p className="w-full font-mono text-xs text-[var(--muted)]">
            after {GENERATIONS} generations: {last.distinct}/{TOPICS} topics, {pct(last.error)} wrong
          </p>
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Start from real data" what="Real support tickets cover forty topics, a few of them often and most of them rarely. A few are mislabelled: real data isn't clean either." accent={ACCENT} active={i === 0}>
            <p className="font-mono text-xs">
              {TOPICS} topics · top 5 = {pct(REAL.slice(0, 5).reduce((a, b) => a + b, 0))} of tickets · rarest topic {(REAL[TOPICS - 1] * 100).toFixed(1)}%
            </p>
          </FlowStep>
          <FlowArrow label="a model trained on it" accent={ACCENT} />

          <FlowStep n={2} title="Generate examples with the model" what="Ask the model for new tickets. It writes what it has seen most, and a model's samples favour its common outputs a little more than their true share. A small batch misses the rare topics by chance alone." accent={ACCENT} active={i > 0}>
            <Choices label="Examples per generation" accent={ACCENT} value={String(s.n)} onChange={(v) => set({ n: Number(v) })} options={SAMPLE_COUNTS.map((c) => ({ id: String(c), label: c.toLocaleString("en-US") }))} />
            <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={s.sharpen} onChange={(e) => set({ sharpen: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
              The model favours its common outputs
            </label>
          </FlowStep>
          <FlowArrow label={`${s.n.toLocaleString("en-US")} examples`} accent={ACCENT} />

          <FlowStep n={3} title="Verify before you keep" what="Check each example with something that isn't the model: a schema, a test, a lookup, a person. Without a check, the model's mistakes become the next model's training data." accent={ACCENT}>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={s.verify} onChange={(e) => set({ verify: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
              Verify every example and drop the ones that fail
            </label>
            <p className="font-mono text-xs">{s.verify ? "wrong examples held near 3%" : "errors grow about 1.6× per generation"}</p>
          </FlowStep>
          <FlowArrow label="kept examples" accent={ACCENT} />

          <FlowStep n={4} title="Mix real data back in" what="Keep some real examples in every training set. They bring back the topics the model stopped generating and anchor the error rate." accent={ACCENT}>
            <Choices label="Real data in each training set" accent={ACCENT} value={String(s.mix)} onChange={(v) => set({ mix: Number(v) })} options={MIX_CHOICES.map((m) => ({ id: String(m), label: pct(m) }))} />
          </FlowStep>
          <FlowArrow label="train, then generate again" accent={ACCENT} />

          <FlowStep n={5} title="Watch the generations" what="Each generation trains on the last one's output. All synthetic, no checks: the tail vanishes and errors compound. This is model collapse. Synthetic data works when it is verified and mixed with real data." accent={ACCENT} active={i === GENERATIONS}>
            <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-x-3 gap-y-0.5 font-mono text-xs">
              <span className="text-[var(--faint)]">gen</span>
              <span className="text-right text-[var(--faint)]">topics</span>
              <span className="text-right text-[var(--faint)]">top 5</span>
              <span className="text-right text-[var(--faint)]">wrong</span>
              {frames.map((g) => (
                <GenRow key={g.gen} g={g.gen} a={`${g.distinct}`} b={pct(g.top5)} c={pct(g.error)} bold={g.gen === i} />
              ))}
            </div>
            <p className="mt-2 text-xs text-[var(--faint)]">The sampling and the shrinking tail are a real simulation; the error growth is a teaching model. Shumailov et al. 2024 showed the collapse in real language models.</p>
          </FlowStep>
        </>
      }
    />
  );
}

function GenRow({ g, a, b, c, bold }: { g: number; a: string; b: string; c: string; bold: boolean }) {
  const w = bold ? 700 : 400;
  return (
    <>
      <span style={{ fontWeight: w }}>{g}</span>
      <span className="text-right" style={{ fontWeight: w }}>
        {a}
      </span>
      <span className="text-right" style={{ fontWeight: w }}>
        {b}
      </span>
      <span className="text-right" style={{ fontWeight: w }}>
        {c}
      </span>
    </>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad: boolean }) {
  return (
    <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="font-mono text-base" style={{ color: bad ? "var(--bad)" : "var(--text)" }}>
        {value}
      </dd>
    </div>
  );
}
