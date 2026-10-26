// A small Redis that really runs commands: strings, lists, hashes, sets and sorted sets, with
// TTLs on a virtual clock, and OBJECT ENCODING chosen by Redis 7's real rules (int / embstr /
// raw strings; listpack until 128 entries or a 64-byte value, then hashtable or skiplist; intset
// for small integer sets). MEMORY USAGE is an estimate. Also: what one slow command does to
// everyone else on the single thread, what RDB and AOF lose in a crash, and which keys each
// maxmemory policy evicts. Command timings are illustrative.

export const LISTPACK_ENTRIES = 128; // hash-, set-, zset-max-listpack-entries
export const LISTPACK_VALUE = 64; // hash-, zset-max-listpack-value
export const INTSET_ENTRIES = 512; // set-max-intset-entries
export const EMBSTR_MAX = 44;

type Value =
  | { type: "string"; v: string }
  | { type: "list"; v: string[] }
  | { type: "hash"; v: Map<string, string> }
  | { type: "set"; v: Set<string> }
  | { type: "zset"; v: Map<string, number> };

export type Db = { data: Map<string, Value>; expires: Map<string, number>; now: number };
export const newDb = (): Db => ({ data: new Map(), expires: new Map(), now: 0 });

const isInt = (s: string) => /^-?\d{1,19}$/.test(s) && Math.abs(Number(s)) <= Number.MAX_SAFE_INTEGER;

export function encoding(val: Value): string {
  switch (val.type) {
    case "string":
      return isInt(val.v) ? "int" : val.v.length <= EMBSTR_MAX ? "embstr" : "raw";
    case "list":
      return val.v.length <= LISTPACK_ENTRIES && val.v.every((x) => x.length <= LISTPACK_VALUE) ? "listpack" : "quicklist";
    case "hash":
      return val.v.size <= LISTPACK_ENTRIES && [...val.v].every(([k, x]) => k.length <= LISTPACK_VALUE && x.length <= LISTPACK_VALUE) ? "listpack" : "hashtable";
    case "set": {
      const xs = [...val.v];
      if (xs.length <= INTSET_ENTRIES && xs.every(isInt)) return "intset";
      return xs.length <= LISTPACK_ENTRIES && xs.every((x) => x.length <= LISTPACK_VALUE) ? "listpack" : "hashtable";
    }
    case "zset":
      return val.v.size <= LISTPACK_ENTRIES && [...val.v.keys()].every((m) => m.length <= LISTPACK_VALUE) ? "listpack" : "skiplist";
  }
}

/** Rough bytes, in the spirit of MEMORY USAGE: packed encodings store entries back to back. */
export function memory(key: string, val: Value): number {
  const enc = encoding(val);
  const base = 56 + key.length; // dict entry + key + object header
  const items: string[] =
    val.type === "string" ? [val.v] : val.type === "list" ? val.v : val.type === "set" ? [...val.v] : val.type === "hash" ? [...val.v].flat() : [...val.v].flatMap(([m, s]) => [m, String(s)]);
  const payload = items.reduce((a, x) => a + x.length, 0);
  if (enc === "int") return base;
  if (enc === "embstr" || enc === "raw") return base + payload + (enc === "raw" ? 16 : 0);
  if (enc === "listpack" || enc === "intset") return base + 16 + payload + items.length * 2;
  const perEntry = enc === "skiplist" ? 96 : enc === "quicklist" ? 12 : 48; // node, pointers and dict entries
  return base + 64 + payload + items.length * perEntry;
}

function glob(pattern: string) {
  return new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
}

/** Split a command line on spaces, keeping "quoted strings" together. */
export function parse(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2]);
  return out;
}

export type Reply = { text: string; error?: boolean };
const ok: Reply = { text: "OK" };
const int = (n: number): Reply => ({ text: `(integer) ${n}` });
const bulk = (s: string | null | undefined): Reply => ({ text: s == null ? "(nil)" : `"${s}"` });
const arr = (xs: string[]): Reply => ({ text: xs.length ? xs.map((x, i) => `${i + 1}) "${x}"`).join("\n") : "(empty array)" });
const err = (t: string): Reply => ({ text: `(error) ${t}`, error: true });
const WRONGTYPE = err("WRONGTYPE Operation against a key holding the wrong kind of value");

