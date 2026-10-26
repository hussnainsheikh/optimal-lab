// What types catch in a product page, and what they can't. The rendering code really runs
// against the server's JSON, so a renamed field really becomes "$NaN" and a null really
// throws. A small runtime schema check validates the JSON at the boundary, and the
// "generated types" check compares the property paths the code reads with the API's current
// schema, the way a compiler would after regenerating types from OpenAPI.

export type Approach = "any" | "interface" | "schema" | "generated";
export const APPROACHES: { id: Approach; label: string; code: string }[] = [
  { id: "any", label: "any", code: "const product: any = await res.json();" },
  { id: "interface", label: "A hand-written interface", code: "interface Product { id: string; name: string;\n  priceCents: number; discount: { percent: number } }\nconst product = (await res.json()) as Product;" },
  { id: "schema", label: "A schema checked at runtime", code: "const product = ProductSchema.parse(await res.json());\n// throws with a list of what didn't match" },
  { id: "generated", label: "Types generated from the API spec", code: "// npx openapi-typescript api.yaml -o api.d.ts\ntype Product = components[\"schemas\"][\"Product\"];\nconst product = ProductSchema.parse(await res.json());" },
];

// The server changed: priceCents became unitPriceCents, and discount can now be null.
export const V1 = { id: "p7", name: "Trail runner 2", priceCents: 12900, discount: { percent: 10 } as { percent: number } | null };
export const V2 = { id: "p7", name: "Trail runner 2", unitPriceCents: 12900, discount: null as { percent: number } | null };

type Field = { type: "string" | "number" | "object"; nullable?: boolean; fields?: Record<string, Field> };
const SCHEMA_V1: Record<string, Field> = { id: { type: "string" }, name: { type: "string" }, priceCents: { type: "number" }, discount: { type: "object", fields: { percent: { type: "number" } } } };
const SCHEMA_V2: Record<string, Field> = { id: { type: "string" }, name: { type: "string" }, unitPriceCents: { type: "number" }, discount: { type: "object", nullable: true, fields: { percent: { type: "number" } } } };

/** The paths the page's code reads. */
export const USES = ["product.name", "product.priceCents", "product.discount.percent"];

/** The page's render function, run for real. */
export function render(product: Record<string, unknown>): { ok: true; text: string } | { ok: false; error: string } {
  try {
    const p = product as { name: string; priceCents: number; discount: { percent: number } };
    const price = (p.priceCents / 100) * (1 - p.discount.percent / 100);
    return { ok: true, text: `${p.name.toUpperCase()} · $${price.toFixed(2)}` };
  } catch (e) {
    return { ok: false, error: `${(e as Error).name}: ${(e as Error).message}` };
  }
}

/** A minimal schema check: every declared field present with the right type. */
export function validate(json: Record<string, unknown>, schema = SCHEMA_V1, path = "product"): string[] {
  const errors: string[] = [];
  for (const [k, f] of Object.entries(schema)) {
    const v = json[k];
    const where = `${path}.${k}`;
    if (v === null) {
      if (!f.nullable) errors.push(`${where}: expected ${f.type}, received null`);
      continue;
    }
    if (v === undefined) {
      errors.push(`${where}: required`);
      continue;
    }
    if (typeof v !== f.type) errors.push(`${where}: expected ${f.type}, received ${typeof v}`);
    else if (f.fields) errors.push(...validate(v as Record<string, unknown>, f.fields, where));
  }
  return errors;
}

/** What the compiler says once types are regenerated from the current API schema. */
export function compileAgainstV2(): string[] {
  const out: string[] = [];
  for (const use of USES) {
    const [, ...parts] = use.split(".");
    let schema: Record<string, Field> | undefined = SCHEMA_V2;
    let path = "product";
    for (const part of parts) {
      const f: Field | undefined = schema?.[part];
      if (!f) {
        const near = Object.keys(schema ?? {}).find((k) => k.toLowerCase().includes(part.toLowerCase().replace(/cents$/, "")) && k !== part);
        out.push(`Property '${part}' does not exist on type '${path === "product" ? "Product" : path}'.${near ? ` Did you mean '${near}'?` : ""}`);
        break;
      }
      if (f.nullable && parts.indexOf(part) < parts.length - 1) out.push(`'${path}.${part}' is possibly 'null'.`);
      schema = f.fields;
      path = `${path}.${part}`;
    }
  }
  return out;
}

export type Outcome = { when: "compile" | "boundary" | "screen" | "none"; detail: string[]; shown: string };

export function outcome(a: Approach, server: "v1" | "v2"): Outcome {
  const json = (server === "v1" ? V1 : V2) as Record<string, unknown>;
  if (a === "generated" && server === "v2") {
    const errs = compileAgainstV2();
    return { when: "compile", detail: errs, shown: "never shipped: the build failed" };
  }
  if (a === "schema" || a === "generated") {
    const errs = validate(json);
    if (errs.length) return { when: "boundary", detail: errs, shown: "an error message: \"Couldn't load this product\"" };
  }
  const r = render(json);
  if (!r.ok) return { when: "screen", detail: [r.error], shown: "a blank page: the render threw" };
  if (r.text.includes("NaN")) return { when: "screen", detail: ["priceCents is undefined, so the price is NaN"], shown: r.text };
  return { when: "none", detail: [], shown: r.text };
}

// ---- state shapes ------------------------------------------------------------------------

/** Every combination of three booleans, and which ones mean anything. */
export function booleanStates() {
  const rows: { isLoading: boolean; error: boolean; data: boolean; valid: boolean; meaning: string }[] = [];
  for (const isLoading of [false, true])
    for (const error of [false, true])
      for (const data of [false, true]) {
        const n = Number(isLoading) + Number(error) + Number(data);
        rows.push({ isLoading, error, data, valid: n <= 1, meaning: n === 0 ? "idle" : n > 1 ? "impossible" : isLoading ? "loading" : error ? "error" : "loaded" });
      }
  return rows;
}
export const UNION = `type State =\n  | { status: "idle" }\n  | { status: "loading" }\n  | { status: "error"; error: string }\n  | { status: "loaded"; product: Product };`;
