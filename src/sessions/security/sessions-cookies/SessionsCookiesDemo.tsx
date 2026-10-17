"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import {
  DEFAULT_FLAGS,
  EVENTS,
  SAFE_FLAGS,
  SESSION,
  SESSION_ID,
  outcome,
  rejected,
  score,
  setCookieLine,
  type Event,
  type Flags,
  type SameSite,
} from "@/lib/sessionsCookies";

const ACCENT = "var(--sec)";

export default function SessionsCookiesDemo() {
  const [flags, setFlags] = useState<Flags>(DEFAULT_FLAGS);
  const [event, setEvent] = useState<Event>("xss");
  const walk = useWalk(6, 1000);
  const stage = walk.stage;
  const o = outcome(event, flags);
  const set = (patch: Partial<Flags>) => setFlags((f) => ({ ...f, ...patch }));
  const stopped = score(flags);
  const attackerInvolved = event === "xss" || event === "cross-site";
  const deleted = event === "logout";

  const eventPackets = (): Packet[] => {
    if (rejected(flags)) return hops(`e-${event}`, ["browser", "server"], { label: "no cookie" });
    if (event === "xss") return o.safe ? [] : hops(`e-${event}`, ["browser", "other"], { label: "sid", tone: "bad" });
    if (event === "cross-site") return hops(`e-${event}`, ["other", "browser", "server"], { label: o.sent ? "POST + sid" : "POST, no sid", tone: o.safe ? "good" : "bad" });
    return hops(`e-${event}`, ["browser", "server"], { label: o.sent ? (event === "http" ? "sid in clear" : "Cookie: sid") : "no cookie", tone: o.safe ? "accent" : "bad" });
  };
  const packets: Packet[] =
    stage === 0 ? hops("login", ["browser", "server"], { label: "POST /login" })
    : stage === 1 ? hops("create", ["server", "store"], { label: "new session" })
    : stage === 2 ? hops("setcookie", ["server", "browser"], { label: "Set-Cookie" })
    : stage === 3 ? eventPackets()
    : stage === 4 && o.sent && event !== "xss" ? hops("lookup", ["server", "store"], { label: "lookup sid", tone: o.found ? (o.safe ? "good" : "bad") : "accent" })
    : stage === 5 ? hops("logout", ["server", "store"], { label: "DELETE sid" })
    : [];

  const caption =
    stage === 0 ? "Ada sends her email and password once, over HTTPS."
    : stage === 1 ? `The server makes a random id, ${SESSION_ID.slice(0, 10)}…, and stores Ada's session under it.`
    : stage === 2 ? `The response carries the id in a cookie: ${setCookieLine(flags).replace("Set-Cookie: ", "")}`
    : stage === 3 ? o.why
    : stage === 4 ? (o.found ? (o.safe ? "The server finds the session: this request is Ada's." : "The server finds the session and treats the request as Ada's. It can't tell who really sent it.") : "No live session for this request: the server treats it as logged out.")
    : stage === 5 ? "Logging out deletes the session on the server, so any copy of the id stops working."
    : `${o.safe ? "Safe" : "Problem"}: ${o.why}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Security · interactive"
        title="Sessions and cookies"
        blurb="HTTP forgets you after every request. To keep you logged in, the server stores a session and gives your browser a random id in a cookie, which the browser sends back on every request. Whoever holds that id is you, so the cookie's flags matter. Set the flags, pick what happens next, and run it."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <SystemMap
              chrome="split"
              title="Ada's browser, the shop's server, its session store and another site"
              accent={ACCENT}
              nodes={[
                { id: "browser", label: "Ada's browser", sub: rejected(flags) ? "no cookie stored" : `sid=${SESSION_ID.slice(0, 8)}…`, at: [15, 30], mobileAt: [25, 15], state: stage === 0 || stage === 3 ? "active" : stage === null ? (o.safe ? "good" : "bad") : "idle" },
                { id: "server", label: "shop.example", sub: stage === 4 || stage === null ? (o.found ? `user ${SESSION.userId}` : "logged out") : "app server", at: [62, 30], mobileAt: [75, 15], state: stage === 4 ? (o.safe ? "good" : "bad") : stage !== null && stage !== 3 ? "active" : "idle" },
                { id: "store", label: "Session store", sub: deleted && (stage === null || stage >= 4) ? "sid deleted" : `sid → ${SESSION.name}`, at: [62, 78], mobileAt: [75, 82], state: stage === 1 || stage === 4 || stage === 5 ? "active" : "idle" },
                { id: "other", label: event === "xss" ? "attacker.example" : "evil.example", sub: event === "xss" ? (o.safe ? "got nothing" : "got the sid") : "other site", at: [15, 78], mobileAt: [25, 82], state: attackerInvolved ? (o.safe ? "wait" : "bad") : "dim" },
              ]}
              links={[
                { from: "browser", to: "server", label: "HTTPS" },
                { from: "server", to: "store", label: "by sid" },
                { from: "other", to: "browser", dim: !attackerInvolved },
              ]}
              packets={packets}
              aspect={1.9}
              mobileAspect={1}
            />
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="What happens after login" accent={ACCENT} value={event} onChange={setEvent} options={EVENTS} />
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT} running="Running…">
                Run it
              </RunButton>
              <span className="text-xs text-[var(--muted)]">These flags stop {stopped} of 3 cookie attacks.</span>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Log in once" what="Ada proves who she is with her password. From now on the server needs a way to recognise her without asking again." accent={ACCENT} active={stage === 0}>
                <p className="break-all font-mono text-xs">POST /login  email=ada@example.com&amp;password=…</p>
              </FlowStep>
              <FlowArrow label="user 42 is Ada" accent={ACCENT} active={stage === 1} />
              <FlowStep n={2} title="Create a session" what="The server makes a long random id and stores what it knows about Ada under it. The id itself means nothing." accent={ACCENT} active={stage === 1}>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{`${SESSION_ID} → { userId: ${SESSION.userId}, name: "${SESSION.name}", since: ${SESSION.createdAt} }`}</pre>
                <p className="mt-1 text-xs text-[var(--muted)]">Make a new id at every login, so an id planted before login is useless (session fixation).</p>
              </FlowStep>
              <FlowArrow label="session id" accent={ACCENT} active={stage === 2} />
              <FlowStep n={3} title="Set the cookie, with flags" what="The flags tell the browser who may read the cookie and when to send it." accent={ACCENT} active={stage === 2}>
                <div className="flex flex-wrap gap-2">
                  <Toggle on={flags.httpOnly} onClick={() => set({ httpOnly: !flags.httpOnly })} label="HttpOnly" hint="no JavaScript access" />
                  <Toggle on={flags.secure} onClick={() => set({ secure: !flags.secure })} label="Secure" hint="HTTPS only" />
                </div>
                <div className="mt-3">
                  <Choices label="SameSite" accent={ACCENT} value={flags.sameSite} onChange={(v: SameSite) => set({ sameSite: v })} options={[{ id: "None", label: "None" }, { id: "Lax", label: "Lax" }, { id: "Strict", label: "Strict" }]} />
                </div>
                <div className="mt-3">
                  <Choices label="Lifetime" accent={ACCENT} value={String(flags.maxAgeHours)} onChange={(v) => set({ maxAgeHours: Number(v) })} options={[{ id: "0", label: "Until browser closes" }, { id: "8", label: "8 hours" }, { id: "720", label: "30 days" }]} />
                </div>
                <p className="mt-3 break-all rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{setCookieLine(flags)}</p>
                {rejected(flags) && <p className="mt-1 text-xs" style={{ color: "var(--bad)" }}>Browsers refuse SameSite=None without Secure: this cookie won&apos;t be stored.</p>}
                <button type="button" onClick={() => setFlags(SAFE_FLAGS)} className="mt-2 min-h-11 rounded-md border border-[var(--line-strong)] px-3 text-sm">
                  Use a safe default
                </button>
              </FlowStep>
              <FlowArrow label="Cookie: sid=…" accent={ACCENT} active={stage === 3} />
              <FlowStep n={4} title="Send it back automatically" what="The browser attaches the cookie to matching requests by itself. The flags decide which requests match." accent={ACCENT} active={stage === 3}>
                <p className="break-all font-mono text-xs" style={{ color: o.safe ? undefined : "var(--bad)" }}>{o.request}</p>
                <p className="mt-1 text-sm" style={{ color: o.safe ? "var(--good)" : "var(--bad)" }}>
                  {o.sent ? "Cookie sent" : "Cookie not sent"} · decided by {o.decidedBy}
                </p>
              </FlowStep>
              <FlowArrow label={o.sent ? "sid" : "no sid"} accent={ACCENT} active={stage === 4} />
              <FlowStep n={5} title="Look up the session" what="The server finds the session by id on every request. No match means not logged in." accent={ACCENT} active={stage === 4}>
                <p className="text-sm" style={{ color: o.found ? (o.safe ? "var(--good)" : "var(--bad)") : "var(--muted)" }}>
                  {o.found ? `Found: user ${SESSION.userId} (${SESSION.name})${o.safe ? "" : ", but the request isn't really from her"}` : "No session found"}
                </p>
              </FlowStep>
              <FlowArrow label="later" accent={ACCENT} active={stage === 5} />
              <FlowStep n={6} title="End it on the server" what="Logout, password change or an idle timeout deletes the session row. Unlike a self-contained token, a server-side session can be ended at once." accent={ACCENT} active={stage === 5}>
                <p className="text-xs text-[var(--muted)]">Typical limits: about 30 minutes idle, 8 to 12 hours in total for sensitive apps. Pick “Log out, then reuse the old id” to see it.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Toggle({ on, onClick, label, hint }: { on: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="min-h-11 rounded-md border px-3 py-1.5 text-left text-sm transition-colors"
      style={on ? { borderColor: ACCENT, background: `color-mix(in srgb, ${ACCENT} 16%, transparent)` } : { borderColor: "var(--line)", color: "var(--muted)" }}
    >
      <span className="font-mono">{on ? "✓" : "○"} {label}</span>
      <span className="block text-[11px] text-[var(--muted)]">{hint}</span>
    </button>
  );
}
