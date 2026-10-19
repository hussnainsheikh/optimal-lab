"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CHANGES, CLERK_A, CLERK_B, CONTEXTS, CREDIT_LIMIT, EXISTING, FIELDS, concurrentAdd, impact, type ChangeId, type Design } from "@/lib/domainDriven";

const ACCENT = "var(--sys)";
const DESIGNS: { id: Design; label: string }[] = [
  { id: "shared", label: "One shared Product" },
  { id: "contexts", label: "A model per context" },
];

export default function DomainDrivenDemo() {
  const [design, setDesign] = useState<Design>("shared");
  const [ch, setCh] = useState<ChangeId>("price");
  const [guarded, setGuarded] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const c = CHANGES.find((x) => x.id === ch)!;
  const im = impact(design, ch);
  const agg = concurrentAdd(guarded);

  const captions = [
    `Step 1: four teams say “product” and mean four different things.`,
    `Step 2: ${design === "shared" ? `one Product with ${FIELDS.length} fields serves everyone.` : "each context keeps only the fields it uses; they share the SKU."}`,
    `Step 3: ${c.text} ${im.teams.length} team${im.teams.length === 1 ? "" : "s"} must change and redeploy.`,
    `Step 4: two clerks add lines at once; the order ends at ${agg.final} against a limit of ${CREDIT_LIMIT}${agg.broken ? ": broken." : ", and the second clerk is refused."}`,
    "Step 5: contexts tell each other what happened with events, translated at the boundary.",
  ];
  const caption = stage !== null ? captions[stage] : `${DESIGNS.find((d) => d.id === design)!.label}: “${c.label.toLowerCase()}” reaches ${im.teams.length} of ${CONTEXTS.length} teams. ${im.why}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Domain-driven design"
        blurb="A shop where catalog, pricing, inventory and shipping all talk about “the product”. Give them one shared model, or let each context own its own model with only the fields it uses, and count which teams each change reaches. Then protect a business rule with an aggregate while two people edit the same order."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Which fields each context holds, and which contexts this change reaches">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">fields × contexts</p>
                <p className="font-mono text-xs" style={{ color: im.teams.length > 1 ? "var(--bad)" : "var(--good)" }}>
                  reaches {im.teams.length} of {CONTEXTS.length} teams
                </p>
              </div>
              <div className="mt-3 grid grid-cols-[6.5rem_repeat(4,minmax(0,1fr))] gap-px text-[10px] sm:text-[11px]">
                <span />
                {CONTEXTS.map((x) => (
                  <span key={x.id} className="truncate px-1 pb-1 text-center font-semibold" style={{ color: im.teams.includes(x.id) ? "var(--bad)" : "var(--text)" }}>
                    {x.label}
                  </span>
                ))}
                {FIELDS.map((f) => (
                  <Row key={f.name} name={f.name} changed={f.name === c.field} cells={CONTEXTS.map((x) => (design === "shared" ? "has" : f.usedBy.includes(x.id) ? (f.owner === x.id ? "owns" : "has") : "none"))} hit={CONTEXTS.map((x) => im.teams.includes(x.id))} />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[var(--muted)]">
                Filled: the context holds the field ({design === "shared" ? "everyone holds all of them" : "solid = owns it"}). Red column: must change for “{c.label.toLowerCase()}”.
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Model" accent={ACCENT} value={design} onChange={setDesign} options={DESIGNS} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Walking…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Listen to the language" what="Ask each team what a product is and you get four answers. One word, four meanings, is the sign of four bounded contexts. Inside each, the code uses the team's own words: the ubiquitous language." accent={ACCENT} active={at(0)}>
                <ul className="space-y-1 text-xs">
                  {CONTEXTS.map((x) => (
                    <li key={x.id}>
                      <span className="font-semibold">{x.label}:</span> <span className="text-[var(--muted)]">{x.means}</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="draw the boundaries" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Give each context its own model" what="A bounded context owns its model and its data. Pricing's Product has the price and nothing about weight; shipping's has the weight and nothing about discounts. They share an identity, the SKU, not a class." accent={ACCENT} active={at(1)}>
                <Choices label="Model" accent={ACCENT} value={design} onChange={setDesign} options={DESIGNS} />
                <p className="mt-2 font-mono text-xs">
                  fields per model: {CONTEXTS.map((x) => `${x.label.toLowerCase()} ${im.fieldsInModel[x.id]}`).join(" · ")}
                </p>
              </FlowStep>
              <FlowArrow label="now change something" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="See how far a change travels" what="With one shared model every team loads every field, so every change is everyone's change. With contexts, a change reaches the teams that hold that field." accent={ACCENT} active={at(2)}>
                <Choices label="Change" accent={ACCENT} value={ch} onChange={setCh} options={CHANGES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{c.text}</p>
                <ul className="mt-1 space-y-0.5 font-mono text-xs">
                  {DESIGNS.map((d) => {
                    const i = impact(d.id, ch);
                    return (
                      <li key={d.id} style={{ fontWeight: d.id === design ? 700 : 400, color: i.teams.length > 1 ? "var(--bad)" : "var(--good)" }}>
                        {d.label}: {i.teams.length} team{i.teams.length === 1 ? "" : "s"} ({i.teams.join(", ")})
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1 text-xs text-[var(--muted)]">{im.why}</p>
              </FlowStep>
              <FlowArrow label="inside one context" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Guard a rule with an aggregate" what={`An order's total must stay within the customer's credit limit (${CREDIT_LIMIT}). If clerks insert order lines directly, two of them can each check against the old total and both succeed. An aggregate is one object that owns the rule and is saved as a unit, with a version, so the second save sees the first.`} accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={guarded} onChange={(e) => setGuarded(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Changes go through the Order aggregate
                </label>
                <ol className="space-y-0.5 font-mono text-xs">
                  {agg.steps.map((s, i) => (
                    <li key={i} style={{ color: s.ok ? "var(--text)" : "var(--bad)" }}>
                      {s.who}: {s.does}
                    </li>
                  ))}
                </ol>
                <p className="mt-1 font-mono text-xs" style={{ color: agg.broken ? "var(--bad)" : "var(--good)" }}>
                  final total {agg.final} · limit {CREDIT_LIMIT} · {agg.broken ? "rule broken" : "rule held"}
                </p>
                <p className="mt-1 text-[11px] text-[var(--faint)]">
                  Existing {EXISTING}, clerk A adds {CLERK_A}, clerk B adds {CLERK_B}.
                </p>
              </FlowStep>
              <FlowArrow label="between contexts" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Talk across boundaries with events" what="Contexts don't reach into each other's data. Ordering publishes OrderPlaced; inventory reserves stock in its own words. Where one context reads another's model, a translation layer at the edge (an anticorruption layer) keeps the foreign meaning out." accent={ACCENT} active={at(4)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  <li>ordering → OrderPlaced(sku, qty) → inventory: reserve(sku, qty)</li>
                  <li>inventory → AvailabilityChanged(sku, inStock) → catalog: show “in stock”</li>
                  <li>pricing → PriceChanged(sku, region, amount) → catalog: refresh the price shown</li>
                </ul>
                <p className="mt-2 text-xs text-[var(--faint)]">Bounded contexts are a good first guess at service boundaries, but they don&rsquo;t have to be services: a modular monolith can keep them as modules.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ name, cells, hit, changed }: { name: string; cells: ("owns" | "has" | "none")[]; hit: boolean[]; changed: boolean }) {
  return (
    <>
      <span className="truncate px-1 py-0.5 font-mono" style={{ fontWeight: changed ? 700 : 400, color: changed ? "var(--bad)" : "var(--text)" }}>
        {name}
      </span>
      {cells.map((c, i) => (
        <span key={i} className="flex items-center justify-center py-0.5" style={{ background: hit[i] ? "color-mix(in srgb, var(--bad) 8%, transparent)" : "transparent" }}>
          <span
            className="h-3 w-3 rounded-sm"
            style={{
              background: c === "owns" ? ACCENT : c === "has" ? `color-mix(in srgb, ${ACCENT} 35%, transparent)` : "transparent",
              border: c === "none" ? "1px solid var(--line)" : `1px solid ${ACCENT}`,
            }}
          />
        </span>
      ))}
    </>
  );
}