function expireIfNeeded(db: Db, key: string) {
  const at = db.expires.get(key);
  if (at !== undefined && at <= db.now) {
    db.data.delete(key);
    db.expires.delete(key);
  }
}

export function run(db: Db, line: string): Reply {
  const [rawCmd, ...a] = parse(line);
  if (!rawCmd) return err("empty command");
  const cmd = rawCmd.toUpperCase();
  for (const k of db.data.keys()) expireIfNeeded(db, k);
  const get = (key: string) => db.data.get(key);
  const typed = <T extends Value["type"]>(key: string, type: T, make: () => Extract<Value, { type: T }>) => {
    const cur = get(key);
    if (!cur) {
      const v = make();
      db.data.set(key, v);
      return v;
    }
    return cur.type === type ? (cur as Extract<Value, { type: T }>) : null;
  };
  const need = (n: number) => a.length < n;
  switch (cmd) {
    case "SET": {
      if (need(2)) return err("wrong number of arguments for 'set' command");
      db.data.set(a[0], { type: "string", v: a[1] });
      db.expires.delete(a[0]);
      const ex = a.findIndex((x) => x.toUpperCase() === "EX");
      if (ex >= 0 && a[ex + 1]) db.expires.set(a[0], db.now + Number(a[ex + 1]));
      return ok;
    }
    case "GET": {
      const v = get(a[0]);
      if (!v) return bulk(null);
      return v.type === "string" ? bulk(v.v) : WRONGTYPE;
    }
    case "INCR":
    case "INCRBY": {
      const v = get(a[0]);
      if (v && v.type !== "string") return WRONGTYPE;
      const cur = v ? v.v : "0";
      if (!isInt(cur)) return err("value is not an integer or out of range");
      const next = Number(cur) + (cmd === "INCR" ? 1 : Number(a[1] ?? 1));
      db.data.set(a[0], { type: "string", v: String(next) });
      return int(next);
    }
    case "DEL": {
      let n = 0;
      for (const k of a) {
        if (!db.data.delete(k)) continue;
        db.expires.delete(k);
        n++;
      }
      return int(n);
    }
    case "EXPIRE": {
      if (!get(a[0])) return int(0);
      db.expires.set(a[0], db.now + Number(a[1]));
      return int(1);
    }
    case "TTL": {
      if (!get(a[0])) return int(-2);
      const at = db.expires.get(a[0]);
      return int(at === undefined ? -1 : at - db.now);
    }
    case "LPUSH":
    case "RPUSH": {
      const l = typed(a[0], "list", () => ({ type: "list", v: [] }));
      if (!l) return WRONGTYPE;
      for (const x of a.slice(1)) {
        if (cmd === "LPUSH") l.v.unshift(x);
        else l.v.push(x);
      }
      return int(l.v.length);
    }
    case "LPOP":
    case "RPOP": {
      const l = get(a[0]);
      if (!l) return bulk(null);
      if (l.type !== "list") return WRONGTYPE;
      const x = cmd === "LPOP" ? l.v.shift() : l.v.pop();
      if (!l.v.length) db.data.delete(a[0]);
      return bulk(x);
    }
    case "LRANGE": {
      const l = get(a[0]);
      if (!l) return arr([]);
      if (l.type !== "list") return WRONGTYPE;
      const n = l.v.length;
      const s = Number(a[1]) < 0 ? n + Number(a[1]) : Number(a[1]);
      const e = Number(a[2]) < 0 ? n + Number(a[2]) : Number(a[2]);
      return arr(l.v.slice(Math.max(0, s), e + 1));
    }
    case "HSET": {
      if (need(3) || (a.length - 1) % 2) return err("wrong number of arguments for 'hset' command");
      const h = typed(a[0], "hash", () => ({ type: "hash", v: new Map() }));
      if (!h) return WRONGTYPE;
      let added = 0;
      for (let i = 1; i < a.length; i += 2) {
        if (!h.v.has(a[i])) added++;
        h.v.set(a[i], a[i + 1]);
      }
      return int(added);
    }
    case "HGET": {
      const h = get(a[0]);
      if (!h) return bulk(null);
      return h.type === "hash" ? bulk(h.v.get(a[1])) : WRONGTYPE;
    }
    case "HGETALL": {
      const h = get(a[0]);
      if (!h) return arr([]);
      return h.type === "hash" ? arr([...h.v].flat()) : WRONGTYPE;
    }
    case "SADD": {
      const s = typed(a[0], "set", () => ({ type: "set", v: new Set() }));
      if (!s) return WRONGTYPE;
      const before = s.v.size;
      for (const x of a.slice(1)) s.v.add(x);
      return int(s.v.size - before);
    }
    case "SMEMBERS": {
      const s = get(a[0]);
      if (!s) return arr([]);
      return s.type === "set" ? arr([...s.v]) : WRONGTYPE;
    }
    case "ZADD": {
      if (need(3) || (a.length - 1) % 2) return err("wrong number of arguments for 'zadd' command");
      const z = typed(a[0], "zset", () => ({ type: "zset", v: new Map() }));
      if (!z) return WRONGTYPE;
      let added = 0;
      for (let i = 1; i < a.length; i += 2) {
        if (Number.isNaN(Number(a[i]))) return err("value is not a valid float");
        if (!z.v.has(a[i + 1])) added++;
        z.v.set(a[i + 1], Number(a[i]));
      }
      return int(added);
    }
    case "ZINCRBY": {
      const z = typed(a[0], "zset", () => ({ type: "zset", v: new Map() }));
      if (!z) return WRONGTYPE;
      const n = (z.v.get(a[2]) ?? 0) + Number(a[1]);
      z.v.set(a[2], n);
      return bulk(String(n));
    }
    case "ZRANGE":
    case "ZREVRANGE": {
      const z = get(a[0]);
      if (!z) return arr([]);
      if (z.type !== "zset") return WRONGTYPE;
      const sorted = [...z.v].sort((x, y) => x[1] - y[1] || (x[0] < y[0] ? -1 : 1));
      if (cmd === "ZREVRANGE") sorted.reverse();
      const n = sorted.length;
      const s = Number(a[1]) < 0 ? n + Number(a[1]) : Number(a[1]);
      const e = Number(a[2]) < 0 ? n + Number(a[2]) : Number(a[2]);
      const part = sorted.slice(Math.max(0, s), e + 1);
      const scores = a.some((x) => x.toUpperCase() === "WITHSCORES");
      return arr(part.flatMap(([m, sc]) => (scores ? [m, String(sc)] : [m])));
    }
    case "TYPE": {
      const v = get(a[0]);
      return { text: v ? v.type : "none" };
    }
    case "OBJECT": {
      if ((a[0] ?? "").toUpperCase() !== "ENCODING") return err("only OBJECT ENCODING is supported here");
      const v = get(a[1]);
      return v ? bulk(encoding(v)) : bulk(null);
    }
    case "MEMORY": {
      const v = get(a[1]);
      return v ? int(memory(a[1], v)) : bulk(null);
    }
    case "KEYS": {
      const re = glob(a[0] ?? "*");
      return arr([...db.data.keys()].filter((k) => re.test(k)).sort());
    }
    case "DBSIZE":
      return int(db.data.size);
    default:
      return err(`unknown command '${rawCmd}' in this mini Redis`);
  }
}

