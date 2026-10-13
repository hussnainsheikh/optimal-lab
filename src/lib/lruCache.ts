// An LRU cache: hash map for lookups, linked list for recency.
export const CAPACITY = 3;
export const OPS: [string, string, number?][] = [["put", "a", 1], ["put", "b", 2], ["put", "c", 3], ["get", "a"], ["put", "d", 4], ["get", "b"], ["get", "c"], ["put", "e", 5], ["get", "a"]];
export type Frame = { order: [string, number][]; op: string; text: string; hit?: boolean; evicted?: string; touched?: string };

export function run(): Frame[] {
  let order: [string, number][] = [];
  const out: Frame[] = [{ order: [], op: "", text: `Capacity ${CAPACITY}. Most recent on the left, least recent on the right.` }];
  for (const [op, k, v] of OPS) {
    const idx = order.findIndex(([x]) => x === k);
    if (op === "get") {
      if (idx < 0) { out.push({ order: [...order], op: `get(${k})`, text: `${k} isn't in the map: miss. Load it from the slow source.`, hit: false }); continue; }
      const [e] = order.splice(idx, 1); order = [e, ...order];
      out.push({ order: [...order], op: `get(${k})`, text: `Hash map finds ${k} in O(1): hit. Unlink it and move it to the front.`, hit: true, touched: k });
    } else {
      let evicted: string | undefined;
      if (idx >= 0) order.splice(idx, 1);
      else if (order.length === CAPACITY) evicted = order.pop()![0];
      order = [[k, v!], ...order];
      out.push({ order: [...order], op: `put(${k}, ${v})`, text: evicted ? `Full. Evict ${evicted} from the tail (least recently used), then add ${k} at the front.` : `Add ${k} at the front.`, evicted, touched: k });
    }
  }
  return out;
}
