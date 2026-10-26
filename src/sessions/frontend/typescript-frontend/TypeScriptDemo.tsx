"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { APPROACHES, UNION, V1, V2, booleanStates, outcome, type Approach } from "@/lib/typedApi";

const ACCENT = "var(--web)";
const WHEN = { compile: { label: "caught at build time", color: "var(--good)" }, boundary: { label: "caught at the API boundary", color: "var(--good)" }, screen: { label: "reached the screen", color: "var(--bad)" }, none: { label: "works", color: "var(--good)" } } as const;

/** The Price component, really run: dividing a string by 100 coerces it. */
function formatCents(cents: unknown) {
  return `$${((cents as number) / 100).toFixed(2)}`;
}

export default function TypeScriptDemo() {
  const [typedProps, setTypedProps] = useState(false);
  const [union, setUnion] = useState(false);
  const [server, setServer] = useState<"v1" | "v2">("v2");
  const [approach, setApproach] = useState<Approach>("any");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const o = outcome(approach, server);
  const states = booleanStates();
  const impossible = states.filter((s) => !s.valid).length;
  const priceShown = formatCents("129.00");

  const nodes: MapNode[] = [
    { id: "editor", label: "Compiler", sub: o.when === "compile" ? `${o.detail.length} errors` : typedProps ? "checks props" : "nothing to check", at: [14, 22], mobileAt: [25, 12], state: o.when === "compile" ? "good" : "active" },
    { id: "code", label: "Your code", sub: union ? "state as a union" : "3 booleans", at: [50, 22], mobileAt: [75, 12], state: union ? "good" : "wait" },
    { id: "spec", label: "API spec", sub: approach === "generated" ? "types generated from it" : "not used", at: [86, 22], mobileAt: [75, 45], state: approach === "generated" ? "good" : "dim" },
    { id: "server", label: "API server", sub: server === "v2" ? "renamed a field, null allowed" : "as before", at: [86, 78], mobileAt: [75, 80], state: server === "v2" ? "wait" : "good" },
    { id: "boundary", label: "Response parser", sub: approach === "schema" || approach === "generated" ? "validates the JSON" : "trusts the JSON", at: [50, 78], mobileAt: [25, 80], state: o.when === "boundary" ? "good" : approach === "any" || approach === "interface" ? "bad" : "good" },
    { id: "screen", label: "Screen", sub: o.when === "screen" ? "shows a broken page" : o.when === "boundary" ? "shows an error message" : o.when === "compile" ? "never got the bug" : "shows the product", at: [14, 78], mobileAt: [25, 45], state: o.when === "screen" ? "bad" : "good" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("p", ["code", "editor"], { label: typedProps ? "type error" : "no check", tone: typedProps ? "good" : "bad" })
    : stage === 1 ? hops("u", ["code", "editor"], { label: union ? "4 states" : `${states.length} states`, tone: union ? "good" : "bad" })
    : stage === 2 ? hops("j", ["server", "boundary"], { label: server === "v2" ? "new JSON" : "same JSON", tone: server === "v2" ? "bad" : "accent" })
    : stage === 3 ? (o.when === "compile" ? hops("c", ["spec", "editor"], { label: "regenerate", tone: "good" }) : hops("c", ["boundary", "screen"], { label: o.when === "boundary" ? "rejected" : "passed through", tone: o.when === "screen" ? "bad" : "good" }))
    : stage === 4 ? hops("s", [o.when === "compile" ? "editor" : "boundary", "screen"], { label: WHEN[o.when].label, tone: o.when === "screen" ? "bad" : "good" })
    : [];

  const captions = [
    typedProps ? 'Step 1: <Price cents="129.00" /> fails to compile: a string isn\'t a number.' : `Step 1: <Price cents="129.00" /> compiles, and a $129 product shows as ${priceShown}: JavaScript quietly turned the string into a number.`,
    union ? "Step 2: state is a union of four shapes, so 'loading with an error and data' can't be written." : `Step 2: three booleans allow ${states.length} combinations; ${impossible} of them mean nothing, and nothing stops the code reaching them.`,
    server === "v2" ? "Step 3: the server team renamed priceCents to unitPriceCents and made discount nullable." : "Step 3: the server sends the shape the code expects.",
    `Step 4: with ${APPROACHES.find((a) => a.id === approach)!.label.toLowerCase()}, ${o.when === "none" ? "everything works" : o.detail[0]}.`,
    `Step 5: the change was ${WHEN[o.when].label}: the user sees ${o.shown}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${APPROACHES.find((a) => a.id === approach)!.label} against the ${server} server: ${WHEN[o.when].label}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="TypeScript for the frontend"
        blurb="Types catch the mistakes you make inside your own code: a wrong prop, a state your UI can't handle. They can't check what arrives over the network. Their answer for API data is only as good as where the types come from. The server changes a field here; follow the bug to wherever it's caught."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The compiler checks your code and types generated from the API spec; the API server's JSON goes through a response parser before it reaches the screen"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "code", to: "editor", label: "tsc" },
                  { from: "spec", to: "editor", label: "generated types", dim: approach !== "generated" },
                  { from: "server", to: "boundary", label: "JSON" },
                  { from: "boundary", to: "screen", label: "render" },
                  { from: "spec", to: "server", label: "describes" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Every approach against this server">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">against the {server} server</p>
                <ul className="mt-2 space-y-1.5">
                  {APPROACHES.map((a) => {
                    const x = outcome(a.id, server);
                    return (
                      <li key={a.id} className="rounded-md bg-[var(--inset)] p-2 text-xs" style={{ outline: a.id === approach ? `1px solid ${ACCENT}` : undefined }}>
                        <span className="flex flex-wrap justify-between gap-x-2">
                          <span className="font-medium">{a.label}</span>
                          <span style={{ color: WHEN[x.when].color }}>{WHEN[x.when].label}</span>
                        </span>
                        <span className="block break-words font-mono text-[10px] text-[var(--muted)]">{x.detail.length ? x.detail.join(" · ") : x.shown}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="The server" accent={ACCENT} value={server} onChange={setServer} options={[{ id: "v1", label: "As the code expects" }, { id: "v2", label: "After a change" }]} />
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Deploying…">
                Load the product
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Type the props" what="A component's props are its contract with every caller. Typed props make a wrong call a compile error instead of a quietly wrong page." accent={ACCENT} active={at(0)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={typedProps} onChange={(e) => setTypedProps(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  {"function Price({ cents }: { cents: number })"}
                </label>
                <pre className="overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{`<Price cents="129.00" />   // dollars, as a string`}</pre>
                <p className="mt-1 font-mono text-xs" style={{ color: typedProps ? "var(--good)" : "var(--bad)" }}>
                  {typedProps ? "Type 'string' is not assignable to type 'number'." : `renders ${priceShown}: "129.00" / 100 is 1.29`}
                </p>
              </FlowStep>
              <FlowArrow label="state" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Make impossible states impossible" what="isLoading, error and data as three booleans allow combinations nobody designed for, like loading and failed at once. A union with a status field allows exactly the states the UI can show." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={union} onChange={(e) => setUnion(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Model state as a discriminated union
                </label>
                {union ? (
                  <pre className="overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{UNION}</pre>
                ) : (
                  <ul className="grid grid-cols-2 gap-1 font-mono text-[10px] sm:grid-cols-4">
                    {states.map((s, i) => (
                      <li key={i} className="rounded bg-[var(--inset)] px-1.5 py-0.5" style={{ color: s.valid ? "var(--muted)" : "var(--bad)" }}>
                        {[s.isLoading && "loading", s.error && "error", s.data && "data"].filter(Boolean).join("+") || "none"} → {s.meaning}
                      </li>
                    ))}
                  </ul>
                )}
              </FlowStep>
              <FlowArrow label="JSON from the server" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Remember the network isn't typed" what="TypeScript's types disappear at runtime. Whatever JSON arrives is whatever the server sent, and servers change." accent={ACCENT} active={at(2)}>
                <pre className="overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{JSON.stringify(server === "v1" ? V1 : V2, null, 2)}</pre>
              </FlowStep>
              <FlowArrow label="your code reads it" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Decide how much to trust it" what="Casting to a hand-written interface tells the compiler what you hope arrives. A schema checks it at runtime, at the boundary. Generating types from the API's spec means a server change breaks your build before it breaks your users." accent={ACCENT} active={at(3)}>
                <Choices accent={ACCENT} value={approach} onChange={setApproach} options={APPROACHES.map((a) => ({ id: a.id, label: a.label }))} />
                <pre className="mt-2 overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{APPROACHES.find((a) => a.id === approach)!.code}</pre>
              </FlowStep>
              <FlowArrow label="the result" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="See where it was caught" what="The earlier a mistake is caught, the cheaper it is: in the editor, then at the boundary with a clear error, and last, on a customer's screen." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs" style={{ color: WHEN[o.when].color }}>
                  {WHEN[o.when].label}
                </p>
                <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-[var(--muted)]">
                  {o.detail.map((d) => (
                    <li key={d} className="break-words">
                      {d}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs">On screen: {o.shown}</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The page code really runs against the JSON, the schema check really runs, and the generated-type errors come from comparing the paths the code reads with the new schema; messages are written the way tsc words them.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
