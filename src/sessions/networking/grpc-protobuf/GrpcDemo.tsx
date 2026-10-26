"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { CHANGE_LABEL, STATUS_CODE, V1, decode, encode, evolve, flat, grpcCall, jsonOf, protoText, restCall, type Change, type Seg, type Status, type Value } from "@/lib/protobuf";

const ACCENT = "var(--net)";
const ITEMS = [3, 270, 86942, 12, 5021, 77, 140000, 9, 650, 31337, 2, 48, 1999, 70000, 404, 8, 123456, 64, 1000, 15];

type Opts = { customer: string; items: number; adjustment: number; gift: boolean; later: boolean; status: Status; change: Change };
const START: Opts = { customer: "Ana Silva", items: 3, adjustment: -150, gift: true, later: false, status: "OK", change: "add" };
const BREAK: Opts = { ...START, status: "DEADLINE_EXCEEDED", change: "retype" };

const PART_COLOR: Record<Seg["part"], string> = { tag: "var(--c4)", length: "var(--muted)", value: "var(--text)" };
const VERDICT: Record<Change, { ok: boolean; text: string }> = {
  add: { ok: true, text: "Safe. Old clients skip field 6 and carry it along as an unknown field." },
  rename: { ok: true, text: "Safe on the wire: only numbers travel. But anything reading JSON (gRPC-JSON transcoding, logs, REST clients) now sees “buyer” instead of “customer”." },
  retype: { ok: false, text: "Silent corruption. sint32 and int32 are both varints, so nothing fails: old clients read the bytes with zigzag and get a different number." },
  reuse: { ok: false, text: "Silent data loss. Old clients expect a string at field 2, see a number, and drop it. Mark deleted numbers with reserved 2; so nobody can reuse them." },
};
const hx = (bs: number[]) => bs.map((x) => x.toString(16).padStart(2, "0")).join(" ");
const fmt = (v: Value[string] | undefined) => (v === undefined ? "—" : Array.isArray(v) ? `[${v.join(", ")}]` : typeof v === "string" ? `"${v}"` : String(v));

