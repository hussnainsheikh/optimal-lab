// Is the destination on my local network, or do I hand it to the router?
// A host ANDs both addresses with its subnet mask and compares the results.

export const toInt = (ip: string) => ip.split(".").reduce((n, o) => n * 256 + Number(o), 0);
export const toDotted = (n: number) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");
export const maskOf = (prefix: number) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);
export const and = (a: number, b: number) => (a & b) >>> 0;
export const octetBits = (n: number) => [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, "0"));

export const ME = { name: "Laptop", ip: "192.168.1.20" };
export const GATEWAY = { name: "Router", ip: "192.168.1.1" };
// The network as it is really wired: one switch, 192.168.1.0/24.
export const REAL_PREFIX = 24;

export type DestId = "printer" | "nas" | "floor2" | "dns";
export const DESTS: { id: DestId; name: string; ip: string }[] = [
  { id: "printer", name: "Printer", ip: "192.168.1.50" },
  { id: "nas", name: "NAS", ip: "192.168.1.200" },
  { id: "floor2", name: "Floor 2 server", ip: "192.168.2.10" },
  { id: "dns", name: "Google DNS", ip: "8.8.8.8" },
];

export const PREFIXES = [16, 24, 25];

export type Outcome = "direct" | "via-router" | "no-reply" | "detour";

export type Decision = {
  mask: number;
  myNet: number;
  destNet: number;
  local: boolean; // what the laptop concludes
  onWire: boolean; // what is actually true
  nextHop: string; // the IP the laptop will look up a MAC address for
  outcome: Outcome;
  verdict: string;
};

export function decide(destIp: string, prefix: number): Decision {
  const mask = maskOf(prefix);
  const me = toInt(ME.ip);
  const dst = toInt(destIp);
  const myNet = and(me, mask);
  const destNet = and(dst, mask);
  const local = myNet === destNet;
  const realMask = maskOf(REAL_PREFIX);
  const onWire = and(me, realMask) === and(dst, realMask);
  const nextHop = local ? destIp : GATEWAY.ip;
  let outcome: Outcome;
  let verdict: string;
  if (local && onWire) {
    outcome = "direct";
    verdict = `Same network, so the laptop looks up ${destIp}'s MAC address and sends straight to it through the switch.`;
  } else if (!local && !onWire) {
    outcome = "via-router";
    verdict = `Different network, so the laptop sends it to the router at ${GATEWAY.ip}, which forwards it on.`;
  } else if (local && !onWire) {
    outcome = "no-reply";
    verdict = `The mask is too wide. The laptop thinks ${destIp} is on its switch and asks for its MAC address, but nobody there has that IP. No reply: "Destination host unreachable".`;
  } else {
    outcome = "detour";
    verdict = `The mask is too narrow. ${destIp} is on the same switch, but the laptop sends it to the router, which sends it straight back. It works, but every packet takes a detour.`;
  }
  return { mask, myNet, destNet, local, onWire, nextHop, outcome, verdict };
}

// Addresses a host can use in a network this size (minus the network and broadcast addresses).
export const usableHosts = (prefix: number) => (prefix >= 31 ? 2 ** (32 - prefix) : 2 ** (32 - prefix) - 2);
