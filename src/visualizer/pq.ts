export type PQNode = { key: number; value: number }

// Binary min-heap priority queue.
export class MinPQ {
  private heap: PQNode[] = []

  get size() {
    return this.heap.length
  }

  push(key: number, value: number) {
    const node = { key, value }
    const h = this.heap
    h.push(node)
    let i = h.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (h[p]!.key <= node.key) break
      h[i] = h[p]!
      i = p
    }
    h[i] = node
  }

  pop(): PQNode | null {
    const h = this.heap
    if (h.length === 0) return null
    const root = h[0]!
    const last = h.pop()!
    if (h.length === 0) return root

    let i = 0
    while (true) {
      const l = i * 2 + 1
      const r = l + 1
      if (l >= h.length) break
      const best = r < h.length && h[r]!.key < h[l]!.key ? r : l
      if (h[best]!.key >= last.key) break
      h[i] = h[best]!
      i = best
    }
    h[i] = last
    return root
  }
}

