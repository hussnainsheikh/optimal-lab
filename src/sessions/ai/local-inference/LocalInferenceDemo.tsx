"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CONTEXTS, MACHINES, MODELS, OVERHEAD_GB, QUANTS, ctxLabel, gb, kvBytesPerToken, plan, type QuantId } from "@/lib/localInference";

const ACCENT = "var(--ai)";
const PART = { weights: "var(--ai)", kv: "var(--c3)", overhead: "var(--ghost)" };

export default function LocalInferenceDemo() {
  const [modelId, setModelId] = useState("llama8b");
  const [quant, setQuant] = useState<QuantId>("q4");
  const [ctx, setCtx] = useState(CONTEXTS[1]);
  const [machineId, setMachineId] = useState("laptop16");
  const { stage, busy, run } = useWalk(5, 1100);
  const m = MODELS.find((x) => x.id === modelId)!;
  const q = QUANTS.find((x) => x.id === quant)!;
  const mc = MACHINES.find((x) => x.id === machineId)!;
  const p = plan(m, q.bits, ctx, mc);
  const at = (i: number) => stage === i;
  const scale = Math.max(p.total, mc.fast + mc.slow, mc.fast) * 1.05;
  const tps = (x: number) => (x >= 10 ? Math.round(x).toString() : x.toFixed(1));

  const verdict =
    p.fits === "fast"
      ? `Fits in ${gb(mc.fast)} of fast memory: about ${tps(p.tokensPerSec)} tokens a second.`
      : p.fits === "offload"
        ? `${gb(p.offloaded)} spills into system RAM: it runs, at about ${tps(p.tokensPerSec)} tokens a second.`
        : `Needs ${gb(p.total)}; this machine has ${gb(mc.fast + mc.slow)} in all. It won't load.`;

  const captions = [
    `Step 1: ${m.label} has ${(m.params / 1e9).toFixed(1)} billion weights.`,
    `Step 2: at ${q.bits} bits each, the weights take ${gb(p.weights)}.`,
    `Step 3: a ${ctxLabel(ctx)}-token context adds a ${gb(p.kv)} KV cache.`,
    `Step 4: ${gb(p.total)} needed on the ${mc.label.toLowerCase()}. ${p.fits === "fast" ? "It fits." : p.fits === "offload" ? "Part of it goes to slower RAM." : "It doesn't fit."}`,
    p.fits === "no" ? "Step 5: nothing to time: pick a smaller model, fewer bits or a bigger machine." : `Step 5: every token reads all ${gb(p.weights + p.kv)} once, so about ${tps(p.tokensPerSec)} tokens a second.`,
  ];
  const caption = stage !== null ? captions[stage] : verdict;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Running models locally"
        blurb="Downloading an open model is easy; the question is whether it fits in your machine's memory and how fast it writes. Pick a model, a precision, a context length and a machine, and see the memory it needs and the tokens per second you'll get."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Memory needed against memory available">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {m.label} · {q.label} · {ctxLabel(ctx)} context
                </p>
                <p className="font-mono text-sm" style={{ color: p.fits === "fast" ? "var(--good)" : p.fits === "offload" ? "var(--c3)" : "var(--bad)" }}>
                  {p.fits === "no" ? "won't load" : `${tps(p.tokensPerSec)} tok/s`}
                </p>
              </div>

              <div className="relative mt-4 h-12 w-full overflow-hidden rounded-lg bg-[var(--track)]">
                <div className="flex h-full">
                  <span className="h-full transition-[width] duration-300" style={{ width: `${(p.weights / scale) * 100}%`, background: PART.weights }} />
                  <span className="h-full transition-[width] duration-300" style={{ width: `${(p.kv / scale) * 100}%`, background: PART.kv }} />
                  <span className="h-full transition-[width] duration-300" style={{ width: `${(OVERHEAD_GB / scale) * 100}%`, background: PART.overhead }} />
                </div>
                <div className="absolute inset-y-0 border-r-2 border-dashed border-[var(--text)]" style={{ left: `${(mc.fast / scale) * 100}%` }} />
                {mc.slow > 0 && <div className="absolute inset-y-0 border-r-2 border-dotted border-[var(--muted)]" style={{ left: `${((mc.fast + mc.slow) / scale) * 100}%` }} />}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PART.weights }} />
                  weights {gb(p.weights)}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PART.kv }} />
                  KV cache {gb(p.kv)}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PART.overhead }} />
                  runtime {gb(OVERHEAD_GB)}
                </li>
                <li>┊ GPU memory {gb(mc.fast)}</li>
                {mc.slow > 0 && <li>⋮ + system RAM {gb(mc.slow)}</li>}
              </ul>

              <p className="mt-5 text-sm font-medium">The same setup on every machine</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {MACHINES.map((x) => {
                  const r = plan(m, q.bits, ctx, x);
                  return (
                    <li key={x.id} className="flex items-baseline justify-between gap-2" style={{ fontWeight: x.id === mc.id ? 600 : 400 }}>
                      <span className="min-w-0">{x.label}</span>
                      <span className="shrink-0 font-mono text-xs" style={{ color: r.fits === "fast" ? "var(--good)" : r.fits === "offload" ? "var(--c3)" : "var(--bad)" }}>
                        {r.fits === "no" ? "won't load" : `${tps(r.tokensPerSec)} tok/s${r.fits === "offload" ? " (offloaded)" : ""}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Loading…">
                Walk through it
              </RunButton>
              <p className="w-full font-mono text-sm">
                {gb(p.total)} needed · {gb(mc.fast)} fast memory
              </p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Pick a model" what="The parameter count sets almost everything: more weights, better answers, more memory, slower tokens." accent={ACCENT} active={at(0)}>
                <Choices accent={ACCENT} value={m.id} onChange={setModelId} options={MODELS.map((x) => ({ id: x.id, label: x.label }))} />
              </FlowStep>
              <FlowArrow label={`${(m.params / 1e9).toFixed(1)}B weights`} accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Choose the precision" what="Quantization stores each weight in fewer bits. Weights take params × bits ÷ 8 bytes. 4-bit is the usual local choice." accent={ACCENT} active={at(1)}>
                <Choices accent={ACCENT} value={quant} onChange={setQuant} options={QUANTS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 font-mono text-xs">
                  {(m.params / 1e9).toFixed(1)}B × {q.bits} bits ÷ 8 = {gb(p.weights)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">{q.quality}</p>
              </FlowStep>
              <FlowArrow label={gb(p.weights)} accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Add room for the context" what="The KV cache keeps keys and values for every token in the conversation, for every layer. It grows with the context you allow." accent={ACCENT} active={at(2)}>
                <Choices accent={ACCENT} value={String(ctx)} onChange={(v) => setCtx(Number(v))} options={CONTEXTS.map((c) => ({ id: String(c), label: ctxLabel(c) }))} />
                <p className="mt-2 font-mono text-xs">
                  {Math.round(kvBytesPerToken(m) / 1024)} KB per token × {ctx.toLocaleString("en-US")} = {gb(p.kv)}
                </p>
              </FlowStep>
              <FlowArrow label={`${gb(p.total)} in all`} accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Check it fits" what="It has to fit in memory the GPU can read fast. A discrete GPU can push extra layers to system RAM, which works but is slow. A laptop's unified memory is shared with everything else." accent={ACCENT} active={at(3)}>
                <Choices accent={ACCENT} value={mc.id} onChange={setMachineId} options={MACHINES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs text-[var(--muted)]">{mc.note}</p>
              </FlowStep>
              <FlowArrow label="tokens, one at a time" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Estimate the speed" what="Each new token reads every weight once. So speed is about memory bandwidth ÷ model size, not raw compute." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-sm">
                  {p.fits === "no"
                    ? "won't load"
                    : p.fits === "fast"
                      ? `${mc.fastBw} GB/s × 60% ÷ ${gb(p.weights + p.kv)} ≈ ${tps(p.tokensPerSec)} tok/s`
                      : `${gb(p.offloaded)} read at ${mc.slowBw} GB/s ≈ ${tps(p.tokensPerSec)} tok/s`}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">People read about 250 words a minute, roughly 5 tokens a second; much slower than that and a chat feels sluggish. Reading the prompt in (prefill) is much faster than writing.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
