// OWNER: Lane D (routing). Minimal binary min-heap over (node, key) pairs, used by Dijkstra.
// Lazy deletion: callers skip stale entries by comparing the popped key to their best-known distance.
export class MinHeap {
  private nodes: number[] = [];
  private keys: number[] = [];

  get size(): number { return this.nodes.length; }

  push(node: number, key: number): void {
    const nodes = this.nodes, keys = this.keys;
    let i = nodes.length;
    nodes.push(node); keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      const pk = keys[p]!;
      if (pk <= key) break;
      nodes[i] = nodes[p]!; keys[i] = pk;
      i = p;
    }
    nodes[i] = node; keys[i] = key;
  }

  /** Pops the smallest entry into `out` ([node, key]). Returns false when empty. */
  pop(out: [number, number]): boolean {
    const nodes = this.nodes, keys = this.keys;
    const n = nodes.length;
    if (n === 0) return false;
    out[0] = nodes[0]!; out[1] = keys[0]!;
    const lastNode = nodes.pop()!, lastKey = keys.pop()!;
    if (n === 1) return true;
    let i = 0;
    const m = n - 1;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= m) break;
      const r = l + 1;
      const c = r < m && keys[r]! < keys[l]! ? r : l;
      if (keys[c]! >= lastKey) break;
      nodes[i] = nodes[c]!; keys[i] = keys[c]!;
      i = c;
    }
    nodes[i] = lastNode; keys[i] = lastKey;
    return true;
  }
}
