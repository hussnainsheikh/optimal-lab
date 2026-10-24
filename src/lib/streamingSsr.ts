// Server rendering a product page whose parts are ready at different times, sent either as one
// buffered response or streamed in HTTP/1.1 chunks as each part is ready. The chunk framing
// (hex length, CRLF, data, CRLF, then a zero-length chunk) is the real Transfer-Encoding:
// chunked format, with byte lengths counted from the actual HTML. React streams late parts
// out of order: hidden HTML plus a tiny inline script that swaps it into its placeholder.
// Render and network times are illustrative.

export type Opts = { stream: boolean; proxyBuffers: boolean; missing: boolean; checkFirst: boolean; headScript: boolean };
export const BUFFERED: Opts = { stream: false, proxyBuffers: false, missing: false, checkFirst: false, headScript: true };
export const STREAMED: Opts = { stream: true, proxyBuffers: false, missing: false, checkFirst: true, headScript: false };

export const T = { shell: 30, product: 220, reviews: 920, check: 25, oneWay: 40, scriptLoad: 160 };

export type Part = { id: "shell" | "product" | "reviews" | "end"; ready: number; html: string };

export function parts(o: Opts): Part[] {
  const head = `<!DOCTYPE html><html><head><title>Trail runner 2</title><link rel="stylesheet" href="/app.css">${o.headScript ? '<script src="/vendor.js"></script>' : ""}</head><body><header>Shop</header>`;
  if (o.missing && o.checkFirst) {
    // The existence check ran before the first byte, so the shell itself says not found.
    return [
      { id: "shell", ready: T.shell, html: `${head}<main><h1>Product not found</h1></main>` },
      { id: "end", ready: T.shell, html: "</body></html>" },
    ];
  }
  if (o.missing) {
    return [
      { id: "shell", ready: T.shell, html: `${head}<main><template id="B:0"></template><p>Loading…</p></main>` },
      { id: "product", ready: T.product, html: `<div hidden id="S:0"><h1>Product not found</h1></div><script>$RC("B:0","S:0")</script>` },
      { id: "end", ready: T.product, html: "</body></html>" },
    ];
  }
  return [
    { id: "shell", ready: T.shell, html: `${head}<main><template id="B:0"></template><div class="skeleton"></div><template id="B:1"></template><div class="skeleton"></div></main>` },
    { id: "product", ready: T.product, html: `<div hidden id="S:0"><h1>Trail runner 2</h1><p>$129 · in stock</p><button>Add to cart</button></div><script>$RC("B:0","S:0")</script>` },
    { id: "reviews", ready: T.reviews, html: `<div hidden id="S:1"><h2>Reviews (212)</h2><ol><li>★★★★★ Light and grippy</li><li>★★★★☆ Runs small</li></ol></div><script>$RC("B:1","S:1")</script>` },
    { id: "end", ready: T.reviews, html: "</body></html>" },
  ];
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** The response exactly as it goes over the wire. */
export function wire(o: Opts) {
  const ps = parts(o);
  const status = o.missing && (!o.stream || o.checkFirst) ? "404 Not Found" : "200 OK";
  if (!o.stream) {
    // Buffered: the whole page is rendered first, then sent with a Content-Length.
    const body = o.missing ? ps[0].html.replace(/<main>.*<\/main>/, "<main><h1>Product not found</h1></main>") + "</body></html>" : ps[0].html.replace(/<main>.*<\/main>/, "<main><h1>Trail runner 2</h1>…<h2>Reviews (212)</h2>…</main>") + "</body></html>";
    const ready = Math.max(...ps.map((p) => p.ready));
    return { status, headers: [`HTTP/1.1 ${status}`, "Content-Type: text/html; charset=utf-8", `Content-Length: ${bytes(body)}`], chunks: [{ at: ready, raw: body, size: bytes(body), id: "all" as const }], totalBytes: bytes(body) };
  }
  // A 404 can only be sent if we know before the first byte; checking first delays the shell.
  const delay = o.checkFirst ? T.check : 0;
  let prev = 0;
  const chunks: { at: number; raw: string; size: number; id: Part["id"] | "last" }[] = ps.map((p) => {
    const size = bytes(p.html);
    prev = Math.max(prev, p.id === "shell" ? p.ready + delay : p.ready);
    return { at: prev, raw: `${size.toString(16)}\r\n${p.html}\r\n`, size, id: p.id };
  });
  // A zero-length chunk ends the response.
  chunks.push({ at: prev, raw: "0\r\n\r\n", size: 0, id: "last" });
  return { status, headers: [`HTTP/1.1 ${status}`, "Content-Type: text/html; charset=utf-8", "Transfer-Encoding: chunked"], chunks, totalBytes: chunks.reduce((a, c) => a + c.size, 0) };
}

/** What the browser sees and when. */
export function timeline(o: Opts) {
  const w = wire(o);
  const last = Math.max(...w.chunks.map((c) => c.at));
  // A buffering proxy holds every chunk until the response is complete.
  const arrive = (at: number) => (o.proxyBuffers ? last : at) + T.oneWay;
  const first = arrive(w.chunks[0].at);
  // A classic script in <head> blocks rendering until it's downloaded and run.
  const paintGate = o.headScript ? first + T.scriptLoad : first;
  const shellPaint = paintGate + 10;
  const find = (id: string) => w.chunks.find((c) => c.id === id);
  const productAt = o.stream && find("product") ? Math.max(shellPaint, arrive(find("product")!.at)) : shellPaint;
  const reviewsAt = o.stream && find("reviews") ? Math.max(shellPaint, arrive(find("reviews")!.at)) : o.missing ? null : shellPaint;
  return { ttfb: first, shellPaint, productAt, reviewsAt, done: arrive(last), status: w.status, softFourOhFour: o.missing && w.status === "200 OK" };
}
