// The same "place an order" feature written three ways. Each file lists what it
// knows about (HTTP, the business rules, SQL) and what it imports. A change to one
// of those things means editing every file that knows about it, plus every file that
// imports a file being replaced. A unit test of the rules needs a database if the
// rules can reach SQL through their imports. All counts are computed from the graph.

export type Arch = "tangled" | "layered" | "hexagonal";
export type Concept = "http" | "rules" | "sql" | "queue" | "wiring";
export type Ring = "outside" | "application" | "domain";

export type File = { name: string; ring: Ring; knows: Concept[]; imports: string[]; note: string };

export const ARCHES: { id: Arch; label: string; one: string }[] = [
  { id: "tangled", label: "Everything in the controller", one: "The HTTP handler checks the rules and writes the SQL itself." },
  { id: "layered", label: "Layered", one: "Controller → service → repository. The service holds the rules and calls the Postgres repository directly." },
  { id: "hexagonal", label: "Hexagonal (ports and adapters)", one: "The rules sit in the middle and define the interfaces they need. HTTP and Postgres are adapters that plug in from outside." },
];

export const FILES: Record<Arch, File[]> = {
  tangled: [
    { name: "OrderController", ring: "outside", knows: ["http", "rules", "sql"], imports: [], note: "parses the request, checks the credit limit, runs INSERT" },
    { name: "AdminController", ring: "outside", knows: ["http", "rules", "sql"], imports: [], note: "the same rule, copied, for staff orders" },
    { name: "schema.sql", ring: "outside", knows: ["sql"], imports: [], note: "tables" },
  ],
  layered: [
    { name: "OrderController", ring: "outside", knows: ["http"], imports: ["OrderService"], note: "parses the request" },
    { name: "AdminController", ring: "outside", knows: ["http"], imports: ["OrderService"], note: "parses the staff request" },
    { name: "OrderService", ring: "application", knows: ["rules"], imports: ["PostgresOrderRepository", "OrderEntity"], note: "checks the credit limit, saves through the repository" },
    { name: "OrderEntity", ring: "domain", knows: ["sql"], imports: [], note: "the order, with ORM column annotations" },
    { name: "PostgresOrderRepository", ring: "outside", knows: ["sql"], imports: ["OrderEntity"], note: "INSERT and SELECT" },
  ],
  hexagonal: [
    { name: "HttpOrderAdapter", ring: "outside", knows: ["http"], imports: ["PlaceOrder"], note: "parses the request, calls the use case" },
    { name: "AdminHttpAdapter", ring: "outside", knows: ["http"], imports: ["PlaceOrder"], note: "the staff request, same use case" },
    { name: "PlaceOrder", ring: "application", knows: [], imports: ["Order", "OrderStore"], note: "the use case: load, apply the rule, save" },
    { name: "Order", ring: "domain", knows: ["rules"], imports: [], note: "the credit-limit rule, plain code" },
    { name: "OrderStore", ring: "domain", knows: [], imports: [], note: "a port: save(order), find(id)" },
    { name: "PostgresOrderStore", ring: "outside", knows: ["sql"], imports: ["OrderStore", "Order"], note: "an adapter that implements the port" },
    { name: "main", ring: "outside", knows: ["wiring"], imports: ["HttpOrderAdapter", "AdminHttpAdapter", "PostgresOrderStore", "PlaceOrder"], note: "picks the adapters at start-up" },
  ],
};

export type ChangeId = "rule" | "database" | "queue" | "test";
export const CHANGES: { id: ChangeId; label: string; text: string }[] = [
  { id: "rule", label: "Change the credit rule", text: "Gold customers get a higher credit limit." },
  { id: "database", label: "Move to DynamoDB", text: "Orders move from Postgres to DynamoDB." },
  { id: "queue", label: "Take orders from a queue", text: "Partners send orders as messages, not HTTP requests." },
  { id: "test", label: "Unit-test the rule", text: "Test the credit rule in milliseconds, with no database running." },
];

const reachable = (files: File[], from: string): Set<string> => {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const i of files.find((x) => x.name === f)?.imports ?? []) stack.push(i);
  }
  return seen;
};

export type Outcome = { edit: string[]; add: string[]; testNeedsDb: boolean; untouched: string[]; why: string };

export function change(arch: Arch, id: ChangeId): Outcome {
  const files = FILES[arch];
  const knowing = (c: Concept) => files.filter((f) => f.knows.includes(c)).map((f) => f.name);
  const ruleFiles = knowing("rules");
  const testNeedsDb = ruleFiles.some((r) => [...reachable(files, r)].some((n) => files.find((f) => f.name === n)!.knows.includes("sql")));
  let edit: string[] = [];
  let add: string[] = [];
  let why = "";

  if (id === "rule") {
    edit = ruleFiles;
    why = ruleFiles.length > 1 ? `The rule lives in ${ruleFiles.length} places; miss one and staff orders follow the old limit.` : `The rule lives in one file, ${ruleFiles[0]}.`;
  } else if (id === "database") {
    const sqlFiles = knowing("sql");
    // Files that import an SQL file by name must change their imports too, unless the SQL file only implements a port.
    const importers = files.filter((f) => !sqlFiles.includes(f.name) && f.imports.some((i) => sqlFiles.includes(i)) && !f.knows.includes("wiring")).map((f) => f.name);
    const wiring = knowing("wiring");
    if (arch === "hexagonal") {
      add = ["DynamoOrderStore"];
      edit = wiring;
      why = "Write a new adapter that implements OrderStore and swap it in main. The rule and the use case don't change.";
    } else {
      edit = [...sqlFiles, ...importers];
      add = arch === "layered" ? ["DynamoOrderRepository"] : [];
      why =
        arch === "layered"
          ? "The service imports the Postgres repository by name and the entity carries ORM annotations, so the rules' file changes for a storage reason."
          : "Every file that writes SQL is rewritten, rule and all.";
    }
  } else if (id === "queue") {
    if (arch === "tangled") {
      add = ["OrderQueueConsumer"];
      why = "The rule and the SQL are inside the HTTP handlers, so the consumer gets a third copy of both.";
    } else if (arch === "layered") {
      add = ["OrderQueueConsumer"];
      why = "The consumer calls OrderService, as the controllers do.";
    } else {
      add = ["QueueOrderAdapter"];
      edit = knowing("wiring");
      why = "A new adapter calls PlaceOrder; main starts it.";
    }
  } else {
    why = testNeedsDb
      ? `The rule's file reaches SQL through its imports, so a test either starts Postgres or mocks the ORM.`
      : "Order imports nothing; the test builds an order and checks the limit. PlaceOrder can be tested with an in-memory OrderStore.";
    add = testNeedsDb ? [] : ["Order.test"];
  }
  const touched = new Set([...edit]);
  const untouched = files.map((f) => f.name).filter((n) => !touched.has(n));
  return { edit, add, testNeedsDb, untouched, why };
}

// Count the "rules" copies: duplicates are the thing that silently diverge.
export function ruleCopies(arch: Arch): number {
  return FILES[arch].filter((f) => f.knows.includes("rules")).length;
}

// Does any import point outward (from an inner ring to an outer one)?
const RANK: Record<Ring, number> = { domain: 0, application: 1, outside: 2 };
export function outwardImports(arch: Arch): string[] {
  const files = FILES[arch];
  const out: string[] = [];
  for (const f of files)
    for (const i of f.imports) {
      const t = files.find((x) => x.name === i)!;
      if (RANK[t.ring] > RANK[f.ring]) out.push(`${f.name} → ${t.name}`);
    }
  return out;
}
