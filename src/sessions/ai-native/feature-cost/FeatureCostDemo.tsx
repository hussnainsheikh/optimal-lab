"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, Slider } from "@/components/session/ui";
import { cost, MODELS } from "@/lib/featureCost";

const ACCENT = "var(--native)";
const USERS = [1000, 10000, 50000, 200000, 1000000];
const money = (x: number) => (x >= 1000 ? `$${Math.round(x).toLocaleString()}` : x >= 1 ? `$${x.toFixed(2)}` : `$${x.toFixed(4)}`);

export default function FeatureCostDemo() {
  const [ui, setUi] = useState(1);
  const [perUser, setPerUser] = useState(5);
  const [inTok, setInTok] = useState(2000);
  const [outTok, setOutTok] = useState(400);
  const [model, setModel] = useState("mid");
  const [cache, setCache] = useState(0);
  const c = cost({ users: USERS[ui], perUser, inTok, outTok, model, cacheHit: cache / 100 });
  return (
    <SessionPage>
      <SessionHeader kicker="AI Native · interactive" title="What an AI feature costs" blurb="Every call is billed by tokens in and tokens out, and output tokens cost several times more. Size your feature before launch: users, calls per user, prompt length, answer length and model. Prices are examples per million tokens." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Monthly cost">
              <p className="text-xs text-[var(--faint)]">per month</p>
              <p className="font-mono text-4xl" style={{ color: ACCENT }}>{money(c.total)}</p>
              <p className="mt-1 font-mono text-xs text-[var(--muted)]">{c.reqs.toLocaleString()} requests · {money(c.perReq)} each · {money(c.perUser)} per user</p>
              <div className="mt-4 flex h-5 overflow-hidden rounded bg-[var(--track)]">
                <span style={{ width: `${(c.inputCost / c.total) * 100}%`, background: "var(--c1)" }} />
                <span style={{ width: `${(c.outputCost / c.total) * 100}%`, background: ACCENT }} />
              </div>
              <p className="mt-1 flex justify-between text-xs text-[var(--muted)]"><span>input {money(c.inputCost)}</span><span>output {money(c.outputCost)}</span></p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Same feature, other models</p>
              <ul className="mt-1 space-y-1 font-mono text-xs">{MODELS.map((m) => <li key={m.id} className="flex justify-between" style={{ color: m.id === model ? ACCENT : "var(--muted)" }}><span>{m.label} (${m.inP} in / ${m.outP} out)</span><span>{money(cost({ users: USERS[ui], perUser, inTok, outTok, model: m.id, cacheHit: cache / 100 }).total)}</span></li>)}</ul>
            </section>
          }
          panel={
            <SystemMapPanel caption={`If ${c.perUser < 1 ? "a user pays 0 a month, this is small" : `each user costs ${money(c.perUser)} a month, check that against what they pay`}. Output is ${Math.round((c.outputCost / c.total) * 100)}% of the bill.`}>
              <Slider label="Daily users" accent={ACCENT} value={ui} min={0} max={USERS.length - 1} step={1} format={(i) => USERS[i].toLocaleString()} onChange={setUi} />
              <Slider label="Calls per user per day" accent={ACCENT} value={perUser} min={1} max={50} step={1} format={String} onChange={setPerUser} />
              <Slider label="Input tokens per call" accent={ACCENT} value={inTok} min={200} max={20000} step={200} format={(v) => v.toLocaleString()} onChange={setInTok} />
              <Slider label="Output tokens per call" accent={ACCENT} value={outTok} min={50} max={2000} step={50} format={String} onChange={setOutTok} />
              <Slider label="Prompt cache hit rate" accent={ACCENT} value={cache} min={0} max={90} step={10} format={(v) => `${v}%`} onChange={setCache} />
              <Choices label="Model" accent={ACCENT} value={model} onChange={setModel} options={MODELS.map((m) => ({ id: m.id, label: m.label }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Tokens in, tokens out" what="Cost = calls × (input tokens × input price + output tokens × output price). System prompts and retrieved context count as input every time." accent={ACCENT}><p className="text-sm text-[var(--muted)]">~4 characters per token in English.</p></FlowStep>
              <FlowArrow label="biggest lever" accent={ACCENT} />
              <FlowStep n={2} title="Model choice moves cost 10–50×" what="Use the smallest model that passes your evals; route only hard requests to a big one." accent={ACCENT}><p className="text-sm text-[var(--muted)]">See the model routers session.</p></FlowStep>
              <FlowArrow label="then" accent={ACCENT} />
              <FlowStep n={3} title="Trim and cache" what="Shorter prompts, fewer retrieved chunks, capped output length, and prompt caching for the repeated prefix." accent={ACCENT} active={cache > 0}><p className="text-sm text-[var(--muted)]">Cached input is billed at a fraction.</p></FlowStep>
              <FlowArrow label="finally" accent={ACCENT} />
              <FlowStep n={4} title="Per-user unit economics" what="Compare cost per active user with revenue per user, and set per-user limits so a few heavy users can't sink the margin." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Log tokens per request from day one.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
