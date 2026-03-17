export type Grid = {
  readonly rows: number
  readonly cols: number
  readonly size: number
  start: number
  end: number
  walls: Uint8Array
  posToIndex: (r: number, c: number) => number
  indexToRow: (idx: number) => number
  indexToCol: (idx: number) => number
}

export function createGrid(rows: number, cols: number): Grid {
  const size = rows * cols
  const walls = new Uint8Array(size)
  const posToIndex = (r: number, c: number) => r * cols + c
  const indexToRow = (idx: number) => Math.floor(idx / cols)
  const indexToCol = (idx: number) => idx - indexToRow(idx) * cols
  return {
    rows,
    cols,
    size,
    start: 0,
    end: size - 1,
    walls,
    posToIndex,
    indexToRow,
    indexToCol,
  }
}

export function forEachNeighbor(
  grid: Grid,
  idx: number,
  fn: (nIdx: number) => void,
) {
  const r = grid.indexToRow(idx)
  const c = idx - r * grid.cols

  // Cardinal neighbors only (consistent with Manhattan heuristic).
  if (r > 0) fn(idx - grid.cols)
  if (r + 1 < grid.rows) fn(idx + grid.cols)
  if (c > 0) fn(idx - 1)
  if (c + 1 < grid.cols) fn(idx + 1)
}

