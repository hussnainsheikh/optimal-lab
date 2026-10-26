// Reading a packet capture, the way tcpdump and Wireshark show one. A short capture of a real
// exchange — an ARP lookup, a DNS query and answer, a TCP+TLS handshake to an HTTPS server, and
// some application data — is stored as structured packets. A display filter (a small expression
// like `tcp.port == 443 && tcp.flags.syn == 1`) is parsed and evaluated against each packet, the
// way Wireshark filters. "Follow the stream" picks every packet of one TCP connection. The point
// the capture makes: you can read the handshake and the SNI, but once TLS is up the payload is
// just ciphertext — the capture shows that a request happened and how big it was, not what it said.
// Timestamps and byte counts are illustrative; the filter grammar is a usable subset of Wireshark's.

export type Pkt = {
  no: number;
  t: number; // seconds into the capture
  proto: "ARP" | "DNS" | "TCP" | "TLS";
  src: string;
  dst: string;
  sport?: number;
  dport?: number;
  len: number;
  flags: { syn: boolean; ack: boolean; fin: boolean; rst: boolean; psh: boolean };
  stream: number | null; // TCP connection id
  info: string;
  readable: string; // what you can actually read from it
  encrypted: boolean;
};

const C = "192.168.1.40";
const GW = "192.168.1.1";
const DNS = "192.168.1.1";
const S = "203.0.113.42";
const f = (o: Partial<Pkt["flags"]> = {}): Pkt["flags"] => ({ syn: false, ack: false, fin: false, rst: false, psh: false, ...o });

export const CAPTURE: Pkt[] = [
  { no: 1, t: 0.0, proto: "ARP", src: C, dst: "broadcast", len: 42, flags: f(), stream: null, info: "Who has 192.168.1.1? Tell 192.168.1.40", readable: "both MAC and IP addresses", encrypted: false },
  { no: 2, t: 0.002, proto: "ARP", src: GW, dst: C, len: 42, flags: f(), stream: null, info: "192.168.1.1 is at b0:4e:26:11:9a:01", readable: "the gateway's MAC address", encrypted: false },
  { no: 3, t: 0.01, proto: "DNS", src: C, dst: DNS, sport: 51210, dport: 53, len: 74, flags: f(), stream: null, info: "Standard query A shop.example.com", readable: "the name being looked up, in plain text", encrypted: false },
  { no: 4, t: 0.03, proto: "DNS", src: DNS, dst: C, sport: 53, dport: 51210, len: 90, flags: f(), stream: null, info: "Standard query response A 203.0.113.42", readable: "the name and its answer", encrypted: false },
  { no: 5, t: 0.05, proto: "TCP", src: C, dst: S, sport: 51515, dport: 443, len: 74, flags: f({ syn: true }), stream: 0, info: "51515 → 443 [SYN] Seq=0 Win=64240", readable: "ports, sequence number, flags, window", encrypted: false },
  { no: 6, t: 0.09, proto: "TCP", src: S, dst: C, sport: 443, dport: 51515, len: 74, flags: f({ syn: true, ack: true }), stream: 0, info: "443 → 51515 [SYN, ACK] Seq=0 Ack=1", readable: "ports, sequence and ack numbers, flags", encrypted: false },
  { no: 7, t: 0.09, proto: "TCP", src: C, dst: S, sport: 51515, dport: 443, len: 66, flags: f({ ack: true }), stream: 0, info: "51515 → 443 [ACK] Seq=1 Ack=1", readable: "ports, flags", encrypted: false },
  { no: 8, t: 0.1, proto: "TLS", src: C, dst: S, sport: 51515, dport: 443, len: 571, flags: f({ psh: true, ack: true }), stream: 0, info: "Client Hello (SNI=shop.example.com)", readable: "the TLS version offered and the site name (SNI)", encrypted: false },
  { no: 9, t: 0.14, proto: "TLS", src: S, dst: C, sport: 443, dport: 51515, len: 1484, flags: f({ psh: true, ack: true }), stream: 0, info: "Server Hello, Certificate, …", readable: "the chosen cipher and, in TLS 1.2, the certificate", encrypted: false },
  { no: 10, t: 0.18, proto: "TLS", src: C, dst: S, sport: 51515, dport: 443, len: 130, flags: f({ psh: true, ack: true }), stream: 0, info: "Application Data", readable: "nothing: this is the encrypted request", encrypted: true },
  { no: 11, t: 0.25, proto: "TLS", src: S, dst: C, sport: 443, dport: 51515, len: 1424, flags: f({ psh: true, ack: true }), stream: 0, info: "Application Data", readable: "nothing: the encrypted response, only its size", encrypted: true },
  { no: 12, t: 0.3, proto: "TCP", src: C, dst: S, sport: 51515, dport: 443, len: 66, flags: f({ fin: true, ack: true }), stream: 0, info: "51515 → 443 [FIN, ACK]", readable: "ports, flags", encrypted: false },
];

