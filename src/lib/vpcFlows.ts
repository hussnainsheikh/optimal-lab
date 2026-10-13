// Traffic flows in a VPC with a public and a private subnet.
export const FLOWS = [
  { id: "in-web", label: "Internet → web server :443", path: ["Internet", "Internet gateway", "Public subnet", "web SG: 443 from 0.0.0.0/0", "web server"], ok: true, note: "The public subnet's route table sends 0.0.0.0/0 to the internet gateway, and the web security group allows 443 from anywhere." },
  { id: "in-db", label: "Internet → database :5432", path: ["Internet", "Internet gateway", "✗ no route to private subnet"], ok: false, note: "The database has no public IP and its subnet has no route from the internet gateway. Unreachable by design." },
  { id: "web-db", label: "Web server → database :5432", path: ["web server", "local route 10.0.0.0/16", "db SG: 5432 from web SG", "database"], ok: true, note: "Traffic inside the VPC uses the local route. The db security group allows 5432 only from members of the web security group." },
  { id: "laptop-db", label: "Your laptop → database :5432", path: ["Laptop", "✗ db SG has no rule for you"], ok: false, note: "Even over a VPN, the security group only trusts the web tier. Use a bastion or SSM session for admin access." },
  { id: "db-out", label: "Database → internet (OS updates)", path: ["database", "private route 0.0.0.0/0 → NAT gateway", "NAT gateway (public subnet)", "Internet gateway", "Internet"], ok: true, note: "Private subnets reach out through a NAT gateway. Replies come back; nothing can start a connection inward." },
];
