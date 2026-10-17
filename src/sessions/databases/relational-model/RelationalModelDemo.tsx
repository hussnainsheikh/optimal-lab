"use client";

import { useState, type ReactNode } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ACTIONS, CUSTOMERS, ORDERS, UPDATED_EMAIL, flatRows, joined, run, type Action, type OnDelete } from "@/lib/relationalModel";

const ACCENT = "var(--db)";

export default function RelationalModelDemo() {
  const [action, setAction] = useState<Action>("update");
  const [onDelete, setOnDelete] = useState<OnDelete>("restrict");
  const out = run(action, onDelete);
  const step = ACTIONS.find((a) => a.id === action)!.step;
  const touched = new Set(out.touched);
  const removed = new Set(out.removed);
  const cell = (t: string, r: number, c: string) => touched.has(`${t}:${r}:${c}`);
  const gone = (t: string, r: number) => removed.has(`${t}:${r}`);
  const tone = out.ok ? "var(--good)" : "var(--bad)";
  const flat = flatRows();

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Tables, keys and relations"
        blurb="Five orders from three customers. Store them in one sheet and Ada's email is copied three times. Split them into two tables linked by a key and every fact lives in one place. Try each statement and see what the database allows."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Customers and orders tables">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">customers</p>
                  <div className="mt-1 overflow-x-auto">
                    <table className="w-full font-mono text-xs">
                      <thead>
                        <tr className="text-left text-[var(--faint)]">
                          <th className="py-1 pr-2 font-normal" style={{ color: ACCENT }}>id (PK)</th>
                          <th className="pr-2 font-normal">name</th>
                          <th className="pr-2 font-normal">email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CUSTOMERS.map((c, i) => (
                          <tr key={c.id} className="border-t border-[var(--line)]" style={{ opacity: gone("customers", i) ? 0.35 : 1, textDecoration: gone("customers", i) ? "line-through" : undefined }}>
                            <Td hot={cell("customers", i, "id")} tone={tone}>{c.id}</Td>
                            <Td>{c.name}</Td>
                            <Td hot={cell("customers", i, "email")} tone={tone}>{action === "update" && i === 0 ? UPDATED_EMAIL : c.email}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">orders</p>
                  <div className="mt-1 overflow-x-auto">
                    <table className="w-full font-mono text-xs">
                      <thead>
                        <tr className="text-left text-[var(--faint)]">
                          <th className="py-1 pr-2 font-normal">id</th>
                          <th className="pr-2 font-normal" style={{ color: ACCENT }}>customer_id (FK)</th>
                          <th className="pr-2 text-right font-normal">total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ORDERS.map((o, i) => (
                          <tr key={o.id} className="border-t border-[var(--line)]" style={{ opacity: gone("orders", i) ? 0.35 : 1, textDecoration: gone("orders", i) ? "line-through" : undefined }}>
                            <Td>{o.id}</Td>
                            <Td hot={cell("orders", i, "customer_id")} tone={tone}>{o.customerId}</Td>
                            <Td right>{o.total.toFixed(2)}</Td>
                          </tr>
                        ))}
                        {action === "orphan" && (
                          <tr className="border-t border-[var(--line)]" style={{ color: "var(--bad)" }}>
                            <Td>106</Td>
                            <Td hot tone="var(--bad)">9</Td>
                            <Td right>12.00 ✕</Td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
                {action === "join" ? "Join result" : "The same data in one flat sheet"}
              </p>
              <div className="mt-1 overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="text-left text-[var(--faint)]">
                      <th className="py-1 pr-2 font-normal">order</th>
                      <th className="pr-2 font-normal">name</th>
                      <th className="pr-2 font-normal">{action === "join" ? "city" : "email"}</th>
                      <th className="pr-2 text-right font-normal">total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {action === "join"
                      ? joined().map((r) => (
                          <tr key={r.order} className="border-t border-[var(--line)]">
                            <Td>{r.order}</Td>
                            <Td>{r.name}</Td>
                            <Td>{r.city}</Td>
                            <Td right>{r.total.toFixed(2)}</Td>
                          </tr>
                        ))
                      : flat.map((r) => {
                          const hot = (action === "update" && r.name === "Ada") || (action === "delete" && r.name === "Cy");
                          return (
                            <tr key={r.order} className="border-t border-[var(--line)]">
                              <Td>{r.order}</Td>
                              <Td hot={action === "delete" && hot} tone="var(--bad)">{r.name}</Td>
                              <Td hot={action === "update" && hot} tone="var(--bad)">{r.email}</Td>
                              <Td right>{r.total.toFixed(2)}</Td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">{out.flat}</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={<span style={{ color: tone }}>{out.message}</span>}>
              <Choices label="Run a statement" accent={ACCENT} value={action} onChange={setAction} options={ACTIONS.map((a) => ({ id: a.id, label: a.label }))} />
              <pre className="w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{out.sql}</pre>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Give every row a primary key" what="A primary key is a column whose value is unique and never empty, so one id names exactly one row." accent={ACCENT} active={step === 0}>
                <p className="font-mono text-xs">id integer PRIMARY KEY</p>
                <p className="mt-1 text-sm text-[var(--muted)]">The database builds a unique index on it and rejects a second customer 2.</p>
              </FlowStep>
              <FlowArrow label="one id per customer" accent={ACCENT} />
              <FlowStep n={2} title="Store each fact once" what="Customer details live in customers. Orders keep only the customer's id, not a copy of their name and email." accent={ACCENT} active={step === 1}>
                <p className="text-sm">
                  Copies of Ada&apos;s email: <span className="font-mono">{flat.filter((r) => r.name === "Ada").length}</span> in the flat sheet, <span className="font-mono">1</span> in customers.
                </p>
              </FlowStep>
              <FlowArrow label="customer_id values" accent={ACCENT} />
              <FlowStep n={3} title="Point at rows with a foreign key" what="A foreign key says every orders.customer_id must exist in customers.id. The database checks it on every insert and update." accent={ACCENT} active={step === 2}>
                <p className="font-mono text-xs">customer_id integer REFERENCES customers (id)</p>
              </FlowStep>
              <FlowArrow label="rows that point at a customer" accent={ACCENT} />
              <FlowStep n={4} title="Decide what a delete does" what="If a customer still has orders, the default is to refuse the delete. CASCADE deletes their orders too." accent={ACCENT} active={step === 3}>
                <Choices
                  label="ON DELETE"
                  accent={ACCENT}
                  value={onDelete}
                  onChange={(v) => {
                    setOnDelete(v);
                    setAction("delete");
                  }}
                  options={[
                    { id: "restrict", label: "NO ACTION (default)" },
                    { id: "cascade", label: "CASCADE" },
                  ]}
                />
              </FlowStep>
              <FlowArrow label="two clean tables" accent={ACCENT} />
              <FlowStep n={5} title="Join the tables to read them" what="A JOIN matches orders.customer_id to customers.id and gives back the flat view, built fresh on every query." accent={ACCENT} active={step === 4}>
                <p className="text-sm text-[var(--muted)]">Splitting costs a join on read. It saves you from copies that drift apart on write.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Td({ children, hot = false, tone, right = false }: { children: ReactNode; hot?: boolean; tone?: string; right?: boolean }) {
  return (
    <td
      className={`py-1 pr-2 ${right ? "text-right" : ""}`}
      style={hot ? { outline: `2px solid ${tone}`, outlineOffset: -2, borderRadius: 4 } : undefined}
    >
      {children}
    </td>
  );
}
