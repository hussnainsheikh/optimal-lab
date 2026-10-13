// What survives docker rm, depending on where the database stores its files.
export type Storage = "container" | "volume" | "bind";
export const STORAGES: { id: Storage; label: string; flag: string }[] = [
  { id: "container", label: "Container filesystem", flag: "docker run postgres" },
  { id: "volume", label: "Named volume", flag: "docker run -v pgdata:/var/lib/postgresql/data postgres" },
  { id: "bind", label: "Bind mount", flag: "docker run -v ./data:/var/lib/postgresql/data postgres" },
];
export const STEPS = ["Start the container", "Insert 3 rows", "docker restart", "docker rm -f, then docker run again", "docker compose down -v"];
export function rows(s: Storage, step: number) {
  if (step === 0) return 0;
  if (step <= 2) return 3;
  if (step === 3) return s === "container" ? 0 : 3;
  return s === "volume" ? 0 : s === "bind" ? 3 : 0;
}
