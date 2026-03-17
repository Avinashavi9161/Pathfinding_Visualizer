import type { Grid } from './grid'
import { forEachNeighbor } from './grid'
import { MinPQ } from './pq'

export type SearchEvent =
  | { type: 'visit'; idx: number }
  | { type: 'done'; found: boolean; path: Int32Array }

export type SearchStats = {
  visited: number
  found: boolean
  pathLength: number | null
}

export type SearchState = {
  visited: Uint8Array
  frontier: Uint8Array
  path: Uint8Array
  stats: SearchStats
}

export function createSearchState(grid: Grid): SearchState {
  return {
    visited: new Uint8Array(grid.size),
    frontier: new Uint8Array(grid.size),
    path: new Uint8Array(grid.size),
    stats: { visited: 0, found: false, pathLength: null },
  }
}

function reconstructPath(prev: Int32Array, start: number, end: number): Int32Array {
  if (start === end) return new Int32Array([start])
  const out: number[] = []
  let cur = end
  while (cur !== -1 && cur !== start) {
    out.push(cur)
    cur = prev[cur]!
  }
  if (cur !== start) return new Int32Array(0)
  out.push(start)
  out.reverse()
  return Int32Array.from(out)
}

export function* dijkstra(
  grid: Grid,
  onFrontier?: (idx: number, isIn: boolean) => void,
): Generator<SearchEvent, void, void> {
  const dist = new Float64Array(grid.size)
  dist.fill(Number.POSITIVE_INFINITY)
  const prev = new Int32Array(grid.size)
  prev.fill(-1)
  const visited = new Uint8Array(grid.size)
  const pq = new MinPQ()

  dist[grid.start] = 0
  pq.push(0, grid.start)
  onFrontier?.(grid.start, true)

  while (pq.size) {
    const node = pq.pop()!
    const idx = node.value
    if (visited[idx]) continue
    visited[idx] = 1
    onFrontier?.(idx, false)

    yield { type: 'visit', idx }
    if (idx === grid.end) {
      const path = reconstructPath(prev, grid.start, grid.end)
      yield { type: 'done', found: path.length > 0, path }
      return
    }

    forEachNeighbor(grid, idx, (n) => {
      if (visited[n] || grid.walls[n]) return
      const nd = dist[idx]! + 1
      if (nd < dist[n]!) {
        dist[n] = nd
        prev[n] = idx
        pq.push(nd, n)
        onFrontier?.(n, true)
      }
    })
  }

  yield { type: 'done', found: false, path: new Int32Array(0) }
}

function manhattan(grid: Grid, a: number, b: number) {
  const ar = grid.indexToRow(a)
  const ac = a - ar * grid.cols
  const br = grid.indexToRow(b)
  const bc = b - br * grid.cols
  return Math.abs(ar - br) + Math.abs(ac - bc)
}

export function* astar(
  grid: Grid,
  onFrontier?: (idx: number, isIn: boolean) => void,
): Generator<SearchEvent, void, void> {
  const g = new Float64Array(grid.size)
  g.fill(Number.POSITIVE_INFINITY)
  const prev = new Int32Array(grid.size)
  prev.fill(-1)
  const visited = new Uint8Array(grid.size)
  const pq = new MinPQ()

  g[grid.start] = 0
  pq.push(manhattan(grid, grid.start, grid.end), grid.start)
  onFrontier?.(grid.start, true)

  while (pq.size) {
    const node = pq.pop()!
    const idx = node.value
    if (visited[idx]) continue
    visited[idx] = 1
    onFrontier?.(idx, false)

    yield { type: 'visit', idx }
    if (idx === grid.end) {
      const path = reconstructPath(prev, grid.start, grid.end)
      yield { type: 'done', found: path.length > 0, path }
      return
    }

    forEachNeighbor(grid, idx, (n) => {
      if (visited[n] || grid.walls[n]) return
      const ng = g[idx]! + 1
      if (ng < g[n]!) {
        g[n] = ng
        prev[n] = idx
        const f = ng + manhattan(grid, n, grid.end)
        pq.push(f, n)
        onFrontier?.(n, true)
      }
    })
  }

  yield { type: 'done', found: false, path: new Int32Array(0) }
}

