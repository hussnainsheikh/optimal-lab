// How a device gets an address when it joins a network. Part one builds the real DHCP exchange
// (RFC 2131): DISCOVER and REQUEST are broadcast from 0.0.0.0:68 to 255.255.255.255:67 because
// the client has no address yet; servers OFFER and ACK with the lease and its options (mask,
// router, DNS, lease time). A rogue server on the LAN can answer first and hand out itself as
// the router; DHCP snooping on the switch drops server messages from untrusted ports. A device
// with a static address inside the pool is caught by the client's ARP probe and DHCPDECLINE.
// Part two runs three days of a café's Wi-Fi minute by minute: devices arrive and leave without
// releasing, leases renew at T1 (half the lease) while they stay, and the pool runs out when
// leases outlive the visits. Regulars come back with the same device and get their lease back.
// Visitor numbers and stay lengths are generated.

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MAC = "3a:91:5c:07:e2:4f"; // locally administered: a randomized MAC
export const ROUTER = "192.168.1.1";
export const ROGUE = "192.168.1.66";
export const PRINTER = "192.168.1.23";
export const XID = "0x5e1f0a37";

export type Lan = "clean" | "rogue" | "printer";
export type Endpoint = { mac: string; ip: string; port?: number };
export type Msg = {
  type: "DISCOVER" | "OFFER" | "REQUEST" | "ACK" | "ARP probe" | "ARP reply" | "DECLINE";
  from: Endpoint;
  to: Endpoint;
  sender: "client" | "server" | "rogue" | "printer";
  fields?: { ciaddr: string; yiaddr: string; siaddr: string; chaddr: string };
  options: [number | string, string][];
  dropped?: string; // why the switch dropped it
  ms: number; // when it was sent, after the DISCOVER
};
export type Config = { ip: string; mask: string; router: string; dns: string; server: string; lease: number };

const BCAST = { mac: "ff:ff:ff:ff:ff:ff", ip: "255.255.255.255" };
const ROUTER_MAC = "b0:4e:26:11:9a:01";
const ROGUE_MAC = "dc:a6:32:5b:44:c8";
const PRINTER_MAC = "00:1b:a9:3e:72:10";

