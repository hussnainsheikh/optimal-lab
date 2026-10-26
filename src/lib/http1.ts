// HTTP/1.1 on the wire. Part one builds real request and response bytes and parses a keep-alive
// connection carrying two responses back to back, framed by Content-Length, chunked
// transfer-encoding or by closing the connection (RFC 9112). A Content-Length that is wrong by
// a few bytes makes the parser read the leftover body as the next status line. Part two loads a
// page of 30 files millisecond by millisecond: a new connection per request, one kept-alive
// connection, pipelining on one connection (responses must come back in order, so one slow
// response holds up the rest), or six kept-alive connections like a browser. Bandwidth is shared
// fairly between transfers. File sizes and server times are illustrative.

export type Framing = "length" | "chunked" | "close";
export const HOST = "shop.example.com";
export const BODY = "<h1>Your cart</h1><p>2 items, $48.00</p>";
export const NEXT = '{"count":2}';

export function request(path: string, keepAlive: boolean): string {
  return [`GET ${path} HTTP/1.1`, `Host: ${HOST}`, "User-Agent: Mozilla/5.0", "Accept: text/html", "Accept-Encoding: gzip", `Connection: ${keepAlive ? "keep-alive" : "close"}`, "", ""].join("\r\n");
}

const utf8 = (s: string) => new TextEncoder().encode(s).length;

export function chunked(body: string, size = 16): string {
  let out = "";
  for (let i = 0; i < body.length; i += size) {
    const c = body.slice(i, i + size);
    out += `${utf8(c).toString(16)}\r\n${c}\r\n`;
  }
  return out + "0\r\n\r\n";
}

// The bytes the server writes for the page, then for a second request on the same connection.
export function responses(framing: Framing, lengthError: number): string {
  const head = (type: string, extra: string[]) => ["HTTP/1.1 200 OK", "Date: Sun, 25 Oct 2026 09:00:00 GMT", `Content-Type: ${type}`, ...extra, "", ""].join("\r\n");
  let first: string;
  if (framing === "chunked") first = head("text/html", ["Transfer-Encoding: chunked"]) + chunked(BODY);
  else if (framing === "close") first = head("text/html", ["Connection: close"]) + BODY;
  else first = head("text/html", [`Content-Length: ${utf8(BODY) + lengthError}`]) + BODY;
  if (framing === "close") return first; // nothing can follow: the end of the body is the end of the connection
  return first + head("application/json", [`Content-Length: ${utf8(NEXT)}`]) + NEXT;
}

export type Parsed = { status: string; headers: [string, string][]; body: string; framing: string; error?: string };

// A small RFC 9112 response parser for one connection's byte stream.
export function parseStream(raw: string, closed: boolean): Parsed[] {
  const out: Parsed[] = [];
  let pos = 0;
  while (pos < raw.length) {
    const end = raw.indexOf("\r\n\r\n", pos);
    const lineEnd = raw.indexOf("\r\n", pos);
    const statusLine = raw.slice(pos, lineEnd < 0 ? raw.length : lineEnd);
    if (!/^HTTP\/1\.[01] \d{3} /.test(statusLine)) {
      out.push({ status: "", headers: [], body: "", framing: "", error: `invalid status line: "${statusLine.slice(0, 40)}"` });
      break;
    }
    if (end < 0) {
      out.push({ status: statusLine, headers: [], body: "", framing: "", error: "headers never ended" });
      break;
    }
    const headers = raw
      .slice(lineEnd + 2, end)
      .split("\r\n")
      .map((l) => {
        const i = l.indexOf(":");
        return [l.slice(0, i), l.slice(i + 1).trim()] as [string, string];
      });
    const get = (k: string) => headers.find(([h]) => h.toLowerCase() === k.toLowerCase())?.[1];
    pos = end + 4;
    let body = "";
    let framing: string;
    const te = get("Transfer-Encoding");
    const cl = get("Content-Length");
    if (te && /chunked/i.test(te)) {
      framing = "chunked";
      for (;;) {
        const le = raw.indexOf("\r\n", pos);
        const size = parseInt(raw.slice(pos, le), 16);
        if (Number.isNaN(size)) {
          out.push({ status: statusLine, headers, body, framing, error: "bad chunk size" });
          return out;
        }
        pos = le + 2;
        if (size === 0) {
          pos += 2;
          break;
        }
        body += raw.slice(pos, pos + size);
        pos += size + 2;
      }
    } else if (cl !== undefined) {
      framing = `Content-Length ${cl}`;
      body = raw.slice(pos, pos + Number(cl));
      pos += Number(cl);
    } else {
      framing = closed ? "until the connection closes" : "no length: must close";
      body = raw.slice(pos);
      pos = raw.length;
    }
    out.push({ status: statusLine, headers, body, framing });
  }
  return out;
}

// ── Part two: a page of 30 files ─────────────────────────────────────────────

export type Mode = "close" | "keepalive" | "pipeline" | "six";
export const MODES: Mode[] = ["close", "keepalive", "pipeline", "six"];
export const MODE_LABEL: Record<Mode, string> = { close: "New connection each", keepalive: "One kept-alive", pipeline: "One, pipelined", six: "Six kept-alive" };
export const BANDWIDTH = 2500; // bytes per ms: 20 Mbps

