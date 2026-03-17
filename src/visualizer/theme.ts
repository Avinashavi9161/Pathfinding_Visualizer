export type Theme = {
  bg: string
  gridLine: string
  wall: string
  wallBorder: string
  start: string
  end: string
  visited: string
  frontier: string
  path: string
  text: string
  panelBg: string
}

export function palette(): Theme {
  // Colors tuned to look good in both light/dark via CSS variables.
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    bg: v('--pv-bg', '#0b0f19'),
    panelBg: v('--pv-panel', '#0f172a'),
    gridLine: v('--pv-grid', 'rgba(148, 163, 184, 0.12)'),
    wall: v('--pv-wall', '#1f2937'),
    wallBorder: v('--pv-wall-border', 'rgba(148, 163, 184, 0.35)'),
    start: v('--pv-start', '#22c55e'),
    end: v('--pv-end', '#ef4444'),
    visited: v('--pv-visited', '#60a5fa'),
    frontier: v('--pv-frontier', '#a78bfa'),
    path: v('--pv-path', '#f59e0b'),
    text: v('--pv-text', '#e5e7eb'),
  }
}

