"use client";

import { useMemo, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { DOC_LIMIT_B, QUERIES, SCHEMA, find, orders, productDoc, relationalOrderPage, renameCustomer, validateAll, type QueryId, type Shape } from "@/lib/documentStore";

const ACCENT = "var(--db)";

type Opts = { query: QueryId; indexed: boolean; shape: Shape; reviews: number; bucketed: boolean; validator: boolean };
const NAIVE: Opts = { query: "bySku", indexed: false, shape: "embed", reviews: 70_000, bucketed: false, validator: false };
const TUNED: Opts = { query: "bySku", indexed: true, shape: "embed", reviews: 70_000, bucketed: true, validator: true };

const bytes = (b: number) => (b >= 1e6 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1e3 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);

export default function DocumentDbDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const docs = orders();
  const f = useMemo(() => find(o.query, o.indexed), [o.query, o.indexed]);
  const val = useMemo(() => validateAll(), []);
  const rn = renameCustomer(o.shape);
  const pd = productDoc(o.reviews, o.bucketed);
  const sample = f.sample ?? docs[0];
  const rel = relationalOrderPage(docs[0]);
  const shown = o.shape === "embed" ? sample : { ...sample, customer: undefined, customer_id: sample.customer.id };

  const nodes: MapNode[] = [
    { id: "app", label: "App", sub: QUERIES[o.query].label, at: [12, 30], mobileAt: [25, 10], state: "active" },
    { id: "orders", label: "orders collection", sub: `${docs.length.toLocaleString("en-US")} documents`, at: [50, 30], mobileAt: [75, 10], state: "active" },
    { id: "index", label: "Index", sub: o.indexed ? `${QUERIES[o.query].indexPath}` : "none", at: [86, 30], mobileAt: [75, 50], state: o.indexed ? "good" : "dim" },
    { id: "cust", label: "customers", sub: o.shape === "embed" ? "copied into orders" : "referenced by id", at: [50, 80], mobileAt: [25, 50], state: o.shape === "embed" ? "wait" : "good" },
    { id: "products", label: "products", sub: pd.over ? "over 16 MB" : bytes(pd.bytes), at: [86, 80], mobileAt: [50, 88], state: pd.over ? "bad" : "good" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("r", ["app", "orders"], { label: "1 document" })
    : stage === 1 ? (o.indexed ? hops("q", ["app", "index", "orders"], { label: `${f.examined} examined`, tone: "good" }) : hops("q", ["app", "orders"], { label: `scan ${f.examined}`, tone: "bad" }))
    : stage === 2 ? hops("n", ["app", o.shape === "embed" ? "orders" : "cust"], { label: `${rn.written} written`, tone: rn.written > 1 ? "bad" : "good" })
    : stage === 3 ? hops("v", ["app", "products"], { label: pd.over ? "too large" : bytes(pd.writtenPerReview), tone: pd.over ? "bad" : "good" })
    : stage === 4 ? hops("s", ["app", "orders"], { label: o.validator ? "validated" : `${val.bad} malformed`, tone: o.validator ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: an order page reads one document: the customer and every item are inside it. The same page in Postgres reads ${rel.rows} rows from ${rel.tables} tables.`,
    `Step 2: ${QUERIES[o.query].shell} ${o.indexed ? `uses the index and examines ${f.examined} documents` : `scans all ${f.examined} documents`} to return ${f.returned}.`,
    `Step 3: customer 7 changes their name. With the customer ${o.shape === "embed" ? "embedded" : "referenced"}, ${rn.note}.`,
    pd.over ? `Step 4: the lamp's document with ${o.reviews.toLocaleString("en-US")} reviews would be ${bytes(pd.bytes)}, over the 16 MB limit, so the insert fails.` : `Step 4: ${o.bucketed ? `reviews live in ${pd.docs - 1} bucket documents; each new review rewrites about ${bytes(pd.writtenPerReview)}` : `each new review rewrites the whole ${bytes(pd.bytes)} product document`}.`,
    o.validator ? `Step 5: with a validator, the ${val.bad} malformed documents old app versions wrote would have been rejected at insert time.` : `Step 5: nothing checks the shape: ${val.bad} of ${docs.length.toLocaleString("en-US")} documents have a string quantity, a missing total or a misspelt field.`,
  ];
  const caption = stage !== null ? captions[stage] : `${f.examined.toLocaleString("en-US")} examined for ${f.returned} results · rename writes ${rn.written} document${rn.written === 1 ? "" : "s"} · product document ${pd.over ? "over the limit" : bytes(pd.bytes)} · ${o.validator ? "schema enforced" : `${val.bad} malformed documents`}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Document databases"
        blurb="A document database stores each order as one JSON document, customer and items included, so the order page is a single read. The trade-offs come later: querying inside arrays, copies that must be kept in step, documents that grow without limit, and data with no fixed shape. Run them against 2,000 real generated orders."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The app reads and writes order documents, optionally through an index; customers are embedded or referenced; products hold reviews"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "orders", label: "find / update" },
                  { from: "app", to: "index", label: "lookup", dim: !o.indexed },
                  { from: "index", to: "orders", label: "ids", dim: !o.indexed },
                  { from: "orders", to: "cust", label: o.shape === "embed" ? "copy" : "$lookup" },
                  { from: "app", to: "products", label: "reviews" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="One order document">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {f.sample ? "First match" : "One order"} · {bytes(JSON.stringify(shown).length)} · customer {o.shape === "embed" ? "embedded" : "referenced"}
                </p>
                <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">{JSON.stringify(shown, null, 2)}</pre>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices<QueryId> accent={ACCENT} value={o.query} onChange={(v) => set({ query: v })} options={(Object.keys(QUERIES) as QueryId[]).map((id) => ({ id, label: QUERIES[id].label }))} />
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Schemaless, no indexes
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Modelled for the queries
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Querying…">
                Run the queries
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Store the whole order as one document" what="Everything the order page shows lives in one JSON (BSON) document: no joins, one read, and it maps straight onto the object in your code. The price is that data used together must be stored together." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  order page: 1 document · in Postgres: {rel.rows} rows from orders, customers, order_items and products
                </p>
              </FlowStep>
              <FlowArrow label="find by a field inside" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Query fields inside documents" what="Dotted paths reach into nested objects and arrays: items.sku matches if any item has that sku. Without an index every document is examined. An index on an array field is multikey: one entry per element." accent={ACCENT} active={at(1)}>
                <code className="block break-words font-mono text-[11px] text-[var(--muted)]">{QUERIES[o.query].shell}</code>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.indexed} onChange={(e) => set({ indexed: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  createIndex({`{ "${QUERIES[o.query].indexPath}": 1 }`})
                </label>
                <p className="font-mono text-xs" style={{ color: o.indexed ? "var(--good)" : "var(--bad)" }}>
                  {f.examined.toLocaleString("en-US")} examined · {f.returned} returned{o.indexed ? ` · index has ${f.indexEntries.toLocaleString("en-US")} entries` : ""}
                </p>
              </FlowStep>
              <FlowArrow label="the same data in two places" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Embed or reference" what="Embedding the customer's name in each order makes reads one lookup but turns a rename into an update of every copy. Referencing keeps one copy but needs a second read ($lookup) on every order page. Embed what's read together and rarely changes." accent={ACCENT} active={at(2)}>
                <Choices<Shape> accent={ACCENT} value={o.shape} onChange={(v) => set({ shape: v })} options={[{ id: "embed", label: "Embed the customer" }, { id: "reference", label: "Reference customer_id" }]} />
                <p className="text-xs text-[var(--muted)]">Rename customer 7: {rn.written} document{rn.written === 1 ? "" : "s"} written · order page: {rn.readsPerOrderPage} read{rn.readsPerOrderPage === 1 ? "" : "s"}</p>
              </FlowStep>
              <FlowArrow label="documents that keep growing" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Keep documents bounded" what="A document must be under 16 MB, and every update rewrites it. An array that grows forever, like every review on a product, eventually breaks both. Move it into its own documents, in buckets of 100." accent={ACCENT} active={at(3)}>
                <Slider label="Reviews on the desk lamp" value={o.reviews} min={100} max={100_000} step={100} format={(v) => v.toLocaleString("en-US")} onChange={(v) => set({ reviews: v })} accent={ACCENT} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.bucketed} onChange={(e) => set({ bucketed: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Reviews in buckets of 100, latest 10 on the product
                </label>
                <div className="h-2 rounded bg-[var(--inset)]">
                  <div className="h-full rounded" style={{ width: `${Math.min(100, (pd.bytes / DOC_LIMIT_B) * 100)}%`, background: pd.over ? "var(--bad)" : ACCENT }} />
                </div>
                <p className="font-mono text-xs" style={{ color: pd.over ? "var(--bad)" : "var(--muted)" }}>
                  product document {bytes(pd.bytes)} of 16 MB{pd.over ? ": BSONObjectTooLarge" : ""} · each new review rewrites {bytes(pd.writtenPerReview)}
                </p>
              </FlowStep>
              <FlowArrow label="no fixed columns" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Enforce a shape anyway" what="With no schema, every app version writes whatever it likes, and readers find out later. A JSON Schema validator on the collection rejects bad writes at the door, the way column types and NOT NULL do in SQL." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.validator} onChange={(e) => set({ validator: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Validator with validationAction: &quot;error&quot;
                </label>
                {o.validator && <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{SCHEMA}</pre>}
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {val.examples.map((x) => (
                    <li key={x.id} style={{ color: o.validator ? "var(--good)" : "var(--bad)" }}>
                      order {x.id}: {x.errs.join("; ")} {o.validator ? "→ rejected" : ""}
                    </li>
                  ))}
                </ul>
                <p className="font-mono text-xs">{val.bad} of {docs.length.toLocaleString("en-US")} documents fail the schema</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Queries, the multikey index, the rename and the validator all run on the generated documents; sizes are JSON bytes, close to BSON.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
