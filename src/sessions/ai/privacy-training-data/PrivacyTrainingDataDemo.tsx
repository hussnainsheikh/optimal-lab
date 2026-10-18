"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DP, ITEMS, NONE, PROMPTS, SIZES, USER_PROMPTS, extractChance, pct, quality, type Defenses } from "@/lib/privacyTrainingData";

const ACCENT = "var(--ai)";
const KIND_COLOR = { secret: "var(--bad)", personal: "var(--c4)", public: "var(--good)" } as const;

export default function PrivacyTrainingDataDemo() {
  const [size, setSize] = useState("mid");
  const [prompt, setPrompt] = useState("long");
  const [d, setD] = useState<Defenses>(NONE);
  const { stage, busy, run } = useWalk(5, 1100);
  const set = (patch: Partial<Defenses>) => setD((cur) => ({ ...cur, ...patch }));
  const chance = (id: string, defs: Defenses = d) => extractChance(ITEMS.find((i) => i.id === id)!, size, prompt, defs);
  const risky = ITEMS.filter((i) => i.kind !== "public");
  const worst = risky.reduce((a, b) => (chance(b.id) > chance(a.id) ? b : a));
  const at = (i: number) => stage === i;
  const q = quality(d);
  const sizeLabel = SIZES.find((s) => s.id === size)!.label;

  const captions = [
    "Step 1: the crawl holds a leaked key, a quoted email, a scraped address, a patient's note and a famous sentence.",
    `Step 2: a ${sizeLabel} model with ${prompt === "long" ? "the whole paragraph" : "a few words"} as the prompt: the address (40 copies) comes out ${pct(chance("address", NONE))} of the time, the key (1 copy) ${pct(chance("key", NONE))}.`,
    d.dedup ? `Step 3: deduplicated, the address drops to ${pct(chance("address"))}.` : "Step 3: deduplication is off. Turn it on: the forty copies of the address become one.",
    d.scrub !== "none" ? `Step 4: scrubbing with ${d.scrub === "regex" ? "pattern rules" : "an entity model"}: the key is at ${pct(chance("key"))}, the patient's note at ${pct(chance("record"))}.` : "Step 4: nothing is scrubbed yet. Pattern rules catch keys and emails; free-text names need an entity model.",
    `Step 5: the riskiest item left is the ${worst.label.toLowerCase()} at ${pct(chance(worst.id))}; model quality ${pct(q)}.`,
  ];
  const caption = stage !== null ? captions[stage] : `Riskiest item left: ${worst.label.toLowerCase()}, ${pct(chance(worst.id))} extractable. Model quality ${pct(q)} of the undefended model.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Privacy and training data"
        blurb="A model trained on the web can repeat what it read, and the more often something appeared, the more likely it is to come out when prompted. See what an attacker can extract from five things in a crawl, then deduplicate, scrub personal data, add differential privacy, and watch what each costs."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Chance each item can be extracted from the model, with the current defenses">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {sizeLabel} model · chance an attacker gets it out
                </p>
                <p className="font-mono text-sm">quality {pct(q)}</p>
              </div>
              <ul className="mt-3 space-y-2">
                {ITEMS.map((item) => {
                  const now = chance(item.id);
                  const before = chance(item.id, NONE);
                  return (
                    <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_7rem_3rem] items-center gap-2 text-xs sm:grid-cols-[minmax(0,1fr)_9rem_3rem]">
                      <span className="min-w-0">
                        <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: KIND_COLOR[item.kind] }} aria-label={item.kind} />
                        {item.label}
                        <span className="block font-mono text-[10px] text-[var(--faint)]">{item.copies.toLocaleString("en-US")} {item.copies === 1 ? "copy" : "copies"}</span>
                      </span>
                      <span className="relative h-3 rounded bg-[var(--track)]">
                        <span className="absolute inset-y-0 left-0 rounded opacity-30" style={{ width: `${before * 100}%`, background: KIND_COLOR[item.kind] }} />
                        <span className="absolute inset-y-0 left-0 rounded transition-[width] duration-300" style={{ width: `${now * 100}%`, background: KIND_COLOR[item.kind] }} />
                      </span>
                      <span className="text-right font-mono">{pct(now)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-[var(--muted)]">
                <span>faded: with no defenses</span>
                {(["secret", "personal", "public"] as const).map((k) => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
                    {k}
                  </span>
                ))}
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Model size" accent={ACCENT} value={size} onChange={setSize} options={SIZES.map((s) => ({ id: s.id, label: s.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Probing…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Look at what's in the crawl" what="Web data carries secrets people pasted once, personal data mirrored across sites, and leaked files. Nobody consented to any of it being learned." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 text-xs text-[var(--muted)]">
                  {ITEMS.map((i) => (
                    <li key={i.id}>
                      <span className="text-[var(--text)]">{i.label}:</span> {i.what}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="train" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="See what the model will repeat" what="Memorization grows with how often a string appeared, with model size, and with how much context the attacker can give. A string seen once is rarely extractable; one seen forty times usually is." accent={ACCENT} active={at(1)}>
                <Choices label="What the attacker types" accent={ACCENT} value={prompt} onChange={setPrompt} options={PROMPTS.map((p) => ({ id: p.id, label: p.label }))} />
                <p className="mt-2 font-mono text-xs">
                  {SIZES.map((s) => `${s.label}: address ${pct(extractChance(ITEMS[2], s.id, prompt, NONE))}`).join(" · ")}
                </p>
              </FlowStep>
              <FlowArrow label="defend the data" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Deduplicate" what="Collapse repeated documents to one copy. Memorization of the repeated ones falls sharply, and the model trains slightly better too. Things seen once stay as they were." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={d.dedup} onChange={(e) => set({ dedup: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Deduplicate the training data
                </label>
                <p className="font-mono text-xs">
                  address: {pct(chance("address", { ...d, dedup: false }))} → {pct(chance("address", { ...d, dedup: true }))}
                </p>
              </FlowStep>
              <FlowArrow label="still personal" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Scrub personal data" what="Pattern rules catch things with a shape: keys, emails, card numbers. Names, addresses and diagnoses in free text need an entity-recognition model, and it misses some." accent={ACCENT} active={at(3)}>
                <Choices label="Scrubber" accent={ACCENT} value={d.scrub} onChange={(v) => set({ scrub: v })} options={[{ id: "none", label: "None" }, { id: "regex", label: "Pattern rules" }, { id: "ner", label: "Entity model" }]} />
                <p className="mt-2 font-mono text-xs">
                  key {pct(chance("key"))} · email {pct(chance("email"))} · address {pct(chance("address"))} · patient note {pct(chance("record"))}
                </p>
              </FlowStep>
              <FlowArrow label="the last resort" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Add noise, and stop collecting" what="Differential privacy adds noise to every training step, so no single example can be recovered, at a cost in quality that grows as ε shrinks. And the easiest data not to leak is data you never kept: users' prompts are training data only if you keep them." accent={ACCENT} active={at(4)}>
                <Choices label="Differential privacy" accent={ACCENT} value={d.dp} onChange={(v) => set({ dp: v })} options={(Object.keys(DP) as (keyof typeof DP)[]).map((k) => ({ id: k, label: DP[k].label }))} />
                <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={d.prompts} onChange={(e) => set({ prompts: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Don&rsquo;t train on users&rsquo; prompts
                </label>
                <p className="font-mono text-xs">
                  {d.prompts ? "0" : Math.round(USER_PROMPTS.perDay * USER_PROMPTS.withPII).toLocaleString("en-US")} prompts with personal data enter training a day · quality {pct(q)}
                </p>
                <p className="mt-2 text-xs text-[var(--faint)]">The curve’s shape follows Carlini et al. 2022 (memorization grows with copies, size and context); the constants and the detection rates are made up. Deduplication’s small quality gain is from Lee et al. 2021.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
