"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DATA, NEW_ORDERS, SHAPES, SIZES, START, fit, fmt, mae, predict, type Params, type ShapeId } from "@/lib/whatIsAModel";

const ACCENT = "var(--ai)";

export default function WhatIsAModelDemo() {
  const [shape, setShape] = useState<ShapeId>("line");
  const [p, setP] = useState<Params>(START);
  const { stage, busy, run } = useWalk(5, 1100);
  const s = SHAPES.find((x) => x.id === shape)!;
  const best = fit(shape);
  const err = mae(shape, p);
  const bestErr = mae(shape, best);
  const fitted = shape === "table" || Math.abs(err - bestErr) < 0.01;
  const at = (i: number) => stage === i;
  const set = (k: keyof Params, v: number) => setP((cur) => ({ ...cur, [k]: v }));

  const pick = (id: ShapeId) => {
    setShape(id);
    setP(START);
  };

  const captions = [
    `Step 1: ${DATA.length} past orders, distance in and time out.`,
    `Step 2: ${s.label.toLowerCase()}: ${s.formula}. ${s.params ? `${s.params} parameters to set.` : "Nothing to set: it keeps every order."}`,
    `Step 3: with these parameters the model is off by ${err.toFixed(1)} minutes per order on average.`,
    fitted ? "Step 4: these are the parameters the data picks: the error can't go lower for this shape." : `Step 4: the data would pick a = ${best.a.toFixed(1)}, b = ${best.b.toFixed(2)}${shape === "curve" ? `, c = ${best.c.toFixed(3)}` : ""}, for an error of ${bestErr.toFixed(1)} minutes.`,
    `Step 5: a ${NEW_ORDERS[0]} km order → ${predict(shape, p, NEW_ORDERS[0]).toFixed(0)} minutes; a ${NEW_ORDERS[1]} km order → ${predict(shape, p, NEW_ORDERS[1]).toFixed(0)} minutes.`,
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : shape === "table"
        ? `The table is never wrong on the orders it has seen, and has no idea about a ${NEW_ORDERS[1]} km order: it answers with the ${DATA.at(-1)!.x} km one.`
        : fitted
          ? `Fitted: off by ${err.toFixed(1)} minutes per order. Predicts ${predict(shape, p, NEW_ORDERS[0]).toFixed(0)} minutes for ${NEW_ORDERS[0]} km, an order it never saw.`
          : `Off by ${err.toFixed(1)} minutes per order. Drag the parameters in step 3, or press Fit in step 4.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="What a model is"
        blurb="A model is a function with knobs: an input goes in, a prediction comes out, and the knobs, the parameters, decide which. Training is letting the data set the knobs. Fit a delivery-time model by hand, then let the data do it, and see what each shape says about an order it has never seen."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Past orders and the model's predictions">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {s.label} · {s.formula}
                </p>
                <p className="font-mono text-sm" style={{ color: err < 1.5 ? "var(--good)" : "var(--text)" }}>
                  off by {err.toFixed(1)} min
                </p>
              </div>
              <Chart shape={shape} p={p} />
              <p className="mt-2 text-xs text-[var(--muted)]">
                Dots: past orders, in minutes. Line: what the model predicts at every distance. Hollow: the new orders at {NEW_ORDERS[0]} and {NEW_ORDERS[1]} km.
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Model shape" accent={ACCENT} value={shape} onChange={pick} options={SHAPES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Predicting…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Collect examples" what="Inputs with the answers you want. Here: how far an order went, and how long it took." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">{DATA.map((d) => `${d.x} km → ${d.y} min`).join(" · ")}</p>
              </FlowStep>
              <FlowArrow label={`${DATA.length} examples`} accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Choose a shape" what="The shape fixes the kind of answer the model can give and how many parameters it has. The data can only tune the parameters, not change the shape." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-sm">{s.formula}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {s.params ? `${s.params} parameters: ${shape === "line" ? "a and b" : "a, b and c"}.` : "No parameters. It stores all 12 orders and answers with the nearest one."}
                </p>
              </FlowStep>
              <FlowArrow label={s.params ? `${s.params} parameters` : "12 stored orders"} accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Set the parameters" what="Every setting is a different model. Drag them and watch the predictions and the error move." accent={ACCENT} active={at(2)}>
                {shape === "table" ? (
                  <p className="text-sm text-[var(--muted)]">Nothing to set.</p>
                ) : (
                  <div className="space-y-2">
                    <Slider label="a (minutes at 0 km)" value={p.a} min={0} max={40} step={0.5} format={(v) => v.toFixed(1)} accent={ACCENT} onChange={(v) => set("a", v)} />
                    <Slider label="b (minutes per km)" value={p.b} min={0} max={8} step={0.05} format={(v) => v.toFixed(2)} accent={ACCENT} onChange={(v) => set("b", v)} />
                    {shape === "curve" && <Slider label="c (minutes per km²)" value={p.c} min={-0.5} max={0.5} step={0.005} format={(v) => v.toFixed(3)} accent={ACCENT} onChange={(v) => set("c", v)} />}
                  </div>
                )}
                <p className="mt-2 font-mono text-xs">average error: {err.toFixed(2)} min</p>
              </FlowStep>
              <FlowArrow label="predictions" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Let the data set them" what="Training searches for the parameters with the smallest error on the examples. For a line that's one formula; for a neural network it's gradient descent, one small nudge at a time." accent={ACCENT} active={at(3)}>
                {shape === "table" ? (
                  <p className="text-sm text-[var(--muted)]">Already perfect on the examples: it just remembers them. That is not the same as understanding them.</p>
                ) : (
                  <>
                    <RunButton busy={false} onClick={() => setP(best)} accent={ACCENT}>
                      Fit to the data
                    </RunButton>
                    <p className="mt-2 font-mono text-xs">
                      best: a = {best.a.toFixed(2)}, b = {best.b.toFixed(2)}
                      {shape === "curve" ? `, c = ${best.c.toFixed(4)}` : ""} · error {bestErr.toFixed(2)} min
                    </p>
                    {shape === "curve" && <p className="mt-1 text-xs text-[var(--muted)]">c comes out almost zero: the data is straight, so the extra parameter has nothing to do.</p>}
                  </>
                )}
              </FlowStep>
              <FlowArrow label="a new order" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Predict for an input it never saw" what="The point of a model is the next order, not the old ones. A shape with the right idea in it (time grows with distance) can answer beyond its examples; a table can only repeat them." accent={ACCENT} active={at(4)}>
                <ul className="space-y-0.5 font-mono text-sm">
                  {NEW_ORDERS.map((x) => (
                    <li key={x}>
                      {x} km → {predict(shape, p, x).toFixed(0)} min
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm font-medium">How many parameters</p>
                <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
                  {SIZES.map((z) => (
                    <li key={z.label} className="flex justify-between gap-2">
                      <span>{z.label}</span>
                      <span className="font-mono">{fmt(z.params)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-[var(--faint)]">An LLM is the same idea: a fixed shape (the transformer) with billions of knobs, set by the data.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Chart({ shape, p }: { shape: ShapeId; p: Params }) {
  const W = 320;
  const H = 180;
  const pad = { l: 34, r: 10, t: 10, b: 26 };
  const maxX = 21;
  const maxY = 100;
  const x = (v: number) => pad.l + (v / maxX) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - Math.max(0, Math.min(maxY, v)) / maxY) * (H - pad.t - pad.b);
  const xs = Array.from({ length: 85 }, (_, i) => (i * maxX) / 84);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Delivery time against distance, with the model's predictions">
      {[0, 50, 100].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={0.6} />
          <text x={pad.l - 5} y={y(t) + 3} textAnchor="end" fontSize={8} fill="var(--faint)">
            {t}
          </text>
        </g>
      ))}
      {[0, 5, 10, 15, 20].map((t) => (
        <text key={t} x={x(t)} y={H - 12} textAnchor="middle" fontSize={8} fill="var(--faint)">
          {t}
        </text>
      ))}
      <text x={(pad.l + W - pad.r) / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--faint)">
        km
      </text>
      <polyline points={xs.map((v) => `${x(v)},${y(predict(shape, p, v))}`).join(" ")} fill="none" stroke={ACCENT} strokeWidth={1.8} />
      {DATA.map((d) => (
        <g key={d.x}>
          <line x1={x(d.x)} x2={x(d.x)} y1={y(d.y)} y2={y(predict(shape, p, d.x))} stroke="var(--bad)" strokeWidth={0.8} opacity={0.6} />
          <circle cx={x(d.x)} cy={y(d.y)} r={2.6} fill="var(--text)" />
        </g>
      ))}
      {NEW_ORDERS.map((v) => (
        <circle key={v} cx={x(v)} cy={y(predict(shape, p, v))} r={3} fill="var(--panel)" stroke={ACCENT} strokeWidth={1.5} />
      ))}
    </svg>
  );
}
