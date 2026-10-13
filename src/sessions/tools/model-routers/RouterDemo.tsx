"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { MODELS, POLICIES, run, type ModelId, type Policy } from "@/lib/modelRouter";

const ACCENT = "var(--tools)";
const COLOR: Record<ModelId, string> = { big: "var(--c1)", alt: "var(--c2)", small: "var(--c3)" };

export default function RouterDemo() {
  const [policy, setPolicy] = useState<Policy>("fallback");
  const r = run(policy);
  const caption = policy === "single" ? `Provider A goes down for requests 4–7, and so does your app: ${r.errors} failed requests.`
    : policy === "fallback" ? `When A fails, the router retries on provider B. No errors, but B costs more: ${r.cost} credits.`
    : `Easy requests go to a small model, hard ones to the big model with B as backup. No errors, and only ${r.cost} credits.`;
  return (
    <SessionPage>
      <SessionHeader kicker="Tools · interactive" title="Model routers" blurb="A router sits between your app and many model providers behind one API. It can fall back when a provider is down and pick a cheaper model when the task is easy. Twelve requests; provider A has an outage in the middle." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Where each request was served">
              <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {r.rows.map((x) => (
                  <li key={x.i} className="rounded-md border p-1.5 text-center text-[11px]" style={{ borderColor: x.served ? COLOR[x.served] : "var(--bad)", background: "var(--inset)" }}>
                    <span className="block font-mono text-[var(--faint)]">#{x.i + 1} {x.kind}</span>
                    <span className="block font-mono" style={{ color: x.served ? COLOR[x.served] : "var(--bad)" }}>{x.served ? x.served : "error"}</span>
                    {x.tried.length > 1 && <span className="block text-[10px] text-[var(--faint)]">after {x.tried.length - 1} fail</span>}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]"><span className="h-2 w-8 rounded bg-[var(--bad)]" /> provider A down for #4–#7</div>
              <ul className="mt-3 space-y-1 text-xs">
                {(Object.keys(MODELS) as ModelId[]).map((m) => <li key={m} className="flex justify-between"><span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLOR[m] }} />{m}: {MODELS[m].label}</span><span className="font-mono">{MODELS[m].price} credits</span></li>)}
              </ul>
              <p className="mt-3 font-mono text-sm">{r.errors} errors · {r.cost} credits</p>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Choices label="Routing" accent={ACCENT} value={policy} onChange={setPolicy} options={POLICIES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="One API, many models" what="Your app calls one endpoint with a model name. The router handles each provider's keys and formats." accent={ACCENT}><p className="font-mono text-xs">model: &quot;provider-a/big&quot;</p></FlowStep>
              <FlowArrow label="provider fails" accent={ACCENT} />
              <FlowStep n={2} title="Fall back automatically" what="On a 5xx, timeout or rate limit, retry the same request on the next model in the list." accent={ACCENT} active={policy !== "single"}><p className="font-mono text-xs">models: [&quot;a/big&quot;, &quot;b/big&quot;]</p></FlowStep>
              <FlowArrow label="pick per request" accent={ACCENT} />
              <FlowStep n={3} title="Route by difficulty or cost" what="Send classification and short answers to a small model, reasoning to a big one. Test that the small model is good enough first." accent={ACCENT} active={policy === "cost"}><p className="text-sm text-[var(--muted)]">Often most of the savings.</p></FlowStep>
              <FlowArrow label="watch it" accent={ACCENT} />
              <FlowStep n={4} title="Log which model answered" what="Fallbacks change output quality and cost. Record the model used per request so evals and bills make sense." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Pin versions where behaviour matters.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
