// gRPC and protobuf. A message is encoded byte for byte the way protobuf does it: each field is a
// tag (field number << 3 | wire type) followed by a varint, or by a length and bytes; sint32 uses
// zigzag so small negatives stay small; repeated numbers are packed; proto3 leaves out fields
// at their default. gRPC wraps each message in a 5-byte prefix (compressed flag + length) inside
// HTTP/2 DATA frames, and reports success or failure in trailers. A decoder that only knows the
// old schema reads bytes written with a changed one: added fields are skipped, renamed fields
// still work, a changed type silently decodes the wrong number, and a reused field number drops
// data. HTTP/2 header sizes are illustrative (HPACK compresses repeats).

export type FType = "uint64" | "string" | "uint32s" | "sint32" | "int32" | "bool" | "uint32";
export type FieldDef = { no: number; name: string; type: FType };
export type Schema = FieldDef[];

export const V1: Schema = [
  { no: 1, name: "id", type: "uint64" },
  { no: 2, name: "customer", type: "string" },
  { no: 3, name: "item_ids", type: "uint32s" },
  { no: 4, name: "adjustment", type: "sint32" },
  { no: 5, name: "gift", type: "bool" },
];

export type Value = Record<string, number | string | boolean | number[]>;

const PROTO_TYPE: Record<FType, string> = { uint64: "uint64", string: "string", uint32s: "repeated uint32", sint32: "sint32", int32: "int32", bool: "bool", uint32: "uint32" };
export function protoText(s: Schema): string {
  return ["message Order {", ...s.map((f) => `  ${PROTO_TYPE[f.type]} ${f.name} = ${f.no};`), "}"].join("\n");
}

const B0 = BigInt(0);
const B7 = BigInt(7);
const B7F = BigInt(0x7f);

function varint(n: bigint): number[] {
  const out: number[] = [];
  let v = BigInt.asUintN(64, n);
  do {
    let b = Number(v & B7F);
    v >>= B7;
    if (v) b |= 0x80;
    out.push(b);
  } while (v);
  return out;
}

const wireType = (t: FType) => (t === "string" || t === "uint32s" ? 2 : 0);

export type Seg = { field: string; part: "tag" | "value" | "length"; bytes: number[]; note: string };

export function encode(v: Value, s: Schema): Seg[] {
  const segs: Seg[] = [];
  for (const f of s) {
    const x = v[f.name];
    if (x === undefined || x === 0 || x === "" || x === false || (Array.isArray(x) && x.length === 0)) continue; // proto3 default: not sent
    const tag = (f.no << 3) | wireType(f.type);
    segs.push({ field: f.name, part: "tag", bytes: varint(BigInt(tag)), note: `field ${f.no}, wire type ${wireType(f.type)} (${wireType(f.type) ? "length-delimited" : "varint"})` });
    if (f.type === "string") {
      const bytes = Array.from(new TextEncoder().encode(String(x)));
      segs.push({ field: f.name, part: "length", bytes: varint(BigInt(bytes.length)), note: `${bytes.length} bytes follow` });
      segs.push({ field: f.name, part: "value", bytes, note: `"${x}" in UTF-8` });
    } else if (f.type === "uint32s") {
      const bytes = (x as number[]).flatMap((n) => varint(BigInt(n)));
      segs.push({ field: f.name, part: "length", bytes: varint(BigInt(bytes.length)), note: `packed: ${bytes.length} bytes of varints` });
      segs.push({ field: f.name, part: "value", bytes, note: (x as number[]).join(", ") });
    } else if (f.type === "sint32") {
      const n = Number(x);
      const zz = ((n << 1) ^ (n >> 31)) >>> 0;
      segs.push({ field: f.name, part: "value", bytes: varint(BigInt(zz)), note: `${n} → zigzag ${zz}` });
    } else if (f.type === "int32") {
      const n = Number(x);
      segs.push({ field: f.name, part: "value", bytes: varint(BigInt(n)), note: n < 0 ? `${n} as a 64-bit two's complement varint` : String(n) });
    } else if (f.type === "bool") segs.push({ field: f.name, part: "value", bytes: [1], note: "true" });
    else segs.push({ field: f.name, part: "value", bytes: varint(BigInt(Number(x))), note: String(x) });
  }
  return segs;
}

export const flat = (segs: Seg[]) => segs.flatMap((s) => s.bytes);

export type Decoded = { values: Value; unknown: string[] };

