import { createCpuStrategy } from '@dots/cpu-engine';
import { applyMove } from '@dots/game-engine';
import type { GameState } from '@dots/game-engine';
import { describe, expect, it } from 'vitest';
import { newLocalGame } from '@/controllers/local-controller';
import type { LoggedMove } from '@/controllers/local-controller';
import {
  CHAPTERS,
  DEFAULT_CAMPAIGN,
  HUMAN_ID,
  STAGES,
  bestTurns,
  chapterFromLegacyLevel,
  chapterUnlocked,
  currentStage,
  getStage,
  goalsMet,
  stageSetup,
  stageUnlocked,
} from './campaign';
import type { Stage } from './campaign';

/** Play a stage with Hard standing in for the human. */
function simulate(stage: Stage, seed: number): { state: GameState; log: LoggedMove[] } {
  const setup = stageSetup(stage, seed * 101);
  let state = newLocalGame(setup, 'g', 0);
  const strategies = Object.fromEntries(
    state.players.map((p) => {
      const bot = setup.bots?.[p.id];
      return [p.id, bot ? createCpuStrategy(bot.difficulty, { ...bot.options, seed: seed * 7 }) : createCpuStrategy('hard', { seed })];
    }),
  );
  const log: LoggedMove[] = [];
  while (state.status === 'playing') {
    const player = state.players[state.currentPlayerIndex]!;
    const edge = strategies[player.id]!.chooseMove(state);
    const result = applyMove(state, edge.id, player.id);
    if (!result.ok) throw new Error(result.error);
    log.push({ edgeId: edge.id, playerId: player.id, cells: result.completedCells.length });
    state = result.gameState;
  }
  return { state, log };
}

describe('campaign data', () => {
  it('has 8 stages per chapter, unique IDs and boards that fit a phone', () => {
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(STAGES.length);
    for (const chapter of CHAPTERS) expect(STAGES.filter((s) => s.chapter === chapter.number)).toHaveLength(8);
    for (const stage of STAGES) {
      expect(stage.rows).toBeLessThanOrEqual(8);
      expect(stage.columns).toBeLessThanOrEqual(8);
      expect(stage.goals[0]).toEqual({ kind: 'win' });
    }
  });

  it('every goal of every stage is reachable by strong play', () => {
    for (const stage of STAGES) {
      const met = [false, false, false];
      for (let seed = 1; seed <= 16 && !met.every(Boolean); seed++) {
        const { state, log } = simulate(stage, seed);
        goalsMet(stage, state, log).forEach((m, i) => (met[i] ||= m));
      }
      expect({ stage: stage.id, met }).toEqual({ stage: stage.id, met: [true, true, true] });
    }
  }, 120_000);
});

describe('goals', () => {
  it('sums consecutive captures into one turn', () => {
    const log: LoggedMove[] = [
      { edgeId: 'a', playerId: 'x', cells: 0 },
      { edgeId: 'b', playerId: 'y', cells: 1 },
      { edgeId: 'c', playerId: 'y', cells: 2 },
      { edgeId: 'd', playerId: 'y', cells: 0 },
      { edgeId: 'e', playerId: 'x', cells: 1 },
    ];
    expect(bestTurns(log)).toEqual(new Map([['x', 1], ['y', 3]]));
  });

  it('awards nothing without a win', () => {
    const stage = getStage('1-1')!;
    for (let seed = 1; seed < 20; seed++) {
      const { state, log } = simulate(stage, seed);
      if (!state.winnerIds?.includes(HUMAN_ID)) {
        expect(goalsMet(stage, state, log)).toEqual([false, false, false]);
        return;
      }
    }
  });
});

describe('progress', () => {
  it('opens stages in order and chapters by stars', () => {
    expect(stageUnlocked(DEFAULT_CAMPAIGN, getStage('1-1')!)).toBe(true);
    expect(stageUnlocked(DEFAULT_CAMPAIGN, getStage('1-2')!)).toBe(false);
    expect(currentStage(DEFAULT_CAMPAIGN).id).toBe('1-1');

    const some = { ...DEFAULT_CAMPAIGN, stars: { '1-1': 3, '1-2': 1 } };
    expect(stageUnlocked(some, getStage('1-3')!)).toBe(true);
    expect(currentStage(some).id).toBe('1-3');
    expect(chapterUnlocked(some, 2)).toBe(false);

    const eight = { ...DEFAULT_CAMPAIGN, stars: { '1-1': 3, '1-2': 3, '1-3': 2 } };
    expect(chapterUnlocked(eight, 2)).toBe(true);
    expect(stageUnlocked(eight, getStage('2-1')!)).toBe(true);
  });

  it('carries old level progress over as chapter unlocks', () => {
    expect(chapterFromLegacyLevel(1)).toBe(1);
    expect(chapterFromLegacyLevel(4)).toBe(2);
    expect(chapterFromLegacyLevel(8)).toBe(3);
    expect(chapterUnlocked({ stars: {}, grantedChapter: 3 }, 3)).toBe(true);
    expect(chapterUnlocked({ stars: {}, grantedChapter: 3 }, 4)).toBe(false);
  });
});