export type File = { name: string; kb: number; server: number };
export const FILES: File[] = [
  { name: "index.html", kb: 14, server: 40 },
  { name: "app.css", kb: 30, server: 4 },
  { name: "theme.css", kb: 12, server: 4 },
  { name: "/api/cart", kb: 2, server: 350 },
  { name: "app.js", kb: 120, server: 4 },
  { name: "vendor.js", kb: 60, server: 4 },
  { name: "chart.js", kb: 35, server: 4 },
  { name: "track.js", kb: 20, server: 4 },
  ...Array.from({ length: 22 }, (_, i) => ({ name: `img-${i + 1}.jpg`, kb: 8 + ((i * 37) % 53), server: 4 })),
];

export type Segment = { conn: number; file: number; phase: "connect" | "wait" | "transfer"; from: number; to: number };
export type Load = { total: number; segments: Segment[]; connections: number; handshakes: number; slowDone: number };

type Conn = { open: boolean; busyUntil: number; job: number | null; phase: "idle" | "connect" | "wait" | "transfer"; left: number; phaseStart: number };

const loadCache = new Map<string, Load>();

export function loadPage(mode: Mode, rtt: number, slowApi: boolean): Load {
  const key = `${mode}-${rtt}-${slowApi}`;
  const hit = loadCache.get(key);
  if (hit) return hit;
  const files = FILES.map((f) => (f.name === "/api/cart" && !slowApi ? { ...f, server: 30 } : f));
  const segments: Segment[] = [];
  const nConn = mode === "close" || mode === "six" ? 6 : 1;
  const conns: Conn[] = Array.from({ length: nConn }, () => ({ open: false, busyUntil: 0, job: null, phase: "idle", left: 0, phaseStart: 0 }));
  const pending: number[] = [0];
  let discovered = false;
  let done = 0;
  let handshakes = 0;
  let slowDone = 0;
  const finished = new Array(files.length).fill(false);
  const handshake = 2 * rtt; // TCP, then TLS 1.3
  // pipelining: every request goes out at once; responses come back strictly in order
  const pipe: { file: number; ready: number }[] = [];
  let t = 0;
  const close = (c: Conn, i: number) => {
    segments.push({ conn: i, file: c.job!, phase: c.phase as Segment["phase"], from: c.phaseStart, to: t });
  };
  while (done < files.length && t < 60_000) {
    // hand out work
    for (let i = 0; i < conns.length; i++) {
      const c = conns[i];
      if (c.phase !== "idle") continue;
      if (mode === "pipeline") {
        if (!pending.length && !pipe.length) continue;
        if (!c.open) {
          c.job = pending[0];
          c.phase = "connect";
          c.phaseStart = t;
          c.busyUntil = t + handshake;
          handshakes++;
          continue;
        }
        // send everything pending now; each is ready once its round trip and server time pass
        for (const f of pending.splice(0)) pipe.push({ file: f, ready: t + rtt + files[f].server });
        if (pipe.length && pipe[0].ready <= t) {
          const p = pipe.shift()!;
          c.job = p.file;
          c.phase = "transfer";
          c.phaseStart = t;
          c.left = files[p.file].kb * 1000;
        } else if (pipe.length) {
          c.job = pipe[0].file;
          c.phase = "wait";
          c.phaseStart = t;
          c.busyUntil = pipe[0].ready;
        }
        continue;
      }
      if (!pending.length) continue;
      const f = pending.shift()!;
      c.job = f;
      c.phaseStart = t;
      if (!c.open || mode === "close") {
        c.phase = "connect";
        c.busyUntil = t + handshake;
        handshakes++;
      } else {
        c.phase = "wait";
        c.busyUntil = t + rtt + files[f].server;
      }
    }
    // advance one millisecond
    const sending = conns.filter((c) => c.phase === "transfer");
    const share = sending.length ? BANDWIDTH / sending.length : 0;
    t++;
    for (let i = 0; i < conns.length; i++) {
      const c = conns[i];
      if (c.phase === "connect" && t >= c.busyUntil) {
        close(c, i);
        c.open = true;
        if (mode === "pipeline") {
          c.phase = "idle";
          c.job = null;
        } else {
          c.phase = "wait";
          c.phaseStart = t;
          c.busyUntil = t + rtt + files[c.job!].server;
        }
      } else if (c.phase === "wait" && t >= c.busyUntil) {
        close(c, i);
        if (mode === "pipeline") {
          const p = pipe.shift()!;
          c.job = p.file;
        }
        c.phase = "transfer";
        c.phaseStart = t;
        c.left = files[c.job!].kb * 1000;
      } else if (c.phase === "transfer") {
        c.left -= share;
        if (c.left <= 0) {
          close(c, i);
          const f = c.job!;
          finished[f] = true;
          done++;
          if (files[f].name === "/api/cart") slowDone = t;
          if (f === 0 && !discovered) {
            discovered = true;
            for (let k = 1; k < files.length; k++) pending.push(k);
          }
          c.phase = "idle";
          c.job = null;
          if (mode === "close") c.open = false;
        }
      }
    }
  }
  const res: Load = { total: t, segments, connections: mode === "close" ? handshakes : nConn, handshakes, slowDone };
  loadCache.set(key, res);
  return res;
}
