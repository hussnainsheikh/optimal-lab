// Browser storage options and what each is for.
export const STORES = [
  { id: "cookie", name: "Cookies", size: "~4 KB each", sent: "with every request", api: "sync (document.cookie)", js: "can be hidden (HttpOnly)", life: "until expiry" },
  { id: "local", name: "localStorage", size: "~5 MB", sent: "never", api: "sync", js: "always readable by JS", life: "until cleared" },
  { id: "session", name: "sessionStorage", size: "~5 MB", sent: "never", api: "sync", js: "always readable by JS", life: "until the tab closes" },
  { id: "idb", name: "IndexedDB", size: "hundreds of MB+", sent: "never", api: "async", js: "always readable by JS", life: "until cleared or evicted" },
  { id: "cache", name: "Cache API", size: "large", sent: "never", api: "async (service workers)", js: "readable by JS", life: "until cleared or evicted" },
];
export const NEEDS = [
  { id: "auth", label: "Login session", pick: "cookie", why: "An HttpOnly, Secure, SameSite cookie is sent automatically and can't be read by injected scripts. Never put tokens in localStorage." },
  { id: "theme", label: "Dark-mode preference", pick: "local", why: "Small, not secret, should survive restarts. localStorage is simple and synchronous, so the page can read it before first paint." },
  { id: "wizard", label: "Half-filled form in this tab", pick: "session", why: "Survives reloads but not into other tabs, and is gone when the tab closes." },
  { id: "offline", label: "10,000 offline notes", pick: "idb", why: "Large, structured and queryable, with an async API that won't block the main thread." },
  { id: "assets", label: "App shell for offline use", pick: "cache", why: "Service workers store responses in the Cache API and serve them when offline." },
];
