// ARP on one switched network (192.168.1.0/24). The laptop knows an IP address,
// but Ethernet delivers by MAC address, so it has to ask who owns that IP.

export type HostId = "laptop" | "printer" | "phone" | "router";

export const BROADCAST = "ff:ff:ff:ff:ff:ff";

export const HOSTS: { id: HostId; name: string; ip: string; mac: string; port: number }[] = [
  { id: "laptop", name: "Laptop", ip: "192.168.1.20", mac: "a4:83:e7:12:34:56", port: 1 },
  { id: "printer", name: "Printer", ip: "192.168.1.50", mac: "00:1b:a9:0c:22:7f", port: 2 },
  { id: "phone", name: "Phone", ip: "192.168.1.33", mac: "7e:91:3c:55:08:d2", port: 3 },
  { id: "router", name: "Router", ip: "192.168.1.1", mac: "3c:37:86:aa:10:01", port: 4 },
];

export const host = (id: HostId) => HOSTS.find((h) => h.id === id)!;

export type TargetId = "printer" | "internet" | "offline";

export const TARGETS: { id: TargetId; label: string; ip: string }[] = [
  { id: "printer", label: "Printer 192.168.1.50", ip: "192.168.1.50" },
  { id: "internet", label: "8.8.8.8 (internet)", ip: "8.8.8.8" },
  { id: "offline", label: "192.168.1.99 (switched off)", ip: "192.168.1.99" },
];

export type Move = { from: HostId | "switch"; to: HostId | "switch"; label: string; tone?: "good" | "bad" };
export type CacheRow = { ip: string; mac: string; fresh?: boolean };
export type PortRow = { mac: string; port: number; fresh?: boolean };

export type Frame = {
  step: number; // 0-based flow step
  text: string;
  moves: Move[][]; // groups of moves; each group starts after the previous one
  arp: CacheRow[]; // the laptop's ARP cache
  ports: PortRow[]; // the switch's MAC address table
  frame?: { src: string; dst: string; body: string };
  failed?: boolean;
};

export function frames(target: TargetId, warm: boolean): Frame[] {
  const t = TARGETS.find((x) => x.id === target)!;
  const laptop = host("laptop");
  // Off this network, the next hop is the router (the default gateway).
  const owner: HostId | null = target === "printer" ? "printer" : target === "internet" ? "router" : null;
  const nextHopIp = target === "internet" ? host("router").ip : t.ip;

  const arp: CacheRow[] = warm
    ? [
        { ip: host("router").ip, mac: host("router").mac },
        { ip: host("printer").ip, mac: host("printer").mac },
      ]
    : [];
  const ports: PortRow[] = warm
    ? [
        { mac: laptop.mac, port: 1 },
        { mac: host("printer").mac, port: 2 },
        { mac: host("router").mac, port: 4 },
      ]
    : [];
  const snap = <T,>(rows: T[]) => rows.map((r) => ({ ...r, fresh: false }));
  const learnPort = (h: HostId) => {
    const x = host(h);
    if (!ports.some((p) => p.mac === x.mac)) ports.push({ mac: x.mac, port: x.port, fresh: true });
  };

  const out: Frame[] = [];
  out.push({
    step: 0,
    text:
      target === "internet"
        ? `8.8.8.8 is not on 192.168.1.0/24, so the next hop is the router, ${nextHopIp}. The laptop needs the router's MAC, not Google's.`
        : `${t.ip} is on 192.168.1.0/24, so the laptop can send straight to it. It needs that machine's MAC address.`,
    moves: [],
    arp: snap(arp),
    ports: snap(ports),
  });

  const hit = arp.find((r) => r.ip === nextHopIp);
  out.push({
    step: 1,
    text: hit ? `ARP cache hit: ${nextHopIp} is at ${hit.mac}. No question needed.` : `The laptop looks in its ARP cache for ${nextHopIp}. Not there.`,
    moves: [],
    arp: snap(arp),
    ports: snap(ports),
  });

  if (!hit) {
    learnPort("laptop");
    out.push({
      step: 2,
      text: `The laptop broadcasts "Who has ${nextHopIp}? Tell ${laptop.ip}" to ${BROADCAST}. The switch sends a broadcast out of every other port.`,
      moves: [
        [{ from: "laptop", to: "switch", label: "who has?" }],
        [
          { from: "switch", to: "printer", label: "who has?" },
          { from: "switch", to: "phone", label: "who has?" },
          { from: "switch", to: "router", label: "who has?" },
        ],
      ],
      arp: snap(arp),
      ports: [...ports],
      frame: { src: laptop.mac, dst: BROADCAST, body: `ARP request: who has ${nextHopIp}?` },
    });

    if (!owner) {
      out.push({
        step: 3,
        text: `Nobody has ${t.ip}. The laptop asks 3 times, about 1 second apart, then gives up: "Destination Host Unreachable".`,
        moves: [],
        arp: [...snap(arp), { ip: t.ip, mac: "(incomplete)", fresh: true }],
        ports: snap(ports),
        failed: true,
      });
      return out;
    }

    const o = host(owner);
    ports.splice(0, ports.length, ...snap(ports)); // only the new entry is highlighted
    learnPort(owner);
    arp.push({ ip: o.ip, mac: o.mac, fresh: true });
    out.push({
      step: 3,
      text: `The ${o.name.toLowerCase()} recognises its own IP and answers only the laptop: "${o.ip} is at ${o.mac}". The others ignore the question. The switch now knows which port each MAC is on.`,
      moves: [[{ from: owner, to: "switch", label: "is at", tone: "good" }], [{ from: "switch", to: "laptop", label: "is at", tone: "good" }]],
      arp: [...arp],
      ports: [...ports],
      frame: { src: o.mac, dst: laptop.mac, body: `ARP reply: ${o.ip} is at ${o.mac}` },
    });
  }

  const o = host(owner!);
  out.push({
    step: 4,
    text: `The laptop sends the real packet in a frame addressed to ${o.mac}. The switch looks that MAC up and sends it out of port ${o.port} only.${target === "internet" ? " The IP header still says 8.8.8.8." : ""}`,
    moves: [[{ from: "laptop", to: "switch", label: "frame" }], [{ from: "switch", to: owner!, label: "frame" }]],
    arp: snap(arp),
    ports: snap(ports),
    frame: { src: laptop.mac, dst: o.mac, body: `IP packet to ${t.ip}` },
  });
  return out;
}
