import { countCells } from './engine';
import type { GameMode, GameState, PlayerType } from './types';

export interface GameResultPlayer {
  id: string;
  name: string;
  type: PlayerType;
  color: string;
  score: number;
  cells: number;
  active: boolean;
}

export interface GameResultSummary {
  gameId: string;
  mode: GameMode;
  level: number;
  rows: number;
  columns: number;
  players: GameResultPlayer[];
  winnerIds: string[];
  isDraw: boolean;
  totalMoves: number;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
}

export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  draws: number;
  losses: number;
  cellsCaptured: number;
  highestScore: number;
  /** Highest level won. */
  highestLevel: number;
  currentWinStreak: number;
  longestWinStreak: number;
  byMode: Record<GameMode, number>;
}

export function emptyStats(): PlayerStats {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    draws: 0,
    losses: 0,
    cellsCaptured: 0,
    highestScore: 0,
    highestLevel: 0,
    currentWinStreak: 0,
    longestWinStreak: 0,
    byMode: { cpu: 0, local: 0, online: 0 },
  };
}

/** Summarise a finished game for result screens, history and stats. */
export function computeResultSummary(state: GameState): GameResultSummary {
  if (state.status !== 'finished') {
    throw new Error('Cannot summarise a game that has not finished');
  }
  const summary: GameResultSummary = {
    gameId: state.gameId,
    mode: state.mode,
    level: state.level,
    rows: state.rows,
    columns: state.columns,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      color: p.color,
      score: p.score,
      cells: countCells(state, p.id),
      active: p.active,
    })),
    winnerIds: state.winnerIds ?? [],
    isDraw: state.isDraw ?? false,
    totalMoves: state.totalMoves,
  };
  if (state.startedAt !== undefined) summary.startedAt = state.startedAt;
  if (state.endedAt !== undefined) summary.endedAt = state.endedAt;
  if (state.startedAt !== undefined && state.endedAt !== undefined) {
    summary.durationMs = Math.max(0, state.endedAt - state.startedAt);
  }
  return summary;
}

/**
 * Fold a result into a player's stats. With `playerId` null (shared-device local
 * games) only neutral counters are updated.
 */
export function applyResultToStats(
  stats: PlayerStats,
  summary: GameResultSummary,
  playerId: string | null,
): PlayerStats {
  const next: PlayerStats = {
    ...stats,
    gamesPlayed: stats.gamesPlayed + 1,
    byMode: { ...stats.byMode, [summary.mode]: stats.byMode[summary.mode] + 1 },
  };
  const me = playerId === null ? undefined : summary.players.find((p) => p.id === playerId);
  if (!me) {
    const best = Math.max(0, ...summary.players.map((p) => p.score));
    next.highestScore = Math.max(stats.highestScore, best);
    return next;
  }
  next.cellsCaptured = stats.cellsCaptured + me.cells;
  next.highestScore = Math.max(stats.highestScore, me.score);
  const won = !summary.isDraw && summary.winnerIds.includes(me.id);
  const drew = summary.isDraw && summary.winnerIds.includes(me.id);
  if (won) {
    next.gamesWon = stats.gamesWon + 1;
    next.currentWinStreak = stats.currentWinStreak + 1;
    next.longestWinStreak = Math.max(stats.longestWinStreak, next.currentWinStreak);
    next.highestLevel = Math.max(stats.highestLevel, summary.level);
  } else {
    next.currentWinStreak = 0;
    if (drew) next.draws = stats.draws + 1;
    else next.losses = stats.losses + 1;
  }
  return next;
}