export function exchange(lan: Lan, snooping: boolean, lease: number): { msgs: Msg[]; config: Config; declined: boolean } {
  const msgs: Msg[] = [];
  const zero = "0.0.0.0";
  const discover = (ms: number, avoid?: string): Msg => ({
    type: "DISCOVER",
    sender: "client",
    from: { mac: MAC, ip: zero, port: 68 },
    to: { ...BCAST, port: 67 },
    fields: { ciaddr: zero, yiaddr: zero, siaddr: zero, chaddr: MAC },
    options: [[53, "DHCPDISCOVER"], [55, "1 subnet mask, 3 router, 6 DNS, 51 lease time"], ...(avoid ? ([[ "note", `previous offer ${avoid} was declined`]] as [string, string][]) : [])],
    ms,
  });
  const offer = (by: "server" | "rogue", ip: string, ms: number): Msg => {
    const server = by === "server" ? ROUTER : ROGUE;
    return {
      type: "OFFER",
      sender: by,
      from: { mac: by === "server" ? ROUTER_MAC : ROGUE_MAC, ip: server, port: 67 },
      to: { ...BCAST, port: 68 },
      fields: { ciaddr: zero, yiaddr: ip, siaddr: server, chaddr: MAC },
      options: [[53, "DHCPOFFER"], [54, `server ${server}`], [51, `${lease} s`], [1, "255.255.255.0"], [3, `router ${server}`], [6, `DNS ${by === "server" ? "192.168.1.1" : ROGUE}`]],
      dropped: by === "rogue" && snooping ? "untrusted port: DHCP snooping drops server messages here" : undefined,
      ms,
    };
  };
  msgs.push(discover(0));
  // the rogue box answers in 2 ms; the router takes longer because it pings the address first
  const firstIp = lan === "printer" ? PRINTER : "192.168.1.57";
  if (lan === "rogue") msgs.push(offer("rogue", "192.168.1.150", 2));
  msgs.push(offer("server", firstIp, 41));
  const usable = msgs.filter((m) => m.type === "OFFER" && !m.dropped).sort((a, b) => a.ms - b.ms);
  const chosen = usable[0];
  const by = chosen.sender as "server" | "rogue";
  const serverIp = by === "server" ? ROUTER : ROGUE;
  const request = (ms: number, ip: string, srv: string): Msg => ({
    type: "REQUEST",
    sender: "client",
    from: { mac: MAC, ip: zero, port: 68 },
    to: { ...BCAST, port: 67 },
    fields: { ciaddr: zero, yiaddr: zero, siaddr: zero, chaddr: MAC },
    options: [[53, "DHCPREQUEST"], [50, `requested ${ip}`], [54, `server ${srv}`]],
    ms,
  });
  const ack = (ms: number, ip: string, b: "server" | "rogue"): Msg => ({
    ...offer(b, ip, ms),
    type: "ACK",
    to: { mac: MAC, ip, port: 68 },
    options: offer(b, ip, ms).options.map(([k, v]) => (k === 53 ? [53, "DHCPACK"] : [k, v])),
  });
  let t = chosen.ms + 1;
  msgs.push(request(t, chosen.fields!.yiaddr, serverIp));
  msgs.push(ack(t + 3, chosen.fields!.yiaddr, by));
  let ip = chosen.fields!.yiaddr;
  let declined = false;
  // before using the address, the client asks "who has it?" with an ARP probe (RFC 5227)
  msgs.push({ type: "ARP probe", sender: "client", from: { mac: MAC, ip: zero }, to: { mac: BCAST.mac, ip }, options: [["who-has", ip], ["tell", zero]], ms: t + 5 });
  if (ip === PRINTER) {
    declined = true;
    msgs.push({ type: "ARP reply", sender: "printer", from: { mac: PRINTER_MAC, ip: PRINTER }, to: { mac: MAC, ip: zero }, options: [["is-at", `${PRINTER} is at ${PRINTER_MAC}`]], ms: t + 6 });
    msgs.push({ type: "DECLINE", sender: "client", from: { mac: MAC, ip: zero, port: 68 }, to: { ...BCAST, port: 67 }, options: [[53, "DHCPDECLINE"], [50, `in use: ${PRINTER}`], [54, `server ${ROUTER}`]], ms: t + 7 });
    t += 10_007; // RFC 2131: wait at least 10 seconds before trying again
    msgs.push(discover(t, PRINTER));
    ip = "192.168.1.58";
    msgs.push(offer("server", ip, t + 41));
    msgs.push(request(t + 42, ip, ROUTER));
    msgs.push(ack(t + 45, ip, "server"));
    msgs.push({ type: "ARP probe", sender: "client", from: { mac: MAC, ip: zero }, to: { mac: BCAST.mac, ip }, options: [["who-has", ip], ["tell", zero]], ms: t + 47 });
  }
  const rogue = by === "rogue";
  return { msgs, declined, config: { ip, mask: "255.255.255.0", router: rogue ? ROGUE : ROUTER, dns: rogue ? ROGUE : ROUTER, server: rogue ? ROGUE : ROUTER, lease } };
}

// Lease timers: renew with the same server at T1, ask any server at T2, give up at expiry.
export function timers(lease: number) {
  return { t1: lease * 0.5, t2: lease * 0.875, expiry: lease };
}

export type PoolOpts = { lease: number; release: boolean; pool: number };
export type Pool = {
  leases: number[]; // active leases every 10 minutes
  present: number[]; // devices in the café every 10 minutes
  joins: number;
  refused: number;
  firstFull: number | null; // minute the pool first ran out
  peak: number;
};

