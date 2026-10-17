// The five-layer TCP/IP model, with the OSI layers each one covers.
// Each layer answers one question and adds one piece of information.

export type LayerId = "app" | "transport" | "network" | "link" | "physical";

export type Layer = {
  id: LayerId;
  name: string;
  osi: string; // which OSI layers it covers
  question: string; // the one question this layer answers
  adds: string; // what it adds to the data
  address: string; // the kind of address it uses
  unit: string; // what the data is called at this layer
  device: string; // boxes that work at this layer
};

export const LAYERS: Layer[] = [
  {
    id: "app",
    name: "Application",
    osi: "OSI 7 · 6 · 5",
    question: "What does the program want?",
    adds: "The request itself, in the program's own format: a URL and headers, a DNS question, an email.",
    address: "names and URLs (example.com/cart)",
    unit: "message",
    device: "browser, web server, layer 7 load balancer",
  },
  {
    id: "transport",
    name: "Transport",
    osi: "OSI 4",
    question: "Which program on that machine, and does it all have to arrive?",
    adds: "Port numbers. TCP also adds sequence numbers and acknowledgements so lost bytes are resent.",
    address: "ports (443, 53, 5060)",
    unit: "segment (TCP) or datagram (UDP)",
    device: "the operating system, firewalls that filter by port",
  },
  {
    id: "network",
    name: "Network",
    osi: "OSI 3",
    question: "Which machine, anywhere on the internet?",
    adds: "Source and destination IP addresses, and a TTL so a lost packet can't loop forever.",
    address: "IP addresses (93.184.216.34)",
    unit: "packet",
    device: "routers",
  },
  {
    id: "link",
    name: "Link",
    osi: "OSI 2",
    question: "Which box on this cable or Wi-Fi network gets it next?",
    adds: "Source and destination MAC addresses, plus a checksum to catch damaged frames.",
    address: "MAC addresses (a4:83:e7:12:34:56)",
    unit: "frame",
    device: "switches, Wi-Fi access points",
  },
  {
    id: "physical",
    name: "Physical",
    osi: "OSI 1",
    question: "How do bits become signals?",
    adds: "Nothing logical. It turns 1s and 0s into voltage on copper, light in fibre or radio waves.",
    address: "none",
    unit: "bits",
    device: "cables, network cards, radios",
  },
];

export type ScenarioId = "web" | "dns" | "call" | "email";

export type Scenario = {
  id: ScenarioId;
  label: string;
  // The protocol used at each layer, top to bottom.
  stack: Record<LayerId, string>;
  // What travels down between layers: app → transport, transport → network, network → link, link → physical.
  passes: [string, string, string, string];
};

export const SCENARIOS: Scenario[] = [
  {
    id: "web",
    label: "Load a web page",
    stack: { app: "HTTP inside TLS (HTTPS)", transport: "TCP, port 443", network: "IPv4", link: "Ethernet", physical: "copper cable" },
    passes: ["an HTTP request", "a TCP segment", "an IP packet", "an Ethernet frame"],
  },
  {
    id: "dns",
    label: "Look up a name",
    stack: { app: "DNS query", transport: "UDP, port 53", network: "IPv4", link: "Wi-Fi (802.11)", physical: "2.4 or 5 GHz radio" },
    passes: ["a DNS question", "a UDP datagram", "an IP packet", "a Wi-Fi frame"],
  },
  {
    id: "call",
    label: "Video call",
    stack: { app: "RTP media (WebRTC)", transport: "UDP, a high port like 50000", network: "IPv6", link: "Wi-Fi (802.11)", physical: "5 GHz radio" },
    passes: ["a video frame slice", "a UDP datagram", "an IPv6 packet", "a Wi-Fi frame"],
  },
  {
    id: "email",
    label: "Send an email",
    stack: { app: "SMTP", transport: "TCP, port 587", network: "IPv4", link: "Ethernet", physical: "fibre (light)" },
    passes: ["an SMTP command", "a TCP segment", "an IP packet", "an Ethernet frame"],
  },
];

export type FaultId = "none" | "light" | "arp" | "gateway" | "port" | "http";

// A real symptom and the layer it points to. Troubleshoot from the bottom up.
export const FAULTS: { id: FaultId; label: string; layer: LayerId | null; explain: string }[] = [
  { id: "none", label: "Nothing broken", layer: null, explain: "Everything works. Pick a symptom to see which layer it points to." },
  { id: "light", label: "No link light on the port", layer: "physical", explain: "No signal at all: a bad cable, an unplugged port or Wi-Fi turned off. Nothing above can work." },
  { id: "arp", label: "Can't reach the router next to you", layer: "link", explain: "The signal is fine, but frames don't get through: wrong Wi-Fi network, a VLAN mistake, or the router never answers ARP." },
  { id: "gateway", label: "Router works, 8.8.8.8 doesn't", layer: "network", explain: "Local traffic works, so layers 1 and 2 are fine. The default gateway or a route is wrong, so packets can't leave." },
  { id: "port", label: "Ping works, port 443 refused", layer: "transport", explain: "The machine is reachable by IP, but nothing listens on that port, or a firewall drops it." },
  { id: "http", label: "Connects, but the page says 404", layer: "app", explain: "Every layer below did its job. The server got the request and answered: that path doesn't exist." },
];

export const layerIndex = (id: LayerId) => LAYERS.findIndex((l) => l.id === id);
