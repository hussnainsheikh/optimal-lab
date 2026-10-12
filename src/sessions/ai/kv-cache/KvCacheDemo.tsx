"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, Slider, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { BYTES_PER_TOKEN, MODEL, OUTPUT, PROMPT, formatBytes, kvTrace, workFor } from "@/lib/kvCache";

const ACCENT = "var(--ai)";
const FRAMES = kvTrace();
const LENGTHS = [1_000, 4_000, 8_000, 32_000, 128_000];
type Mode = "cache" | "none";

const show = (t: string) => t.replace(/^ /, "·");
// in sentences, drop the leading space instead of marking it
const word = (t: string) => t.trim();

export default function KvCacheDemo() {
  const [mode, setMode] = useState<Mode>("cache");
  const [lenIdx, setLenIdx] = useState(2);
  const playback = usePlayback(FRAMES.length, 1200);
  const f = FRAMES[playback.i];
  const cached = mode === "cache";
  const prefill = f.phase === "prefill";
  const computedNow = cached ? f.computedWithCache : f.computedNoCache;
  const totalNow = cached ? f.totalWithCache : f.totalNoCache;
  const maxTotal = FRAMES.at(-1)!.totalNoCache;
  // rows the model reads to pick this token: every token seen before it
  const rows = PROMPT.length + (prefill ? 0 : f.step);
  const inputs = [...PROMPT, ...OUTPUT].slice(0, rows);
  const len = LENGTHS[lenIdx];
  const big = workFor(len, 500);

  const caption = prefill
    ? `Prefill: the model reads all ${PROMPT.length} prompt tokens at once, computes a key and a value for each, and produces “${word(f.newToken!)}”.`
    : cached
      ? `Step ${f.step}: only “${word(inputs.at(-1)!)}” is new, so the model computes 1 key/value row and reuses ${rows - 1} from the cache. Out comes “${word(f.newToken!)}”.`
      : `Step ${f.step}: no cache, so the model recomputes keys and values for all ${rows} tokens, again, just to produce “${word(f.newToken!)}”.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="The KV cache"
        blurb="To pick each new token, attention needs a key and a value for every token before it. Keep them, and each step only does work for the newest token. Throw them away, and every step starts over. Switch between the two and watch the counters."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Tokens and their cached keys and values">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {prefill ? "Prefill" : `Decode step ${f.step}`}
                </p>
                <p className="font-mono text-xs text-[var(--muted)]">{cached ? "with KV cache" : "no cache"}</p>
              </div>

              <p className="mt-3 flex flex-wrap items-baseline gap-x-1 gap-y-1 text-lg">
                {f.tokens.map((t, i) => {
                  const isNew = i === f.tokens.length - 1;
                  const isPrompt = i < PROMPT.length;
                  return (
                    <span
                      key={i}
                      className="whitespace-pre rounded px-0.5"
                      style={isNew ? { background: ACCENT, color: "var(--on-accent)" } : { color: isPrompt ? "var(--muted)" : "var(--text)" }}
                    >
                      {t}
                    </span>
                  );
                })}
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-separate border-spacing-y-1 font-mono text-xs">
                  <thead>
                    <tr className="text-left text-[var(--faint)]">
                      <th className="font-normal">token</th>
                      <th className="font-normal">key (K)</th>
                      <th className="font-normal">value (V)</th>
                      <th className="text-right font-normal">this step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inputs.map((t, i) => {
                      const fresh = prefill || !cached || i === rows - 1;
                      const cell = {
                        background: fresh ? "color-mix(in srgb, var(--ai) 22%, transparent)" : "var(--inset)",
                        borderColor: fresh ? ACCENT : "var(--line)",
                      };
                      return (
                        <tr key={i}>
                          <td className="whitespace-pre pr-2">{show(t)}</td>
                          <td className="pr-2"><span className="block h-4 rounded border" style={cell} /></td>
                          <td className="pr-2"><span className="block h-4 rounded border" style={cell} /></td>
                          <td className="text-right" style={{ color: fresh ? "var(--text)" : "var(--faint)" }}>{fresh ? "computed" : "from cache"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Counter label="Rows computed so far, no cache" value={f.totalNoCache} max={maxTotal} color="var(--bad)" />
                <Counter label="Rows computed so far, with cache" value={f.totalWithCache} max={maxTotal} color="var(--good)" />
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices
                accent={ACCENT}
                value={mode}
                onChange={(m) => setMode(m)}
                options={[
                  { id: "cache", label: "With KV cache" },
                  { id: "none", label: "No cache" },
                ]}
              />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next token" status={`${computedNow} rows this step · ${totalNow} total`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Prefill: read the whole prompt at once" what="The prompt tokens are processed together, in parallel. Each gets a key and a value, and they're stored. This is why the first token takes longest." accent={ACCENT} active={prefill}>
                <p className="font-mono text-sm">{PROMPT.length} rows computed, the same with or without a cache</p>
              </FlowStep>
              <FlowArrow label="the first new token" accent={ACCENT} />

              <FlowStep n={2} title="Feed in the newest token" what="Generation is a loop: the token just produced becomes the next input." accent={ACCENT} active={!prefill}>
                <p className="font-mono text-sm">{prefill ? "—" : `input: “${word(inputs.at(-1)!)}”`}</p>
              </FlowStep>
              <FlowArrow label="one new token" accent={ACCENT} />

              <FlowStep n={3} title="Compute keys and values" what="With a cache, only the new token needs a key and a value; the rest are already stored. Without one, every token is computed again." accent={ACCENT} active={!prefill}>
                <p className="font-mono text-sm">
                  {cached ? "1 new row, " : `${rows} rows, `}
                  {cached ? `${rows - 1} reused` : "none reused"}
                </p>
              </FlowStep>
              <FlowArrow label="K and V for every token so far" accent={ACCENT} />

              <FlowStep n={4} title="Attend and pick the next token" what="The new token's query is compared with every key, the values are blended, and the next token comes out." accent={ACCENT}>
                <p className="font-mono text-sm">→ “{word(f.newToken!)}”</p>
              </FlowStep>
              <FlowArrow label="repeat until done" accent={ACCENT} />

              <FlowStep n={5} title="The cache grows with every token" what={`It trades memory for speed. For a 7B-class model (${MODEL.layers} layers × ${MODEL.heads} heads × ${MODEL.headDim} dims, fp16) each token costs about ${formatBytes(BYTES_PER_TOKEN)}.`} accent={ACCENT} active={playback.atEnd}>
                <Slider
                  label="Conversation length"
                  accent={ACCENT}
                  value={lenIdx}
                  min={0}
                  max={LENGTHS.length - 1}
                  step={1}
                  format={(i) => `${LENGTHS[i].toLocaleString()} tokens`}
                  onChange={setLenIdx}
                />
                <ul className="mt-3 space-y-1 text-sm">
                  <li>
                    Cache size: <span className="font-mono">{formatBytes(len * BYTES_PER_TOKEN)}</span> per conversation
                  </li>
                  <li className="text-[var(--muted)]">
                    Writing a 500-token reply: <span className="font-mono text-[var(--text)]">{big.withCache.toLocaleString()}</span> rows with the cache vs{" "}
                    <span className="font-mono text-[var(--text)]">{big.noCache.toLocaleString()}</span> without.
                  </li>
                </ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Counter({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="rounded-lg bg-[var(--inset)] p-2">
      <p className="flex justify-between gap-2 text-xs text-[var(--muted)]">
        <span>{label}</span>
        <span className="font-mono text-[var(--text)]">{value}</span>
      </p>
      <span className="mt-1.5 block h-2 rounded bg-[var(--track)]">
        <span className="block h-full rounded transition-[width]" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
    </div>
  );
}
