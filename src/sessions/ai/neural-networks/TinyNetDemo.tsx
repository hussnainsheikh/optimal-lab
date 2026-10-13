"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CASES, forward, NET, single } from "@/lib/tinyNet";

const ACCENT = "var(--ai)";

export default function TinyNetDemo() {
  const [inp, setInp] = useState("1,0");
  const [x1, x2] = inp.split(",").map(Number);
  const r = forward(x1, x2);
  const node = (x: number, y: number, label: string, val: string, on: boolean) => (
    <g>
      <circle cx={x} cy={y} r="24" fill={on ? ACCENT : "var(--inset)"} stroke="var(--line-strong)" />
      <text x={x} y={y + 4} fontSize="13" textAnchor="middle" fill={on ? "var(--on-accent)" : "var(--text)"} className="font-mono">{val}</text>
      <text x={x} y={y + 40} fontSize="10" textAnchor="middle" fill="var(--muted)">{label}</text>
    </g>
  );
  const edge = (x1_: number, y1: number, x2_: number, y2: number, w: number) => (
    <g><line x1={x1_ + 24} y1={y1} x2={x2_ - 24} y2={y2} stroke={w < 0 ? "var(--bad)" : "var(--good)"} strokeWidth={1 + Math.abs(w)} /><text x={(x1_ + x2_) / 2} y={(y1 + y2) / 2 - 5} fontSize="11" textAnchor="middle" fill="var(--muted)" className="font-mono">{w}</text></g>
  );
  return (
    <SessionPage>
      <SessionHeader kicker="AI · interactive" title="A neural network, by hand" blurb="Each neuron multiplies its inputs by weights, adds a bias, and passes the result through an activation (here ReLU: negatives become 0). XOR, “one or the other but not both”, is impossible for one neuron but easy for two layers. Weights are hand-picked so you can check the maths." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Network">
              <svg viewBox="0 0 380 230" className="w-full">
                {NET.hidden.map((h, j) => <g key={j}>{edge(50, 60, 190, 60 + j * 110, h.w[0])}{edge(50, 170, 190, 60 + j * 110, h.w[1])}</g>)}
                {edge(190, 60, 330, 115, NET.out.w[0])}{edge(190, 170, 330, 115, NET.out.w[1])}
                {node(50, 60, "x1", String(x1), x1 > 0)}{node(50, 170, "x2", String(x2), x2 > 0)}
                {NET.hidden.map((h, j) => <g key={j}>{node(190, 60 + j * 110, `${h.label} · bias ${h.b}`, String(r.h[j].a), r.h[j].a > 0)}</g>)}
                {node(330, 115, "output", String(r.y), r.y > 0)}
              </svg>
              <p className="mt-2 font-mono text-xs">h1 = relu({x1} + {x2} + 0) = {r.h[0].a} · h2 = relu({x1} + {x2} − 1) = {r.h[1].a} · y = {r.h[0].a} − 2×{r.h[1].a} = <b style={{ color: ACCENT }}>{r.y}</b></p>
              <table className="mt-4 w-full font-mono text-xs">
                <thead><tr className="text-left text-[var(--faint)]"><th className="font-normal">x1 x2</th><th className="font-normal">XOR</th><th className="font-normal">2-layer net</th><th className="font-normal">best single neuron</th></tr></thead>
                <tbody>{CASES.map(([a, b]) => { const t = a ^ b, n = forward(a, b).y, s = single(a, b); return <tr key={`${a}${b}`} style={{ background: `${a},${b}` === inp ? "var(--inset)" : undefined }}><td className="py-0.5">{a} {b}</td><td>{t}</td><td style={{ color: n === t ? "var(--good)" : "var(--bad)" }}>{n}</td><td style={{ color: s === t ? "var(--good)" : "var(--bad)" }}>{s}</td></tr>; })}</tbody>
              </table>
            </section>
          }
          panel={<SystemMapPanel caption={`Hidden neuron 1 fires if either input is on (OR); neuron 2 only if both are (AND). The output is OR minus twice AND: on for exactly one input. A single neuron draws one straight line and can't separate XOR's cases.`}><Choices label="Inputs (x1, x2)" accent={ACCENT} value={inp} onChange={setInp} options={["0,0", "0,1", "1,0", "1,1"].map((x) => ({ id: x, label: x }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="A neuron is a weighted sum" what="Multiply each input by a weight, add a bias. Positive weights excite, negative ones inhibit." accent={ACCENT}><p className="font-mono text-xs">z = w1·x1 + w2·x2 + b</p></FlowStep>
              <FlowArrow label="bend it" accent={ACCENT} />
              <FlowStep n={2} title="An activation adds the bend" what="Without a non-linearity, stacking layers is still one straight line. ReLU, max(0, z), is the usual choice." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Bends let networks carve up the input space.</p></FlowStep>
              <FlowArrow label="stack layers" accent={ACCENT} />
              <FlowStep n={3} title="Layers build features" what="The hidden layer computes useful intermediate features (OR, AND); the next layer combines them." accent={ACCENT} active><p className="text-sm text-[var(--muted)]">LLMs do this with billions of weights.</p></FlowStep>
              <FlowArrow label="learning" accent={ACCENT} />
              <FlowStep n={4} title="Training finds the weights" what="Here they're picked by hand. Real networks start random and adjust weights by gradient descent to reduce the loss." accent={ACCENT}><p className="text-sm text-[var(--muted)]">See the training loss session.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
