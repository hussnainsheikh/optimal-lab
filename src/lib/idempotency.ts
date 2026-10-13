// Idempotency keys. A client charges a card, the response is lost on the way back, and the
// client retries. Without a key the server can't tell a retry from a new payment; with one,
// it stores the first result under the key and returns it again.

export type Actor = "client" | "server" | "network";
export type IdemFrame = { actor: Actor; text: string; charges: number; keys: string[]; clientSees: string };

export const KEY = "pay_7f3c";

export function runPayment(withKey: boolean): IdemFrame[] {
  const f: IdemFrame[] = [];
  let charges = 0;
  const keys: string[] = [];
  const push = (actor: Actor, text: string, clientSees: string) => f.push({ actor, text, charges, keys: [...keys], clientSees });
  push("client", withKey ? `POST /charge $50, Idempotency-Key: ${KEY}` : "POST /charge $50", "waiting…");
  if (withKey) keys.push(`${KEY} → in progress`);
  charges++;
  if (withKey) keys[0] = `${KEY} → charge #1, $50, success`;
  push("server", "Charges the card: $50. Sends 200 OK.", "waiting…");
  push("network", "The response is lost (a dropped connection, a timeout).", "timeout: did it work?");
  push("client", withKey ? `Retries with the same key: ${KEY}` : "Retries: POST /charge $50", "waiting…");
  if (withKey) push("server", `Key ${KEY} is already stored: returns the saved result. No new charge.`, "200 OK: charge #1");
  else {
    charges++;
    push("server", "Looks like a new payment. Charges the card again: $50.", "200 OK: charge #2");
  }
  return f;
}
