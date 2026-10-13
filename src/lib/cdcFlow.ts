// Keeping a search index in sync with the database: dual writes vs change data capture.
export type Mode = "dual" | "cdc";
export type Frame = { db: string[]; log: string[]; bus: string[]; search: string[]; text: string; bad?: boolean; actor: string };
export function frames(mode: Mode): Frame[] {
  const db: string[] = [], log: string[] = [], bus: string[] = [], search: string[] = [];
  const out: Frame[] = [];
  const snap = (actor: string, text: string, bad = false) => out.push({ db: [...db], log: [...log], bus: [...bus], search: [...search], text, bad, actor });
  snap("", "Products live in Postgres; search runs on a separate index (Elasticsearch). They must agree.");
  if (mode === "dual") {
    db.push("lamp $40"); snap("app", "The app inserts a lamp into the database…");
    search.push("lamp $40"); snap("app", "…then writes it to the search index too. Two writes, no shared transaction.");
    db.splice(0, 1, "lamp $35"); snap("app", "A price change: the database update commits…");
    snap("app", "…and the process crashes before updating search. Search says $40, the database says $35, and nothing will fix it.", true);
  } else {
    db.push("lamp $40"); log.push("INSERT lamp $40"); snap("app", "The app writes only to the database. The change lands in its write-ahead log as part of the commit.");
    bus.push("lamp created"); snap("cdc", "A CDC connector (Debezium) tails the log and publishes a change event to Kafka.");
    search.push("lamp $40"); snap("consumer", "A consumer applies it to the search index.");
    db.splice(0, 1, "lamp $35"); log.push("UPDATE lamp $35"); snap("app", "The price changes. Again, one database write.");
    snap("cdc", "Even if the connector or consumer crashes now, the change is safe in the log; it resumes from its saved position.");
    bus.push("lamp price 35"); search.splice(0, 1, "lamp $35"); snap("consumer", "The update flows through. Search catches up a moment later: eventually consistent, never wrong forever.");
  }
  return out;
}
