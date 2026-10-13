// Home router NAT: private addresses share one public address.
export const PUBLIC = "203.0.113.7";
export const DEVICES = [{ name: "Laptop", ip: "192.168.1.10" }, { name: "Phone", ip: "192.168.1.11" }, { name: "TV", ip: "192.168.1.12" }];
export type Row = { inside: string; outside: string; remote: string };
export type Frame = { text: string; packet: { from: string; to: string; side: "lan" | "wan" } | null; table: Row[]; drop?: boolean; hot?: number };

export function frames(): Frame[] {
  const t: Row[] = [];
  const out: Frame[] = [{ text: "Three devices with private 192.168 addresses. The internet only knows the router's one public address.", packet: null, table: [] }];
  const send = (dev: number, port: number, pub: number, remote: string) => {
    const inside = `${DEVICES[dev].ip}:${port}`;
    out.push({ text: `${DEVICES[dev].name} sends from ${inside} to ${remote}.`, packet: { from: inside, to: remote, side: "lan" }, table: [...t] });
    t.push({ inside, outside: `${PUBLIC}:${pub}`, remote });
    out.push({ text: `Router rewrites the source to ${PUBLIC}:${pub} and remembers the mapping.`, packet: { from: `${PUBLIC}:${pub}`, to: remote, side: "wan" }, table: [...t], hot: t.length - 1 });
  };
  send(0, 51000, 40001, "93.184.216.34:443");
  send(1, 51000, 40002, "142.250.80.46:443");
  out.push({ text: "Both used local port 51000. The router gave them different public ports, so replies can be told apart.", packet: null, table: [...t] });
  out.push({ text: `A reply arrives for ${PUBLIC}:40002. The table says that's the Phone.`, packet: { from: "142.250.80.46:443", to: `${PUBLIC}:40002`, side: "wan" }, table: [...t], hot: 1 });
  out.push({ text: "Router rewrites the destination back to 192.168.1.11:51000 and forwards it inside.", packet: { from: "142.250.80.46:443", to: "192.168.1.11:51000", side: "lan" }, table: [...t], hot: 1 });
  out.push({ text: `A stranger sends to ${PUBLIC}:8080. No mapping matches, so it's dropped. That's why you can't host a server at home without port forwarding.`, packet: { from: "198.51.100.9:5555", to: `${PUBLIC}:8080`, side: "wan" }, table: [...t], drop: true });
  return out;
}
