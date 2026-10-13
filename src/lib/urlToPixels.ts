// Loading https://shop.example.com on a decent connection, step by step. Times in ms, illustrative.
export const STEPS = [
  { name: "DNS lookup", start: 0, ms: 30, lane: "network", note: "Turn shop.example.com into an IP address." },
  { name: "TCP + TLS", start: 30, ms: 60, lane: "network", note: "Two round trips to open an encrypted connection." },
  { name: "Request → first byte", start: 90, ms: 120, lane: "network", note: "The server builds the page; the first byte of HTML arrives (TTFB)." },
  { name: "Parse HTML, build the DOM", start: 210, ms: 40, lane: "main", note: "The parser turns tags into a tree of nodes, streaming as bytes arrive." },
  { name: "Fetch CSS (render-blocking)", start: 230, ms: 90, lane: "network", note: "The browser won't paint until it has the CSS, or the page would flash unstyled." },
  { name: "Fetch JS (deferred)", start: 235, ms: 140, lane: "network", note: "defer lets HTML parsing continue; the script runs after parsing." },
  { name: "Build CSSOM + render tree", start: 320, ms: 15, lane: "main", note: "Combine DOM and CSS rules: which nodes are visible, with which styles." },
  { name: "Layout", start: 335, ms: 12, lane: "main", note: "Compute every box's size and position." },
  { name: "Paint + composite", start: 347, ms: 10, lane: "main", note: "Draw pixels into layers and combine them on the GPU. First paint!" },
  { name: "Run JS, hydrate", start: 375, ms: 80, lane: "main", note: "Scripts run, attach event handlers; the page becomes interactive." },
];
