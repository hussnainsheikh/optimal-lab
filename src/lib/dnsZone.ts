// The DNS zone for example.com and what queries return.
export const RECORDS = [
  { name: "example.com", type: "A", value: "93.184.216.34", ttl: 300, note: "IPv4 address for the bare domain" },
  { name: "example.com", type: "AAAA", value: "2606:2800:220:1::248", ttl: 300, note: "IPv6 address" },
  { name: "www.example.com", type: "CNAME", value: "example.com", ttl: 3600, note: "An alias: look up that name instead" },
  { name: "api.example.com", type: "CNAME", value: "lb-123.eu-west-1.elb.amazonaws.com", ttl: 60, note: "Points at a load balancer whose IPs change" },
  { name: "example.com", type: "MX", value: "10 mail.example.com", ttl: 3600, note: "Where to deliver email; lower number = preferred" },
  { name: "example.com", type: "TXT", value: "v=spf1 include:_spf.google.com -all", ttl: 3600, note: "SPF: who may send mail as this domain" },
  { name: "example.com", type: "NS", value: "ns1.dnsprovider.net", ttl: 86400, note: "Which servers are authoritative for the zone" },
];
export const QUERIES = [
  { q: "example.com A", name: "example.com", type: "A" },
  { q: "www.example.com A", name: "www.example.com", type: "A" },
  { q: "api.example.com A", name: "api.example.com", type: "A" },
  { q: "example.com MX", name: "example.com", type: "MX" },
  { q: "example.com TXT", name: "example.com", type: "TXT" },
  { q: "shop.example.com A", name: "shop.example.com", type: "A" },
];
export function resolve(name: string, type: string) {
  const chain: string[] = [];
  let n = name;
  for (let i = 0; i < 4; i++) {
    const direct = RECORDS.find((r) => r.name === n && r.type === type);
    if (direct) { chain.push(`${n} ${type} → ${direct.value}`); return { chain, answer: direct.value, hit: RECORDS.indexOf(direct) }; }
    const cname = RECORDS.find((r) => r.name === n && r.type === "CNAME");
    if (cname) { chain.push(`${n} CNAME → ${cname.value}`); n = cname.value; if (n.endsWith("amazonaws.com")) { chain.push(`${n} A → 52.18.4.7 (answered by AWS's DNS)`); return { chain, answer: "52.18.4.7", hit: RECORDS.indexOf(cname) }; } continue; }
    chain.push(`${n} ${type} → NXDOMAIN (no such name)`); return { chain, answer: null, hit: -1 };
  }
  return { chain, answer: null, hit: -1 };
}