export default function GrpcDemo() {
  const [o, setO] = useState<Opts>(START);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const value: Value = { id: 1234567, customer: o.customer, item_ids: ITEMS.slice(0, o.items), adjustment: o.adjustment, gift: o.gift };
  const segs = encode(value, V1);
  const bytes = flat(segs);
  const json = jsonOf(value);
  const frames = grpcCall(bytes.length, o.status, !o.later);
  const grpcTotal = frames.reduce((s, f) => s + f.bytes, 0);
  const rest = restCall(new TextEncoder().encode(json).length, o.status);
  const ev = evolve(o.change, value);
  const v2bytes = flat(encode(ev.value, ev.schema));
  const old = decode(v2bytes, V1);
  const verdict = VERDICT[o.change];
  const failed = o.status !== "OK";

  const nodes: MapNode[] = [
    { id: "checkout", label: "Checkout service", sub: "generated client stub", at: [12, 55], mobileAt: [50, 7], state: "active" },
    { id: "proxy", label: "Envoy", sub: "balances each call", at: [40, 55], mobileAt: [50, 35], state: "active" },
    { id: "orders", label: "Orders service", sub: failed ? `grpc-status ${STATUS_CODE[o.status]}` : "GetOrder", at: [68, 55], mobileAt: [50, 63], state: failed ? "bad" : "good" },
    { id: "old", label: "Mobile app v1", sub: "built with the old .proto", at: [88, 18], mobileAt: [50, 91], state: verdict.ok ? "good" : "bad" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("c", ["checkout", "proxy", "orders"], { label: "GetOrder(1234567)" })
    : stage === 1 ? hops("e", ["orders", "proxy", "checkout"], { label: `${bytes.length} B (JSON ${json.length})`, tone: "good" })
    : stage === 2 ? hops("f", ["checkout", "proxy", "orders"], { label: `HEADERS + DATA` })
    : stage === 3 ? hops("t", ["orders", "proxy", "checkout"], { label: `trailers: ${o.status}`, tone: failed ? "bad" : "good" })
    : stage === 4 ? hops("v", ["orders", "old"], { label: `v2 bytes → v1 reader`, tone: verdict.ok ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: checkout calls GetOrder on the orders service through a stub generated from the .proto file, as if it were a local function.`,
    `Step 2: the Order encodes to ${bytes.length} bytes of protobuf; the same data as JSON is ${json.length} bytes, because field names and numbers travel as text.`,
    `Step 3: gRPC puts a 5-byte prefix on the message and sends it as HTTP/2 frames: ${grpcTotal} bytes for the call, against about ${rest.total} for REST over HTTP/1.1.`,
    failed ? `Step 4: the HTTP status is still 200; the failure is in the trailers: grpc-status ${STATUS_CODE[o.status]} (${o.status}).` : "Step 4: the trailers after the data carry grpc-status 0: the call succeeded.",
    `Step 5: ${CHANGE_LABEL[o.change]}: ${verdict.text.split(".")[0]}.`,
  ];
  const caption = stage !== null ? captions[stage] : `Order: ${bytes.length} bytes of protobuf vs ${json.length} of JSON. The schema change “${CHANGE_LABEL[o.change]}” is ${verdict.ok ? "safe" : "not safe"} for old clients.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="gRPC and protobuf"
        blurb="gRPC lets one service call another as if it were a local function. The contract is a .proto file; messages travel as compact protobuf bytes in HTTP/2 frames. Encode a message byte by byte, see the frames and trailers, then change the contract and watch an old client read the new bytes."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A checkout service calls an orders service over gRPC through Envoy; an old mobile app reads the same messages with an older schema"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "checkout", to: "proxy", label: "HTTP/2", dashed: true },
                  { from: "proxy", to: "orders", label: "HTTP/2", dashed: true },
                  { from: "orders", to: "old", label: "Order bytes" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.75}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The encoded message">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Order on the wire · {bytes.length} bytes</p>
                <p className="mt-2 break-words font-mono text-xs leading-relaxed">
                  {segs.map((s, i) => (
                    <span key={i} style={{ color: PART_COLOR[s.part] }}>
                      {hx(s.bytes)}{" "}
                    </span>
                  ))}
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-[var(--muted)]">
                  <span><span style={{ color: "var(--c4)" }}>■</span> tag</span>
                  <span><span style={{ color: "var(--muted)" }}>■</span> length</span>
                  <span><span style={{ color: "var(--text)" }}>■</span> value</span>
                  <span>JSON: {json.length} bytes</span>
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(START)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Happy path
                </button>
                <button type="button" onClick={() => setO(BREAK)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Timeout, risky change
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Calling…">
                Make the call
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Write the contract" what="Both sides share a .proto file. Each field has a type and a number; the numbers, not the names, go on the wire. Code generators turn it into client stubs and server interfaces in any language." accent={ACCENT} active={at(0)}>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">{protoText(V1)}</pre>
                <label className="block text-sm">
                  <span className="font-medium">customer</span>
                  <input type="text" value={o.customer} maxLength={60} onChange={(e) => set({ customer: e.target.value })} className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--inset)] px-3 font-mono text-sm" />
                </label>
                <Slider label="item_ids" value={o.items} min={0} max={ITEMS.length} step={1} format={(v) => `${v} items`} onChange={(v) => set({ items: v })} accent={ACCENT} />
                <Slider label="adjustment" value={o.adjustment} min={-500} max={500} step={10} format={(v) => String(v)} onChange={(v) => set({ adjustment: v })} accent={ACCENT} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.gift} onChange={(e) => set({ gift: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  gift
                </label>
              </FlowStep>
              <FlowArrow label="an Order value" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Encode the message" what="Each field becomes a tag (field number and wire type) and a value. Numbers are varints: 7 bits per byte, so small numbers take one byte. sint32 uses zigzag so −150 stays small. Fields at their default (0, empty, false) aren't sent at all." accent={ACCENT} active={at(1)}>
                <ul className="space-y-1 text-[11px]">
                  {segs.map((s, i) => (
                    <li key={i} className="grid grid-cols-[minmax(0,6rem)_minmax(0,1fr)] gap-2">
                      <span className="text-[var(--muted)]">
                        {s.field} · {s.part}
                      </span>
                      <span className="min-w-0 break-words font-mono">
                        {s.bytes.length > 16 ? `${hx(s.bytes.slice(0, 16))} …` : hx(s.bytes)} <span className="font-sans text-[var(--faint)]">{s.note}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="font-mono text-xs">
                  protobuf {bytes.length} B · JSON {json.length} B
                </p>
              </FlowStep>
              <FlowArrow label="length-prefixed message" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Frame it on HTTP/2" what="gRPC sends each call as an HTTP/2 stream: a HEADERS frame naming the method, DATA frames with each message behind a 5-byte prefix, and trailers at the end. Many calls share one long-lived connection, so the balancer must work per call (like Envoy), not per connection." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.later} onChange={(e) => set({ later: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  A later call on the same connection (headers compressed by HPACK)
                </label>
                <ul className="space-y-1.5 text-[11px]">
                  {frames.map((f, i) => (
                    <li key={i} className="rounded-md bg-[var(--inset)] p-2">
                      <div className="flex justify-between gap-2 font-medium">
                        <span>
                          {f.dir === "request" ? "→" : "←"} {f.name}
                        </span>
                        <span className="font-mono">{f.bytes} B</span>
                      </div>
                      <div className="break-words font-mono text-[var(--muted)]">{f.lines.join(" · ")}</div>
                    </li>
                  ))}
                </ul>
                <p className="font-mono text-xs">
                  gRPC {grpcTotal} B · REST + JSON over HTTP/1.1 ~{rest.total} B
                </p>
              </FlowStep>
              <FlowArrow label="trailers" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Report the result in trailers" what="The HTTP status is 200 even when the call fails: gRPC's own status code arrives in the trailers after the data. A deadline set by the caller travels as grpc-timeout, so every service down the chain knows how long it has left." accent={ACCENT} active={at(3)}>
                <Choices<Status> accent={ACCENT} value={o.status} onChange={(v) => set({ status: v })} options={(Object.keys(STATUS_CODE) as Status[]).map((id) => ({ id, label: id }))} />
                <p className="font-mono text-xs" style={{ color: failed ? "var(--bad)" : "var(--good)" }}>
                  HTTP 200 · grpc-status {STATUS_CODE[o.status]} · REST would say HTTP {rest.status}
                </p>
              </FlowStep>
              <FlowArrow label="v2 of the contract" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Change the contract" what="Clients built from the old .proto keep running for months. They decode new bytes with the old schema. Adding fields is safe; changing a field's type or reusing its number breaks them, usually without an error." accent={ACCENT} active={at(4)}>
                <Choices<Change> accent={ACCENT} value={o.change} onChange={(v) => set({ change: v })} options={(Object.keys(CHANGE_LABEL) as Change[]).map((id) => ({ id, label: CHANGE_LABEL[id] }))} />
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">{ev.diff}</pre>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[16rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">v1 field</th>
                        <th className="py-1 text-right font-normal">sent</th>
                        <th className="py-1 text-right font-normal">old client reads</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {V1.map((f) => {
                        const sent = o.change === "rename" && f.no === 2 ? ev.value.buyer : ev.value[f.name];
                        const got = old.values[f.name];
                        const same = fmt(sent) === fmt(got);
                        return (
                          <tr key={f.no} className="border-t border-[var(--line)]">
                            <td className="py-1">{f.name}</td>
                            <td className="max-w-[8rem] truncate py-1 text-right">{fmt(sent)}</td>
                            <td className="max-w-[8rem] truncate py-1 text-right" style={{ color: same ? undefined : "var(--bad)" }}>{fmt(got)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {old.unknown.length > 0 && <p className="text-xs text-[var(--muted)]">Skipped as unknown: {old.unknown.join("; ")}</p>}
                <p className="text-xs" style={{ color: verdict.ok ? "var(--good)" : "var(--bad)" }}>
                  {verdict.ok ? "✓" : "✕"} {verdict.text}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Encoding and decoding follow the protobuf wire format and run here. HTTP/2 header sizes and the REST comparison are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
