import type { Point, Rect } from './layout';

/*
 * Buscador de caminos sobre una rejilla (A* con 8 vecinos) y suavizado por línea de visión.
 * Trabaja en px de la v10. Los obstáculos se inflan con el radio del personaje.
 */

export interface NavGrid {
  bounds: Rect;
  cell: number;
  cols: number;
  rows: number;
  blocked: Uint8Array;
}

export function createNavGrid(bounds: Rect, obstacles: Rect[], radius: number, cell = 8): NavGrid {
  const cols = Math.ceil(bounds.w / cell);
  const rows = Math.ceil(bounds.h / cell);
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = bounds.x + (c + 0.5) * cell;
      const y = bounds.y + (r + 0.5) * cell;
      const outside = x < bounds.x + radius || x > bounds.x + bounds.w - radius;
      if (outside || obstacles.some((o) => hitsRect(x, y, o, radius))) blocked[r * cols + c] = 1;
    }
  return { bounds, cell, cols, rows, blocked };
}

/** Cierra una franja de la rejilla (p. ej. la fachada) dejando abiertos los huecos indicados */
export function blockBand(g: NavGrid, y0: number, y1: number, openings: [number, number][], radius: number): void {
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) {
      const x = g.bounds.x + (c + 0.5) * g.cell;
      const y = g.bounds.y + (r + 0.5) * g.cell;
      if (y < y0 - radius || y > y1 + radius) continue;
      if (openings.some(([a, b]) => x > a + radius && x < b - radius)) continue;
      g.blocked[r * g.cols + c] = 1;
    }
}

function hitsRect(x: number, y: number, o: Rect, pad: number): boolean {
  return x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad;
}

const cellOf = (g: NavGrid, p: Point) => ({
  c: Math.min(g.cols - 1, Math.max(0, Math.floor((p.x - g.bounds.x) / g.cell))),
  r: Math.min(g.rows - 1, Math.max(0, Math.floor((p.y - g.bounds.y) / g.cell))),
});

const center = (g: NavGrid, c: number, r: number): Point => ({
  x: g.bounds.x + (c + 0.5) * g.cell,
  y: g.bounds.y + (r + 0.5) * g.cell,
});

export function isFree(g: NavGrid, p: Point): boolean {
  const { c, r } = cellOf(g, p);
  return !g.blocked[r * g.cols + c];
}

// Celda libre más cercana (por si el destino cae justo en el borde de un obstáculo)
function nearestFree(g: NavGrid, c: number, r: number): number {
  if (!g.blocked[r * g.cols + c]) return r * g.cols + c;
  for (let d = 1; d < Math.max(g.cols, g.rows); d++)
    for (let dr = -d; dr <= d; dr++)
      for (let dc = -d; dc <= d; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= g.cols || rr >= g.rows) continue;
        if (!g.blocked[rr * g.cols + cc]) return rr * g.cols + cc;
      }
  return -1;
}

const NEIGHBORS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
] as const;

/** Camino de `from` a `to` (incluidos ambos) o null si no hay paso */
export function findPath(g: NavGrid, from: Point, to: Point): Point[] | null {
  const a = cellOf(g, from), b = cellOf(g, to);
  const start = nearestFree(g, a.c, a.r), goal = nearestFree(g, b.c, b.r);
  if (start < 0 || goal < 0) return null;
  const n = g.cols * g.rows;
  const cost = new Float32Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const gc = goal % g.cols, gr = (goal / g.cols) | 0;
  const h = (i: number) => Math.hypot((i % g.cols) - gc, ((i / g.cols) | 0) - gr);
  const open = new MinHeap();
  cost[start] = 0;
  open.push(start, h(start));
  while (open.size) {
    const i = open.pop();
    if (i === goal) break;
    if (closed[i]) continue;
    closed[i] = 1;
    const c = i % g.cols, r = (i / g.cols) | 0;
    for (const [dc, dr, w] of NEIGHBORS) {
      const cc = c + dc, rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= g.cols || rr >= g.rows) continue;
      const j = rr * g.cols + cc;
      if (g.blocked[j]) continue;
      // Sin atajos por las esquinas de los obstáculos
      if (dc && dr && (g.blocked[r * g.cols + cc] || g.blocked[rr * g.cols + c])) continue;
      const nc = cost[i] + w;
      if (nc < cost[j]) {
        cost[j] = nc;
        prev[j] = i;
        open.push(j, nc + h(j));
      }
    }
  }
  if (start !== goal && prev[goal] < 0) return null;
  const cells: Point[] = [];
  for (let i = goal; i >= 0; i = i === start ? -1 : prev[i]) cells.push(center(g, i % g.cols, (i / g.cols) | 0));
  cells.reverse();
  return smooth(g, [from, ...cells.slice(1, -1), to]);
}

/** ¿Se puede ir en línea recta de a a b sin pisar celdas bloqueadas? */
export function lineOfSight(g: NavGrid, a: Point, b: Point): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (g.cell / 3));
  for (let s = 0; s <= steps; s++) {
    const t = steps ? s / steps : 0;
    if (!isFree(g, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })) return false;
  }
  return true;
}

function smooth(g: NavGrid, pts: Point[]): Point[] {
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !lineOfSight(g, pts[i], pts[j])) j--;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, key: number) {
    const { ids, keys } = this;
    ids.push(id);
    keys.push(key);
    let i = ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= keys[i]) break;
      [ids[p], ids[i]] = [ids[i], ids[p]];
      [keys[p], keys[i]] = [keys[i], keys[p]];
      i = p;
    }
  }
  pop(): number {
    const { ids, keys } = this;
    const top = ids[0];
    const lastId = ids.pop()!, lastKey = keys.pop()!;
    if (ids.length) {
      ids[0] = lastId;
      keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < ids.length && keys[l] < keys[m]) m = l;
        if (r < ids.length && keys[r] < keys[m]) m = r;
        if (m === i) break;
        [ids[m], ids[i]] = [ids[i], ids[m]];
        [keys[m], keys[i]] = [keys[i], keys[m]];
        i = m;
      }
    }
    return top;
  }
}
