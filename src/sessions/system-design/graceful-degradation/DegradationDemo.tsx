"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { DEPS, render, type DepId } from "@/lib/degradation";

const ACCENT = "var(--sys)";
const TEXT: Record<string, { ok: string; fallback: string }> = {
  price: { ok: "$34.00 (your member price)", fallback: "$40.00" },
  reviews: { ok: "★ 4.6 · 1,204 reviews", fallback: "★ 4.6 · 1,198 reviews (cached)" },
  recs: { ok: "You may also like: shade, bulb, stand", fallback: "" },
  stock: { ok: "7 left in stock", fallback: "In stock" },
};

export default function DegradationDemo() {
  const [down, setDown] = useState<Set<DepId>>(new Set(["recs", "price"]));
  const [fb, setFb] = useState("yes");
  const r = render(down, fb === "yes");
  const toggle = (id: DepId) => setDown((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Graceful degradation" blurb="A product page calls five services. Only one of them is essential. If the page fails whenever any of them fails, it's only as reliable as the weakest. With timeouts and fallbacks, a broken recommendations service just means no recommendations." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Product page">
              <div className="rounded-lg border border-[var(--line)] bg-[var(--inset)] p-4" style={{ borderColor: r.status === 200 ? "var(--line)" : "var(--bad)" }}>
                {r.status !== 200 ? (
                  <div className="py-8 text-center"><p className="font-mono text-2xl text-[var(--bad)]">{r.status}</p><p className="text-sm text-[var(--muted)]">{r.status === 503 ? "Product unavailable" : "Something went wrong"}{r.ms > 10000 ? " (after waiting 30 s for a timeout)" : ""}</p></div>
                ) : (
                  <>
                    <p className="text-lg font-semibold">Brass desk lamp</p>
                    {r.sections.map((sct) => sct.state === "hidden" ? null : <p key={sct.id} className="mt-1 text-sm" style={{ color: sct.state === "fallback" ? "var(--auto)" : undefined }}>{TEXT[sct.id][sct.state === "ok" ? "ok" : "fallback"]}</p>)}
                    <span className="mt-3 inline-block rounded px-3 py-1 text-sm" style={{ background: ACCENT, color: "var(--on-accent)" }}>Add to cart</span>
                  </>
                )}
              </div>
              <p className="mt-2 font-mono text-xs text-[var(--muted)]">HTTP {r.status} · {r.ms >= 1000 ? `${r.ms / 1000} s` : `${r.ms} ms`} · amber = fallback content</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={down.has("catalog") ? "Without the product itself there's nothing to show: that dependency really is critical." : fb === "no" && down.size ? "One optional service failed and took the whole page with it, after a long wait." : down.size ? "Each failed optional service is replaced by a sensible fallback. The customer can still buy." : "Everything healthy."}>
              <div className="w-full space-y-1.5">
                {DEPS.map((d) => <label key={d.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[var(--line)] px-2 text-sm"><input type="checkbox" checked={down.has(d.id)} onChange={() => toggle(d.id)} style={{ accentColor: "var(--bad)" }} /><span className="flex-1">{d.label} {d.critical && <span className="text-xs text-[var(--faint)]">(critical)</span>}</span><span className="text-[11px] text-[var(--muted)]">{down.has(d.id) ? "down" : "up"}</span></label>)}
              </div>
              <Choices label="Timeouts + fallbacks" accent={ACCENT} value={fb} onChange={setFb} options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Sort dependencies by importance" what="Which ones can the page not live without? Usually far fewer than it calls." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Availability multiplies across hard dependencies.</p></FlowStep>
              <FlowArrow label="bound the wait" accent={ACCENT} />
              <FlowStep n={2} title="Short timeouts on optional calls" what="A slow dependency is worse than a dead one: it ties up threads. Give up quickly." accent={ACCENT} active={fb === "no"}><p className="text-sm text-[var(--muted)]">Plus circuit breakers to stop calling it.</p></FlowStep>
              <FlowArrow label="degrade" accent={ACCENT} />
              <FlowStep n={3} title="Fallbacks per feature" what="Stale cache, defaults, or simply hiding the section. Decide them in advance, not mid-incident." accent={ACCENT} active={fb === "yes" && down.size > 0}><p className="text-sm text-[var(--muted)]">Netflix shows generic rows when personalisation fails.</p></FlowStep>
              <FlowArrow label="and" accent={ACCENT} />
              <FlowStep n={4} title="Test it" what="Inject failures in staging (or production) to prove fallbacks work. Monitor how often they kick in." accent={ACCENT}><p className="text-sm text-[var(--muted)]">See chaos engineering.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
