// A checkout, with five bugs the reader can switch on, and a test suite at three levels that
// really runs against it. Unit tests call functions; component tests render the checkout with
// the API mocked; end-to-end tests go through the real (simulated) server, at desktop and phone
// widths. Each test passes or fails by running its assertions. Run times are illustrative.

export type Bugs = { rounding: boolean; emptyCart: boolean; contract: boolean; mobileCss: boolean; doubleSubmit: boolean };
export const NO_BUGS: Bugs = { rounding: false, emptyCart: false, contract: false, mobileCss: false, doubleSubmit: false };
export const BUG_LIST: { id: keyof Bugs; label: string; what: string }[] = [
  { id: "rounding", label: "Coupon drops the cents", what: "the discounted total is rounded down to whole dollars" },
  { id: "emptyCart", label: "Pay button enabled on an empty cart", what: "the disabled check was lost in a refactor" },
  { id: "contract", label: "API renamed a field", what: "the server now sends unitPriceCents; the client still reads priceCents" },
  { id: "mobileCss", label: "Pay button hidden on phones", what: "a media query hides it below 400px" },
  { id: "doubleSubmit", label: "Double click pays twice", what: "the button isn't disabled while the payment is in flight" },
];

type Item = { sku: string; priceCents: number; qty: number };
const CART: Item[] = [{ sku: "trail-runner", priceCents: 1999, qty: 3 }];

// ---- the app ---------------------------------------------------------------------------

export function cartTotal(items: Item[], couponPct: number, b: Bugs) {
  const cents = items.reduce((a, i) => a + i.priceCents * i.qty, 0);
  const after = cents * (1 - couponPct / 100);
  return b.rounding ? Math.floor(after / 100) : Math.round(after) / 100;
}

/** What the server sends: the field name changed when the contract bug is on. */
function serverCart(b: Bugs) {
  return { items: CART.map((i) => (b.contract ? { sku: i.sku, unitPriceCents: i.priceCents, qty: i.qty } : { ...i })) };
}

/** The client's parser, written against the old field name. */
function parseCart(json: { items: Record<string, unknown>[] }): Item[] {
  return json.items.map((i) => ({ sku: String(i.sku), priceCents: Number(i.priceCents), qty: Number(i.qty) }));
}

type View = { total: string; payDisabled: boolean; payVisibleAt: (width: number) => boolean; click: (times: number) => number };

function renderCheckout(items: Item[], b: Bugs): View {
  const total = cartTotal(items, 10, b);
  let charges = 0;
  let submitting = false;
  return {
    total: Number.isNaN(total) ? "$NaN" : `$${total.toFixed(2)}`,
    payDisabled: b.emptyCart ? false : items.length === 0,
    payVisibleAt: (w) => !(b.mobileCss && w < 400),
    click: (times) => {
      for (let t = 0; t < times; t++) {
        if (submitting && !b.doubleSubmit) continue;
        submitting = true;
        charges++;
      }
      return charges;
    },
  };
}

// ---- the tests -------------------------------------------------------------------------

export type Level = "unit" | "component" | "e2e";
export type Test = { id: string; level: Level; name: string; ms: number; run: (b: Bugs) => string | null };

const expectEq = (got: unknown, want: unknown, what: string) => (got === want ? null : `${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

export const TESTS: Test[] = [
  { id: "u1", level: "unit", name: "cartTotal applies a 10% coupon", ms: 2, run: (b) => expectEq(cartTotal(CART, 10, b), 53.97, "cartTotal") },
  { id: "u2", level: "unit", name: "cartTotal of an empty cart is 0", ms: 1, run: (b) => expectEq(cartTotal([], 10, b), 0, "cartTotal([])") },
  { id: "u3", level: "unit", name: "parseCart reads the price (fixture)", ms: 1, run: () => expectEq(parseCart({ items: [{ sku: "a", priceCents: 500, qty: 1 }] })[0].priceCents, 500, "priceCents") },
  { id: "c1", level: "component", name: "Pay is disabled for an empty cart", ms: 40, run: (b) => expectEq(renderCheckout([], b).payDisabled, true, "pay button disabled") },
  { id: "c2", level: "component", name: "Pay shows the total (API mocked)", ms: 45, run: (b) => expectEq(renderCheckout(parseCart({ items: CART }), b).total, "$53.97", "total text") },
  { id: "c3", level: "component", name: "A double click charges once", ms: 60, run: (b) => expectEq(renderCheckout(CART, b).click(2), 1, "charges") },
  { id: "e1", level: "e2e", name: "Buy on desktop (real server)", ms: 4200, run: (b) => {
    const v = renderCheckout(parseCart(serverCart(b)), b);
    return expectEq(v.total, "$53.97", "total on the page") ?? expectEq(v.payVisibleAt(1280), true, "pay button visible");
  } },
  { id: "e2", level: "e2e", name: "Buy on a 390px phone (real server)", ms: 4600, run: (b) => {
    const v = renderCheckout(parseCart(serverCart(b)), b);
    return expectEq(v.payVisibleAt(390), true, "pay button visible at 390px") ?? expectEq(v.total, "$53.97", "total on the page");
  } },
];

export type Opts = { unit: boolean; component: boolean; e2e: boolean; mobile: boolean };
export const UNIT_ONLY: Opts = { unit: true, component: false, e2e: false, mobile: false };
export const LAYERED: Opts = { unit: true, component: true, e2e: true, mobile: true };

export function runSuite(b: Bugs, o: Opts) {
  const enabled = (t: Test) => (t.level === "unit" ? o.unit : t.level === "component" ? o.component : o.e2e && (t.id !== "e2" || o.mobile));
  const results = TESTS.map((t) => ({ test: t, ran: enabled(t), failure: enabled(t) ? t.run(b) : null }));
  // Which switched-on bugs made at least one test fail? Run each bug alone to attribute it.
  const caught = BUG_LIST.filter((bug) => b[bug.id]).map((bug) => {
    const only = { ...NO_BUGS, [bug.id]: true };
    const by = TESTS.filter((t) => enabled(t) && t.run(only) !== null).map((t) => t.level);
    return { bug, caughtBy: [...new Set(by)] };
  });
  const ms = results.filter((r) => r.ran).reduce((a, r) => a + r.test.ms, 0);
  return { results, caught, ms, escaped: caught.filter((c) => c.caughtBy.length === 0) };
}
