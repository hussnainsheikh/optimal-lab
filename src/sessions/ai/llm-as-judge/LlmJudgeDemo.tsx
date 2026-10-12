"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PAIRS, SETUPS, flipsWhenSwapped, judge, tally, type Setup, type Verdict } from "@/lib/llmJudge";

const ACCENT = "var(--ai)";
const FLIPS = flipsWhenSwapped();
const label = (v: Verdict) => (v === "tie" ? "can't tell" : v);

export default function LlmJudgeDemo() {
  const [setup, setSetup] = useState<Setup>("naive");
  const [pairId, setPairId] = useState(PAIRS[1].id);
  const all = PAIRS.map((p) => judge(p, setup));
  const j = all.find((x) => x.pair.id === pairId) ?? all[0];
  const t = tally(setup);
  const s = SETUPS.find((x) => x.id === setup)!;
  const max = 4;

  const caption =
    j.judge === "tie"
      ? `The two orders disagree, so the judge can't tell. People picked ${j.human}.`
      : j.agrees
        ? `The judge picks ${j.judge}, same as people.`
        : `The judge picks ${j.judge}, but people picked ${j.human}. ${Math.abs(j.pushes.length) > 0.5 ? "The longer answer won on length, not content." : "Being shown first was enough."}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="LLM-as-judge and its biases"
        blurb="Using a model to grade answers is fast and cheap, but judges have habits: they lean toward whichever answer they read first and toward longer answers. Watch one judge get eight pairs right for the wrong reasons, then fix it."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The pair being judged and every verdict">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Question</p>
              <p className="mt-1 font-medium">{j.pair.question}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(["A", "B"] as const).map((side) => {
                  const ans = side === "A" ? j.pair.a : j.pair.b;
                  const picked = j.judge === side;
                  const human = j.human === side;
                  return (
                    <div key={side} className="rounded-lg border p-3" style={{ borderColor: picked ? ACCENT : "var(--line)", background: "var(--inset)" }}>
                      <p className="flex flex-wrap justify-between gap-2 font-mono text-[11px] text-[var(--faint)]">
                        <span>
                          Answer {side} · {ans.words} words
                        </span>
                        <span>
                          {human && <span style={{ color: "var(--good)" }}>people ✓ </span>}
                          {picked && <span style={{ color: ACCENT }}>judge ✓</span>}
                        </span>
                      </p>
                      <p className="mt-1 text-sm">{ans.text}</p>
                    </div>
                  );
                })}
              </div>

              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left font-mono text-[11px] text-[var(--faint)]">
                    <th className="font-normal">pair</th>
                    <th className="font-normal">people</th>
                    <th className="font-normal">judge</th>
                    <th className="text-right font-normal">match</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((x) => (
                    <tr key={x.pair.id} className="cursor-pointer" style={{ background: x.pair.id === pairId ? "color-mix(in srgb, var(--ai) 10%, transparent)" : undefined }} onClick={() => setPairId(x.pair.id)}>
                      <td className="py-1 pr-2">
                        <button type="button" className="text-left hover:underline" onClick={() => setPairId(x.pair.id)}>
                          {x.pair.question}
                        </button>
                      </td>
                      <td className="font-mono">{x.human}</td>
                      <td className="font-mono">{label(x.judge)}</td>
                      <td className="text-right" style={{ color: x.agrees ? "var(--good)" : x.judge === "tie" ? "var(--faint)" : "var(--bad)" }}>
                        {x.agrees ? "✓" : x.judge === "tie" ? "–" : "✗"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="How the judge is asked" accent={ACCENT} value={setup} onChange={setSetup} options={SETUPS.map((x) => ({ id: x.id, label: x.label }))} />
              <p className="w-full text-xs text-[var(--muted)]">{s.note}</p>
              <p className="w-full font-mono text-sm">
                <span style={{ color: "var(--good)" }}>{t.agree} agree</span> · <span style={{ color: "var(--bad)" }}>{t.wrong} wrong</span> · <span className="text-[var(--muted)]">{t.ties} can&apos;t tell</span>
              </p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Show the judge two answers" what="The judge model gets the question, answer A, answer B and asks itself which is better. Click any row to change the pair." accent={ACCENT}>
                <p className="text-sm text-[var(--muted)]">
                  Answer A is {j.pair.a.words} words, answer B is {j.pair.b.words}.
                </p>
              </FlowStep>
              <FlowArrow label="a pick" accent={ACCENT} />

              <FlowStep n={2} title="See what pushed the pick" what="Real quality should decide it. Two habits push too: reading A first, and the longer answer looking more thorough." accent={ACCENT} active>
                <ul className="space-y-2 px-3 text-sm">
                  <Push name="Real quality (from people)" value={j.pushes.quality} max={max} />
                  <Push name="Shown first" value={j.pushes.position} max={max} />
                  <Push name="Length" value={j.pushes.length} max={max} />
                </ul>
                <p className="mt-2 font-mono text-xs text-[var(--faint)]">
                  {j.passes.map((p) => `${p.order === "AB" ? "A first" : "B first"}: picks ${p.pick}`).join(" · ")}
                </p>
              </FlowStep>
              <FlowArrow label="8 picks" accent={ACCENT} />

              <FlowStep n={3} title="Check the judge against people" what="Before trusting a judge, grade a sample by hand and measure how often they agree." accent={ACCENT}>
                <p className="text-sm">
                  {t.agree} of {PAIRS.length} match people{setup === "naive" ? `, but ${FLIPS} of those picks flip when B is shown first.` : "."}
                </p>
              </FlowStep>
              <FlowArrow label="fix the setup" accent={ACCENT} />

              <FlowStep n={4} title="Take the biases out" what="Ask twice with the order swapped and only accept agreement. Tell it to ignore length and grade against a checklist. Close calls become “can't tell”, which is honest." accent={ACCENT}>
                <ul className="space-y-1 text-sm text-[var(--muted)]">
                  {SETUPS.map((x) => {
                    const tt = tally(x.id);
                    return (
                      <li key={x.id} className="flex justify-between gap-3">
                        <span>{x.label}</span>
                        <span className="font-mono text-[var(--text)]">
                          {tt.agree} ✓ · {tt.wrong} ✗ · {tt.ties} –
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

// A bar from the centre: left pushes toward A, right toward B (matching the cards above).
function Push({ name, value, max }: { name: string; value: number; max: number }) {
  const w = Math.min(50, (Math.abs(value) / max) * 50);
  return (
    <li>
      <p className="flex justify-between gap-2 text-xs">
        <span>{name}</span>
        <span className="font-mono text-[var(--muted)]">
          {value === 0 ? "none" : `${Math.abs(value).toFixed(2)} toward ${value > 0 ? "A" : "B"}`}
        </span>
      </p>
      <span className="relative mt-1 flex h-2 items-center rounded bg-[var(--track)]" aria-hidden>
        <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--line-strong)]" />
        <span className="absolute -left-3 font-mono text-[10px] text-[var(--faint)]">A</span>
        <span className="absolute -right-3 font-mono text-[10px] text-[var(--faint)]">B</span>
        <span className="absolute inset-y-0 rounded" style={{ background: ACCENT, width: `${w}%`, left: value >= 0 ? `${50 - w}%` : "50%" }} />
      </span>
    </li>
  );
}
