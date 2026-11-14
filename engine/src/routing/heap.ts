// OWNER: Lane D (routing). Minimal binary min-heap over (node, key) pairs, used by Dijkstra.
// Lazy deletion: callers skip stale entries by comparing the popped key to their best-known distance.
// Backed by typed arrays that grow by doubling, so steady-state pushes and pops allocate nothing.
export class MinHeap {
  private nodes: Int32Array;
  private keys: Float64Array;
  private n = 0;

  constructor(capacity = 1024) {
    this.nodes = new Int32Array(Math.max(16, capacity));
    this.keys = new Float64Array(Math.max(16, capacity));
  }

  get size(): number { return this.n; }

  /** drop every entry (keeps the backing arrays) */
  reset(): void { this.n = 0; }

  push(node: number, key: number): void {
    if (this.n === this.nodes.length) {
      const nodes = new Int32Array(this.n * 2); nodes.set(this.nodes); this.nodes = nodes;
      const keys = new Float64Array(this.n * 2); keys.set(this.keys); this.keys = keys;
    }
    const nodes = this.nodes, keys = this.keys;
    let i = this.n++;
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
    const n = this.n;
    if (n === 0) return false;
    const nodes = this.nodes, keys = this.keys;
    out[0] = nodes[0]!; out[1] = keys[0]!;
    const m = n - 1;
    this.n = m;
    if (m === 0) return true;
    const lastNode = nodes[m]!, lastKey = keys[m]!;
    let i = 0;
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
