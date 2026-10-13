// GET /api/invoices/:id as Ada, who owns invoice 1041.
export const INVOICES: Record<number, { owner: string; total: string; item: string }> = {
  1040: { owner: "Bo", total: "$2,300", item: "Office lease" },
  1041: { owner: "Ada", total: "$49", item: "Pro plan" },
  1042: { owner: "Cy", total: "$18,900", item: "Payroll" },
};
export const IDS = [1041, 1042, 1040, 9999];
export type Check = "none" | "owner";
export function request(id: number, check: Check) {
  const inv = INVOICES[id];
  if (!inv) return { status: 404, body: "Not found", leak: false };
  if (check === "owner" && inv.owner !== "Ada") return { status: 404, body: "Not found", leak: false };
  return { status: 200, body: `${inv.item} · ${inv.total} · billed to ${inv.owner}`, leak: inv.owner !== "Ada" };
}
