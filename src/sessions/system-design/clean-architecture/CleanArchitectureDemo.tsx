"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ARCHES, CHANGES, FILES, change, outwardImports, ruleCopies, type Arch, type ChangeId, type Ring } from "@/lib/cleanArchitecture";

const ACCENT = "var(--sys)";
const RINGS: { id: Ring; label: string }[] = [
  { id: "outside", label: "Outside: HTTP, database, wiring" },
  { id: "application", label: "Application: use cases" },
  { id: "domain", label: "Domain: the business" },
];
const KNOW_COLOR: Record<string, string> = { http: "var(--c1)", rules: "var(--c4)", sql: "var(--c3)", wiring: "var(--muted)", queue: "var(--c2)" };

export default function CleanArchitectureDemo() {
  const [arch, setArch] = useState<Arch>("tangled");
  const [ch, setCh] = useState<ChangeId>("rule");
  const o = change(arch, ch);
  const all = (id: ChangeId) => ARCHES.map((a) => ({ a, o: change(a.id, id) }));
  const outward = outwardImports(arch);

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Layered, clean and hexagonal architecture"
        blurb="The same “place an order” feature written three ways. Each file knows about some of HTTP, the business rules and SQL, and imports some other files. Make four everyday changes and count the files each version makes you edit, and whether the rule can be tested without a database."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={`The files of the ${ARCHES.find((a) => a.id === arch)!.label} version, with the ones this change touches marked`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{ARCHES.find((a) => a.id === arch)!.label}</p>
                <p className="font-mono text-xs" style={{ color: o.edit.length + o.add.length > 2 || o.testNeedsDb ? "var(--bad)" : "var(--good)" }}>
                  {o.edit.length} edited · {o.add.length} added
                </p>
              </div>
              <div className="mt-3 space-y-3">
                {RINGS.map((ring) => {
                  const files = FILES[arch].filter((f) => f.ring === ring.id);
                  if (!files.length) return null;
                  return (
                    <div key={ring.id}>
                      <p className="text-[11px] text-[var(--faint)]">{ring.label}</p>
                      <div className="mt-1 grid gap-2 sm:grid-cols-2">
                        {files.map((f) => {
                          const edited = o.edit.includes(f.name);
                          return (
                            <div key={f.name} className="rounded-md border px-2 py-1.5" style={{ borderColor: edited ? "var(--bad)" : "var(--line)", background: edited ? "color-mix(in srgb, var(--bad) 10%, transparent)" : "transparent" }}>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-xs font-semibold">{f.name}</span>
                                {f.knows.map((k) => (
                                  <span key={k} className="rounded px-1 font-mono text-[9px]" style={{ color: KNOW_COLOR[k], border: `1px solid ${KNOW_COLOR[k]}` }}>
                                    {k}
                                  </span>
                                ))}
                              </div>
                              <p className="mt-0.5 text-[11px] text-[var(--muted)]">{f.note}</p>
                              {f.imports.length > 0 && <p className="mt-0.5 font-mono text-[10px] text-[var(--faint)]">→ {f.imports.join(", ")}</p>}
                            </div>
                          );
                        })}
                        {ring.id === "outside" &&
                          o.add.filter((n) => !n.endsWith(".test")).map((n) => (
                            <div key={n} className="rounded-md border border-dashed px-2 py-1.5" style={{ borderColor: "var(--good)" }}>
                              <span className="font-mono text-xs font-semibold">{n}</span>
                              <p className="mt-0.5 text-[11px] text-[var(--muted)]">new file</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-[var(--muted)]">
                Red: edited for this change. Dashed: added. {outward.length ? `Imports pointing outward: ${outward.join(", ")}.` : "No import points outward."}
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={o.why}>
              <div className="w-full">
                <Choices label="Version" accent={ACCENT} value={arch} onChange={setArch} options={ARCHES.map((a) => ({ id: a.id, label: a.label }))} />
              </div>
              <div className="w-full">
                <Choices label="Change" accent={ACCENT} value={ch} onChange={setCh} options={CHANGES.map((c) => ({ id: c.id, label: c.label }))} />
              </div>
              <p className="w-full text-xs text-[var(--muted)]">{CHANGES.find((c) => c.id === ch)!.text}</p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Change a business rule" what="The rule should live in one place that knows nothing else. When it's copied into every handler, a change is a search, and a missed copy is a bug that only some customers hit." accent={ACCENT} active={ch === "rule"}>
                <Compare rows={all("rule").map(({ a, o }) => [a.label, `${o.edit.length} file${o.edit.length === 1 ? "" : "s"} · ${ruleCopies(a.id)} cop${ruleCopies(a.id) === 1 ? "y" : "ies"} of the rule`, o.edit.length > 1])} />
              </FlowStep>
              <FlowArrow label="swap the storage" accent={ACCENT} />

              <FlowStep n={2} title="Swap the database" what="Point dependencies inward. When the rules import the Postgres class, moving to DynamoDB edits the rules' file for a reason that has nothing to do with the business. When the rules own an interface (a port) and Postgres implements it, the swap is a new adapter and one line of wiring." accent={ACCENT} active={ch === "database"}>
                <Compare rows={all("database").map(({ a, o }) => [a.label, `edit ${o.edit.length} · add ${o.add.length}${o.edit.some((e) => FILES[a.id].find((f) => f.name === e)?.knows.includes("rules")) ? " · rules' file edited" : ""}`, o.edit.length > 1])} />
              </FlowStep>
              <FlowArrow label="add an entry point" accent={ACCENT} />

              <FlowStep n={3} title="Add a second way in" what="Partners send orders on a queue instead of HTTP. If the rules are inside the HTTP handler, the consumer copies them. If they sit behind a use case, the consumer is another thin adapter that calls it." accent={ACCENT} active={ch === "queue"}>
                <Compare rows={all("queue").map(({ a, o }) => [a.label, `add ${o.add.join(", ")}${o.edit.length ? ` · edit ${o.edit.join(", ")}` : ""}${a.id === "tangled" ? " · rule copy #3" : ""}`, a.id === "tangled"])} />
              </FlowStep>
              <FlowArrow label="and test it" accent={ACCENT} />

              <FlowStep n={4} title="Test the rule on its own" what="A rule that imports nothing can be tested in milliseconds. One that reaches SQL through its imports needs a database or a mock of the ORM. This check is computed by following the imports from the rule's file." accent={ACCENT} active={ch === "test"}>
                <Compare rows={ARCHES.map((a) => [a.label, change(a.id, "test").testNeedsDb ? "needs a database (or a mock)" : "plain unit test", change(a.id, "test").testNeedsDb])} />
                <p className="mt-2 text-xs text-[var(--faint)]">Layered is the common default and fine for small apps. The cost appears when the storage or the entry points change. Clean architecture and hexagonal are the same idea with different diagrams: dependencies point toward the business rules.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Compare({ rows }: { rows: [string, string, boolean][] }) {
  return (
    <ul className="space-y-1 text-xs">
      {rows.map(([k, v, bad]) => (
        <li key={k} className="grid gap-x-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <span className="text-[var(--muted)]">{k}</span>
          <span className="font-mono" style={{ color: bad ? "var(--bad)" : "var(--good)" }}>
            {v}
          </span>
        </li>
      ))}
    </ul>
  );
}
