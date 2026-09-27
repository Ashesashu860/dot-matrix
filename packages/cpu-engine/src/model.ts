import { cellId, edgeId } from '@dots/game-engine';
import type { GameState } from '@dots/game-engine';

/**
 * Compact, mutable board model for fast CPU analysis. Converted from a GameState
 * and never written back — strategies return an edge ID for the engine to apply.
 */
export interface Topology {
  rows: number;
  columns: number;
  edgeCount: number;
  cellCount: number;
  edgeIds: string[];
  edgeIndex: Map<string, number>;
  /** 4 edge indexes per cell: top, right, bottom, left. */
  cellEdges: Int16Array;
  /** 2 cell indexes per edge, -1 when the edge is on the border. */
  edgeCells: Int16Array;
}

export interface Position {
  topo: Topology;
  /** 1 when the edge is claimed. */
  taken: Uint8Array;
  /** Claimed sides per cell; 4 means the cell is owned. */
  sides: Uint8Array;
}

const topologyCache = new Map<string, Topology>();

export function getTopology(rows: number, columns: number): Topology {
  const key = `${rows}x${columns}`;
  const cached = topologyCache.get(key);
  if (cached) return cached;

  const edgeIds: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns - 1; c++) edgeIds.push(edgeId('horizontal', r, c));
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < columns; c++) edgeIds.push(edgeId('vertical', r, c));
  }
  const edgeIndex = new Map(edgeIds.map((id, i) => [id, i]));
  const cellRows = rows - 1;
  const cellColumns = columns - 1;
  const cellCount = cellRows * cellColumns;
  const cellEdges = new Int16Array(cellCount * 4);
  const edgeCells = new Int16Array(edgeIds.length * 2).fill(-1);

  for (let r = 0; r < cellRows; r++) {
    for (let c = 0; c < cellColumns; c++) {
      const cell = r * cellColumns + c;
      const sides = [
        edgeIndex.get(edgeId('horizontal', r, c))!,
        edgeIndex.get(edgeId('vertical', r, c + 1))!,
        edgeIndex.get(edgeId('horizontal', r + 1, c))!,
        edgeIndex.get(edgeId('vertical', r, c))!,
      ];
      sides.forEach((e, i) => {
        cellEdges[cell * 4 + i] = e;
        const slot = edgeCells[e * 2] === -1 ? 0 : 1;
        edgeCells[e * 2 + slot] = cell;
      });
    }
  }

  const topo: Topology = {
    rows,
    columns,
    edgeCount: edgeIds.length,
    cellCount,
    edgeIds,
    edgeIndex,
    cellEdges,
    edgeCells,
  };
  topologyCache.set(key, topo);
  return topo;
}

export function fromGameState(state: GameState): Position {
  const topo = getTopology(state.rows, state.columns);
  const taken = new Uint8Array(topo.edgeCount);
  const sides = new Uint8Array(topo.cellCount);
  for (let e = 0; e < topo.edgeCount; e++) {
    if (state.edges[topo.edgeIds[e]!]?.claimedBy !== undefined) play({ topo, taken, sides }, e);
  }
  return { topo, taken, sides };
}

export function cellIdOf(topo: Topology, cell: number): string {
  const cellColumns = topo.columns - 1;
  return cellId(Math.floor(cell / cellColumns), cell % cellColumns);
}

/** Claim edge `e`; returns the number of cells it completed. */
export function play(pos: Position, e: number): number {
  pos.taken[e] = 1;
  let completed = 0;
  for (let i = 0; i < 2; i++) {
    const cell = pos.topo.edgeCells[e * 2 + i]!;
    if (cell >= 0 && ++pos.sides[cell]! === 4) completed++;
  }
  return completed;
}

export function undo(pos: Position, e: number): void {
  pos.taken[e] = 0;
  for (let i = 0; i < 2; i++) {
    const cell = pos.topo.edgeCells[e * 2 + i]!;
    if (cell >= 0) pos.sides[cell]!--;
  }
}

export function freeEdges(pos: Position): number[] {
  const out: number[] = [];
  for (let e = 0; e < pos.topo.edgeCount; e++) if (!pos.taken[e]) out.push(e);
  return out;
}

/** Cells that would be completed by claiming `e`. */
export function completionCount(pos: Position, e: number): number {
  let n = 0;
  for (let i = 0; i < 2; i++) {
    const cell = pos.topo.edgeCells[e * 2 + i]!;
    if (cell >= 0 && pos.sides[cell] === 3) n++;
  }
  return n;
}

/** True when claiming `e` leaves some adjacent cell with exactly three sides. */
export function createsThirdSide(pos: Position, e: number): boolean {
  for (let i = 0; i < 2; i++) {
    const cell = pos.topo.edgeCells[e * 2 + i]!;
    if (cell >= 0 && pos.sides[cell] === 2) return true;
  }
  return false;
}

export function capturingMoves(pos: Position): number[] {
  return freeEdges(pos).filter((e) => completionCount(pos, e) > 0);
}

/** Moves that neither capture nor hand the opponent a capturable cell. */
export function safeMoves(pos: Position): number[] {
  return freeEdges(pos).filter((e) => completionCount(pos, e) === 0 && !createsThirdSide(pos, e));
}

export function freeSidesOf(pos: Position, cell: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    const e = pos.topo.cellEdges[cell * 4 + i]!;
    if (!pos.taken[e]) out.push(e);
  }
  return out;
}

export function otherCell(topo: Topology, e: number, cell: number): number {
  const a = topo.edgeCells[e * 2]!;
  const b = topo.edgeCells[e * 2 + 1]!;
  return a === cell ? b : a;
}

/**
 * Greedily take every capture available (as the player who keeps moving would),
 * returning the number of cells taken and the moves played. The position is
 * restored before returning.
 */
export function greedyCaptureCount(pos: Position): { cells: number; moves: number[] } {
  const moves: number[] = [];
  let cells = 0;
  for (;;) {
    let next = -1;
    for (let cell = 0; cell < pos.topo.cellCount && next === -1; cell++) {
      if (pos.sides[cell] === 3) next = freeSidesOf(pos, cell)[0]!;
    }
    if (next === -1) break;
    cells += play(pos, next);
    moves.push(next);
  }
  for (let i = moves.length - 1; i >= 0; i--) undo(pos, moves[i]!);
  return { cells, moves };
}

export interface Component {
  cells: number[];
  isLoop: boolean;
}

/**
 * Split unowned cells into chains/loops: groups of cells connected through
 * unclaimed shared edges. Meaningful in the endgame, where every cell has ≥2 sides.
 */
export function components(pos: Position): Component[] {
  const { topo } = pos;
  const seen = new Uint8Array(topo.cellCount);
  const out: Component[] = [];
  for (let start = 0; start < topo.cellCount; start++) {
    if (seen[start] || pos.sides[start] === 4) continue;
    const cells: number[] = [];
    let isLoop = true;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const cell = stack.pop()!;
      cells.push(cell);
      const free = freeSidesOf(pos, cell);
      if (free.length !== 2) isLoop = false;
      for (const e of free) {
        const neighbour = otherCell(topo, e, cell);
        if (neighbour < 0) {
          isLoop = false;
          continue;
        }
        if (!seen[neighbour] && pos.sides[neighbour] !== 4) {
          seen[neighbour] = 1;
          stack.push(neighbour);
        }
      }
    }
    out.push({ cells, isLoop: isLoop && cells.length >= 4 });
  }
  return out;
}
