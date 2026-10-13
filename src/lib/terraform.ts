// Terraform plan: compare config with state and work out the actions.
export type Action = "create" | "update" | "replace" | "destroy" | "no-op";
export type Change = "add-bucket" | "resize" | "new-ami" | "remove-db" | "drift";

export const CHANGES: { id: Change; label: string }[] = [
  { id: "add-bucket", label: "Add a bucket" },
  { id: "resize", label: "Bigger instance" },
  { id: "new-ami", label: "New machine image" },
  { id: "remove-db", label: "Delete the database block" },
  { id: "drift", label: "Someone edited it in the console" },
];

type Res = { addr: string; attrs: Record<string, string> };
const BASE: Res[] = [
  { addr: "aws_instance.web", attrs: { instance_type: "t3.small", ami: "ami-0aa1", tags: "env=prod" } },
  { addr: "aws_db_instance.main", attrs: { engine: "postgres", size: "db.t3.medium" } },
];
const FORCES_NEW: Record<string, string[]> = { "aws_instance.web": ["ami"], "aws_db_instance.main": ["engine"] };

export function scenario(c: Change) {
  const state = BASE.map((r) => ({ ...r, attrs: { ...r.attrs } }));
  let config = BASE.map((r) => ({ ...r, attrs: { ...r.attrs } }));
  if (c === "add-bucket") config.push({ addr: "aws_s3_bucket.assets", attrs: { bucket: "shop-assets" } });
  if (c === "resize") config[0].attrs.instance_type = "t3.large";
  if (c === "new-ami") config[0].attrs.ami = "ami-0bb2";
  if (c === "remove-db") config = config.slice(0, 1);
  const real = state.map((r) => ({ ...r, attrs: { ...r.attrs } }));
  if (c === "drift") real[0].attrs.tags = "env=prod,owner=bob";
  return { config, state, real };
}

export function plan(c: Change) {
  const { config, real } = scenario(c);
  const addrs = [...new Set([...real.map((r) => r.addr), ...config.map((r) => r.addr)])];
  const rows = addrs.map((addr) => {
    const want = config.find((r) => r.addr === addr);
    const have = real.find((r) => r.addr === addr);
    if (!have) return { addr, action: "create" as Action, diffs: Object.entries(want!.attrs).map(([k, v]) => ({ k, from: "", to: v, forces: false })) };
    if (!want) return { addr, action: "destroy" as Action, diffs: Object.entries(have.attrs).map(([k, v]) => ({ k, from: v, to: "", forces: false })) };
    const diffs = Object.keys({ ...want.attrs, ...have.attrs }).filter((k) => want.attrs[k] !== have.attrs[k]).map((k) => ({ k, from: have.attrs[k] ?? "", to: want.attrs[k] ?? "", forces: (FORCES_NEW[addr] ?? []).includes(k) }));
    const action: Action = !diffs.length ? "no-op" : diffs.some((d) => d.forces) ? "replace" : "update";
    return { addr, action, diffs };
  });
  const count = (a: Action) => rows.filter((r) => r.action === a).length;
  return { rows, add: count("create") + count("replace"), change: count("update"), destroy: count("destroy") + count("replace") };
}
