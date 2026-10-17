// Customers and orders, stored two ways: one flat sheet, or two tables joined by a key.
// Each action is a real SQL statement; the result says what the database does with it.

export type Customer = { id: number; name: string; email: string; city: string };
export type Order = { id: number; customerId: number; day: string; total: number };

export const CUSTOMERS: Customer[] = [
  { id: 1, name: "Ada", email: "ada@mail.com", city: "London" },
  { id: 2, name: "Bo", email: "bo@mail.com", city: "Paris" },
  { id: 3, name: "Cy", email: "cy@mail.com", city: "Lagos" },
];

export const ORDERS: Order[] = [
  { id: 101, customerId: 1, day: "03-02", total: 40 },
  { id: 102, customerId: 2, day: "03-02", total: 15.5 },
  { id: 103, customerId: 1, day: "03-04", total: 22 },
  { id: 104, customerId: 3, day: "03-05", total: 9.99 },
  { id: 105, customerId: 1, day: "03-07", total: 61.25 },
];

export type Action = "duplicate" | "update" | "orphan" | "delete" | "join";
export type OnDelete = "restrict" | "cascade";

export const ACTIONS: { id: Action; label: string; step: number }[] = [
  { id: "duplicate", label: "Insert a duplicate id", step: 0 },
  { id: "update", label: "Change Ada's email", step: 1 },
  { id: "orphan", label: "Order for customer 9", step: 2 },
  { id: "delete", label: "Delete customer 3", step: 3 },
  { id: "join", label: "Join them back", step: 4 },
];

export type Outcome = {
  sql: string;
  ok: boolean;
  message: string;
  /** Cells that change, as "table:rowIndex:column". */
  touched: string[];
  /** Rows removed, as "table:rowIndex". */
  removed: string[];
  /** Same change made on the one flat sheet. */
  flat: string;
};

const NEW_EMAIL = "ada@new.io";

export function flatRows() {
  return ORDERS.map((o) => {
    const c = CUSTOMERS.find((x) => x.id === o.customerId)!;
    return { order: o.id, name: c.name, email: c.email, city: c.city, total: o.total };
  });
}

export function joined() {
  return ORDERS.map((o) => {
    const c = CUSTOMERS.find((x) => x.id === o.customerId)!;
    return { order: o.id, name: c.name, city: c.city, total: o.total };
  });
}

export function run(action: Action, onDelete: OnDelete): Outcome {
  const adaOrders = ORDERS.filter((o) => o.customerId === 1).length; // 3
  switch (action) {
    case "duplicate":
      return {
        sql: "INSERT INTO customers (id, name) VALUES (2, 'Dee');",
        ok: false,
        message: 'ERROR: duplicate key value violates unique constraint "customers_pkey". Key (id)=(2) already exists.',
        touched: ["customers:1:id"],
        removed: [],
        flat: "The flat sheet has no key, so a second customer with the same id goes in silently.",
      };
    case "update":
      return {
        sql: `UPDATE customers SET email = '${NEW_EMAIL}' WHERE id = 1;`,
        ok: true,
        message: "UPDATE 1. One cell changed, and every order of Ada's sees the new email through the key.",
        touched: ["customers:0:email"],
        removed: [],
        flat: `The flat sheet repeats Ada's email on ${adaOrders} rows. Miss one and the data disagrees with itself.`,
      };
    case "orphan":
      return {
        sql: "INSERT INTO orders (id, customer_id, total) VALUES (106, 9, 12.00);",
        ok: false,
        message: 'ERROR: insert or update on table "orders" violates foreign key constraint "orders_customer_id_fkey". Key (customer_id)=(9) is not present in table "customers".',
        touched: [],
        removed: [],
        flat: "The flat sheet accepts an order for a customer nobody can find.",
      };
    case "delete": {
      const idx = ORDERS.findIndex((o) => o.customerId === 3);
      return onDelete === "restrict"
        ? {
            sql: "DELETE FROM customers WHERE id = 3;",
            ok: false,
            message: 'ERROR: update or delete on table "customers" violates foreign key constraint "orders_customer_id_fkey" on table "orders". Order 104 still points at customer 3.',
            touched: [`orders:${idx}:customer_id`],
            removed: [],
            flat: "Deleting Cy's row in the flat sheet also deletes order 104, with no warning.",
          }
        : {
            sql: "DELETE FROM customers WHERE id = 3;",
            ok: true,
            message: "DELETE 1. ON DELETE CASCADE also removed order 104, so nothing points at a missing customer.",
            touched: [],
            removed: ["customers:2", `orders:${idx}`],
            flat: "Same result as the flat sheet, but here you chose it in the schema.",
          };
    }
    case "join":
      return {
        sql: "SELECT o.id, c.name, c.city, o.total\nFROM orders o JOIN customers c ON c.id = o.customer_id;",
        ok: true,
        message: `${ORDERS.length} rows. The join rebuilds the flat view on demand, from facts stored once.`,
        touched: [],
        removed: [],
        flat: "The flat sheet is what the join returns. You read it, you don't store it.",
      };
  }
}

export const UPDATED_EMAIL = NEW_EMAIL;

