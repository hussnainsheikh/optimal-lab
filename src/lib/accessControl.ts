// A document app with three departments. Who may edit a document is decided by
// roles (RBAC), by rules over attributes of the user and the document (ABAC), or by
// relationships like "shared with" (ReBAC, as in Google's Zanzibar). Eight requests
// are evaluated against each model and compared with what the business intended.

export type Dept = "sales" | "legal" | "eng";
export type User = { id: string; name: string; dept: Dept; title: "staff" | "manager" | "contractor" };
export type Doc = { id: string; name: string; dept: Dept; owner: string; status: "draft" | "locked"; sharedWith: string[] };

export const DEPTS: Dept[] = ["sales", "legal", "eng"];
export const ACTIONS = ["view", "edit", "share", "delete"] as const;

export const USERS: User[] = [
  { id: "ana", name: "Ana", dept: "sales", title: "staff" },
  { id: "raj", name: "Raj", dept: "sales", title: "manager" },
  { id: "lee", name: "Lee", dept: "legal", title: "staff" },
  { id: "kim", name: "Kim", dept: "eng", title: "contractor" },
];
export const DOCS: Doc[] = [
  { id: "q3", name: "Q3 pipeline", dept: "sales", owner: "ana", status: "draft", sharedWith: [] },
  { id: "contract", name: "Signed contract", dept: "legal", owner: "lee", status: "locked", sharedWith: ["raj"] },
  { id: "spec", name: "API spec", dept: "eng", owner: "kim", status: "draft", sharedWith: ["ana"] },
];

export type Request = { user: string; action: "view" | "edit"; doc: string; intended: boolean; why: string };
export const REQUESTS: Request[] = [
  { user: "ana", action: "edit", doc: "q3", intended: true, why: "her own draft" },
  { user: "raj", action: "edit", doc: "q3", intended: true, why: "his department's draft" },
  { user: "lee", action: "edit", doc: "q3", intended: false, why: "another department's draft" },
  { user: "raj", action: "view", doc: "contract", intended: true, why: "shared with him" },
  { user: "raj", action: "edit", doc: "contract", intended: false, why: "it's locked" },
  { user: "lee", action: "edit", doc: "contract", intended: false, why: "it's locked, even for its owner" },
  { user: "ana", action: "view", doc: "spec", intended: true, why: "shared with her" },
  { user: "kim", action: "edit", doc: "q3", intended: false, why: "contractor, another department" },
];

export type Model = "rbac" | "abac" | "rebac";
export const MODELS: { id: Model; label: string; one: string; policy: string[] }[] = [
  {
    id: "rbac",
    label: "Roles (RBAC)",
    one: "Users get roles; roles get permissions. Simple to audit: “who can edit?” is a list of roles.",
    policy: ["editor: view, edit any document", "viewer: view any document", "staff and managers → editor; contractors → viewer"],
  },
  {
    id: "abac",
    label: "Attributes (ABAC)",
    one: "A rule over the user, the document and the context, evaluated on every request.",
    policy: ["edit if user.dept == doc.dept and doc.status == draft and user.title != contractor", "view if user.dept == doc.dept"],
  },
  {
    id: "rebac",
    label: "Relationships (ReBAC)",
    one: "Permissions follow relationships: owner, member of a department, shared with. Rules over those, plus attributes.",
    policy: ["view if owner, or member of doc.dept, or in sharedWith", "edit if (owner or member of doc.dept) and doc.status == draft and not contractor"],
  },
];

const user = (id: string) => USERS.find((u) => u.id === id)!;
const doc = (id: string) => DOCS.find((d) => d.id === id)!;

export function decide(m: Model, r: Request): boolean {
  const u = user(r.user);
  const d = doc(r.doc);
  if (m === "rbac") {
    const editor = u.title !== "contractor";
    return r.action === "view" ? true : editor;
  }
  if (m === "abac") {
    if (r.action === "view") return u.dept === d.dept;
    return u.dept === d.dept && d.status === "draft" && u.title !== "contractor";
  }
  const related = d.owner === u.id || u.dept === d.dept;
  if (r.action === "view") return related || d.sharedWith.includes(u.id);
  return related && d.status === "draft" && u.title !== "contractor";
}

export type Score = { right: number; overGrants: Request[]; underGrants: Request[] };
export function score(m: Model): Score {
  const overGrants = REQUESTS.filter((r) => decide(m, r) && !r.intended);
  const underGrants = REQUESTS.filter((r) => !decide(m, r) && r.intended);
  return { right: REQUESTS.length - overGrants.length - underGrants.length, overGrants, underGrants };
}

// Getting RBAC to express "your department only" means a role per department and action.
export function roleCount(m: Model, depts: number): number {
  if (m === "rbac") return depts * 2 + 1; // dept-editor and dept-viewer per department, plus admin
  return 3; // staff, manager, contractor stay as attributes; the rule does the rest
}

export const userName = (id: string) => user(id).name;
export const docName = (id: string) => doc(id).name;