export function decode(bytes: number[], s: Schema): Decoded {
  const values: Value = {};
  const unknown: string[] = [];
  let i = 0;
  const readVarint = () => {
    let r = B0;
    let shift = B0;
    for (;;) {
      const b = bytes[i++];
      r |= BigInt(b & 0x7f) << shift;
      if (!(b & 0x80)) return r;
      shift += B7;
    }
  };
  while (i < bytes.length) {
    const tag = Number(readVarint());
    const no = tag >> 3;
    const wt = tag & 7;
    const f = s.find((d) => d.no === no);
    let raw: bigint | number[];
    if (wt === 0) raw = readVarint();
    else {
      const len = Number(readVarint());
      raw = bytes.slice(i, i + len);
      i += len;
    }
    if (!f || wireType(f.type) !== wt) {
      unknown.push(`field ${no} (wire type ${wt}${f ? `, expected ${wireType(f.type)} for ${f.name}` : ""})`);
      continue;
    }
    if (f.type === "string") values[f.name] = new TextDecoder().decode(new Uint8Array(raw as number[]));
    else if (f.type === "uint32s") {
      const arr: number[] = [];
      const inner = raw as number[];
      let j = 0;
      while (j < inner.length) {
        let r = 0;
        let sh = 0;
        for (;;) {
          const b = inner[j++];
          r += (b & 0x7f) * 2 ** sh;
          if (!(b & 0x80)) break;
          sh += 7;
        }
        arr.push(r);
      }
      values[f.name] = arr;
    } else {
      const n = raw as bigint;
      if (f.type === "sint32") {
        const u = Number(BigInt.asUintN(32, n));
        values[f.name] = (u >>> 1) ^ -(u & 1);
      } else if (f.type === "int32") values[f.name] = Number(BigInt.asIntN(32, n));
      else if (f.type === "bool") values[f.name] = n !== B0;
      else values[f.name] = Number(n);
    }
  }
  // proto3: a field that wasn't sent reads as its default
  for (const f of s) if (!(f.name in values)) values[f.name] = f.type === "string" ? "" : f.type === "uint32s" ? [] : f.type === "bool" ? false : 0;
  return { values, unknown };
}

// ── Changing the contract ────────────────────────────────────────────────────

export type Change = "add" | "rename" | "retype" | "reuse";
export const CHANGE_LABEL: Record<Change, string> = { add: "Add a field", rename: "Rename a field", retype: "sint32 → int32", reuse: "Reuse number 2" };

export function evolve(c: Change, v: Value): { schema: Schema; value: Value; diff: string } {
  switch (c) {
    case "add":
      return { schema: [...V1, { no: 6, name: "coupon", type: "string" }], value: { ...v, coupon: "SPRING10" }, diff: "+ string coupon = 6;" };
    case "rename":
      return { schema: V1.map((f) => (f.no === 2 ? { ...f, name: "buyer" } : f)), value: { ...Object.fromEntries(Object.entries(v).filter(([k]) => k !== "customer")), buyer: v.customer }, diff: "~ string buyer = 2;  (was customer)" };
    case "retype":
      return { schema: V1.map((f) => (f.no === 4 ? { ...f, type: "int32" as FType } : f)), value: v, diff: "~ int32 adjustment = 4;  (was sint32)" };
    case "reuse":
      return { schema: [...V1.filter((f) => f.no !== 2), { no: 2, name: "store_id", type: "uint32" as FType }].sort((a, b) => a.no - b.no), value: { ...Object.fromEntries(Object.entries(v).filter(([k]) => k !== "customer")), store_id: 41 }, diff: "- string customer = 2;\n+ uint32 store_id = 2;" };
  }
}

// What JSON over REST would send for the same message.
export function jsonOf(v: Value): string {
  return JSON.stringify(v);
}

// ── gRPC framing over HTTP/2 ─────────────────────────────────────────────────

export type Status = "OK" | "NOT_FOUND" | "DEADLINE_EXCEEDED";
export const STATUS_CODE: Record<Status, number> = { OK: 0, NOT_FOUND: 5, DEADLINE_EXCEEDED: 4 };

export function grpcPrefix(len: number): number[] {
  return [0, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff];
}

export type Frame = { dir: "request" | "response"; name: string; bytes: number; lines: string[] };

export function grpcCall(msgLen: number, status: Status, first: boolean): Frame[] {
  const h = (n: number) => (first ? n : Math.round(n / 5)); // HPACK: repeats become table indexes
  const frames: Frame[] = [
    { dir: "request", name: "HEADERS", bytes: 9 + h(96), lines: [":method POST", ":path /shop.v1.Orders/GetOrder", ":authority orders.internal", "content-type: application/grpc", "te: trailers", "grpc-timeout: 300m"] },
    { dir: "request", name: "DATA", bytes: 9 + 5 + 6, lines: ["00 00 00 00 06 · not compressed, 6 bytes", "GetOrderRequest { id: 1234567 }"] },
    { dir: "response", name: "HEADERS", bytes: 9 + h(28), lines: [":status 200", "content-type: application/grpc"] },
  ];
  if (status === "OK") frames.push({ dir: "response", name: "DATA", bytes: 9 + 5 + msgLen, lines: [`${grpcPrefix(msgLen).map((b) => b.toString(16).padStart(2, "0")).join(" ")} · not compressed, ${msgLen} bytes`, "Order { … }"] });
  frames.push({ dir: "response", name: "HEADERS (trailers)", bytes: 9 + h(status === "OK" ? 14 : 40), lines: [`grpc-status: ${STATUS_CODE[status]}${status === "OK" ? "" : ` (${status})`}`, ...(status === "OK" ? [] : [`grpc-message: ${status === "NOT_FOUND" ? "order 1234567 not found" : "deadline exceeded after 300ms"}`])] });
  return frames;
}

export function restCall(jsonLen: number, status: Status) {
  const req = 380; // HTTP/1.1 repeats every header on every request
  const res = 190 + (status === "OK" ? jsonLen : 60);
  return { req, res, total: req + res, status: status === "OK" ? 200 : status === "NOT_FOUND" ? 404 : 504 };
}
