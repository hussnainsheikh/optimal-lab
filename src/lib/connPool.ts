// App servers sharing one Postgres with max_connections = 100.
export type Mode = "per-request" | "pool" | "bouncer";
export const MODES: { id: Mode; label: string }[] = [
  { id: "per-request", label: "New connection per request" },
  { id: "pool", label: "Pool of 10 per app server" },
  { id: "bouncer", label: "Pool + PgBouncer" },
];
export const MAX = 100;
const BUSY = 6; // concurrent queries per app server at peak
const POOL = 10;
const BOUNCER = 40;

export function model(mode: Mode, servers: number) {
  const wanted = mode === "per-request" ? servers * BUSY : mode === "pool" ? servers * POOL : BOUNCER;
  const open = Math.min(wanted, MAX);
  const refused = Math.max(0, wanted - MAX);
  const clients = mode === "bouncer" ? servers * POOL : wanted;
  const connectMs = mode === "per-request" ? 25 : 0;
  const errors = mode === "bouncer" ? 0 : refused > 0 ? Math.round((refused / wanted) * 100) : 0;
  const waitMs = mode === "bouncer" ? Math.max(0, Math.round(((servers * BUSY) / BOUNCER - 1) * 4)) : 0;
  return { wanted, open, refused, clients, connectMs, errors, waitMs };
}
