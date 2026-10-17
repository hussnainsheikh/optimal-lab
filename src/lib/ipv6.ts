// IPv6 addresses: how big the space is, and the RFC 5952 rules for writing one short.

// Exact counts, written out (2^32, 2^128 and 2^64).
export const IPV4_TOTAL = "4,294,967,296";
export const IPV6_TOTAL = "340,282,366,920,938,463,463,374,607,431,768,211,456";
export const SUBNET_64 = "18,446,744,073,709,551,616"; // addresses in one /64 subnet

export const ADDRESSES: { id: string; label: string; full: string; note: string }[] = [
  { id: "doc", label: "Docs example", full: "2001:0db8:0000:0000:0000:ff00:0042:8329", note: "Three zero groups in a row become ::" },
  { id: "mid", label: "Zeros in the middle", full: "2001:0db8:85a3:0000:0000:8a2e:0370:7334", note: "A run of two zero groups is enough for ::" },
  { id: "two-runs", label: "Two zero runs", full: "2001:0db8:0000:0001:0000:0000:0000:0001", note: "Only the longest run gets ::. The lone 0 stays." },
  { id: "tie", label: "A tie", full: "2001:0db8:0000:0000:0001:0000:0000:0001", note: "Two runs of the same length: the first one gets ::." },
  { id: "loopback", label: "Loopback", full: "0000:0000:0000:0000:0000:0000:0000:0001", note: "Seven zero groups: the whole thing is ::1 (IPv4's 127.0.0.1)." },
];

export const groupsOf = (full: string) => full.toLowerCase().split(":");

// Rule 1: drop leading zeros in each group (but keep one digit).
export const stripZeros = (g: string) => g.replace(/^0+(?=.)/, "");

// Rule 2: the longest run of two or more all-zero groups becomes "::". First one wins a tie.
export function longestZeroRun(groups: string[]): { start: number; len: number } | null {
  let best: { start: number; len: number } | null = null;
  let i = 0;
  while (i < groups.length) {
    if (/^0+$/.test(groups[i])) {
      let j = i;
      while (j < groups.length && /^0+$/.test(groups[j])) j++;
      const len = j - i;
      if (len >= 2 && (!best || len > best.len)) best = { start: i, len };
      i = j;
    } else i++;
  }
  return best;
}

export function compress(full: string): string {
  const g = groupsOf(full).map(stripZeros);
  const run = longestZeroRun(g);
  if (!run) return g.join(":");
  const left = g.slice(0, run.start).join(":");
  const right = g.slice(run.start + run.len).join(":");
  return `${left}::${right}`;
}

export const stripped = (full: string) => groupsOf(full).map(stripZeros).join(":");

// Modified EUI-64: put ff:fe in the middle of the MAC and flip bit 0x02 of the first byte.
export function eui64(mac: string): string {
  const b = mac.split(":").map((x) => parseInt(x, 16));
  b[0] ^= 0x02;
  const bytes = [b[0], b[1], b[2], 0xff, 0xfe, b[3], b[4], b[5]];
  const hex = bytes.map((x) => x.toString(16).padStart(2, "0"));
  return [0, 2, 4, 6].map((i) => stripZeros(hex[i] + hex[i + 1])).join(":");
}

export const MACS = ["a4:83:e7:12:34:56", "00:1b:a9:0c:22:7f", "3c:37:86:aa:10:01"];

// What else is different, field by field.
export const HEADER = [
  { thing: "Header size", v4: "20 to 60 bytes", v6: "40 bytes, always" },
  { thing: "Fields", v4: "13", v6: "8" },
  { thing: "Checksum", v4: "yes, every router recomputes it", v6: "none (link and TCP/UDP check)" },
  { thing: "Fragmenting", v4: "routers may split packets", v6: "only the sender may" },
  { thing: "Find a MAC", v4: "ARP broadcast", v6: "Neighbor Discovery (multicast)" },
  { thing: "Get an address", v4: "DHCP", v6: "SLAAC: build your own, or DHCPv6" },
  { thing: "NAT", v4: "almost everywhere", v6: "not needed: every device gets a public address" },
];
