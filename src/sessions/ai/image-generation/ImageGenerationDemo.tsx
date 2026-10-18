"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ALPHA_BAR, GUIDANCE_CHOICES, PROMPTS, SIZE, STEP_CHOICES, T, clipped, match, sample, type Img, type PromptId } from "@/lib/imageGeneration";

const ACCENT = "var(--ai)";
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function ImageGenerationDemo() {
  const [prompt, setPrompt] = useState<PromptId>("house");
  const [steps, setSteps] = useState(25);
  const [guidance, setGuidance] = useState(7);
  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="How image generation works"
        blurb="A diffusion model learns one skill: look at a noisy picture and guess the noise in it. To make an image, start from pure noise and remove a little at a time, nudged toward the prompt. Change the number of steps and the guidance, and watch a 16 × 16 picture appear."
      />
      <div className="mt-6">
        <Run key={`${prompt}-${steps}-${guidance}`} prompt={prompt} setPrompt={setPrompt} steps={steps} setSteps={setSteps} guidance={guidance} setGuidance={setGuidance} />
      </div>
    </SessionPage>
  );
}

function Run(props: { prompt: PromptId; setPrompt: (p: PromptId) => void; steps: number; setSteps: (n: number) => void; guidance: number; setGuidance: (g: number) => void }) {
  const { prompt, steps, guidance } = props;
  const frames = sample(prompt, steps, guidance);
  const playback = usePlayback(frames.length, steps > 10 ? 260 : 700);
  const i = playback.i;
  const f = frames[i];
  const last = frames[frames.length - 1].x;
  const done = i === frames.length - 1;
  const noise = Math.sqrt(1 - ALPHA_BAR[f.t]);
  const final = { match: match(last, prompt), clipped: clipped(last, prompt) };
  const label = PROMPTS.find((p) => p.id === prompt)!.label;

  const caption =
    i === 0
      ? `Pure noise. Press play to remove it in ${steps} ${steps === 1 ? "step" : "steps"}.`
      : !done
        ? `Step ${i} of ${steps}: noise level ${noise.toFixed(2)}. The model's guess of the clean picture sharpens as the noise drops.`
        : final.match < 0.3
          ? `Done, but only ${pct(final.match)} of “${label}” came through. ${steps <= 5 ? "Too few steps: the last guess was made through heavy noise." : "Guidance is too weak to pull away from a generic picture."}`
          : final.clipped > 0.05
            ? `Done: “${label}”, but guidance is so strong that ${pct(final.clipped)} of the shading is crushed to pure black or white.`
            : `Done: ${pct(final.match)} of “${label}” came through.`;

  const active = i === 0 ? 2 : done ? 5 : 4;

  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The image being denoised, and the model's current guess of the clean image">
          <div className="grid grid-cols-2 gap-4">
            <figure>
              <Pixels img={f.x} label={`Image at step ${i}`} />
              <figcaption className="mt-1 text-center font-mono text-[11px] text-[var(--muted)]">
                image, step {i}/{steps} · t = {f.t}
              </figcaption>
            </figure>
            <figure>
              <Pixels img={f.predicted} label="The model's guess of the clean image" />
              <figcaption className="mt-1 text-center font-mono text-[11px] text-[var(--muted)]">model&rsquo;s guess of the clean image</figcaption>
            </figure>
          </div>
          <div className="mt-4">
            <div className="flex justify-between font-mono text-[11px] text-[var(--faint)]">
              <span>noise level</span>
              <span>{noise.toFixed(2)}</span>
            </div>
            <span className="mt-1 block h-2 rounded bg-[var(--track)]">
              <span className="block h-full rounded transition-[width] duration-200" style={{ width: `${noise * 100}%`, background: ACCENT }} />
            </span>
          </div>
          <ol className="mt-4 flex gap-1 overflow-hidden" aria-label="Every few steps">
            {thumbs(frames.length).map((k) => (
              <li key={k} className="min-w-0 flex-1" style={{ opacity: k <= i ? 1 : 0.3 }}>
                <Pixels img={frames[k].x} label={`step ${k}`} />
              </li>
            ))}
          </ol>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
              <dt className="text-[11px] text-[var(--muted)]">of “{label}” in the final image</dt>
              <dd className="font-mono text-base">{pct(final.match)}</dd>
            </div>
            <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
              <dt className="text-[11px] text-[var(--muted)]">shading crushed to black or white</dt>
              <dd className="font-mono text-base">{pct(final.clipped)}</dd>
            </div>
          </dl>
        </section>
      }
      panel={
        <SystemMapPanel caption={caption}>
          <div className="w-full">
            <Choices label="Prompt" accent={ACCENT} value={prompt} onChange={props.setPrompt} options={PROMPTS.map((p) => ({ id: p.id, label: p.label }))} />
          </div>
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${i} of ${steps}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Encode the prompt" what="A text encoder turns the prompt into vectors. Every denoising step reads them, so the prompt steers the whole process." accent={ACCENT} active={false}>
            <p className="font-mono text-sm">“{label}” → prompt vectors</p>
          </FlowStep>
          <FlowArrow label="prompt vectors" accent={ACCENT} />

          <FlowStep n={2} title="Start from pure noise" what="Random noise, from a seed. The same seed and settings give the same picture; a new seed gives a new one." accent={ACCENT} active={active === 2}>
            <p className="font-mono text-xs">x at t = {T - 1}: random Gaussian noise, seed 7</p>
          </FlowStep>
          <FlowArrow label="noisy image" accent={ACCENT} />

          <FlowStep n={3} title="Guess the clean picture" what="The model predicts the noise, which gives a guess of the clean picture. Guidance makes two guesses, with and without the prompt, and pushes past the difference: uncond + g × (cond − uncond)." accent={ACCENT} active={false}>
            <Choices label="Guidance scale" accent={ACCENT} value={String(guidance)} onChange={(v) => props.setGuidance(Number(v))} options={GUIDANCE_CHOICES.map((g) => ({ id: String(g), label: String(g) }))} />
            <p className="mt-2 text-xs text-[var(--muted)]">Too low: faint and generic. Too high: harsh, with the shading crushed. This toy&rsquo;s scale is tuned so 7 looks right, like many real models&rsquo; defaults.</p>
          </FlowStep>
          <FlowArrow label="guess" accent={ACCENT} />

          <FlowStep n={4} title="Remove some noise, repeat" what="Move part of the way from the noisy image toward the guess, to a slightly less noisy step. Then guess again from there. Each guess is made through less noise, so it can show more detail." accent={ACCENT} active={active === 4}>
            <Choices label="Steps" accent={ACCENT} value={String(steps)} onChange={(v) => props.setSteps(Number(v))} options={STEP_CHOICES.map((n) => ({ id: String(n), label: String(n) }))} />
            <p className="mt-2 text-xs text-[var(--muted)]">More steps cost more time (one model call each) but get detail right. Few steps leave the final guess blurry.</p>
          </FlowStep>
          <FlowArrow label="clean image" accent={ACCENT} />

          <FlowStep n={5} title="Decode to pixels" what="Most models, like Stable Diffusion, denoise a small compressed image (a latent, 64 × 64 for a 512 × 512 picture), and a decoder turns it into full pixels at the end. This toy denoises the pixels directly." accent={ACCENT} active={active === 5}>
            <p className="font-mono text-sm">
              {SIZE} × {SIZE} pixels · {steps} model {steps === 1 ? "call" : "calls"}
            </p>
            <p className="mt-2 text-xs text-[var(--faint)]">The noise schedule and the update are the real DDIM ones. The trained network is replaced by an oracle that knows each prompt&rsquo;s picture and, like a real model, sees less detail through more noise.</p>
          </FlowStep>
        </>
      }
    />
  );
}

// Up to 8 evenly spaced frames for the strip.
function thumbs(n: number): number[] {
  const k = Math.min(8, n);
  return Array.from({ length: k }, (_, j) => Math.round((j * (n - 1)) / Math.max(1, k - 1)));
}

function Pixels({ img, label }: { img: Img; label: string }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block w-full rounded border border-[var(--line)]" role="img" aria-label={label} shapeRendering="crispEdges">
      {img.map((v, k) => {
        const p = Math.round(Math.max(0, Math.min(1, (v + 1) / 2)) * 100);
        return <rect key={k} x={k % SIZE} y={Math.floor(k / SIZE)} width={1} height={1} fill={`color-mix(in srgb, var(--text) ${p}%, var(--inset))`} />;
      })}
    </svg>
  );
}
