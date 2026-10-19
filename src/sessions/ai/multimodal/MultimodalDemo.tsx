"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PATCH, PICTURES, READABLE_PX, TIERS, encodeImage, wordsFor, type Picture, type TierId } from "@/lib/multimodal";

const ACCENT = "var(--ai)";
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export default function MultimodalDemo() {
  const [picId, setPicId] = useState("receipt");
  const [tier, setTier] = useState<TierId>("standard");
  const [cropped, setCropped] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const pic = PICTURES.find((p) => p.id === picId)!;
  const crop = cropped && !!pic.crop;
  const r = encodeImage(pic, tier, crop);
  const src = crop && pic.crop ? pic.crop : { x: 0, y: 0, w: pic.w, h: pic.h };
  const at = (i: number) => stage === i;
  const lost = r.details.filter((d) => d.kept && !d.readable);
  const t = TIERS.find((x) => x.id === tier)!;

  const choosePic = (id: string) => {
    setPicId(id);
    setCropped(false);
  };

  const captions = [
    `Step 1: a ${src.w}×${src.h} image${crop ? ", cropped," : ""} goes in with the question.`,
    r.scale < 1 ? `Step 2: too big for the ${t.label.toLowerCase()} limits, so it is shrunk to ${r.w}×${r.h}.` : "Step 2: within the limits, so it is sent as is.",
    `Step 3: ${r.cols} × ${r.rows} patches of ${PATCH}×${PATCH} pixels = ${r.tokens.toLocaleString("en-US")} tokens.`,
    `Step 4: those ${r.tokens.toLocaleString("en-US")} image tokens sit in the prompt like about ${wordsFor(r.tokens).toLocaleString("en-US")} words of text.`,
    lost.length ? `Step 5: ${lost.map((d) => lowerFirst(d.label)).join(" and ")} ended up under ${READABLE_PX} px tall: the model will likely guess.` : "Step 5: every detail the question needs is still big enough to read.",
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : `${r.tokens.toLocaleString("en-US")} tokens. ${lost.length ? `Lost: ${lost.map((d) => lowerFirst(d.label)).join(", ")}.` : "Everything needed is readable."} ${pic.crop && !crop && lost.length ? `Try “${pic.crop.label.toLowerCase()}” in step 1.` : ""}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Multimodal models"
        blurb="A model reads an image the way it reads text: as tokens. The image is shrunk to fit the model's limits, cut into small square patches, and each patch becomes one token. Send a receipt, a dashboard and a product photo, and see what that costs and which details survive."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The image, the patch grid the model sees, and which details are still readable">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {src.w}×{src.h} → {r.w}×{r.h}
                </p>
                <p className="font-mono text-sm">{r.tokens.toLocaleString("en-US")} tokens</p>
              </div>
              <div className="mx-auto mt-3" style={{ maxWidth: src.w >= src.h ? "100%" : `${Math.round((src.w / src.h) * 100)}%` }}>
                <Scene pic={pic} view={src} cols={r.cols} rows={r.rows} readable={Object.fromEntries(r.details.map((d) => [d.label, d.readable]))} />
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {r.details.map((d) => (
                  <li key={d.label} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0">
                      {d.label} <span className="text-xs text-[var(--faint)]">“{d.question}”</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs" style={{ color: !d.kept ? "var(--faint)" : d.readable ? "var(--good)" : "var(--bad)" }}>
                      {!d.kept ? "cropped out" : `${d.px} → ${d.after.toFixed(1)} px ${d.readable ? "✓" : "✗"}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Model tier" accent={ACCENT} value={tier} onChange={setTier} options={TIERS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Encoding…">
                Send the image
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Send the image with a question" what="Phone photos are huge: 12 megapixels and more. Most of that resolution is thrown away. Cropping to the part that matters keeps the detail you need." accent={ACCENT} active={at(0)}>
                <Choices accent={ACCENT} value={pic.id} onChange={choosePic} options={PICTURES.map((p) => ({ id: p.id, label: p.label }))} />
                {pic.crop && (
                  <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" checked={cropped} onChange={(e) => setCropped(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                    {pic.crop.label}
                  </label>
                )}
              </FlowStep>
              <FlowArrow label={`${src.w}×${src.h} px`} accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Shrink it to the limits" what="Each model has a longest-edge limit and a token limit. Bigger images are scaled down, keeping their shape, until both fit." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  {t.label}: long edge ≤ {t.maxEdge.toLocaleString("en-US")} px, ≤ {t.maxTokens.toLocaleString("en-US")} tokens
                </p>
                <p className="mt-1 font-mono text-sm">
                  {src.w}×{src.h} → {r.w}×{r.h} ({Math.round(r.scale * 100)}%)
                </p>
              </FlowStep>
              <FlowArrow label={`${r.w}×${r.h} px`} accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Cut it into patches" what={`The model's vision encoder looks at ${PATCH}×${PATCH} pixel squares. Each square becomes one token.`} accent={ACCENT} active={at(2)}>
                <p className="font-mono text-sm">
                  ⌈{r.w}/{PATCH}⌉ × ⌈{r.h}/{PATCH}⌉ = {r.cols} × {r.rows} = {r.tokens.toLocaleString("en-US")}
                </p>
              </FlowStep>
              <FlowArrow label={`${r.tokens.toLocaleString("en-US")} image tokens`} accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Put them in the prompt" what="Each patch becomes a vector in the same space as word tokens, and joins the text in one sequence. Attention then relates the question's words to the right patches." accent={ACCENT} active={at(3)}>
                <p className="text-sm">
                  You pay for these like input tokens: this image costs as much as about {wordsFor(r.tokens).toLocaleString("en-US")} words of text.
                </p>
              </FlowStep>
              <FlowArrow label="image + text tokens" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Answer from what survived" what={`Detail far smaller than a patch blurs into its neighbours. As a rule of thumb, text under about ${READABLE_PX} px tall after shrinking is a guess.`} accent={ACCENT} active={at(4)}>
                <ul className="space-y-1 text-sm">
                  {r.details.map((d) => (
                    <li key={d.label} style={{ color: !d.kept ? "var(--faint)" : d.readable ? "var(--text)" : "var(--bad)" }}>
                      {d.question} {!d.kept ? "(cropped out)" : d.readable ? "✓" : "✗ likely wrong"}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-[var(--muted)]">Limits and the {PATCH}-pixel patch follow Anthropic&rsquo;s vision docs; other providers use similar tiling with their own sizes.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

// A schematic of each picture in its own pixel coordinates, with the patch grid on top.
function Scene({ pic, view, cols, rows, readable }: { pic: Picture; view: { x: number; y: number; w: number; h: number }; cols: number; rows: number; readable: Record<string, boolean> }) {
  const ink = (label: string) => (readable[label] === undefined ? "var(--muted)" : readable[label] ? "var(--good)" : "var(--bad)");
  const stepX = view.w / cols;
  const stepY = view.h / rows;

  return (
    <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="w-full rounded-md border border-[var(--line)] bg-[var(--inset)]" role="img" aria-label={`${pic.label}, cut into ${cols} by ${rows} patches`}>
      {pic.id === "receipt" && (
        <g>
          <rect x={300} y={200} width={2424} height={3700} fill="var(--panel)" />
          <rect x={900} y={420} width={1224} height={120} rx={20} fill="var(--muted)" />
          {Array.from({ length: 9 }, (_, i) => (
            <g key={i}>
              <rect x={520} y={900 + i * 150} width={1300 - (i % 3) * 200} height={48} fill={ink("Item names")} />
              <rect x={2100} y={900 + i * 150} width={360} height={48} fill={ink("Item names")} />
            </g>
          ))}
          <rect x={520} y={2950} width={700} height={64} fill={ink("Total")} />
          <rect x={1960} y={2950} width={500} height={64} fill={ink("Total")} />
          {Array.from({ length: 4 }, (_, i) => (
            <rect key={i} x={520} y={3420 + i * 60} width={1900 - i * 260} height={24} fill={ink("VAT number in the fine print")} />
          ))}
        </g>
      )}
      {pic.id === "dashboard" && (
        <g>
          <rect x={0} y={0} width={1920} height={90} fill="var(--panel)" />
          {[40, 680, 1320].map((x, i) => (
            <g key={x}>
              <rect x={x} y={160} width={560} height={28} fill={ink("Chart titles")} />
              <rect x={x} y={560} width={560} height={400} fill="var(--panel)" />
              <polyline
                points={Array.from({ length: 8 }, (_, k) => `${x + 60 + k * 64},${900 - (k * (i + 1) * 30) % 280 - k * 20}`).join(" ")}
                fill="none"
                stroke={ink("Line going up or down")}
                strokeWidth={10}
              />
              {Array.from({ length: 5 }, (_, k) => (
                <rect key={k} x={x + 8} y={600 + k * 70} width={36} height={12} fill={ink("Axis numbers")} />
              ))}
            </g>
          ))}
        </g>
      )}
      {pic.id === "product" && (
        <g>
          <circle cx={500} cy={500} r={300} fill="var(--panel)" stroke={ink("What the object is")} strokeWidth={14} />
          <line x1={420} y1={380} x2={560} y2={460} stroke={ink("A small scratch")} strokeWidth={14} />
        </g>
      )}
      <g stroke="var(--ai)" strokeOpacity={0.35} strokeWidth={view.w / 600}>
        {Array.from({ length: cols - 1 }, (_, i) => (
          <line key={`c${i}`} x1={view.x + (i + 1) * stepX} x2={view.x + (i + 1) * stepX} y1={view.y} y2={view.y + view.h} />
        ))}
        {Array.from({ length: rows - 1 }, (_, i) => (
          <line key={`r${i}`} y1={view.y + (i + 1) * stepY} y2={view.y + (i + 1) * stepY} x1={view.x} x2={view.x + view.w} />
        ))}
      </g>
    </svg>
  );
}
