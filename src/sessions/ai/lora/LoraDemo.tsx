"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Slider } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { MODEL, RANKS, TOY_D, TOY_MAX_RANK, counts, fmtCount, toyDelta } from "@/lib/lora";

const ACCENT = "var(--ai)";
const CELL = 14; // px per cell in the toy picture

export default function LoraDemo() {
  const [rankIdx, setRankIdx] = useState(3); // r = 8
  const r = RANKS[rankIdx];
  const toyR = Math.min(r, TOY_MAX_RANK);
  const c = counts(r);
  const { delta, A, B } = toyDelta(toyR);

  const caption = `Rank ${r}: train ${fmtCount(c.lora)} numbers instead of ${fmtCount(c.full)}, ${(c.shareOfModel * 100).toFixed(2)}% of the model. The adapter file is ${c.adapterMB.toFixed(0)} MB.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="LoRA: fine-tune a sliver of the model"
        blurb="Full fine-tuning changes every weight and needs a whole new copy of the model. LoRA freezes the original weights and trains two thin matrices beside them. Their product is the same shape as the weights it adjusts, at a fraction of the size."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="A frozen weight matrix and its low-rank update">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                A tiny {TOY_D}×{TOY_D} layer at rank {toyR}
                {r > TOY_MAX_RANK ? ` (the picture stops at ${TOY_MAX_RANK})` : ""}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Labeled label={`W (frozen) · ${TOY_D * TOY_D}`}>
                  <Grid rows={TOY_D} cols={TOY_D} color="var(--ghost)" />
                </Labeled>
                <span className="text-lg text-[var(--muted)]">+</span>
                <Labeled label={`B · ${TOY_D}×${toyR}`}>
                  <Matrix values={transpose(B)} />
                </Labeled>
                <span className="text-lg text-[var(--muted)]">×</span>
                <Labeled label={`A · ${toyR}×${TOY_D}`}>
                  <Matrix values={A} />
                </Labeled>
                <span className="text-lg text-[var(--muted)]">=</span>
                <Labeled label={`B·A · ${TOY_D}×${TOY_D}`}>
                  <Matrix values={delta} />
                </Labeled>
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Trained here: {2 * TOY_D * toyR} numbers (B and A) to adjust all {TOY_D * TOY_D} weights, and the update can only change the layer in {toyR}{" "}
                {toyR === 1 ? "direction" : "independent directions"}. The saving grows with size: at {MODEL.d}×{MODEL.d}, rank {r} trains{" "}
                {((2 * MODEL.d * r) / (MODEL.d * MODEL.d) * 100).toFixed(2)}% as many numbers.
              </p>

              <div className="mt-5 space-y-3">
                <Bar label={`Full fine-tune of those layers (${MODEL.name})`} value={c.full} max={c.full} text={fmtCount(c.full)} color="var(--bad)" />
                <Bar label={`LoRA at rank ${r}`} value={c.lora} max={c.full} text={fmtCount(c.lora)} color="var(--good)" />
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Slider label="Rank (r)" accent={ACCENT} value={rankIdx} min={0} max={RANKS.length - 1} step={1} format={(i) => String(RANKS[i])} onChange={setRankIdx} hint="Width of the two thin matrices" />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Freeze the original weights" what="The base model never changes. Nothing has to be copied, and the same base can serve many fine-tunes." accent={ACCENT}>
                <p className="font-mono text-sm">
                  {MODEL.layers} layers × {MODEL.adapted} matrices of {MODEL.d}×{MODEL.d} stay frozen
                </p>
              </FlowStep>
              <FlowArrow label="frozen W" accent={ACCENT} />

              <FlowStep n={2} title="Add two thin matrices beside each one" what="B is tall and thin, A is short and wide. Their product B·A has the same shape as W, so it can be added to it." accent={ACCENT}>
                <p className="font-mono text-sm">
                  B: {MODEL.d}×{r}, A: {r}×{MODEL.d} → {fmtCount(2 * MODEL.d * r)} numbers instead of {fmtCount(MODEL.d * MODEL.d)}
                </p>
              </FlowStep>
              <FlowArrow label="B and A" accent={ACCENT} />

              <FlowStep n={3} title="Train only B and A" what="Gradients flow through the frozen model but only update the adapters, so training fits on far smaller GPUs." accent={ACCENT} active>
                <p className="text-sm">
                  {fmtCount(c.lora)} trainable numbers, {(c.shareOfFull * 100).toFixed(2)}% of a full fine-tune of the same layers.
                </p>
              </FlowStep>
              <FlowArrow label="a trained adapter" accent={ACCENT} />

              <FlowStep n={4} title="Merge it, or swap adapters per task" what="Add B·A into W for zero extra latency, or keep adapters separate and load a different one for each customer or task." accent={ACCENT}>
                <p className="text-sm">
                  Adapter file: <span className="font-mono">{c.adapterMB.toFixed(0)} MB</span>. A fully fine-tuned copy: <span className="font-mono">{c.fullFineTuneGB.toFixed(1)} GB</span>.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

const transpose = (m: number[][]) => (m.length ? m[0].map((_, j) => m.map((row) => row[j])) : []);

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-1">
      {children}
      <figcaption className="font-mono text-[10px] text-[var(--faint)]">{label}</figcaption>
    </figure>
  );
}

function Grid({ rows, cols, color }: { rows: number; cols: number; color: string }) {
  return (
    <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${cols}, ${CELL}px)` }} aria-hidden>
      {Array.from({ length: rows * cols }, (_, i) => (
        <span key={i} style={{ width: CELL, height: CELL, background: color }} className="rounded-[2px]" />
      ))}
    </div>
  );
}

// Positive values in the accent colour, negative in the "bad" colour, strength by size.
function Matrix({ values }: { values: number[][] }) {
  const cols = values[0]?.length ?? 0;
  const max = Math.max(0.01, ...values.flat().map(Math.abs));
  return (
    <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${cols}, ${CELL}px)` }} aria-hidden>
      {values.flat().map((v, i) => (
        <span
          key={i}
          className="rounded-[2px]"
          style={{
            width: CELL,
            height: CELL,
            background: `color-mix(in srgb, ${v >= 0 ? "var(--ai)" : "var(--bad)"} ${Math.round((Math.abs(v) / max) * 85) + 10}%, transparent)`,
          }}
        />
      ))}
    </div>
  );
}

function Bar({ label, value, max, text, color }: { label: string; value: number; max: number; text: string; color: string }) {
  return (
    <div>
      <p className="flex justify-between gap-2 text-xs text-[var(--muted)]">
        <span>{label}</span>
        <span className="font-mono text-[var(--text)]">{text}</span>
      </p>
      <span className="mt-1 block h-2 rounded bg-[var(--track)]">
        <span className="block h-full rounded" style={{ width: `${Math.max(0.6, (value / max) * 100)}%`, background: color }} />
      </span>
    </div>
  );
}
