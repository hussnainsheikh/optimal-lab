// Containers on a user-defined Docker network called app, and connections between them.
export const CONTAINERS = [
  { name: "web", ip: "172.18.0.2", publish: "8080:80" },
  { name: "api", ip: "172.18.0.3", publish: null },
  { name: "db", ip: "172.18.0.4", publish: null },
];
export const TRIES = [
  { from: "your browser", to: "localhost:8080", ok: true, note: "-p 8080:80 publishes web's port 80 on the host's 8080. Docker forwards it into the container." },
  { from: "api", to: "localhost:5432", ok: false, note: "Inside a container, localhost is that container. There's no Postgres in api, so: connection refused." },
  { from: "api", to: "db:5432", ok: true, note: "On a user-defined network, Docker's DNS resolves container names. db → 172.18.0.4." },
  { from: "your laptop", to: "localhost:5432", ok: false, note: "db's port isn't published, so nothing listens on the host. Add -p 5432:5432 (only for local development)." },
  { from: "web", to: "api:3000", ok: true, note: "Same network, name resolution, any port the container listens on. No publishing needed between containers." },
];
