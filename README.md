# Pathfinding Visualizer

Compare **Dijkstra vs A\*** side-by-side, control animation speed in real time, and interactively draw obstacles and move start/end nodes. Built with **TypeScript + Vite** and rendered on **Canvas** for smooth performance on larger grids.

## Demo
- **Live**: (add GitHub Pages link here after deployment)
- **Repo**: (add GitHub repo link here)

## Highlights
- **Algorithm comparison**: run **Dijkstra** and **A\*** in parallel (or run either one solo)
- **Real-time speed control**: adjust steps/second while the simulation is running
- **Large-grid performance**:
  - **Canvas rendering** (no DOM grid)
  - **Incremental “dirty-cell” redraws** (updates only changed cells)
  - **Typed arrays** for grid + overlays (`Uint8Array`, `Int32Array`)

## Controls
- **Draw walls**: click/drag
- **Move start / Move end**: switch edit mode, then click to place
- **Run / Pause / Step**
- **Clear**: clears walls + resets search
- **Random walls**: quick demo / stress test
- **Cell size**: scale the grid density to test performance

## Tech notes (what recruiters ask about)
- **Dijkstra vs A\***: both use a priority queue; A\* uses a Manhattan heuristic.
- **Rendering**: the grid lines are drawn into an offscreen canvas once, then composited; only changed cells are repainted each frame.

## Run locally

```bash
npm install
npm run dev
```

## Build / preview

```bash
npm run build
npm run preview
```