/** Advance the virtual clock (for TTLs). */
export function tick(db: Db, seconds: number) {
  db.now += seconds;
  for (const k of [...db.data.keys()]) expireIfNeeded(db, k);
}

export const EXAMPLES: { label: string; lines: string[] }[] = [
  { label: "A session with a TTL", lines: ["SET session:9f2 alice EX 1800", "TTL session:9f2", "OBJECT ENCODING session:9f2"] },
  { label: "A page counter", lines: ["INCR views:/pricing", "INCR views:/pricing", "OBJECT ENCODING views:/pricing"] },
  { label: "A user as a hash", lines: ["HSET user:42 name Alice plan pro city Berlin", "HGETALL user:42", "OBJECT ENCODING user:42", "MEMORY USAGE user:42"] },
  { label: "A leaderboard", lines: ["ZADD board 3100 alice 2800 bob 4050 carol", "ZINCRBY board 500 bob", "ZREVRANGE board 0 2 WITHSCORES", "OBJECT ENCODING board"] },
  { label: "A job queue", lines: ["LPUSH jobs email:1 email:2 email:3", "RPOP jobs", "LRANGE jobs 0 -1"] },
  { label: "A hash too big to pack", lines: ["HSET big f0 v0", "__FILL big 200", "OBJECT ENCODING big", "MEMORY USAGE big"] },
];

