import type { Grid } from './grid'
import type { Theme } from './theme'
import type { SearchState } from './search'

export type Renderer = {
  setTitle: (title: string) => void
  setHover: (idx: number | null) => void
  drawFull: (state: SearchState) => void
  drawDirty: (state: SearchState, dirty: Int32Array) => void
}

export function createRenderer(canvas: HTMLCanvasElement, grid: Grid, theme: Theme): Renderer {
  const ctx = canvas.getContext('2d', { alpha: false })!
  const gridOverlay = document.createElement('canvas')
  const gridCtx = gridOverlay.getContext('2d', { alpha: true })!
  let title = ''
  let hoverIdx: number | null = null
  let lastCssW = -1
  let lastCssH = -1
  let lastCell = -1

  const setSize = () => {
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const cssW = Math.floor(canvas.clientWidth)
    const cssH = Math.floor(canvas.clientHeight)
    canvas.width = Math.max(1, Math.floor(cssW * dpr))
    canvas.height = Math.max(1, Math.floor(cssH * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const cs = cellSize()
    if (cssW !== lastCssW || cssH !== lastCssH || cs !== lastCell) {
      lastCssW = cssW
      lastCssH = cssH
      lastCell = cs
      gridOverlay.width = canvas.width
      gridOverlay.height = canvas.height
      gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawGridOverlay()
    }
  }

  const cellSize = () => {
    // UI slider is the source of truth; read from CSS custom property (set in CSS).
    const css = getComputedStyle(document.documentElement)
    const raw = css.getPropertyValue('--cell').trim()
    const v = Number.parseFloat(raw)
    return Number.isFinite(v) && v > 0 ? v : 18
  }

  const fillCell = (idx: number, color: string) => {
    const cs = cellSize()
    const r = grid.indexToRow(idx)
    const c = idx - r * grid.cols
    const x = c * cs
    const y = r * cs
    ctx.fillStyle = color
    ctx.fillRect(x, y, cs, cs)
  }

  const strokeCell = (idx: number, color: string) => {
    const cs = cellSize()
    const r = grid.indexToRow(idx)
    const c = idx - r * grid.cols
    const x = c * cs + 0.5
    const y = r * cs + 0.5
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, cs - 1, cs - 1)
  }

  const drawGridOverlay = () => {
    const cs = cellSize()
    gridCtx.clearRect(0, 0, grid.cols * cs, grid.rows * cs)
    gridCtx.strokeStyle = theme.gridLine
    gridCtx.lineWidth = 1
    gridCtx.beginPath()
    for (let r = 0; r <= grid.rows; r++) {
      const y = r * cs + 0.5
      gridCtx.moveTo(0, y)
      gridCtx.lineTo(grid.cols * cs, y)
    }
    for (let c = 0; c <= grid.cols; c++) {
      const x = c * cs + 0.5
      gridCtx.moveTo(x, 0)
      gridCtx.lineTo(x, grid.rows * cs)
    }
    gridCtx.stroke()
  }

  const drawCell = (state: SearchState, idx: number) => {
    if (idx < 0 || idx >= grid.size) return
    if (grid.walls[idx]) {
      fillCell(idx, theme.wall)
      // Make walls pop: subtle border + inner hatch.
      strokeCell(idx, theme.wallBorder)
      const cs = cellSize()
      const r = grid.indexToRow(idx)
      const c = idx - r * grid.cols
      const x = c * cs
      const y = r * cs
      ctx.strokeStyle = theme.wallBorder
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x + 3, y + cs - 3)
      ctx.lineTo(x + cs - 3, y + 3)
      ctx.stroke()
      return
    }
    if (idx === grid.start) {
      fillCell(idx, theme.start)
      return
    }
    if (idx === grid.end) {
      fillCell(idx, theme.end)
      return
    }
    if (state.path[idx]) {
      fillCell(idx, theme.path)
      return
    }
    if (state.frontier[idx]) {
      fillCell(idx, theme.frontier)
      return
    }
    if (state.visited[idx]) {
      fillCell(idx, theme.visited)
      return
    }
    fillCell(idx, theme.bg)
  }

  const drawHover = () => {
    if (hoverIdx === null) return
    if (hoverIdx < 0 || hoverIdx >= grid.size) return
    const cs = cellSize()
    const r = grid.indexToRow(hoverIdx)
    const c = hoverIdx - r * grid.cols
    const x = c * cs + 1.5
    const y = r * cs + 1.5
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, cs - 3, cs - 3)
  }

  const drawFull = (state: SearchState) => {
    setSize()
    const cs = cellSize()
    ctx.fillStyle = theme.bg
    ctx.fillRect(0, 0, grid.cols * cs, grid.rows * cs)

    // Draw base cells first, then overlays.
    for (let i = 0; i < grid.size; i++) drawCell(state, i)
    ctx.drawImage(gridOverlay, 0, 0)
    drawHover()

    if (title) {
      ctx.fillStyle = theme.text
      ctx.font = '600 12px system-ui, Segoe UI, Roboto, sans-serif'
      ctx.fillText(title, 10, 16)
    }
  }

  const drawDirty = (state: SearchState, dirty: Int32Array) => {
    setSize()
    for (let i = 0; i < dirty.length; i++) drawCell(state, dirty[i]!)
    ctx.drawImage(gridOverlay, 0, 0)
    drawHover()
    if (title) {
      ctx.fillStyle = theme.text
      ctx.font = '600 12px system-ui, Segoe UI, Roboto, sans-serif'
      ctx.fillText(title, 10, 16)
    }
  }

  return {
    setTitle: (t) => {
      title = t
    },
    setHover: (idx) => {
      hoverIdx = idx
    },
    drawFull,
    drawDirty,
  }
}

