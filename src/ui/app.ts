import { clamp } from '../utils/math'
import { createGrid, type Grid } from '../visualizer/grid'
import { createRenderer, type Renderer } from '../visualizer/renderer'
import { createComparisonRunner, type ComparisonRunner } from '../visualizer/runner'
import { palette, type Theme } from '../visualizer/theme'

type Mode = 'walls' | 'start' | 'end'
type AlgoSelection = 'compare' | 'dijkstra' | 'astar'

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Omit<Partial<HTMLElementTagNameMap[K]>, 'style'> & { className?: string; style?: string },
  children: Array<Node | string> = [],
) {
  const node = document.createElement(tag)
  const { style, ...rest } = attrs ?? {}
  Object.assign(node, rest)
  if (style) node.setAttribute('style', style)
  for (const child of children) node.append(child)
  return node
}

function labeledControl(labelText: string, control: HTMLElement) {
  return el('label', { className: 'control' }, [
    el('div', { className: 'controlLabel', textContent: labelText }),
    control,
  ])
}

export function mountApp(root: HTMLDivElement) {
  const theme: Theme = palette()

  root.innerHTML = ''
  root.className = 'appRoot'

  const title = el('div', { className: 'title' }, [
    el('div', { className: 'titleMain', textContent: 'Pathfinding Visualizer' }),
    el('div', {
      className: 'titleSub',
      textContent: 'Dijkstra vs A* • speed control • optimized for big grids',
    }),
  ])
  const help = el('div', {
    className: 'help',
    textContent:
      'Tip: Drag to draw walls. Use “Move start/end” to reposition. Run to watch the algorithm explore; Step to learn slowly.',
  })

  const algoSelect = el('select', { className: 'select' }) as HTMLSelectElement
  ;[
    ['compare', 'Compare (Dijkstra vs A*)'],
    ['dijkstra', 'Dijkstra'],
    ['astar', 'A* (Manhattan)'],
  ].forEach(([value, label]) => {
    algoSelect.append(el('option', { value, textContent: label }))
  })
  algoSelect.value = 'compare'

  const speed = el('input', {
    className: 'range',
    type: 'range',
    min: '5',
    max: '240',
    value: '60',
    step: '1',
  }) as HTMLInputElement
  const speedValue = el('div', { className: 'value', textContent: '60 steps/s' })
  const speedWrap = el('div', { className: 'row' }, [speed, speedValue])

  const cellSize = el('input', {
    className: 'range',
    type: 'range',
    min: '8',
    max: '32',
    value: '18',
    step: '1',
  }) as HTMLInputElement
  const cellValue = el('div', { className: 'value', textContent: '18 px' })
  const cellWrap = el('div', { className: 'row' }, [cellSize, cellValue])

  const modeToggle = el('div', { className: 'segmented' })
  const modeButtons = new Map<Mode, HTMLButtonElement>()
  const addModeButton = (mode: Mode, label: string) => {
    const btn = el('button', { className: 'seg', type: 'button', textContent: label }) as HTMLButtonElement
    btn.addEventListener('click', () => setMode(mode))
    modeButtons.set(mode, btn)
    modeToggle.append(btn)
  }
  addModeButton('walls', 'Draw walls')
  addModeButton('start', 'Move start')
  addModeButton('end', 'Move end')

  const runBtn = el('button', { className: 'btn primary', type: 'button', textContent: 'Run' }) as HTMLButtonElement
  const pauseBtn = el('button', { className: 'btn', type: 'button', textContent: 'Pause' }) as HTMLButtonElement
  const stepBtn = el('button', { className: 'btn', type: 'button', textContent: 'Step' }) as HTMLButtonElement
  const clearBtn = el('button', { className: 'btn', type: 'button', textContent: 'Clear' }) as HTMLButtonElement
  const mazeBtn = el('button', { className: 'btn', type: 'button', textContent: 'Random walls' }) as HTMLButtonElement

  const stats = el('div', { className: 'stats' })
  const legend = el('div', { className: 'legend' }, [
    el('div', { className: 'legendItem' }, [
      el('div', { className: 'swatch', style: 'background: var(--pv-wall); border-color: var(--pv-wall-border);' }),
      'Wall',
    ]),
    el('div', { className: 'legendItem' }, [
      el('div', { className: 'swatch', style: 'background: var(--pv-start);' }),
      'Start',
    ]),
    el('div', { className: 'legendItem' }, [
      el('div', { className: 'swatch', style: 'background: var(--pv-end);' }),
      'End',
    ]),
    el('div', { className: 'legendItem' }, [
      el('div', { className: 'swatch', style: 'background: var(--pv-frontier);' }),
      'Frontier',
    ]),
    el('div', { className: 'legendItem' }, [
      el('div', { className: 'swatch', style: 'background: var(--pv-visited);' }),
      'Visited',
    ]),
    el('div', { className: 'legendItem' }, [
      el('div', { className: 'swatch', style: 'background: var(--pv-path);' }),
      'Path',
    ]),
  ])

  const controls = el('div', { className: 'controls' }, [
    el('div', { className: 'controlsLeft' }, [
      labeledControl('Algorithm', algoSelect),
      labeledControl('Speed', speedWrap),
      labeledControl('Cell size', cellWrap),
      labeledControl('Edit mode', modeToggle),
    ]),
    el('div', { className: 'controlsRight' }, [
      el('div', { className: 'actions' }, [runBtn, pauseBtn, stepBtn, clearBtn, mazeBtn]),
      el('div', { className: 'col' }, [legend, stats]),
    ]),
  ])

  const leftPanel = el('div', { className: 'panel' })
  const rightPanel = el('div', { className: 'panel' })
  const canvases = el('div', { className: 'canvases' }, [leftPanel, rightPanel])

  root.append(title, help, controls, canvases)

  let mode: Mode = 'walls'
  const setMode = (m: Mode) => {
    mode = m
    for (const [key, btn] of modeButtons) btn.dataset.active = key === m ? 'true' : 'false'
  }
  setMode('walls')

  const leftCanvas = el('canvas', { className: 'canvas' }) as HTMLCanvasElement
  const rightCanvas = el('canvas', { className: 'canvas' }) as HTMLCanvasElement
  leftPanel.append(
    el('div', { className: 'panelHeader' }, [el('div', { className: 'panelTitle', textContent: 'Dijkstra' })]),
    leftCanvas,
  )
  rightPanel.append(
    el('div', { className: 'panelHeader' }, [el('div', { className: 'panelTitle', textContent: 'A*' })]),
    rightCanvas,
  )

  let grid: Grid | null = null
  let leftRenderer: Renderer | null = null
  let rightRenderer: Renderer | null = null
  let runner: ComparisonRunner | null = null
  let isPointerDown = false
  let hoverIdx: number | null = null

  const resize = () => {
    const cell = Number(cellSize.value)
    cellValue.textContent = `${cell} px`
    document.documentElement.style.setProperty('--cell', `${cell}px`)

    const panelRect = leftPanel.getBoundingClientRect()
    const header = leftPanel.querySelector('.panelHeader') as HTMLDivElement | null
    const headerH = header?.getBoundingClientRect().height ?? 0
    const availableW = Math.max(320, Math.floor(panelRect.width))
    const availableH = Math.max(240, Math.floor(panelRect.height - headerH - 12))

    const cols = Math.max(10, Math.floor(availableW / cell))
    const rows = Math.max(10, Math.floor(availableH / cell))

    grid = createGrid(rows, cols)
    grid.start = grid.posToIndex(Math.floor(rows / 2), Math.floor(cols * 0.2))
    grid.end = grid.posToIndex(Math.floor(rows / 2), Math.floor(cols * 0.8))
    grid.walls.fill(0)

    leftRenderer = createRenderer(leftCanvas, grid, theme)
    rightRenderer = createRenderer(rightCanvas, grid, theme)
    leftRenderer.setTitle('Dijkstra')
    rightRenderer.setTitle('A*')
    resetRunner()
    paintAll()
  }

  const resetRunner = () => {
    if (!grid) return
    runner?.stop()
    runner = createComparisonRunner(grid)
    runner.setSpeed(Number(speed.value))
    runner.setSelection(algoSelect.value as AlgoSelection)
    updateStats()
  }

  const paintAll = () => {
    if (!grid || !leftRenderer || !rightRenderer || !runner) return
    leftRenderer.drawFull(runner.leftState)
    rightRenderer.drawFull(runner.rightState)
  }

  const updateStats = () => {
    if (!runner) return
    const s = runner.getStats()
    stats.innerHTML = ''
    const row = (name: string, value: string) =>
      el('div', { className: 'statRow' }, [
        el('div', { className: 'statName', textContent: name }),
        el('div', { className: 'statValue', textContent: value }),
      ])
    stats.append(
      row('Visited (Dijkstra)', String(s.dijkstra.visited)),
      row('Visited (A*)', String(s.astar.visited)),
      row('Path length', s.pathLength === null ? '—' : String(s.pathLength)),
      row('Status', s.status),
    )
  }

  const setPointer = (e: PointerEvent, canvas: HTMLCanvasElement) => {
    if (!grid || !runner) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cell = Number(cellSize.value)
    const c = clamp(Math.floor(x / cell), 0, grid.cols - 1)
    const r = clamp(Math.floor(y / cell), 0, grid.rows - 1)
    const idx = grid.posToIndex(r, c)
    updateHover(idx)

    if (mode === 'walls') {
      if (idx === grid.start || idx === grid.end) return
      const v = runner.pointerWallValue ?? (grid.walls[idx] ? 0 : 1)
      grid.walls[idx] = v
      runner.markDirty(idx)
    } else if (mode === 'start') {
      if (idx === grid.end || grid.walls[idx]) return
      grid.start = idx
      runner.resetSearch()
      runner.markAllDirty()
    } else {
      if (idx === grid.start || grid.walls[idx]) return
      grid.end = idx
      runner.resetSearch()
      runner.markAllDirty()
    }
    runner.clearExploration()
    updateStats()
  }

  const updateHover = (idx: number | null) => {
    if (idx === hoverIdx) return
    const prev = hoverIdx
    hoverIdx = idx
    if (runner) {
      if (prev !== null) runner.markDirty(prev)
      if (hoverIdx !== null) runner.markDirty(hoverIdx)
    }
    leftRenderer?.setHover(hoverIdx)
    rightRenderer?.setHover(hoverIdx)
  }

  const bindCanvas = (canvas: HTMLCanvasElement) => {
    canvas.addEventListener('pointerdown', (e) => {
      if (!grid || !runner) return
      isPointerDown = true
      canvas.setPointerCapture(e.pointerId)
      runner.pointerWallValue = null
      if (mode === 'walls') {
        // Decide the intended value on first cell, then keep it consistent while dragging.
        const rect = canvas.getBoundingClientRect()
        const cell = Number(cellSize.value)
        const c = clamp(Math.floor((e.clientX - rect.left) / cell), 0, grid.cols - 1)
        const r = clamp(Math.floor((e.clientY - rect.top) / cell), 0, grid.rows - 1)
        const idx = grid.posToIndex(r, c)
        runner.pointerWallValue = grid.walls[idx] ? 0 : 1
      }
      setPointer(e, canvas)
    })
    canvas.addEventListener('pointermove', (e) => {
      // Always update hover; only edit grid while pointer is down.
      if (!grid) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const cell = Number(cellSize.value)
      const c = clamp(Math.floor(x / cell), 0, grid.cols - 1)
      const r = clamp(Math.floor(y / cell), 0, grid.rows - 1)
      updateHover(grid.posToIndex(r, c))
      if (!isPointerDown) return
      setPointer(e, canvas)
    })
    canvas.addEventListener('pointerleave', () => updateHover(null))
    const end = (e: PointerEvent) => {
      isPointerDown = false
      canvas.releasePointerCapture(e.pointerId)
      if (runner) runner.pointerWallValue = null
    }
    canvas.addEventListener('pointerup', end)
    canvas.addEventListener('pointercancel', end)
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  bindCanvas(leftCanvas)
  bindCanvas(rightCanvas)

  algoSelect.addEventListener('change', () => {
    if (!runner) return
    runner.setSelection(algoSelect.value as AlgoSelection)
    paintAll()
    updateStats()
    const showCompare = algoSelect.value === 'compare'
    rightPanel.dataset.hidden = showCompare ? 'false' : 'true'
    leftPanel.querySelector('.panelTitle')!.textContent = showCompare
      ? 'Dijkstra'
      : algoSelect.value === 'astar'
        ? 'A*'
        : 'Dijkstra'
  })

  speed.addEventListener('input', () => {
    if (!runner) return
    const v = Number(speed.value)
    speedValue.textContent = `${v} steps/s`
    runner.setSpeed(v)
  })
  speed.dispatchEvent(new Event('input'))

  cellSize.addEventListener('input', () => {
    // Resize is expensive; debounce lightly via rAF.
    requestAnimationFrame(resize)
  })

  runBtn.addEventListener('click', () => {
    runner?.start()
  })
  pauseBtn.addEventListener('click', () => {
    runner?.pause()
    updateStats()
  })
  stepBtn.addEventListener('click', () => {
    runner?.stepOnce()
    flushDirty()
    updateStats()
  })
  clearBtn.addEventListener('click', () => {
    if (!grid || !runner) return
    grid.walls.fill(0)
    runner.resetSearch()
    runner.markAllDirty()
    runner.clearExploration()
    flushDirty(true)
    updateStats()
  })
  mazeBtn.addEventListener('click', () => {
    if (!grid || !runner) return
    const p = 0.27
    for (let i = 0; i < grid.size; i++) {
      if (i === grid.start || i === grid.end) {
        grid.walls[i] = 0
        continue
      }
      grid.walls[i] = Math.random() < p ? 1 : 0
    }
    runner.resetSearch()
    runner.markAllDirty()
    runner.clearExploration()
    flushDirty(true)
    updateStats()
  })

  const flushDirty = (forceFull = false) => {
    if (!runner || !leftRenderer || !rightRenderer) return
    const { dirty } = runner.consumeDirty()
    if (forceFull || dirty === null) {
      paintAll()
      return
    }
    leftRenderer.drawDirty(runner.leftState, dirty)
    rightRenderer.drawDirty(runner.rightState, dirty)
  }

  const tick = () => {
    if (runner) {
      runner.tick()
      flushDirty()
      updateStats()
    }
    requestAnimationFrame(tick)
  }

  const ro = new ResizeObserver(() => resize())
  ro.observe(leftPanel)
  resize()
  requestAnimationFrame(tick)
}

