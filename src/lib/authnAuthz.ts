// An invoicing API. Seven requests arrive: from an admin, members of two teams,
// someone with no token, someone with a forged token, and a member who adds
// "role: admin" to the request body. Authentication answers "who is this?";
// authorization answers "may they do this, to this record?". Each check below
// catches a real, common mistake; whether each request is handled right is computed.

export type Checks = { verifySignature: boolean; serverAuthz: boolean; roleFromToken: boolean; ownTeamOnly: boolean };
export const NONE: Checks = { verifySignature: false, serverAuthz: false, roleFromToken: false, ownTeamOnly: false };
export const ALL: Checks = { verifySignature: true, serverAuthz: true, roleFromToken: true, ownTeamOnly: true };

export type Req = {
  id: string;
  who: string;
  token: "valid" | "none" | "forged";
  role: "admin" | "member"; // the role the identity provider really gave them (or, if forged, what the token claims)
  claimedRole?: "admin"; // a role field the client added to the request body
  team: "A" | "B";
  action: "read" | "delete";
  invoiceTeam: "A" | "B";
  shouldBe: 200 | 401 | 403;
  label: string;
};

export const REQUESTS: Req[] = [
  { id: "admin", who: "Ada (admin)", token: "valid", role: "admin", team: "A", action: "delete", invoiceTeam: "B", shouldBe: 200, label: "Admin deletes an invoice" },
  { id: "member-own", who: "Ben (team A)", token: "valid", role: "member", team: "A", action: "read", invoiceTeam: "A", shouldBe: 200, label: "Member reads their team's invoice" },
  { id: "member-other", who: "Ben (team A)", token: "valid", role: "member", team: "A", action: "read", invoiceTeam: "B", shouldBe: 403, label: "Member reads another team's invoice" },
  { id: "member-delete", who: "Cat (team B)", token: "valid", role: "member", team: "B", action: "delete", invoiceTeam: "B", shouldBe: 403, label: "Member calls DELETE directly" },
  { id: "claimed-admin", who: "Cat (team B)", token: "valid", role: "member", claimedRole: "admin", team: "B", action: "delete", invoiceTeam: "A", shouldBe: 403, label: "Member sends role: admin in the body" },
  { id: "forged", who: "Unknown", token: "forged", role: "admin", team: "A", action: "delete", invoiceTeam: "A", shouldBe: 401, label: "Forged token claiming admin" },
  { id: "anon", who: "Nobody", token: "none", role: "member", team: "A", action: "read", invoiceTeam: "A", shouldBe: 401, label: "No token at all" },
];

export type Outcome = { status: 200 | 401 | 403; at: "gateway" | "service" | "data"; correct: boolean; why: string };

export function handle(r: Req, c: Checks): Outcome {
  // Authentication: who is this?
  if (r.token === "none") return { status: 401, at: "gateway", correct: r.shouldBe === 401, why: "No token: the gateway can't say who this is." };
  if (r.token === "forged" && c.verifySignature) return { status: 401, at: "gateway", correct: true, why: "The signature doesn't verify with the issuer's key: not a token we issued." };

  // Authorization: may they do this, to this record?
  if (!c.serverAuthz) {
    const ok = r.shouldBe === 200;
    return {
      status: 200,
      at: "data",
      correct: ok,
      why: ok
        ? "Allowed. Nothing checked, but this one was fine anyway."
        : r.token === "forged"
          ? "The gateway decoded the token without checking its signature, and nothing after it asked whether the caller may do this."
          : "The UI hides this from members, but the API itself never checks: calling it directly works.",
    };
  }
  const role = c.roleFromToken ? r.role : r.claimedRole ?? r.role;
  if (r.token === "forged") {
    // reached only when signatures aren't verified
    return { status: 200, at: "data", correct: false, why: "The service checked the role, but the role came from a token nobody verified. Anyone can write “admin” into an unsigned JWT." };
  }
  if (r.action === "delete" && role !== "admin") return { status: 403, at: "service", correct: r.shouldBe === 403, why: "Deleting needs the admin role; this caller is a member." };
  if (r.action === "delete" && r.role !== "admin")
    return { status: 200, at: "data", correct: false, why: "The service read the role from the request body, which the caller wrote. Roles must come from the verified token or the database." };
  if (c.ownTeamOnly && role !== "admin" && r.team !== r.invoiceTeam)
    return { status: 403, at: "service", correct: r.shouldBe === 403, why: "The invoice belongs to another team. Checking the role isn't enough; the check has to include this record." };
  return {
    status: 200,
    at: "data",
    correct: r.shouldBe === 200,
    why: r.shouldBe === 200 ? "Allowed, and it should be." : "Allowed by role, but the invoice belongs to another team: broken object-level authorization, the top API risk.",
  };
}

export const score = (c: Checks) => REQUESTS.filter((r) => handle(r, c).correct).length;
