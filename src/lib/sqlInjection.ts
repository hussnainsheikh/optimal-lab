// SQL injection. A login form builds a query from what the user typed. Gluing the text into
// the SQL lets the input change the query itself; a parameterized query keeps it as data.
// The "database" here is a simulation that understands just these cases.

export const USERS = [
  { id: 1, username: "admin", role: "admin" },
  { id: 2, username: "alice", role: "user" },
  { id: 3, username: "bob", role: "user" },
];

export const INPUTS = [
  { id: "normal", label: "alice", value: "alice" },
  { id: "or", label: "' OR '1'='1", value: "' OR '1'='1" },
  { id: "comment", label: "admin' --", value: "admin' --" },
  { id: "drop", label: "x'; DROP TABLE users; --", value: "x'; DROP TABLE users; --" },
];

export type Mode = "concat" | "param";

export function run(input: string, mode: Mode) {
  if (mode === "param") {
    const rows = USERS.filter((u) => u.username === input);
    return {
      sql: "SELECT * FROM users WHERE username = $1",
      params: `$1 = ${JSON.stringify(input)}`,
      rows,
      effect: rows.length ? `Found ${rows[0].username}.` : "No user is literally named that. The quotes are just characters in a name.",
      dangerous: false,
    };
  }
  const sql = `SELECT * FROM users WHERE username = '${input}'`;
  if (input.includes("DROP TABLE")) return { sql, params: null, rows: [], effect: "The quote ends the string, the semicolon starts a second statement: the users table is deleted.", dangerous: true };
  if (/'\s*OR\s*'1'\s*=\s*'1/i.test(input)) return { sql, params: null, rows: USERS, effect: "'1'='1' is always true, so every row matches. The app logs in as the first one: admin.", dangerous: true };
  if (input.includes("--")) {
    const name = input.split("'")[0];
    return { sql, params: null, rows: USERS.filter((u) => u.username === name), effect: `-- comments out the rest of the query, including any password check. Logged in as ${name}.`, dangerous: true };
  }
  const rows = USERS.filter((u) => u.username === input);
  return { sql, params: null, rows, effect: rows.length ? `Found ${rows[0].username}. Works fine until someone types a quote.` : "No match.", dangerous: false };
}
