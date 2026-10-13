// Renaming users.name to users.full_name while app servers roll from v1 to v2.
export type Mode = "rename" | "expand";
export type Step = { schema: string; apps: string; text: string; errors: boolean; phase: string };
export function steps(mode: Mode): Step[] {
  if (mode === "rename") return [
    { phase: "before", schema: "name", apps: "v1 v1 v1", text: "All servers run v1, which reads and writes name.", errors: false },
    { phase: "migrate", schema: "full_name", apps: "v1 v1 v1", text: "ALTER TABLE users RENAME name TO full_name. Every v1 server now fails: column “name” does not exist.", errors: true },
    { phase: "deploy", schema: "full_name", apps: "v2 v1 v1", text: "The rolling deploy is underway, but most servers still run v1 and keep erroring.", errors: true },
    { phase: "done", schema: "full_name", apps: "v2 v2 v2", text: "Errors stop only when the last v1 is gone, minutes later. And rolling back the code now breaks again.", errors: false },
  ];
  return [
    { phase: "expand", schema: "name + full_name", apps: "v1 v1 v1", text: "Expand: add full_name as a new nullable column. v1 doesn't notice.", errors: false },
    { phase: "dual write", schema: "name + full_name", apps: "v2 v2 v1", text: "Deploy v2, which writes both columns and still reads name. Old and new servers can run side by side.", errors: false },
    { phase: "backfill", schema: "name + full_name", apps: "v2 v2 v2", text: "Backfill full_name for old rows in small batches.", errors: false },
    { phase: "switch reads", schema: "name + full_name", apps: "v3 v3 v3", text: "Deploy v3, which reads full_name (and still writes both, so a rollback to v2 is safe).", errors: false },
    { phase: "contract", schema: "full_name", apps: "v4 v4 v4", text: "Contract: v4 stops writing name; later, drop the column. No step broke a running server.", errors: false },
  ];
}
