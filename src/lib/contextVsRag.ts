// Answering questions over a document set: stuff everything into the context, or retrieve chunks. Illustrative numbers.
export const WINDOW = 200_000;
const TOKENS_PER_PAGE = 600;
const PRICE_PER_M = 3; // $ per million input tokens, example
export function compare(pages: number) {
  const all = pages * TOKENS_PER_PAGE;
  const fits = all <= WINDOW;
  const longTokens = Math.min(all, WINDOW);
  const ragTokens = 8 * 500 + 300;
  const longAcc = fits ? Math.max(0.6, 0.95 - (all / WINDOW) * 0.25) : 0.95 * (WINDOW / all) ** 0.8;
  const ragAcc = 0.86 - Math.min(0.08, pages / 20000);
  return {
    long: { tokens: longTokens, cost: (longTokens / 1e6) * PRICE_PER_M, latency: 0.6 + longTokens / 40000, acc: longAcc, fits },
    rag: { tokens: ragTokens, cost: (ragTokens / 1e6) * PRICE_PER_M, latency: 0.9 + ragTokens / 40000, acc: ragAcc },
    all,
  };
}
