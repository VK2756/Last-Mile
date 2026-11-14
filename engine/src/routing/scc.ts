// OWNER: Lane D (routing). Strongly connected components of a directed road graph.

/** Largest strongly connected component (iterative Kosaraju). Returns a membership mask. */
export function largestScc(n: number, edges: { from: number; to: number }[]): Uint8Array {
  const out: number[][] = Array.from({ length: n }, () => []);
  const inc: number[][] = Array.from({ length: n }, () => []);
  for (const e of edges) { out[e.from]!.push(e.to); inc[e.to]!.push(e.from); }
  const seen = new Uint8Array(n);
  const order: number[] = [];
  for (let s = 0; s < n; s++) {
    if (seen[s]) continue;
    const stack: [number, number][] = [[s, 0]];
    seen[s] = 1;
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const [u, k] = top;
      if (k < out[u]!.length) {
        top[1]++;
        const v = out[u]![k]!;
        if (!seen[v]) { seen[v] = 1; stack.push([v, 0]); }
      } else { order.push(u); stack.pop(); }
    }
  }
  const comp = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  for (let k = order.length - 1; k >= 0; k--) {
    const s = order[k]!;
    if (comp[s] !== -1) continue;
    const c = sizes.length;
    sizes.push(0);
    const stack = [s];
    comp[s] = c;
    while (stack.length) {
      const u = stack.pop()!;
      sizes[c]!++;
      for (const v of inc[u]!) if (comp[v] === -1) { comp[v] = c; stack.push(v); }
    }
  }
  let best = 0;
  for (let c = 1; c < sizes.length; c++) if (sizes[c]! > sizes[best]!) best = c;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (comp[i] === best) mask[i] = 1;
  return mask;
}