/** Fill a hash with n fields, to cross the listpack limit. */
export function fill(db: Db, key: string, n: number) {
  const args: string[] = [];
  for (let i = 0; i < n; i++) args.push(`f${i}`, `v${i}`);
  return run(db, `HSET ${key} ${args.join(" ")}`);
}

// ---- one thread --------------------------------------------------------------------------------

export const KEY_SCAN_NS = 100; // illustrative: KEYS visits each key
export function slowCommand(keys: number, useScan: boolean) {
  const keysMs = (keys * KEY_SCAN_NS) / 1e6;
  // SCAN does the same work in batches of ~10 keys per call, other commands run in between.
  const blockMs = useScan ? (10 * KEY_SCAN_NS) / 1e6 : keysMs;
  const othersDelayed = Math.round(blockMs * 100); // at 100,000 commands a second
  return { keysMs, blockMs, othersDelayed };
}

// ---- persistence ---------------------------------------------------------------------------------

export type Persist = "none" | "rdb" | "aof-everysec" | "aof-always";
/** Seconds of writes lost when the server dies `crashAtS` seconds after the last RDB snapshot. */
export function lost(persist: Persist, crashAtS: number, rdbEveryS = 300) {
  if (persist === "none") return { lostS: Infinity, note: "nothing on disk: the whole dataset is gone on restart" };
  if (persist === "rdb") return { lostS: crashAtS % rdbEveryS, note: `snapshots every ${rdbEveryS / 60} min: everything since the last one is gone` };
  if (persist === "aof-everysec") return { lostS: 1, note: "every write is appended to the AOF and fsynced once a second: up to 1 s lost" };
  return { lostS: 0, note: "appendfsync always: fsync on every write, nothing lost, but each write waits for the disk" };
}

// ---- eviction ------------------------------------------------------------------------------------

export type Policy = "noeviction" | "allkeys-lru" | "volatile-lru" | "allkeys-lfu";
export type Key = { name: string; mb: number; lastUsedS: number; hits: number; ttl: boolean };
export const KEYSPACE: Key[] = [
  { name: "session:a1", mb: 12, lastUsedS: 4, hits: 40, ttl: true },
  { name: "session:b7", mb: 12, lastUsedS: 900, hits: 3, ttl: true },
  { name: "cache:home", mb: 30, lastUsedS: 1, hits: 9000, ttl: true },
  { name: "cache:report-2023", mb: 40, lastUsedS: 2400, hits: 2, ttl: true },
  { name: "queue:emails", mb: 18, lastUsedS: 2, hits: 600, ttl: false },
  { name: "ratelimit:ip", mb: 10, lastUsedS: 1, hits: 7000, ttl: true },
  { name: "feature-flags", mb: 2, lastUsedS: 30, hits: 5000, ttl: false },
  { name: "leaderboard", mb: 26, lastUsedS: 600, hits: 800, ttl: false },
];
/** Write `incomingMb` more with maxmemory at `limitMb`: which keys go, or does the write fail? */
export function evict(policy: Policy, limitMb: number, incomingMb: number) {
  const used = KEYSPACE.reduce((a, k) => a + k.mb, 0);
  let over = used + incomingMb - limitMb;
  if (over <= 0) return { evicted: [] as string[], error: null as string | null, used };
  if (policy === "noeviction") return { evicted: [], error: "OOM command not allowed when used memory > 'maxmemory'", used };
  const pool = KEYSPACE.filter((k) => policy !== "volatile-lru" || k.ttl);
  const order = [...pool].sort((x, y) => (policy === "allkeys-lfu" ? x.hits - y.hits : y.lastUsedS - x.lastUsedS));
  const evicted: string[] = [];
  for (const k of order) {
    if (over <= 0) break;
    evicted.push(k.name);
    over -= k.mb;
  }
  return { evicted, error: over > 0 ? "OOM: no more keys this policy may evict" : null, used };
}