// ── A small Wireshark-style display filter ───────────────────────────────────

function field(p: Pkt, name: string): string | number | boolean | null {
  switch (name) {
    case "arp": return p.proto === "ARP";
    case "dns": return p.proto === "DNS";
    case "tcp": return p.proto === "TCP" || p.proto === "TLS";
    case "tls": return p.proto === "TLS";
    case "tcp.port": return p.sport && p.dport ? `${p.sport},${p.dport}` : null;
    case "tcp.srcport": return p.sport ?? null;
    case "tcp.dstport": return p.dport ?? null;
    case "tcp.flags.syn": return p.flags.syn ? 1 : 0;
    case "tcp.flags.ack": return p.flags.ack ? 1 : 0;
    case "tcp.flags.fin": return p.flags.fin ? 1 : 0;
    case "tcp.flags.reset": return p.flags.rst ? 1 : 0;
    case "ip.addr": return `${p.src},${p.dst}`;
    case "ip.src": return p.src;
    case "ip.dst": return p.dst;
    case "frame.len": return p.len;
    default: return null;
  }
}

function cmp(got: string | number | boolean | null, op: string, want: string): boolean {
  if (got === null) return false;
  if (typeof got === "boolean") return got; // existence test, e.g. `tls`
  // tcp.port / ip.addr hold two values joined by a comma: match either side
  if (typeof got === "string" && got.includes(",") && (op === "==" || op === "!=")) {
    const parts = got.split(",");
    const hit = parts.some((x) => x === want);
    return op === "==" ? hit : !hit;
  }
  const g = typeof got === "number" ? got : got;
  const w = typeof got === "number" ? Number(want) : want.replace(/^["']|["']$/g, "");
  switch (op) {
    case "==": return g === w;
    case "!=": return g !== w;
    case ">": return Number(g) > Number(w);
    case "<": return Number(g) < Number(w);
    case ">=": return Number(g) >= Number(w);
    case "<=": return Number(g) <= Number(w);
    default: return false;
  }
}

export type Filter = { ok: true; test: (p: Pkt) => boolean } | { ok: false; error: string };

// Parse `a == b && c`, `tls`, `tcp.port == 443 || arp`, with && || and parentheses.
export function parse(src: string): Filter {
  const s = src.trim();
  if (!s) return { ok: true, test: () => true };
  const matched = s.match(/\(|\)|&&|\|\||==|!=|>=|<=|>|<|[\w.]+|"[^"]*"/g);
  if (!matched) return { ok: false, error: "couldn't read the filter" };
  const tokens: string[] = matched;
  let i = 0;
  const peek = (): string => tokens[i] ?? "";
  const COMPARE = new Set(["==", "!=", ">", "<", ">=", "<="]);

  function atom(): ((p: Pkt) => boolean) | null {
    if (peek() === "(") {
      i++;
      const e = expr();
      if (peek() !== ")") return null;
      i++;
      return e;
    }
    const name = tokens[i++];
    if (!name || /^(&&|\|\||\))$/.test(name)) return null;
    if (COMPARE.has(peek())) {
      const op = tokens[i++];
      const val = tokens[i++];
      if (val === undefined) return null;
      return (p: Pkt) => cmp(field(p, name), op, val);
    }
    return (p: Pkt) => field(p, name) === true; // existence test
  }
  type Test = (p: Pkt) => boolean;
  function expr(): Test | null {
    let left: Test | null = atom();
    if (!left) return null;
    while (peek() === "&&" || peek() === "||") {
      const op = tokens[i++];
      const right = atom();
      if (!right) return null;
      const l: Test = left;
      const r: Test = right;
      left = op === "&&" ? (p: Pkt) => l(p) && r(p) : (p: Pkt) => l(p) || r(p);
    }
    return left;
  }
  const test = expr();
  if (!test || i < tokens.length) return { ok: false, error: `can't parse near "${tokens.slice(i).join(" ") || tokens[tokens.length - 1]}"` };
  return { ok: true, test };
}

export function apply(src: string): { matches: Set<number>; error: string | null } {
  const fexpr = parse(src);
  if (!fexpr.ok) return { matches: new Set(), error: fexpr.error };
  const matches = new Set<number>();
  for (const p of CAPTURE) if (fexpr.test(p)) matches.add(p.no);
  return { matches, error: null };
}

export function stream(id: number): Pkt[] {
  return CAPTURE.filter((p) => p.stream === id);
}

export const EXAMPLES = ["tls", "dns", "tcp.port == 443", "tcp.flags.syn == 1 && tcp.flags.ack == 0", "frame.len > 1000", "arp || dns", 'ip.addr == 203.0.113.42'];
