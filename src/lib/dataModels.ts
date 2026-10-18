// The same shop data in three models, and three questions asked of each.
// The queries below really run against the small in-memory dataset and count what
// they touch: rows read or written for SQL, documents for the document model, nodes
// and edges for the graph. That count is the cost shown on the page.

export const CUSTOMERS = [
  { id: "c1", name: "Sara" },
  { id: "c2", name: "Marco" },
  { id: "c3", name: "Priya" },
  { id: "c4", name: "Ahmed" },
];
export const PRODUCTS = [
  { id: "p1", name: "Desk lamp" },
  { id: "p2", name: "Notebook" },
  { id: "p3", name: "Headphones" },
  { id: "p4", name: "Mug" },
];
export const ORDERS: { id: string; customer: string; items: string[] }[] = [
  { id: "o1", customer: "c1", items: ["p1", "p2"] },
  { id: "o2", customer: "c2", items: ["p2", "p3"] },
  { id: "o3", customer: "c3", items: ["p1", "p3"] },
  { id: "o4", customer: "c1", items: ["p4"] },
  { id: "o5", customer: "c4", items: ["p2"] },
  { id: "o6", customer: "c2", items: ["p1", "p4"] },
];

export type ModelId = "sql" | "document" | "graph";
export const MODELS: { id: ModelId; label: string; shape: string }[] = [
  { id: "sql", label: "Relational", shape: "customers, orders, order_items, products: one fact in one place, joined at read time" },
  { id: "document", label: "Document", shape: "one document per order, with the customer and the items copied inside it" },
  { id: "graph", label: "Graph", shape: "customer, order and product nodes, joined by PLACED and CONTAINS edges" },
];

export type QuestionId = "order" | "rename" | "alsoBought";
export const QUESTIONS: { id: QuestionId; label: string; text: string }[] = [
  { id: "order", label: "Show an order", text: "Show order o1 with the customer's name and every item's name." },
  { id: "rename", label: "Rename a product", text: "The “Desk lamp” is now the “Desk lamp 2”. Update it everywhere." },
  { id: "alsoBought", label: "People also bought", text: "Which products did people who bought the Desk lamp also buy?" },
];

export type Trace = { steps: string[]; touched: number; unit: string; verdict: "good" | "ok" | "bad" };

// --- Relational -------------------------------------------------------------
const orderItemRows = ORDERS.flatMap((o) => o.items.map((p) => ({ order: o.id, product: p })));

function sql(q: QuestionId): Trace {
  if (q === "order") {
    const o = ORDERS.find((x) => x.id === "o1")!;
    const items = orderItemRows.filter((r) => r.order === o.id);
    return {
      steps: ["SELECT … FROM orders WHERE id = 'o1'", "JOIN customers ON customers.id = orders.customer_id", `JOIN order_items ON order_items.order_id = 'o1' (${items.length} rows)`, `JOIN products for those ${items.length} items`],
      touched: 1 + 1 + items.length + items.length,
      unit: "rows read",
      verdict: "ok",
    };
  }
  if (q === "rename") return { steps: ["UPDATE products SET name = 'Desk lamp 2' WHERE id = 'p1'"], touched: 1, unit: "row written", verdict: "good" };
  const buyers = [...new Set(ORDERS.filter((o) => o.items.includes("p1")).map((o) => o.customer))];
  const theirOrders = ORDERS.filter((o) => buyers.includes(o.customer));
  const theirItems = orderItemRows.filter((r) => theirOrders.some((o) => o.id === r.order));
  return {
    steps: [`order_items WHERE product_id = 'p1' → ${ORDERS.filter((o) => o.items.includes("p1")).length} orders`, `JOIN orders → ${buyers.length} customers`, `JOIN orders again → ${theirOrders.length} of their orders`, `JOIN order_items again → ${theirItems.length} items, GROUP BY product`],
    touched: ORDERS.filter((o) => o.items.includes("p1")).length + buyers.length + theirOrders.length + theirItems.length,
    unit: "rows read, over 4 joins",
    verdict: "bad",
  };
}

// --- Document ------------------------------------------------------------------
function document(q: QuestionId): Trace {
  if (q === "order") return { steps: ["db.orders.findOne({ _id: 'o1' })", "customer name and item names are already inside"], touched: 1, unit: "document read", verdict: "good" };
  if (q === "rename") {
    const n = ORDERS.filter((o) => o.items.includes("p1")).length;
    return { steps: ["db.products.updateOne({ _id: 'p1' }, …)", `db.orders.updateMany({ 'items.product_id': 'p1' }, …): the name is copied into ${n} order documents`], touched: 1 + n, unit: "documents written", verdict: "bad" };
  }
  const buyers = [...new Set(ORDERS.filter((o) => o.items.includes("p1")).map((o) => o.customer))];
  const theirOrders = ORDERS.filter((o) => buyers.includes(o.customer));
  return {
    steps: [`db.orders.find({ 'items.product_id': 'p1' }) → ${buyers.length} customers`, `db.orders.find({ customer_id: { $in: […] } }) → ${theirOrders.length} documents`, "collect the items in the application"],
    touched: ORDERS.filter((o) => o.items.includes("p1")).length + theirOrders.length,
    unit: "documents read, 2 queries",
    verdict: "ok",
  };
}

// --- Graph ---------------------------------------------------------------------
function graph(q: QuestionId): Trace {
  if (q === "order") {
    const o = ORDERS.find((x) => x.id === "o1")!;
    return { steps: ["MATCH (c)-[:PLACED]->(o {id: 'o1'})-[:CONTAINS]->(p)", `follow 1 PLACED edge and ${o.items.length} CONTAINS edges`], touched: 1 + 1 + o.items.length + o.items.length, unit: "nodes and edges", verdict: "ok" };
  }
  if (q === "rename") return { steps: ["MATCH (p:Product {id: 'p1'}) SET p.name = 'Desk lamp 2'"], touched: 1, unit: "node written", verdict: "good" };
  const orders1 = ORDERS.filter((o) => o.items.includes("p1"));
  const buyers = [...new Set(orders1.map((o) => o.customer))];
  const theirOrders = ORDERS.filter((o) => buyers.includes(o.customer));
  const edges = theirOrders.reduce((s, o) => s + o.items.length, 0);
  return {
    steps: ["MATCH (:Product {id:'p1'})<-[:CONTAINS]-(o)<-[:PLACED]-(c)-[:PLACED]->(o2)-[:CONTAINS]->(p2)", `walk ${orders1.length} + ${buyers.length} + ${theirOrders.length} + ${edges} edges, no joins`],
    touched: orders1.length + buyers.length + theirOrders.length + edges,
    unit: "edges walked, 1 query",
    verdict: "good",
  };
}

export const trace = (m: ModelId, q: QuestionId): Trace => (m === "sql" ? sql(q) : m === "document" ? document(q) : graph(q));

export const alsoBought = (): string[] => {
  const buyers = [...new Set(ORDERS.filter((o) => o.items.includes("p1")).map((o) => o.customer))];
  const items = ORDERS.filter((o) => buyers.includes(o.customer)).flatMap((o) => o.items);
  return [...new Set(items)].filter((p) => p !== "p1").map((p) => PRODUCTS.find((x) => x.id === p)!.name);
};
