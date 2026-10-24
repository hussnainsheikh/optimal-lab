"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { ACTIONS, GRANTS, TENANT, check, connection, type Connect, type Creds, type Setup, type Ssl } from "@/lib/dbSecurity";

const ACCENT = "var(--db)";

type Opts = Setup & { ssl: Ssl; creds: Creds };
const NAIVE: Opts = { connect: "superuser", rls: false, columnGrants: false, appendOnlyAudit: false, ssl: "disable", creds: "static" };
const TUNED: Opts = { connect: "app", rls: true, columnGrants: true, appendOnlyAudit: true, ssl: "verify-full", creds: "iam" };

export default function DbSecurityDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const results = ACTIONS.map((a) => ({ a, r: check(a, o) }));
  const bad = results.filter(({ a, r }) => (a.id === "list" ? false : a.id === "inject" ? (r.tenants ?? 0) > 1 : r.allowed));
  const get = (id: string) => results.find((x) => x.a.id === id)!.r;
  const conn = connection(o.ssl, o.creds);

  const nodes: MapNode[] = [
    { id: "app", label: "Invoicing app", sub: o.connect === "app" ? "role app_rw" : o.connect === "owner" ? "role app_owner" : "role postgres", at: [13, 22], mobileAt: [25, 10], state: o.connect === "app" ? "good" : "bad" },
    { id: "attacker", label: "Attacker", sub: "types into the search box", at: [13, 78], mobileAt: [75, 10], state: bad.some((b) => b.a.injected) ? "bad" : "dim" },
    { id: "pg", label: "Postgres", sub: `${bad.length} of ${ACTIONS.length - 1} attacks work`, at: [50, 50], mobileAt: [50, 45], state: bad.length ? "bad" : "good" },
    { id: "rep", label: "Reporting", sub: o.columnGrants ? "no hash column" : "reads everything", at: [87, 22], mobileAt: [25, 82], state: o.columnGrants ? "good" : "bad" },
    { id: "support", label: "Support tool", sub: o.appendOnlyAudit ? "INSERT-only audit" : "can delete audit", at: [87, 78], mobileAt: [75, 82], state: o.appendOnlyAudit ? "good" : "bad" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("c", ["app", "pg"], { label: o.connect === "app" ? "app_rw" : o.connect === "owner" ? "owner" : "superuser", tone: o.connect === "app" ? "good" : "bad" })
    : stage === 1 ? hops("d", ["attacker", "app", "pg"], { label: get("drop").allowed || get("program").allowed ? "DROP / COPY PROGRAM" : "permission denied", tone: get("drop").allowed || get("program").allowed ? "bad" : "good" })
    : stage === 2 ? hops("i", ["attacker", "app", "pg"], { label: `${get("inject").rows} rows`, tone: (get("inject").tenants ?? 0) > 1 ? "bad" : "good" })
    : stage === 3 ? [...hops("h", ["rep", "pg"], { label: get("hashes").allowed ? "hashes" : "denied", tone: get("hashes").allowed ? "bad" : "good" }), ...hops("a", ["support", "pg"], { label: get("audit").allowed ? "DELETE 37" : "denied", tone: get("audit").allowed ? "bad" : "good", start: 0.3 })]
    : stage === 4 ? hops("n", ["app", "pg"], { label: o.ssl === "verify-full" ? "TLS, verified" : o.ssl === "require" ? "TLS, unverified" : "plain text", tone: conn.safeWire ? "good" : "bad" })
    : [];

  const captions = [
    o.connect === "app" ? "Step 1: the app logs in as app_rw, which owns nothing and can only read and write rows in the tables it was granted." : `Step 1: the app logs in as ${o.connect === "superuser" ? "the postgres superuser, which skips every permission check" : "the owner of its tables, which can drop them and bypasses their row-level security"}.`,
    `Step 2: through a SQL injection, DROP TABLE ${get("drop").allowed ? "succeeds" : "fails: must be owner"}, and COPY … TO PROGRAM ${get("program").allowed ? "runs a shell command on the database server" : "is refused"}.`,
    `Step 3: the injected OR 1=1 returns ${get("inject").rows} invoices from ${get("inject").tenants} tenant${get("inject").tenants === 1 ? "" : "s"}${o.rls && o.connect === "app" ? ": the RLS policy still applies to every query" : ""}.`,
    `Step 4: reporting ${get("hashes").allowed ? "can read every password hash" : "is refused the password_hash column"}; support ${get("audit").allowed ? "can delete audit entries" : "can only add to the audit log"}.`,
    `Step 5: on the wire, ${conn.wire}. A leaked credential works ${conn.lifetime}.`,
  ];
  const caption = stage !== null ? captions[stage] : bad.length ? `${bad.length} of ${ACTIONS.length - 1} attacks work: ${bad.map((b) => b.a.label.toLowerCase()).join("; ")}.` : "Every attack is stopped by the database itself, even with a bug in the app.";

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Database security"
        blurb="Assume the app will have a bug: an injection, a leaked password, a careless internal tool. What the attacker can do next is decided by the database's own permissions. Connect a multi-tenant invoicing app as a superuser, the table owner or a narrow role, then add row-level security, column grants and an append-only audit log, and run six attacks."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The invoicing app, an attacker going through it, a reporting role and a support tool all connect to Postgres with their own roles"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "pg", label: "app role" },
                  { from: "attacker", to: "app", label: "injection" },
                  { from: "rep", to: "pg", label: "reporting" },
                  { from: "support", to: "pg", label: "support" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="What each request does">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Six requests against these settings</p>
                <ul className="mt-2 space-y-2">
                  {results.map(({ a, r }) => {
                    const harmful = a.id === "list" ? false : a.id === "inject" ? (r.tenants ?? 0) > 1 : r.allowed;
                    return (
                      <li key={a.id} className="min-w-0 text-xs">
                        <p className="flex flex-wrap items-baseline justify-between gap-x-2">
                          <span className="font-medium">{a.label}</span>
                          <span className="font-mono text-[10px] text-[var(--faint)]">as {a.who === "app" ? (o.connect === "app" ? "app_rw" : o.connect === "owner" ? "app_owner" : "postgres") : a.who}</span>
                        </p>
                        <code className="block break-words font-mono text-[10px] text-[var(--muted)]">{a.sql}</code>
                        <p style={{ color: harmful ? "var(--bad)" : "var(--good)" }}>{r.message}</p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  App runs as postgres
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Least privilege
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Attacking…">
                Run the attacks
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Give the app its own role" what="A superuser skips every check. The owner of a table can alter or drop it, and isn't subject to its row-level security. The app should log in as a role that owns nothing; a separate migrator role owns the schema and is used only by deploys." accent={ACCENT} active={at(0)}>
                <Choices<Connect> accent={ACCENT} value={o.connect} onChange={(v) => set({ connect: v })} options={[{ id: "superuser", label: "As postgres (superuser)" }, { id: "owner", label: "As the table owner" }, { id: "app", label: "As app_rw" }]} />
                <ul className="space-y-0.5 text-[11px]">
                  {GRANTS(o).map((g) => (
                    <li key={g.role}>
                      <span className="font-mono">{g.role}</span> <span className="text-[var(--muted)]">· {g.what}</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="an injection gets through" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Limit what an injection can do" what="SQL injection runs the attacker's SQL with the app's privileges. With a narrow role, DROP TABLE fails (must be owner) and COPY … TO PROGRAM, which runs shell commands on the server, needs superuser or pg_execute_server_program." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs" style={{ color: get("drop").allowed ? "var(--bad)" : "var(--good)" }}>{get("drop").message}</p>
                <p className="font-mono text-xs" style={{ color: get("program").allowed ? "var(--bad)" : "var(--good)" }}>{get("program").message}</p>
              </FlowStep>
              <FlowArrow label="the app forgets a WHERE" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Filter rows by tenant in the database" what={`Row-level security adds a condition to every query on the table. The app sets the tenant once per request (SET app.tenant_id = ${TENANT}); even OR 1=1, or a forgotten WHERE, can only see that tenant's rows.`} accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.rls} onChange={(e) => set({ rls: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Row-level security on invoices
                </label>
                {o.rls && (
                  <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">
                    {"ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;\nCREATE POLICY tenant_only ON invoices\n  USING (tenant_id = current_setting('app.tenant_id')::int);"}
                  </pre>
                )}
                <p className="font-mono text-xs" style={{ color: (get("inject").tenants ?? 0) > 1 ? "var(--bad)" : "var(--good)" }}>
                  injected query: {get("inject").rows} rows from {get("inject").tenants} tenant{get("inject").tenants === 1 ? "" : "s"}
                </p>
              </FlowStep>
              <FlowArrow label="other roles, other needs" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Grant columns and actions, not whole tables" what="GRANT works per column: reporting can read users' emails without the password hashes. And a role that should only append to an audit log gets INSERT, so nobody using it can quietly edit history." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.columnGrants} onChange={(e) => set({ columnGrants: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  GRANT SELECT (id, email, created_at) ON users TO reporting
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.appendOnlyAudit} onChange={(e) => set({ appendOnlyAudit: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  GRANT INSERT ON audit_log TO support (nothing else)
                </label>
              </FlowStep>
              <FlowArrow label="the connection itself" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Protect the connection and the password" what="sslmode=verify-full encrypts the connection and checks the server's certificate, so nobody in between can read or impersonate it. Short-lived tokens from the cloud provider's identity system mean a leaked credential stops working within minutes." accent={ACCENT} active={at(4)}>
                <Choices<Ssl> accent={ACCENT} value={o.ssl} onChange={(v) => set({ ssl: v })} options={[{ id: "disable", label: "sslmode=disable" }, { id: "require", label: "sslmode=require" }, { id: "verify-full", label: "sslmode=verify-full" }]} />
                <Choices<Creds> accent={ACCENT} value={o.creds} onChange={(v) => set({ creds: v })} options={[{ id: "static", label: "Password in config" }, { id: "iam", label: "IAM auth token" }]} />
                <p className="text-xs" style={{ color: conn.safeWire ? "var(--good)" : "var(--bad)" }}>On the wire: {conn.wire}.</p>
                <p className="text-xs" style={{ color: o.creds === "iam" ? "var(--good)" : "var(--bad)" }}>Credential: {conn.note}; if leaked, it works {conn.lifetime}.</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Permission checks follow Postgres&apos;s rules for superusers, owners, grants and RLS, applied to 60 generated invoices; error messages match Postgres&apos;s.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
