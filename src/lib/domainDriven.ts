// A shop where catalog, pricing, inventory and shipping all use "Product". One
// shared Product model, or one model per bounded context, each with only the fields
// that context uses. Which teams a change reaches is computed from who reads which
// field. Then an Order aggregate: two clerks add lines at once against a credit
// limit, with and without the aggregate guarding its invariant.

export type ContextId = "catalog" | "pricing" | "inventory" | "shipping";
export const CONTEXTS: { id: ContextId; label: string; means: string }[] = [
  { id: "catalog", label: "Catalog", means: "something a customer browses: a name, photos, a description" },
  { id: "pricing", label: "Pricing", means: "a SKU with a price, a currency, a tax class and today's discount" },
  { id: "inventory", label: "Inventory", means: "units on a shelf in a warehouse, and when to reorder" },
  { id: "shipping", label: "Shipping", means: "a parcel: weight, size, and whether it's hazardous" },
];

export const FIELDS: { name: string; owner: ContextId; usedBy: ContextId[] }[] = [
  { name: "sku", owner: "catalog", usedBy: ["catalog", "pricing", "inventory", "shipping"] },
  { name: "name", owner: "catalog", usedBy: ["catalog"] },
  { name: "description", owner: "catalog", usedBy: ["catalog"] },
  { name: "images", owner: "catalog", usedBy: ["catalog"] },
  { name: "category", owner: "catalog", usedBy: ["catalog", "pricing"] },
  { name: "price", owner: "pricing", usedBy: ["pricing"] },
  { name: "currency", owner: "pricing", usedBy: ["pricing"] },
  { name: "tax_class", owner: "pricing", usedBy: ["pricing"] },
  { name: "discount", owner: "pricing", usedBy: ["pricing"] },
  { name: "stock", owner: "inventory", usedBy: ["inventory"] },
  { name: "warehouse", owner: "inventory", usedBy: ["inventory", "shipping"] },
  { name: "reorder_level", owner: "inventory", usedBy: ["inventory"] },
  { name: "weight_g", owner: "shipping", usedBy: ["shipping"] },
  { name: "dimensions", owner: "shipping", usedBy: ["shipping"] },
  { name: "hazmat", owner: "shipping", usedBy: ["shipping"] },
];

export type ChangeId = "price" | "stock" | "hazmat";
export const CHANGES: { id: ChangeId; label: string; field: string; text: string; event?: string }[] = [
  { id: "price", label: "Prices by region", field: "price", text: "Pricing needs a price per region instead of one price." },
  { id: "stock", label: "Stock per warehouse", field: "stock", text: "Inventory splits one stock number into a count per warehouse.", event: "AvailabilityChanged" },
  { id: "hazmat", label: "Hazard classes", field: "hazmat", text: "Shipping replaces a yes/no hazmat flag with a UN hazard class." },
];

export type Design = "shared" | "contexts";
export type Impact = { teams: ContextId[]; why: string; fieldsInModel: Record<ContextId, number> };

export function impact(design: Design, id: ChangeId): Impact {
  const c = CHANGES.find((x) => x.id === id)!;
  const f = FIELDS.find((x) => x.name === c.field)!;
  const fieldsInModel = Object.fromEntries(
    CONTEXTS.map((x) => [x.id, design === "shared" ? FIELDS.length : FIELDS.filter((y) => y.usedBy.includes(x.id)).length]),
  ) as Record<ContextId, number>;
  if (design === "shared") {
    return {
      teams: CONTEXTS.map((x) => x.id),
      why: `Every context loads the same Product class and table, so all ${CONTEXTS.length} teams rebuild, retest and deploy for a change only ${f.usedBy.length === 1 ? CONTEXTS.find((x) => x.id === f.owner)!.label.toLowerCase() : "some of them"} cares about.`,
      fieldsInModel,
    };
  }
  const teams = [...new Set(f.usedBy)];
  return {
    teams,
    why: c.event
      ? `Only ${teams.map((t) => CONTEXTS.find((x) => x.id === t)!.label).join(" and ")} hold this field. Catalog shows "in stock" from an ${c.event} event, which keeps its meaning when the inside changes.`
      : `Only ${teams.map((t) => CONTEXTS.find((x) => x.id === t)!.label).join(" and ")} hold this field; the other contexts never see it.`,
    fieldsInModel,
  };
}

// The Order aggregate: lines plus a credit limit that the total must not exceed.
export const CREDIT_LIMIT = 100;
export const EXISTING = 20;
export const CLERK_A = 40;
export const CLERK_B = 70;

export type Step = { who: string; does: string; total: number; ok: boolean };
export function concurrentAdd(guarded: boolean): { steps: Step[]; final: number; broken: boolean } {
  const steps: Step[] = [];
  if (!guarded) {
    steps.push({ who: "Clerk A", does: `reads order lines: total ${EXISTING}`, total: EXISTING, ok: true });
    steps.push({ who: "Clerk B", does: `reads order lines: total ${EXISTING}`, total: EXISTING, ok: true });
    steps.push({ who: "Clerk A", does: `checks ${EXISTING} + ${CLERK_A} ≤ ${CREDIT_LIMIT}, inserts a line`, total: EXISTING + CLERK_A, ok: true });
    steps.push({ who: "Clerk B", does: `checks ${EXISTING} + ${CLERK_B} ≤ ${CREDIT_LIMIT}, inserts a line`, total: EXISTING + CLERK_A + CLERK_B, ok: EXISTING + CLERK_A + CLERK_B <= CREDIT_LIMIT });
    const final = EXISTING + CLERK_A + CLERK_B;
    return { steps, final, broken: final > CREDIT_LIMIT };
  }
  steps.push({ who: "Clerk A", does: `loads Order v1: total ${EXISTING}`, total: EXISTING, ok: true });
  steps.push({ who: "Clerk B", does: `loads Order v1: total ${EXISTING}`, total: EXISTING, ok: true });
  steps.push({ who: "Clerk A", does: `order.addLine(${CLERK_A}): ${EXISTING + CLERK_A} ≤ ${CREDIT_LIMIT}; saves v2`, total: EXISTING + CLERK_A, ok: true });
  steps.push({ who: "Clerk B", does: "saves expecting v1, finds v2: conflict, reloads", total: EXISTING + CLERK_A, ok: true });
  steps.push({ who: "Clerk B", does: `order.addLine(${CLERK_B}): ${EXISTING + CLERK_A + CLERK_B} > ${CREDIT_LIMIT}; refused`, total: EXISTING + CLERK_A, ok: true });
  return { steps, final: EXISTING + CLERK_A, broken: false };
}
