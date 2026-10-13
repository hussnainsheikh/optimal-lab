"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { MODELS, query, type Model } from "@/lib/multiTenancy";

const ACCENT = "var(--sys)";

export default function MultiTenancyDemo() {
  const [m, setM] = useState<Model>("shared");
  const [bug, setBug] = useState("yes");
  const [rls, setRls] = useState("no");
  const r = query(m, bug === "yes", rls === "yes");
  const md = MODELS.find((x) => x.id === m)!;
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Multi-tenancy" blurb="A SaaS app serves many companies from one system. Their data can share tables, get a schema each, or a database each. The choice decides cost, isolation, and what happens when a developer forgets a WHERE tenant_id clause." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Query result">
              <p className="font-mono text-xs text-[var(--faint)]">logged in as acme</p>
              <pre className="mt-1 rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{m === "shared" ? (bug === "yes" ? "SELECT * FROM invoices;  -- forgot tenant filter" : "SELECT * FROM invoices WHERE tenant_id = 'acme';") : m === "schema" ? "SET search_path = acme;  SELECT * FROM invoices;" : "-- connected to the acme database\nSELECT * FROM invoices;"}</pre>
              <ul className="mt-3 space-y-1">{r.rows.map((x) => <li key={x.item} className="rounded px-2 py-1 text-sm" style={{ background: "var(--inset)", color: x.tenant !== "acme" ? "var(--bad)" : undefined }}>{x.item}{x.tenant !== "acme" ? " (another customer!)" : ""}</li>)}</ul>
              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[["Isolation", "●".repeat(md.isolation) + "○".repeat(3 - md.isolation)], ["Cost per tenant", md.costPerTenant], ["Migrations", md.migrations], ["Noisy neighbours", md.noisy]].map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="text-sm">{v}</dd></div>)}
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={r.leak ? "One missing WHERE clause and acme sees every customer's invoices. With shared tables, isolation depends on every query being right." : m === "shared" && rls === "yes" ? "Row-level security makes the database add the tenant filter itself, so a forgotten clause can't leak." : m === "shared" ? "Correct query, correct rows: but only because this developer remembered." : "Separation is structural: the query can only see acme's data."}>
              <Choices label="Model" accent={ACCENT} value={m} onChange={setM} options={MODELS.map((x) => ({ id: x.id, label: x.label }))} />
              <Choices label="Developer forgets the filter" accent={ACCENT} value={bug} onChange={setBug} options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes" }]} />
              {m === "shared" && <Choices label="Row-level security" accent={ACCENT} value={rls} onChange={setRls} options={[{ id: "no", label: "Off" }, { id: "yes", label: "On" }]} />}
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Shared tables: cheapest, riskiest" what="Every row has tenant_id. One schema to migrate, thousands of tenants per database." accent={ACCENT} active={m === "shared"}><p className="text-sm text-[var(--muted)]">Enforce it in one place: RLS or a data layer.</p></FlowStep>
              <FlowArrow label="more separation" accent={ACCENT} />
              <FlowStep n={2} title="Schema or database per tenant" what="Stronger isolation and easy per-tenant backups, but thousands of schemas or databases to migrate and monitor." accent={ACCENT} active={m !== "shared"}><p className="text-sm text-[var(--muted)]">Common for enterprise customers.</p></FlowStep>
              <FlowArrow label="beyond data" accent={ACCENT} />
              <FlowStep n={3} title="Noisy neighbours and limits" what="One big tenant can slow everyone. Per-tenant rate limits and quotas, or moving them to their own shard." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Tag metrics and logs with tenant id.</p></FlowStep>
              <FlowArrow label="in practice" accent={ACCENT} />
              <FlowStep n={4} title="Mix models by tier" what="Small customers share; large or regulated ones get dedicated resources. Route by tenant at the edge." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Design for moving tenants between them.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
