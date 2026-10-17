"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { CASES, CLIENT_ID, ISSUER, JWK, LIFETIME_MIN, NONCE, verify, type Case } from "@/lib/oidc";

const ACCENT = "var(--sec)";
const PART_COLORS = ["var(--c1)", "var(--c3)", "var(--c4)"];

export default function OidcDemo() {
  const [c, setC] = useState<Case>("valid");
  const [minutes, setMinutes] = useState(2);
  const walk = useWalk(6, 1000);
  const stage = walk.stage;
  const v = verify(c, minutes);
  const t = v.token;
  const parts = t.compact.split(".");
  const fail = v.firstFail >= 0 ? v.list[v.firstFail] : null;
  const sigOk = v.list[0].pass;

  const packets: Packet[] =
    stage === 0 ? hops("auth", ["app", "browser", "idp"], { label: "scope=openid" })
    : stage === 1 ? [...hops("code", ["app", "idp"], { label: "code" }), ...hops("tok", ["idp", "app"], { label: "id_token", start: 0.6 })]
    : stage === 3 ? hops("jwks", ["idp", "app"], { label: "public keys" })
    : stage === 5 ? hops("done", ["app", "browser"], { label: v.ok ? "signed in" : "rejected", tone: v.ok ? "good" : "bad" })
    : [];

  const caption =
    stage === 0 ? `The app sends the browser to ${ISSUER} asking for scope "openid email" and a fresh nonce, ${NONCE}.`
    : stage === 1 ? "The app swaps the code for tokens, server to server. Next to the access token comes an ID token."
    : stage === 2 ? `The ID token says who signed in: sub ${t.claims.sub}, ${t.claims.email}, for audience ${t.claims.aud}.`
    : stage === 3 ? (sigOk ? "The signature matches the provider's published key: these claims came from the provider unchanged." : "The signature doesn't match the provider's key. Stop: none of the claims can be trusted.")
    : stage === 4 ? (fail ? `Failed: ${fail.label.toLowerCase()} (${fail.detail}).` : "Issuer, audience, expiry and nonce all check out.")
    : stage === 5 ? (v.ok ? `Signed in as the account keyed by (${ISSUER}, ${t.claims.sub}).` : "Login refused. The user sees an error and nothing is created.")
    : v.ok ? `Valid ID token. Sign in user (${ISSUER}, ${t.claims.sub}).` : `Rejected: ${fail!.label.toLowerCase()}. ${fail!.detail}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Security · interactive"
        title="OpenID Connect"
        blurb="OAuth gives an app an access token to call an API. It doesn't say who the user is. OpenID Connect adds an ID token: a signed statement from the provider that this person signed in, for this app, just now. The app's job is to check it properly. Pick a token and see which check catches it."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="min-w-0 space-y-3">
              <SystemMap
                chrome="split"
                title="The browser, your app and the identity provider"
                accent={ACCENT}
                nodes={[
                  { id: "browser", label: "Browser", sub: stage === 5 || stage === null ? (v.ok ? "signed in" : "error page") : "Ada", at: [14, 72], mobileAt: [22, 80], state: stage === 0 || stage === 5 ? "active" : stage === null ? (v.ok ? "good" : "bad") : "idle" },
                  { id: "app", label: "Your app", sub: CLIENT_ID, at: [86, 72], mobileAt: [78, 80], state: stage !== null && stage >= 1 ? (stage === 4 && fail ? "bad" : "active") : "idle" },
                  { id: "idp", label: "Identity provider", sub: c === "wrong-issuer" ? "other provider signed" : "id.example.com", at: [50, 22], mobileAt: [50, 18], state: stage === 0 || stage === 1 || stage === 3 ? "active" : "idle" },
                ]}
                links={[
                  { from: "browser", to: "app", label: "redirects" },
                  { from: "app", to: "idp", label: "back channel" },
                  { from: "browser", to: "idp", label: "sign in" },
                ]}
                packets={packets}
                aspect={2.2}
                mobileAspect={1.1}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 sm:p-4" aria-label="Checks on the ID token">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Your app checks the ID token</p>
                <ul className="mt-2 space-y-1.5">
                  {v.list.map((x) => (
                    <li key={x.id} className="flex min-w-0 gap-2 rounded-md bg-[var(--inset)] px-2 py-1.5 text-sm">
                      <span className="w-4 shrink-0 font-mono" style={{ color: x.pass ? "var(--good)" : "var(--bad)" }}>{x.pass ? "✓" : "✗"}</span>
                      <span className="min-w-0">
                        {x.label}
                        <span className="block break-all font-mono text-[11px] text-[var(--muted)]">{x.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Which token arrives" accent={ACCENT} value={c} onChange={setC} options={CASES} />
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT} running="Signing in…">
                Run the sign-in
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Ask for openid and send a nonce" what="Adding the openid scope turns an OAuth request into a sign-in. The nonce is a random value the app remembers in the user's session." accent={ACCENT} active={stage === 0}>
                <p className="break-all font-mono text-xs">{`${ISSUER}/authorize?client_id=${CLIENT_ID}&response_type=code&scope=openid%20email&nonce=${NONCE}&state=…&code_challenge=…`}</p>
              </FlowStep>
              <FlowArrow label="code" accent={ACCENT} active={stage === 1} />
              <FlowStep n={2} title="Swap the code for an ID token" what="Exactly as in OAuth: the app's server redeems the code (with PKCE). The response now includes id_token." accent={ACCENT} active={stage === 1}>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{`{ "access_token": "…",\n  "id_token": "eyJhbGciOi…",\n  "expires_in": 3600 }`}</pre>
              </FlowStep>
              <FlowArrow label="id_token (a JWT)" accent={ACCENT} active={stage === 2} />
              <FlowStep n={3} title="Read the ID token" what="Three base64url parts: header, claims, signature. Anyone can decode the claims, so they are only worth something once checked." accent={ACCENT} active={stage === 2}>
                <p className="break-all font-mono text-[11px] leading-5">
                  {parts.map((p, i) => (
                    <span key={i}>
                      <span style={{ color: PART_COLORS[i] }}>{p}</span>
                      {i < 2 && "."}
                    </span>
                  ))}
                </p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{JSON.stringify(t.claims, null, 2)}</pre>
              </FlowStep>
              <FlowArrow label={`kid ${JWK.kid}`} accent={ACCENT} active={stage === 3} />
              <FlowStep n={4} title="Check the signature with the provider's key" what="The app fetches the provider's public keys from its JWKS URL (cached) and checks the signature over header.claims." accent={ACCENT} active={stage === 3}>
                <p className="font-mono text-xs">{`n = ${JWK.n}, e = ${JWK.e}`} (toy RSA)</p>
                <p className="mt-1 font-mono text-xs" style={{ color: sigOk ? "var(--good)" : "var(--bad)" }}>{v.list[0].detail}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Only accept the algorithms you expect. Never accept alg none.</p>
              </FlowStep>
              <FlowArrow label="trusted claims" accent={ACCENT} active={stage === 4} />
              <FlowStep n={5} title="Check issuer, audience, expiry and nonce" what="Who issued it, who it was for, whether it is still fresh, and whether it answers the request this browser made." accent={ACCENT} active={stage === 4}>
                <Slider label="Minutes since the token was issued" value={minutes} min={0} max={120} step={1} format={(m) => `${m} min`} onChange={setMinutes} accent={ACCENT} hint={`ID tokens here live ${LIFETIME_MIN} minutes`} />
                <ul className="mt-2 space-y-1 text-sm">
                  {v.list.slice(1).map((x) => (
                    <li key={x.id} style={{ color: x.pass ? "var(--good)" : "var(--bad)" }}>{x.pass ? "✓" : "✗"} {x.label}</li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label={v.ok ? `sub ${t.claims.sub}` : "rejected"} accent={ACCENT} active={stage === 5} />
              <FlowStep n={6} title="Sign in by issuer and subject" what="sub is the provider's permanent id for this person. Key your user table on (iss, sub), not on email: emails change and can be reused." accent={ACCENT} active={stage === 5}>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{`SELECT * FROM users\nWHERE issuer = '${ISSUER}'\n  AND subject = '${t.claims.sub}'`}</pre>
                <p className="mt-1 text-xs text-[var(--muted)]">Then start your own session (a cookie). The ID token is for your app only; never send it to APIs as an access token.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
