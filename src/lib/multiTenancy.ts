// Three ways to keep customers' data apart, and what a missing tenant filter does in each.
export type Model = "shared" | "schema" | "database";
export const MODELS = [
  { id: "shared" as Model, label: "Shared tables + tenant_id", isolation: 1, costPerTenant: "cents", migrations: "one migration", noisy: "high" },
  { id: "schema" as Model, label: "Schema per tenant", isolation: 2, costPerTenant: "low", migrations: "one per schema", noisy: "high" },
  { id: "database" as Model, label: "Database per tenant", isolation: 3, costPerTenant: "high", migrations: "one per database", noisy: "none" },
];
export const ROWS = [{ tenant: "acme", item: "Acme invoice #12" }, { tenant: "acme", item: "Acme invoice #13" }, { tenant: "globex", item: "Globex invoice #7" }, { tenant: "initech", item: "Initech invoice #3" }];
export function query(m: Model, bug: boolean, rls: boolean) {
  // logged in as acme
  if (m !== "shared" || !bug || rls) return { rows: ROWS.filter((r) => r.tenant === "acme"), leak: false };
  return { rows: ROWS, leak: true };
}
