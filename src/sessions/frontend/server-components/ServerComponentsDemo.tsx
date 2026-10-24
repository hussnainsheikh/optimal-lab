"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { COMPS, RSC, SPA, T, analyze, type Opts, type Where } from "@/lib/serverComponents";

const ACCENT = "var(--web)";
const SIDES: { id: Where; label: string }[] = [
  { id: "server", label: "Server" },
  { id: "client", label: "Client" },
];

export default function ServerComponentsDemo() {
  const [o, setO] = useState<Opts>(SPA);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const a = analyze(o);
  const broken = a.errors.length > 0;
  const server = o.page === "server";
  const setWhere = (id: string, w: Where) => setO((c) => ({ ...c, where: { ...c.where, [id]: w } }));

  const nodes: MapNode[] = [
    { id: "browser", label: "Browser", sub: broken ? "build failed" : `interactive at ${a.interactiveAt} ms`, at: [14, 22], mobileAt: [25, 12], state: broken ? "bad" : "active" },
    { id: "server", label: "Server", sub: server ? "runs server components" : "sends an empty shell", at: [50, 22], mobileAt: [75, 12], state: server ? "good" : "idle" },
    { id: "db", label: "Database", sub: server ? "queried by the server" : "behind an API", at: [86, 22], mobileAt: [75, 45], state: "active" },
    { id: "api", label: "JSON API", sub: server ? "not needed" : "2 calls from the browser", at: [86, 78], mobileAt: [75, 80], state: server ? "dim" : "wait" },
    { id: "cdn", label: "CDN", sub: `${a.bundleKb} KB of JavaScript`, at: [50, 78], mobileAt: [25, 80], state: a.bundleKb > 100 ? "bad" : "good" },
    { id: "hydrate", label: "Client components", sub: `${a.hydrated} hydrate`, at: [14, 78], mobileAt: [25, 45], state: "active" },
  ];

  const packets: Packet[] =
    stage === 0 ? (server ? hops("q", ["browser", "server", "db"], { label: "GET /product/7" }) : hops("q", ["browser", "server"], { label: "GET /product/7" }))
    : stage === 1 ? (server ? hops("p", ["db", "server", "browser"], { label: `HTML + ${a.payloadKb.toFixed(0)} KB payload` }) : hops("p", ["server", "browser"], { label: "empty shell", tone: "bad" }))
    : stage === 2 ? (broken ? hops("e", ["server", "browser"], { label: "error", tone: "bad" }) : hops("e", ["server", "hydrate"], { label: "serializable props", tone: "good" }))
    : stage === 3 ? hops("j", ["cdn", "browser"], { label: `${a.bundleKb} KB JS`, tone: a.bundleKb > 100 ? "bad" : "good" })
    : stage === 4 ? (server ? hops("h", ["browser", "hydrate"], { label: `hydrate ${a.hydrated}`, tone: "good" }) : hops("h", ["browser", "api", "db"], { label: "then fetch data", tone: "bad" }))
    : [];

  const captions = [
    server ? "Step 1: the request reaches the server, where server components run. They can be async and query the database directly." : "Step 1: the page is a client component, so the server has nothing to render: it sends an empty HTML shell.",
    server ? `Step 2: server components turn into HTML and an RSC payload (${a.payloadKb.toFixed(1)} KB): their output, plus slots for the client components and their props.` : "Step 2: the browser sees a blank page until the JavaScript arrives.",
    broken ? `Step 3: ${a.errors[0]}` : "Step 3: everything handed to a client component is serialized: data, not functions or class instances.",
    `Step 4: the browser downloads ${a.bundleKb} KB of JavaScript, for client components only${server ? "" : " (which here is everything)"}.`,
    server ? `Step 5: ${a.hydrated} client components hydrate; the server components never do. Interactive at ${a.interactiveAt} ms.` : `Step 5: only now can the page fetch its data from the API, one request after the other: content at ${a.contentAt} ms.`,
  ];
  const caption = stage !== null ? captions[stage] : broken ? `Build error: ${a.errors[0]}` : `Content at ${a.contentAt} ms · interactive at ${a.interactiveAt} ms · ${a.bundleKb} KB of JavaScript.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="React Server Components"
        blurb={'Server Components run only on the server: they can read the database directly, and their code never reaches the browser. Client components, marked "use client", are the interactive parts that ship JavaScript and hydrate. The line between them decides what the page costs.'}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The browser asks the server for a product page; server components query the database; client component JavaScript comes from a CDN and hydrates; a client-only page calls a JSON API instead"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "browser", to: "server", label: "request" },
                  { from: "server", to: "db", label: "SQL", dim: !server },
                  { from: "browser", to: "api", label: "fetch", dim: server },
                  { from: "api", to: "db", label: "SQL", dim: server },
                  { from: "cdn", to: "browser", label: "JS" },
                  { from: "server", to: "hydrate", label: "props" },
                  { from: "browser", to: "hydrate", label: "hydrate" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The component tree and what the browser receives">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">component tree</p>
                <ul className="mt-2 space-y-1 font-mono text-xs">
                  <li>
                    <Badge client={!server} /> ProductPage {server ? "(async, queries the db)" : '("use client")'}
                  </li>
                  {COMPS.map((c) => (
                    <li key={c.id} className="pl-4">
                      <Badge client={a.isClient(c.id)} /> {c.name}
                      {!server && o.where[c.id] === "server" && <span className="text-[10px] text-[var(--faint)]"> client anyway: imported by a client module</span>}
                    </li>
                  ))}
                </ul>
                {broken ? (
                  <ul className="mt-3 space-y-1">
                    {a.errors.map((e) => (
                      <li key={e} className="rounded-md border border-[var(--bad)] p-2 text-xs text-[var(--bad)]">
                        {e}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                    {[
                      ["JavaScript", `${a.bundleKb} KB`],
                      ["payload / data", `${a.payloadKb.toFixed(1)} KB`],
                      ["content", `${a.contentAt} ms`],
                      ["interactive", `${a.interactiveAt} ms`],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-md bg-[var(--inset)] p-2">
                        <dt className="text-[10px] text-[var(--faint)]">{k}</dt>
                        <dd className="font-mono text-sm">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(SPA)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  All client
                </button>
                <button type="button" onClick={() => setO(RSC)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Server, with client leaves
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Loading…">
                Open the product page
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Run the page on the server" what={'Components are server components unless a file says "use client". A server component can be async and await a database query; it runs once per request and never in the browser.'} accent={ACCENT} active={at(0)}>
                <Choices label="ProductPage" accent={ACCENT} value={o.page} onChange={(v) => setO((c) => ({ ...c, page: v }))} options={[{ id: "server", label: "Server component" }, { id: "client", label: '"use client" at the top' }]} />
                <pre className="mt-2 overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">
                  {server ? "export default async function ProductPage({ id }) {\n  const [product, reviews] = await Promise.all([\n    db.product(id), db.reviews(id),\n  ]);\n  return …;\n}" : '"use client";\nexport default function ProductPage({ id }) {\n  const product = useFetch(`/api/product/${id}`);\n  …\n}'}
                </pre>
              </FlowStep>
              <FlowArrow label="rendered output" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Send HTML and an RSC payload" what="The server's output is HTML for the first paint plus the RSC payload: a description of the tree with server components already rendered, and for each client component a reference to its code and the props to give it." accent={ACCENT} active={at(1)}>
                <ul className="space-y-0.5 text-[11px]">
                  {a.payload.map((p) => (
                    <li key={p.name} className="flex flex-wrap justify-between gap-x-2">
                      <span>
                        <span className="font-mono">{p.name}</span> <span className="text-[var(--faint)]">{p.what}</span>
                      </span>
                      <span className="font-mono">{p.kb.toFixed(1)} KB</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="props" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Cross the boundary with plain data" what="Props going from a server component to a client component travel over the network, so they must be serializable: strings, numbers, arrays, plain objects, promises. A function can't be sent, unless it's a Server Action. And everything sent is downloaded, so send what the component needs." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.wholeProduct} onChange={(e) => setO((c) => ({ ...c, wholeProduct: e.target.checked }))} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Pass the whole product to AddToCart
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.fnProp} onChange={(e) => setO((c) => ({ ...c, fnProp: e.target.checked }))} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Pass an onAdded callback to AddToCart
                </label>
              </FlowStep>
              <FlowArrow label="client code" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Ship JavaScript for client components only" what={'Only client components, and everything they import, go into the bundle. A markdown parser used by a server component stays on the server. "use client" is a boundary: anything imported from a client file is client code too.'} accent={ACCENT} active={at(3)}>
                <div className="space-y-2">
                  {COMPS.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs">{c.name}</span>
                      <div className="flex gap-1">
                        {SIDES.map((s) => (
                          <button key={s.id} type="button" aria-pressed={o.where[c.id] === s.id} onClick={() => setWhere(c.id, s.id)} className="min-h-11 rounded-md border px-3 text-xs" style={o.where[c.id] === s.id ? { borderColor: ACCENT, background: `color-mix(in srgb, ${ACCENT} 16%, transparent)` } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <ul className="mt-2 space-y-0.5 text-[11px]">
                  {a.bundle.map((b) => (
                    <li key={b.name} className="flex justify-between gap-2">
                      <span>{b.name}</span>
                      <span className="font-mono">{b.kb} KB</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="the bundle" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Hydrate the interactive parts" what="React attaches event handlers to the client components' HTML, which is hydration. Server components are already final HTML and are never hydrated. A client-only page has to hydrate everything, and only then can it start fetching data." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs text-[var(--muted)]">
                  {a.hydrated} hydrated · {a.browserRequests} requests from the browser · content {a.contentAt} ms · interactive {a.interactiveAt} ms
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The boundary, bundle and serialization rules are React&apos;s; sizes and timings ({T.rtt} ms round trips, {T.product} and {T.reviews} ms queries) are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Badge({ client }: { client: boolean }) {
  return (
    <span className="mr-1 inline-block rounded px-1 text-[9px] uppercase tracking-wide" style={{ background: client ? `color-mix(in srgb, ${ACCENT} 25%, transparent)` : "var(--inset)", color: client ? "var(--text)" : "var(--muted)" }}>
      {client ? "client" : "server"}
    </span>
  );
}
