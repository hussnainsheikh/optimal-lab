// The CSS box model: content, padding, border, margin.
export function sizes(width: number, padding: number, border: number, margin: number, borderBox: boolean) {
  const content = borderBox ? Math.max(0, width - 2 * padding - 2 * border) : width;
  const borderBoxW = content + 2 * padding + 2 * border;
  return { content, borderBoxW, space: borderBoxW + 2 * margin };
}
