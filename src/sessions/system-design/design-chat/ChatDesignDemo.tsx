"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { BATCH_S, CHANGES_PER_HOUR, GATEWAYS, GROUPS, ONLINE, ONLINE_CONTACTS, PER_GATEWAY, SKEW_S, fanout, fmt, order, presenceRate, receipts, type Presence, type Receipts } from "@/lib/chatDesign";

const ACCENT = "var(--sys)";

export default function ChatDesignDemo() {
  const [members, setMembers] = useState(50);
  const [by, setBy] = useState<"client" | "server">("client");
  const [mode, setMode] = useState<Receipts>("each");
  const [presence, setPresence] = useState<Presence>("eager");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const f = fanout(members);
  const rc = receipts(members, mode);
  const msgs = order(by);
  const wrong = msgs[1].from !== "Alice";

  const packets: Packet[] =
    stage === 0 ? hops("m", ["alice", "gwa", "chat"], { label: "“Yes! See you there”" })
    : stage === 1 ? hops("s", ["chat", "store"], { label: by === "server" ? "seq 2" : "client time", tone: wrong ? "bad" : "good" })
    : stage === 2 ? hops("reg", ["chat", "registry", "chat"], { label: `${f.online} online?` }).concat(hops("o", ["chat", "gws"], { label: `${f.online} on ${f.gateways} gateways`, start: 1 }), f.offline ? hops("p", ["chat", "push"], { label: `${f.offline} pushes`, start: 1.2 }) : [])
    : stage === 3 ? hops("r", ["gws", "chat", "gwa", "alice"], { label: `${rc.toSender} receipts`, tone: rc.toSender > 200 ? "bad" : "good" })
    : stage === 4 ? hops("pr", ["gws", "chat", "gwa"], { label: presence === "eager" ? `Sam is online × ${ONLINE_CONTACTS}` : "Sam is online × 1" })
    : [];

  const captions = [
    `Step 1: Alice's phone already holds an open WebSocket to one of ${GATEWAYS} gateways; the message goes up it.`,
    by === "server" ? "Step 2: the chat service gives the message the next sequence number in this conversation and stores it." : `Step 2: ordered by the phones' clocks, Alice's reply lands after Sam's last message: her clock is ${SKEW_S} s fast.`,
    `Step 3: ${f.online} members are online across ${f.gateways} gateways and get it now; ${f.offline} get a push notification.`,
    `Step 4: ${rc.events} delivered and read receipts come back; Alice's phone gets ${rc.toSender} updates.`,
    `Step 5: presence costs ${fmt(presenceRate(presence))} messages a second across the app.`,
  ];
  const caption = stage !== null ? captions[stage] : `Group of ${members}: ${f.online} delivered live on ${f.gateways} gateways, ${f.offline} by push · ${rc.toSender} receipt updates to the sender · presence ${fmt(presenceRate(presence))}/s.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design a chat app"
        blurb={`Ten million people online at once, each holding a connection open. Alice replies in a group: keep the messages in order when phone clocks disagree, reach members who are online on different servers and those who aren't, send delivery and read receipts back, and show who's online without flooding the network.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Alice, her gateway, the chat service, message store, session registry, other gateways and push"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "alice", label: "Alice", sub: "phone", at: [8, 50], mobileAt: [20, 7], state: "active" },
                  { id: "gwa", label: "Gateway", sub: "her WebSocket", at: [28, 50], mobileAt: [78, 7], state: "active" },
                  { id: "chat", label: "Chat service", sub: by === "server" ? "assigns seq" : "trusts phones", at: [52, 50], mobileAt: [50, 55], state: wrong ? "bad" : "active" },
                  { id: "store", label: "Message store", sub: "by conversation", at: [52, 12], mobileAt: [18, 33], state: "idle" },
                  { id: "registry", label: "Sessions", sub: "user → gateway", at: [52, 88], mobileAt: [82, 33], state: "idle" },
                  { id: "gws", label: "Other gateways", sub: `${f.gateways} of ${GATEWAYS}`, at: [84, 25], mobileAt: [20, 90], state: "active" },
                  { id: "push", label: "Push", sub: `${f.offline} offline`, at: [84, 75], mobileAt: [80, 90], state: f.offline ? "active" : "dim" },
                ]}
                links={[
                  { from: "alice", to: "gwa", label: "WebSocket", dashed: true },
                  { from: "gwa", to: "chat", label: "message" },
                  { from: "chat", to: "store", label: "append" },
                  { from: "chat", to: "registry", label: "where?" },
                  { from: "chat", to: "gws", label: "deliver" },
                  { from: "chat", to: "push", label: "notify", dim: !f.offline },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.85}
              />
              <Thread by={by} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Group size" accent={ACCENT} value={String(members)} onChange={(v) => setMembers(Number(v))} options={GROUPS.map((g) => ({ id: String(g), label: g === 2 ? "1:1" : `${g} people` }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Sending…">
                Send Alice&rsquo;s reply
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Keep a connection open per online user" what={`Chat can't wait for the phone to ask; the server pushes. Each online user holds a WebSocket to a gateway server that does nothing but hold connections, about ${fmt(PER_GATEWAY)} each. A session registry records which gateway each user is on.`} accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {fmt(ONLINE)} online ÷ {fmt(PER_GATEWAY)} per gateway = {GATEWAYS} gateway servers
                </p>
              </FlowStep>
              <FlowArrow label="message" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Order by the server, not the phone" what="Phone clocks are wrong by seconds or hours. The chat service gives each message the next sequence number in its conversation; every client shows messages in that order and can ask for any gap after reconnecting." accent={ACCENT} active={at(1)}>
                <Choices label="Order by" accent={ACCENT} value={by} onChange={setBy} options={[{ id: "client" as const, label: "Phone timestamp" }, { id: "server" as const, label: "Server sequence" }]} />
                <p className="mt-2 font-mono text-xs" style={{ color: wrong ? "var(--bad)" : "var(--good)" }}>
                  {wrong ? `Alice's clock is ${SKEW_S} s fast: her “yes” shows after “I'll book the table”` : "in the order the server received them"}
                </p>
              </FlowStep>
              <FlowArrow label="to the group" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Store it, then fan out" what="Write the message first, so it exists even if delivery fails. Then look up each member's gateway: online members get it over their socket, offline members get a push notification and fetch messages after their last sequence number when they open the app." accent={ACCENT} active={at(2)}>
                <Choices label="Group size" accent={ACCENT} value={String(members)} onChange={(v) => setMembers(Number(v))} options={GROUPS.map((g) => ({ id: String(g), label: g === 2 ? "1:1" : `${g} people` }))} />
                <p className="mt-2 font-mono text-xs">
                  {f.others} recipients · {f.online} online on {f.gateways} gateways · {f.offline} push notifications
                </p>
              </FlowStep>
              <FlowArrow label="receipts" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Send receipts back, batched for big groups" what="Every recipient's phone reports delivered, and later read. In a 1:1 chat that's two ticks. In a 500-person group, sending each one to the sender is hundreds of messages for one line of text; collapse them into a count every few seconds." accent={ACCENT} active={at(3)}>
                <Choices label="Receipts" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "each" as Receipts, label: "Every receipt" }, { id: "batched" as Receipts, label: `Batched every ${BATCH_S} s` }]} />
                <p className="mt-2 font-mono text-xs">
                  {rc.events} receipts in the first hour → {rc.toSender} updates to Alice
                </p>
              </FlowStep>
              <FlowArrow label="who's online" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Show presence only where someone is looking" what={`People come and go about ${CHANGES_PER_HOUR} times an hour. Telling every online contact each time is the most expensive feature in the app. Send presence only to people who have that chat open, and let “last seen” be read when asked.`} accent={ACCENT} active={at(4)}>
                <Choices label="Presence" accent={ACCENT} value={presence} onChange={setPresence} options={[{ id: "eager" as Presence, label: `Tell all ${ONLINE_CONTACTS} online contacts` }, { id: "lazy" as Presence, label: "Only open chats" }]} />
                <p className="mt-2 font-mono text-xs" style={{ color: presence === "eager" ? "var(--bad)" : "var(--good)" }}>
                  {fmt(presenceRate(presence))} presence messages a second across the app
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">{ONLINE_SHARE_NOTE}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

const ONLINE_SHARE_NOTE = "40% of a group is online at a time; read times are drawn with a fixed seed. Sizes are typical, not from one product.";

// The three messages in the order the chosen rule puts them.
function Thread({ by }: { by: "client" | "server" }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The conversation as each member sees it">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">the group, as everyone sees it</p>
      <ul className="mt-3 space-y-1.5">
        {order(by).map((m) => (
          <li key={m.text} className={`flex ${m.from === "Alice" ? "justify-end" : "justify-start"}`}>
            <span className="max-w-[80%] rounded-lg px-3 py-1.5 text-xs" style={{ background: m.from === "Alice" ? "color-mix(in srgb, var(--sys) 22%, transparent)" : "var(--inset)" }}>
              <span className="block text-[10px] text-[var(--faint)]">
                {m.from} · #{m.seq}
              </span>
              {m.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
