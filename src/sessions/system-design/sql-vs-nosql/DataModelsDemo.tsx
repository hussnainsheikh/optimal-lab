"use client";

import { useState } from "react";
import { FlowArrow, FlowSequence, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { CUSTOMERS, MODELS, ORDERS, PRODUCTS, QUESTIONS, alsoBought, trace, type ModelId, type QuestionId } from "@/lib/dataModels";

const ACCENT = "var(--sys)";
const VERDICT = { good: "var(--good)", ok: "var(--text)", bad: "var(--bad)" } as const;

export default function DataModelsDemo() {
  const [q, setQ] = useState<QuestionId>("order");
  const question = QUESTIONS.find((x) => x.id === q)!;
  const traces = Object.fromEntries(MODELS.map((m) => [m.id, trace(m.id, q)])) as Record<ModelId, ReturnType<typeof trace>>;
  const best = MODELS.reduce((a, b) => (traces[b.id].touched < traces[a.id].touched ? b : a));

  const caption =
    q === "order"
      ? `One order with its names: the document has it all in one read; relational and graph assemble it from ${traces.sql.touched} pieces.`
      : q === "rename"
        ? `Renaming a product is one write where the name lives once, and ${traces.document.touched} writes where it was copied into every order.`
        : `“People also bought” walks relationships: ${traces.graph.touched} edges in one graph query, ${traces.sql.touched} rows across four joins in SQL. The answer: ${alsoBought().join(", ")}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="SQL, document and graph databases"
        blurb={`The same shop, ${CUSTOMERS.length} customers, ${PRODUCTS.length} products, ${ORDERS.length} orders, stored three ways. Ask the same three questions of each model and count what every one has to touch. None of them wins all three.`}
      />

      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p aria-live="polite" className="min-h-10 text-sm">
          {caption}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Choices accent={ACCENT} value={q} onChange={setQ} options={QUESTIONS.map((x) => ({ id: x.id, label: x.label }))} />
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">{question.text}</p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {MODELS.map((m) => {
          const t = traces[m.id];
          return (
            <section key={m.id} aria-label={m.label} className="min-w-0 rounded-xl border bg-[var(--panel)] p-4" style={{ borderColor: m.id === best.id ? "var(--good)" : "var(--line)" }}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{m.label}</h2>
                <span className="font-mono text-xs" style={{ color: VERDICT[t.verdict] }}>
                  {t.touched} {t.unit}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">{m.shape}</p>
              <Shape model={m.id} />
              <ol className="mt-3 space-y-1 font-mono text-[11px]">
                {t.steps.map((s, i) => (
                  <li key={i} className="rounded bg-[var(--inset)] px-2 py-1">
                    {s}
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>

      <div className="mt-6">
        <FlowSequence mode="stage" accent={ACCENT}>
          <FlowStep n={1} title="Store each fact once, or copy it where it's read" what="Relational tables keep a product's name in one row and join at read time. A document copies the name into every order so a read is one lookup. A graph stores the links themselves." accent={ACCENT} active={q === "order"}>
            <p className="font-mono text-xs">show an order: SQL {traces.sql.touched} rows · document 1 · graph {traces.graph.touched} nodes and edges</p>
          </FlowStep>
          <FlowArrow label="then change something" accent={ACCENT} />
          <FlowStep n={2} title="Pay for the copies on every write" what="What made the document read fast makes the rename slow: every copied name has to change. One row in SQL, one node in the graph." accent={ACCENT} active={q === "rename"}>
            <p className="font-mono text-xs">rename a product: SQL 1 row · document {trace("document", "rename").touched} documents · graph 1 node</p>
          </FlowStep>
          <FlowArrow label="then ask about relationships" accent={ACCENT} />
          <FlowStep n={3} title="Walk relationships, or join them" what="“People also bought” is two hops away. A graph walks edges in one query. SQL joins order_items to orders to orders to order_items: fine at this size, slow at millions. Documents need two queries and work in the app." accent={ACCENT} active={q === "alsoBought"}>
            <p className="font-mono text-xs">also bought: SQL {trace("sql", "alsoBought").touched} rows, 4 joins · document {trace("document", "alsoBought").touched} docs, 2 queries · graph {trace("graph", "alsoBought").touched} edges, 1 query</p>
          </FlowStep>
          <FlowArrow label="choose" accent={ACCENT} />
          <FlowStep n={4} title="Pick by the questions you'll ask most" what="Relational for data that many things read and write and must stay consistent. Documents when one thing is read whole far more than its parts change. Graphs when the questions are about connections several hops deep. Many systems use two." accent={ACCENT}>
            <p className="text-xs text-[var(--muted)]">Every count above is from running the query against the six orders. The ratios are what change with size.</p>
          </FlowStep>
        </FlowSequence>
      </div>
    </SessionPage>
  );
}

function Shape({ model }: { model: ModelId }) {
  if (model === "sql")
    return (
      <div className="mt-3 grid grid-cols-2 gap-1 font-mono text-[10px]">
        {[
          ["customers", `${CUSTOMERS.length} rows`],
          ["products", `${PRODUCTS.length} rows`],
          ["orders", `${ORDERS.length} rows`],
          ["order_items", `${ORDERS.reduce((s, o) => s + o.items.length, 0)} rows`],
        ].map(([t, n]) => (
          <div key={t} className="rounded border border-[var(--line)] px-2 py-1">
            <span className="block">{t}</span>
            <span className="text-[var(--faint)]">{n}</span>
          </div>
        ))}
      </div>
    );
  if (model === "document")
    return (
      <pre className="mt-3 overflow-hidden rounded bg-[var(--inset)] px-2 py-1 font-mono text-[10px] leading-snug">{`{ _id: "o1",
  customer: { id: "c1", name: "Sara" },
  items: [
    { product_id: "p1", name: "Desk lamp" },
    { product_id: "p2", name: "Notebook" } ] }`}</pre>
    );
  return (
    <svg viewBox="0 0 100 54" className="mt-3 w-full" role="img" aria-label="Customer, order and product nodes joined by edges">
      {[
        [8, 24, "Sara", "var(--c1)"],
        [50, 24, "o1", "var(--c3)"],
        [88, 10, "Desk lamp", "var(--c4)"],
        [88, 38, "Notebook", "var(--c4)"],
      ].map(([x, y, l, c]) => (
        <g key={String(l)}>
          <circle cx={Number(x)} cy={Number(y)} r={4} fill={String(c)} />
          <text x={Number(x)} y={Number(y) + 9} textAnchor="middle" fontSize={4} fill="var(--text)">
            {String(l)}
          </text>
        </g>
      ))}
      <line x1={12} y1={24} x2={46} y2={24} stroke="var(--line-strong)" strokeWidth={0.6} />
      <text x={29} y={22} textAnchor="middle" fontSize={3.5} fill="var(--muted)">
        PLACED
      </text>
      <line x1={54} y1={23} x2={84} y2={11} stroke="var(--line-strong)" strokeWidth={0.6} />
      <line x1={54} y1={25} x2={84} y2={37} stroke="var(--line-strong)" strokeWidth={0.6} />
      <text x={70} y={14} textAnchor="middle" fontSize={3.5} fill="var(--muted)">
        CONTAINS
      </text>
    </svg>
  );
}
