"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { AMOUNTS, COINS, coinChangeTrace, coinsUsed, greedyCoins, naiveCalls, type DpFrame } from "@/lib/coinChange";

const ACCENT = "var(--dsa)";
const plus = (coins: number[]) => coins.join(" + ");

function captionFor(f: DpFrame, done: boolean, target: number, used: number[]) {
  if (f.amount === 0) return "Start with the base case: making 0 takes 0 coins.";
  const pick = f.candidates.find((c) => c.coin === f.via);
  const step = `Amount ${f.amount}: try each coin, best is ${pick?.coin} + the answer for ${pick?.from} (${pick?.fromBest} coins) = ${f.best}.`;
  return done ? `${step} Done: ${target} takes ${f.best} coins (${plus(used)}).` : step;
}

export default function DynamicProgrammingDemo() {
  const [target, setTarget] = useState(AMOUNTS[0]);
  const frames = coinChangeTrace(target);
  const playback = usePlayback(frames.length, 1300);
  const f = frames[playback.i];
  const done = playback.atEnd;
  const used = coinsUsed(frames);
  const greedy = greedyCoins(target) ?? [];
  const greedyWorse = greedy.length > used.length;
  const sources = new Set(f.candidates.map((c) => c.from));
  const winner = f.candidates.find((c) => c.coin === f.via)?.from;
  const caption = captionFor(f, done, target, used);

  return (
    <SessionPage>
      <SessionHeader
        kicker="DSA · interactive"
        title="Dynamic programming: solve small, reuse it"
        blurb={`What is the fewest coins (${COINS.join(", ")}) that add up to an amount? Plain recursion asks the same small questions over and over. A table answers each one once, from 0 upward, and looks up the rest.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The table of best answers">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  Filling amount {f.amount} of {target}
                </p>
                <p className="font-mono text-xs text-[var(--faint)]">coins {COINS.join(" · ")}</p>
              </div>

              <ol className="mt-4 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(target + 1, 13)}, minmax(0, 1fr))` }}>
                {Array.from({ length: target + 1 }, (_, a) => {
                  const filled = a < f.table.length;
                  const current = a === f.amount;
                  const isWinner = a === winner && !current;
                  const isSource = sources.has(a) && !current;
                  const border = current ? "var(--good)" : isWinner ? "var(--good)" : isSource ? ACCENT : "var(--line)";
                  const bg = current
                    ? "color-mix(in srgb, var(--good) 22%, transparent)"
                    : isSource
                      ? "color-mix(in srgb, var(--dsa) 14%, transparent)"
                      : "var(--inset)";
                  return (
                    <li key={a} className="flex min-w-0 flex-col items-center">
                      <span className="font-mono text-[10px] text-[var(--faint)]">{a}</span>
                      <span
                        className="mt-0.5 grid h-11 w-full place-items-center rounded-md border font-mono text-sm tabular-nums sm:h-12 sm:text-base"
                        style={{ borderColor: border, background: bg, borderStyle: isSource && !isWinner ? "dashed" : "solid", opacity: filled ? 1 : 0.4 }}
                      >
                        {filled ? (f.table[a] ?? "✕") : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <ul className="mt-4 space-y-1.5" aria-label="Coins tried for this amount">
                {f.amount === 0 ? (
                  <li className="font-mono text-sm text-[var(--muted)]">best[0] = 0, no coins needed</li>
                ) : (
                  f.candidates.map((c) => {
                    const win = c.coin === f.via;
                    return (
                      <li key={c.coin} className="flex flex-wrap justify-between gap-2 rounded-md px-2 py-1 font-mono text-sm" style={{ background: win ? "color-mix(in srgb, var(--good) 14%, transparent)" : "var(--inset)" }}>
                        <span>
                          use a {c.coin}: best[{c.from}] + 1 = {c.fromBest ?? "✕"} + 1
                        </span>
                        <span style={{ color: win ? "var(--good)" : "var(--muted)" }}>
                          {c.total ?? "can't"} {win ? "← smallest" : ""}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices
                label="Amount"
                accent={ACCENT}
                value={String(target)}
                onChange={(id) => {
                  setTarget(Number(id));
                  playback.reset();
                }}
                options={AMOUNTS.map((a) => ({ id: String(a), label: String(a) }))}
              />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next amount" status={`${f.amount + 1} of ${target + 1} cells`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Start with the smallest question" what="Making 0 takes 0 coins. Every other answer is built on top of this one." accent={ACCENT} active={f.amount === 0}>
                <p className="font-mono text-sm">best[0] = 0</p>
              </FlowStep>
              <FlowArrow label="next amount" accent={ACCENT} />

              <FlowStep n={2} title="Try every coin as the last one" what="If the last coin is c, the rest must make amount − c. That smaller answer is already in the table, so it's one lookup, not a new search." accent={ACCENT} active={f.amount > 0 && !done}>
                <p className="font-mono text-sm">
                  {f.amount > 0 ? f.candidates.map((c) => `best[${c.from}] + 1`).join(", ") : "best[a − c] + 1 for each coin c"}
                </p>
              </FlowStep>
              <FlowArrow label="one total per coin" accent={ACCENT} />

              <FlowStep n={3} title="Keep the smallest and write it down" what="Store the best count for this amount, and which coin gave it. Bigger amounts will reuse it instead of working it out again." accent={ACCENT} active={f.amount > 0 && !done}>
                <p className="font-mono text-sm">{f.amount > 0 ? `best[${f.amount}] = ${f.best} (last coin ${f.via})` : "best[a] = smallest total"}</p>
              </FlowStep>
              <FlowArrow label="table full" accent={ACCENT} />

              <FlowStep n={4} title="Read the answer from the last cell" what="Follow the saved coins back down to 0 to see which coins were used." accent={ACCENT} active={done}>
                {done ? (
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-mono">{target} = {plus(used)}</span>: {used.length} coins, with {target + 1} cells filled once each.
                    </p>
                    <p className="text-[var(--muted)]">
                      Grabbing the biggest coin first gives {plus(greedy)} ({greedy.length} coins)
                      {greedyWorse ? ", which is worse. Greedy can't see that a smaller coin now saves coins later." : ". Same here, but not for every amount: try 6."}
                    </p>
                    <p className="text-[var(--muted)]">
                      Plain recursion with no table makes {naiveCalls(target).toLocaleString()} calls for {target}, because it solves the same small amounts again and again.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">Keep stepping to fill the table.</p>
                )}
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