export const DAYS = 3;
export const POOLS = [100, 241, 1000];

type Visit = { device: number; arrive: number; leave: number };
let visits: Visit[] | null = null;

// Three days of visits: regulars who come back with the same phone, and walk-ins.
function makeVisits(): Visit[] {
  if (visits) return visits;
  const r = rng(67);
  const out: Visit[] = [];
  const REGULARS = 220;
  let nextDevice = REGULARS * 2;
  for (let d = 0; d < DAYS; d++) {
    for (let minute = 7 * 60; minute < 22 * 60; minute++) {
      const h = minute / 60;
      const rate = 0.55 + 0.9 * Math.exp(-(((h - 12.5) / 1.6) ** 2)) + 0.6 * Math.exp(-(((h - 16) / 2) ** 2)); // arrivals a minute
      let k = 0;
      for (let L = Math.exp(-rate), p = r(); p > L; p *= r()) k++;
      for (let j = 0; j < k; j++) {
        const stay = Math.min(240, Math.max(8, Math.exp(Math.log(40) + 0.6 * (r() + r() + r() - 1.5) * 2)));
        const arrive = d * 1440 + minute;
        const regular = r() < 0.18;
        const person = regular ? Math.floor(r() * REGULARS) : -1;
        const devices = r() < 0.3 ? 2 : 1;
        for (let dev = 0; dev < devices; dev++) {
          const device = person >= 0 ? person * 2 + dev : nextDevice++;
          out.push({ device, arrive, leave: arrive + Math.round(stay) });
        }
      }
    }
  }
  visits = out.sort((a, b) => a.arrive - b.arrive);
  return visits;
}

const poolCache = new Map<string, Pool>();

export function runPool(o: PoolOpts): Pool {
  const key = `${o.lease}-${o.release}-${o.pool}`;
  const hit = poolCache.get(key);
  if (hit) return hit;
  const vs = makeVisits();
  const L = o.lease / 60; // minutes
  const half = L / 2;
  const binding = new Map<string, number>(); // client id → lease expiry (minute)
  const spans: [number, number][] = []; // every lease held: [from, to)
  const spanOf = new Map<string, number>();
  let refused = 0;
  let firstFull: number | null = null;
  for (const v of vs) {
    const id = `d${v.device}`;
    const now = v.arrive;
    let active = 0;
    for (const [k, exp] of binding) {
      if (exp <= now) binding.delete(k);
      else active++;
    }
    const mine = binding.get(id);
    if (mine === undefined && active >= o.pool) {
      refused++;
      if (firstFull === null) firstFull = now;
      continue;
    }
    // renewals at T1 while the device stays; the last one decides when the lease runs out
    const renewals = Math.floor((v.leave - now) / half);
    const expiry = o.release ? v.leave : Math.max(mine ?? 0, now + renewals * half + L);
    binding.set(id, expiry);
    if (mine !== undefined) spans[spanOf.get(id)!][1] = expiry; // same address, lease extended
    else {
      spanOf.set(id, spans.length);
      spans.push([now, expiry]);
    }
  }
  const M = DAYS * 1440;
  const diff = new Int32Array(M + 1);
  const pres = new Int32Array(M + 1);
  for (const [from, to] of spans) {
    diff[Math.min(M, from)]++;
    diff[Math.min(M, Math.ceil(to))]--;
  }
  for (const v of vs) {
    pres[Math.min(M, v.arrive)]++;
    pres[Math.min(M, v.leave)]--;
  }
  const leases: number[] = [];
  const present: number[] = [];
  let a = 0, p = 0;
  for (let i = 0; i < M; i++) {
    a += diff[i];
    p += pres[i];
    if (i % 10 === 0) {
      leases.push(a);
      present.push(p);
    }
  }
  const res: Pool = { leases, present, joins: vs.length, refused, firstFull, peak: Math.max(...leases) };
  poolCache.set(key, res);
  return res;
}
