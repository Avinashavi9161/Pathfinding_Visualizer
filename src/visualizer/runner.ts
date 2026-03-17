import type { Grid } from './grid'
import { astar, createSearchState, dijkstra, type SearchState } from './search'

type Algo = 'dijkstra' | 'astar'
type Selection = 'compare' | Algo

type AlgoRuntime = {
  algo: Algo
  gen: Generator<any, void, void> | null
  state: SearchState
  done: boolean
  found: boolean
  lastPath: Int32Array | null
  visitedCount: number
}

type ComparisonStats = {
  dijkstra: { visited: number }
  astar: { visited: number }
  pathLength: number | null
  status: 'idle' | 'running' | 'paused' | 'done'
}

export type ComparisonRunner = {
  leftState: SearchState
  rightState: SearchState
  pointerWallValue: 0 | 1 | null
  setSpeed: (stepsPerSecond: number) => void
  setSelection: (selection: Selection) => void
  start: () => void
  pause: () => void
  stop: () => void
  tick: () => void
  stepOnce: () => void
  resetSearch: () => void
  clearExploration: () => void
  markDirty: (idx: number) => void
  markAllDirty: () => void
  consumeDirty: () => { dirty: Int32Array | null }
  getStats: () => ComparisonStats
}

export function createComparisonRunner(grid: Grid): ComparisonRunner {
  const left = createSearchState(grid)
  const right = createSearchState(grid)

  const rt: Record<Algo, AlgoRuntime> = {
    dijkstra: {
      algo: 'dijkstra',
      gen: null,
      state: left,
      done: false,
      found: false,
      lastPath: null,
      visitedCount: 0,
    },
    astar: {
      algo: 'astar',
      gen: null,
      state: right,
      done: false,
      found: false,
      lastPath: null,
      visitedCount: 0,
    },
  }

  let selection: Selection = 'compare'
  let stepsPerSecond = 60
  let status: ComparisonStats['status'] = 'idle'
  let running = false
  let accumulator = 0
  let lastTs = performance.now()

  let dirtyBuf = new Int32Array(0)
  let dirtyLen = 0
  let dirtyAll = true

  const ensureDirtyCap = (need: number) => {
    if (dirtyBuf.length >= need) return
    const next = Math.max(need, dirtyBuf.length * 2, 256)
    dirtyBuf = new Int32Array(next)
  }

  const markDirty = (idx: number) => {
    if (dirtyAll) return
    ensureDirtyCap(dirtyLen + 1)
    dirtyBuf[dirtyLen++] = idx
  }

  const markAllDirty = () => {
    dirtyAll = true
    dirtyLen = 0
  }

  const consumeDirty = () => {
    if (dirtyAll) {
      dirtyAll = false
      return { dirty: null }
    }
    const out = dirtyLen ? dirtyBuf.slice(0, dirtyLen) : new Int32Array(0)
    dirtyLen = 0
    return { dirty: out }
  }

  const clearState = (s: SearchState) => {
    s.visited.fill(0)
    s.frontier.fill(0)
    s.path.fill(0)
    s.stats.visited = 0
    s.stats.found = false
    s.stats.pathLength = null
  }

  const bindGenerators = () => {
    const onFrontier = (which: Algo) => (idx: number, isIn: boolean) => {
      const st = rt[which].state
      st.frontier[idx] = isIn ? 1 : 0
      markDirty(idx)
    }
    rt.dijkstra.gen = dijkstra(grid, onFrontier('dijkstra'))
    rt.astar.gen = astar(grid, onFrontier('astar'))
  }

  const resetSearch = () => {
    for (const a of ['dijkstra', 'astar'] as const) {
      const r = rt[a]
      clearState(r.state)
      r.done = false
      r.found = false
      r.lastPath = null
      r.visitedCount = 0
    }
    bindGenerators()
    status = 'idle'
    running = false
    accumulator = 0
    lastTs = performance.now()
    markAllDirty()
  }

  const clearExploration = () => {
    // Keep walls/start/end, but clear overlays.
    clearState(left)
    clearState(right)
    bindGenerators()
    for (const a of ['dijkstra', 'astar'] as const) {
      rt[a].done = false
      rt[a].found = false
      rt[a].lastPath = null
      rt[a].visitedCount = 0
    }
    status = 'idle'
    running = false
    accumulator = 0
    lastTs = performance.now()
    markAllDirty()
  }

  const applyPath = (st: SearchState, path: Int32Array) => {
    st.path.fill(0)
    for (let i = 0; i < path.length; i++) {
      const idx = path[i]!
      if (idx === grid.start || idx === grid.end) continue
      st.path[idx] = 1
      markDirty(idx)
    }
    st.stats.pathLength = path.length ? Math.max(0, path.length - 1) : null
  }

  const stepAlgo = (which: Algo) => {
    const r = rt[which]
    if (r.done || !r.gen) return
    const next = r.gen.next()
    if (next.done) return
    const ev = next.value as { type: string; idx?: number; found?: boolean; path?: Int32Array }
    if (ev.type === 'visit') {
      const idx = ev.idx!
      if (idx !== grid.start && idx !== grid.end) {
        r.state.visited[idx] = 1
        markDirty(idx)
      }
      r.visitedCount++
      r.state.stats.visited = r.visitedCount
      return
    }
    if (ev.type === 'done') {
      r.done = true
      r.found = !!ev.found
      r.lastPath = ev.path ?? new Int32Array(0)
      r.state.stats.found = r.found
      if (r.found && r.lastPath) applyPath(r.state, r.lastPath)
      return
    }
  }

  const isDone = () => {
    if (selection === 'compare') return rt.dijkstra.done && rt.astar.done
    return selection === 'dijkstra' ? rt.dijkstra.done : rt.astar.done
  }

  const stepOnce = () => {
    if (isDone()) {
      status = 'done'
      running = false
      return
    }

    if (selection === 'compare') {
      stepAlgo('dijkstra')
      stepAlgo('astar')
    } else if (selection === 'dijkstra') {
      stepAlgo('dijkstra')
    } else {
      stepAlgo('astar')
    }

    if (isDone()) {
      status = 'done'
      running = false
    } else if (running) {
      status = 'running'
    } else {
      status = 'paused'
    }
  }

  resetSearch()

  return {
    leftState: left,
    rightState: right,
    pointerWallValue: null,
    setSpeed: (s) => {
      stepsPerSecond = Math.max(1, s)
    },
    setSelection: (s) => {
      selection = s
      markAllDirty()
    },
    start: () => {
      if (status === 'done') resetSearch()
      running = true
      status = 'running'
    },
    pause: () => {
      running = false
      status = isDone() ? 'done' : 'paused'
    },
    stop: () => {
      running = false
      status = 'idle'
    },
    tick: () => {
      const now = performance.now()
      const dt = Math.min(50, now - lastTs)
      lastTs = now
      if (!running) return

      accumulator += dt
      const stepMs = 1000 / stepsPerSecond

      // Process a bounded number of steps per frame to keep UI responsive.
      let steps = 0
      const maxSteps = 240
      while (accumulator >= stepMs && steps < maxSteps) {
        accumulator -= stepMs
        stepOnce()
        steps++
        if (status === 'done') break
      }
    },
    stepOnce,
    resetSearch,
    clearExploration,
    markDirty,
    markAllDirty,
    consumeDirty,
    getStats: () => {
      const path = selection === 'astar' ? rt.astar.lastPath : rt.dijkstra.lastPath
      const comparePath = rt.astar.lastPath && rt.astar.lastPath.length ? rt.astar.lastPath : rt.dijkstra.lastPath
      const pathLength =
        selection === 'compare'
          ? comparePath && comparePath.length
            ? Math.max(0, comparePath.length - 1)
            : null
          : path && path.length
            ? Math.max(0, path.length - 1)
            : null
      return {
        dijkstra: { visited: rt.dijkstra.visitedCount },
        astar: { visited: rt.astar.visitedCount },
        pathLength,
        status,
      }
    },
  }
}

