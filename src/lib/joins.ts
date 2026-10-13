// Three join algorithms on orders ⋈ customers, counted in comparisons / lookups.
export type Algo = "nested" | "hash" | "merge";
export const ALGOS: { id: Algo; label: string }[] = [
  { id: "nested", label: "Nested loop" },
  { id: "hash", label: "Hash join" },
  { id: "merge", label: "Merge join" },
];
export const CUSTOMERS = [{ id: 3, name: "Ada" }, { id: 1, name: "Bo" }, { id: 4, name: "Cy" }, { id: 2, name: "Di" }];
export const ORDERS = [{ id: 10, cust: 2 }, { id: 11, cust: 4 }, { id: 12, cust: 1 }, { id: 13, cust: 2 }, { id: 14, cust: 3 }];
export type Frame = { o: number | null; c: number | null; match: boolean; text: string; work: number; out: string[]; built?: number[] };

export function run(a: Algo): Frame[] {
  const out: string[] = [];
  const f: Frame[] = [];
  let work = 0;
  if (a === "nested") {
    f.push({ o: null, c: null, match: false, text: "For every order, scan every customer.", work, out: [] });
    ORDERS.forEach((o, oi) => CUSTOMERS.forEach((c, ci) => {
      work++; const m = o.cust === c.id; if (m) out.push(`#${o.id} ${c.name}`);
      f.push({ o: oi, c: ci, match: m, text: m ? `Order ${o.id} matches ${c.name}.` : `Order ${o.id} vs customer ${c.id}: no.`, work, out: [...out] });
    }));
  } else if (a === "hash") {
    const built: number[] = [];
    f.push({ o: null, c: null, match: false, text: "Build: put the smaller table in a hash map keyed by id.", work, out: [], built: [] });
    CUSTOMERS.forEach((c, ci) => { work++; built.push(ci); f.push({ o: null, c: ci, match: false, text: `hash[${c.id}] = ${c.name}`, work, out: [], built: [...built] }); });
    ORDERS.forEach((o, oi) => {
      work++; const ci = CUSTOMERS.findIndex((c) => c.id === o.cust); out.push(`#${o.id} ${CUSTOMERS[ci].name}`);
      f.push({ o: oi, c: ci, match: true, text: `Probe: order ${o.id} looks up hash[${o.cust}] in one step.`, work, out: [...out], built: [...built] });
    });
  } else {
    const os = [...ORDERS].sort((x, y) => x.cust - y.cust), cs = [...CUSTOMERS].sort((x, y) => x.id - y.id);
    f.push({ o: null, c: null, match: false, text: "Both sides sorted by customer id (often free, from an index). Walk them together.", work, out: [] });
    let i = 0, j = 0;
    while (i < os.length && j < cs.length) {
      work++;
      const oi = ORDERS.indexOf(os[i]), ci = CUSTOMERS.indexOf(cs[j]);
      if (os[i].cust === cs[j].id) { out.push(`#${os[i].id} ${cs[j].name}`); f.push({ o: oi, c: ci, match: true, text: `Equal ids (${cs[j].id}): output, advance the orders.`, work, out: [...out] }); i++; }
      else if (os[i].cust < cs[j].id) { f.push({ o: oi, c: ci, match: false, text: "Order id smaller: advance orders.", work, out: [...out] }); i++; }
      else { f.push({ o: oi, c: ci, match: false, text: `Customer ${cs[j].id} is smaller: advance customers.`, work, out: [...out] }); j++; }
    }
  }
  f.push({ o: null, c: null, match: false, text: `${out.length} rows joined in ${work} steps.`, work, out: [...out] });
  return f;
}

export function cost(a: Algo, n: number, m: number, sorted: boolean) {
  if (a === "nested") return n * m;
  if (a === "hash") return n + m;
  return sorted ? n + m : Math.round(n * Math.log2(n) + m * Math.log2(m) + n + m);
}
