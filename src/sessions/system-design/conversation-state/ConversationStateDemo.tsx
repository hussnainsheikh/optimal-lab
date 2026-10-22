"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { EVENTS, STORES, TURN_CHOICES, historyCost, outcome, type EventId, type Store } from "@/lib/conversationState";

const ACCENT = "var(--sys)";

export default function ConversationStateDemo() {
  const [s, setS] = useState<Store>("memory");
  const [e, setE] = useState<EventId>("reload");
  const [turns, setTurns] = useState(40);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const o = outcome(s, e);
  const survived = EVENTS.filter((x) => outcome(s, x.id).ok).length;
  const onServer = s === "server" || s === "serverStream";
  const plain = historyCost(turns, false);
  const cached = historyCost(turns, true);

  const packets: Packet[] =
    stage === 0 ? hops("msg", ["browser", "api", "llm"], { label: "message" })
    : stage === 1 ? (onServer ? hops("save", ["api", "db"], { label: "append" }) : s === "local" ? hops("ls", ["api", "browser"], { label: "save in browser" }) : [])
    : stage === 2 ? hops("stream", s === "serverStream" ? ["llm", "buffer", "browser"] : ["llm", "api", "browser"], { label: "tokens…" })
    : stage === 3 ? hops("ev", [e === "phone" ? "phone" : "browser", onServer ? "api" : "browser"].filter((x, i, a) => a.indexOf(x) === i), { label: EVENTS.find((x) => x.id === e)!.label.toLowerCase(), tone: o.ok ? "good" : "bad" })
    : stage === 4 && onServer ? hops("load", ["db", "api", e === "phone" ? "phone" : "browser"], { label: "history", tone: o.ok ? "good" : "bad" })
    : [];

  const captions = [
    "Step 1: the user sends a message; the API sends it and the history so far to the model.",
    `Step 2: the conversation is kept ${STORES.find((x) => x.id === s)!.label.toLowerCase()}.`,
    s === "serverStream" ? "Step 3: the answer streams from a server-side buffer that a client can reconnect to." : "Step 3: the answer streams straight from the request that generated it.",
    `Step 4: ${EVENTS.find((x) => x.id === e)!.what}`,
    `Step 5: ${o.what}`,
  ];
  const caption = stage !== null ? captions[stage] : `${STORES.find((x) => x.id === s)!.label}: survives ${survived} of ${EVENTS.length} everyday events. ${EVENTS.find((x) => x.id === e)!.label}: ${o.what}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Conversation and session state"
        blurb="A chat assistant looks stateless: send a message, get an answer. The conversation still has to live somewhere, and survive what users do: reload, switch to their phone, lose signal halfway through an answer, and the server restarting during a deploy. Pick where it lives and try each one."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A browser, a phone, your API, the conversation database, a stream buffer and the model"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "browser", label: "Browser", sub: s === "memory" ? "holds the chat" : s === "local" ? "localStorage" : "shows the chat", at: [10, 28], mobileAt: [22, 8], state: "active" },
                  { id: "phone", label: "Phone", sub: onServer ? "same chat" : "empty", at: [10, 76], mobileAt: [78, 8], state: onServer ? "good" : "dim" },
                  { id: "api", label: "Your API", sub: "per request", at: [40, 52], mobileAt: [50, 36], state: "active" },
                  { id: "db", label: "Conversations DB", sub: onServer ? "messages" : "unused", at: [70, 82], mobileAt: [22, 66], state: onServer ? "good" : "dim" },
                  { id: "buffer", label: "Stream buffer", sub: s === "serverStream" ? "resumable" : "none", at: [70, 22], mobileAt: [78, 66], state: s === "serverStream" ? "good" : "dim" },
                  { id: "llm", label: "Model", sub: "generates", at: [92, 52], mobileAt: [50, 92], state: "idle" },
                ]}
                links={[
                  { from: "browser", to: "api", label: "message" },
                  { from: "phone", to: "api", label: "open chat", dim: !onServer },
                  { from: "api", to: "llm", label: "history + message" },
                  { from: "api", to: "db", label: "append", dim: !onServer },
                  { from: "llm", to: "buffer", label: "tokens", dim: s !== "serverStream" },
                  { from: "buffer", to: "browser", label: "stream", dashed: true, dim: s !== "serverStream" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Which everyday events this design survives">
                <ul className="space-y-0.5 text-xs">
                  {EVENTS.map((x) => {
                    const y = outcome(s, x.id);
                    return (
                      <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-x-2" style={{ fontWeight: x.id === e ? 700 : 400 }}>
                        <span>{x.label}</span>
                        <span className="font-mono" style={{ color: y.ok ? "var(--good)" : "var(--bad)" }}>
                          {y.ok ? "survives" : "breaks"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Where the chat lives" accent={ACCENT} value={s} onChange={setS} options={STORES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <div className="w-full">
                <Choices label="What happens" accent={ACCENT} value={e} onChange={setE} options={EVENTS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Chatting…">
                Send a message
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="The model remembers nothing between calls" what="Every request to the model carries the system prompt and the whole conversation so far. The “memory” of a chat is whatever your app sends back each time." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">turn 40 sends 39 earlier turns plus the new message</p>
              </FlowStep>
              <FlowArrow label="so store it" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Keep the conversation on the server" what="In the page it dies with the tab; in browser storage it stays on one device. In a database, keyed by conversation and user, it survives reloads and follows the user, and two tabs append to the same ordered list." accent={ACCENT} active={at(1)}>
                <Choices label="Where the chat lives" accent={ACCENT} value={s} onChange={setS} options={STORES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{STORES.find((x) => x.id === s)!.one}</p>
              </FlowStep>
              <FlowArrow label="the answer streams" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Make streams resumable" what="An answer takes seconds to stream. If generation runs in a background worker that writes tokens to a buffer under a message id, a client that drops can reconnect with the id and the last position it saw, and a deploy doesn't kill the answer." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs">GET /messages/m_8812/stream?from=412</p>
              </FlowStep>
              <FlowArrow label="real life" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Test it against what users do" what="Reloads, second devices, tunnels and deploys are not edge cases; they happen every day to some share of users." accent={ACCENT} active={at(3) || at(4)}>
                <Choices label="What happens" accent={ACCENT} value={e} onChange={setE} options={EVENTS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs" style={{ color: o.ok ? "var(--good)" : "var(--bad)" }}>
                  {o.what}
                </p>
              </FlowStep>
              <FlowArrow label="and the bill" accent={ACCENT} />

              <FlowStep n={5} title="Pay for history once, with prompt caching" what="Resending a growing history makes each turn more expensive than the last. Prompt caching charges the unchanged prefix at a fraction of the price; trimming and summarising (see context compression) keep it bounded." accent={ACCENT}>
                <Choices label="Turns in the conversation" accent={ACCENT} value={String(turns)} onChange={(v) => setTurns(Number(v))} options={TURN_CHOICES.map((t) => ({ id: String(t), label: String(t) }))} />
                <p className="mt-2 font-mono text-xs">
                  {(plain.tokens / 1000).toFixed(0)}k input tokens · ${plain.cost.toFixed(2)} resent in full · ${cached.cost.toFixed(2)} with the prefix cached
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Prices are typical per-million-token rates; the growth with turns is the point.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
