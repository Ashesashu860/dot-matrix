import type { Difficulty } from '@dots/cpu-engine';
import { CUSTOM_LEVEL, SHAPES, cellCount, shapeCells, shapeSize } from '@dots/game-engine';
import type { GameState, PlayerInit, ShapeId } from '@dots/game-engine';
import { PLAYER_COLORS } from '@dots/protocol';
import type { LocalGameSetup, LoggedMove } from '@/controllers/local-controller';

/**
 * The star campaign: fixed stages with a board, bots and three goals. Star 1
 * is always a win; stars 2 and 3 are extra goals that also need the win.
 */

export type Goal =
  | { kind: 'win' }
  /** Beat the best bot by at least n boxes. */
  | { kind: 'margin'; n: number }
  /** Capture at least n boxes in one turn. */
  | { kind: 'combo'; n: number }
  /** No bot turn captures more than n boxes. */
  | { kind: 'maxGift'; n: number };

export interface Bot {
  difficulty: Difficulty;
  /** Easy only: lower values make more mistakes. */
  captureChance?: number;
  safeChance?: number;
}

export interface Stage {
  id: string;
  chapter: number;
  rows: number;
  columns: number;
  /** Shaped board from the catalog (rows/columns are its size). */
  shape?: ShapeId;
  bots: Bot[];
  cpuFirst?: boolean;
  goals: [Goal, Goal, Goal];
}

export interface Chapter {
  number: number;
  title: string;
  blurb: string;
  /** Total stars needed to open the chapter. */
  starsToUnlock: number;
}

export const CHAPTERS: readonly Chapter[] = [
  { number: 1, title: 'First Lines', blurb: 'Bolt is new here too. Grab boxes and avoid third sides.', starsToUnlock: 0 },
  { number: 2, title: 'Sneaky Pixel', blurb: 'Pixel never hands out free boxes. Make it open the chains.', starsToUnlock: 8 },
  { number: 3, title: 'Chain Gang', blurb: 'Long chains decide games. Take them whole, give away the small ones.', starsToUnlock: 18 },
  { number: 4, title: 'Nova’s Control', blurb: 'Nova double-deals to keep control. Learn to do it back.', starsToUnlock: 30 },
  { number: 5, title: 'Crowded Board', blurb: 'Three and four players: every gift goes to someone.', starsToUnlock: 42 },
  { number: 6, title: 'Odd Shapes', blurb: 'Holes, walls and gold boxes worth 2. Chains bend in new ways.', starsToUnlock: 54 },
];

const win: Goal = { kind: 'win' };
const margin = (n: number): Goal => ({ kind: 'margin', n });
const combo = (n: number): Goal => ({ kind: 'combo', n });
const maxGift = (n: number): Goal => ({ kind: 'maxGift', n });
const bolt = (captureChance?: number, safeChance?: number): Bot => ({ difficulty: 'easy', captureChance, safeChance });
const pixel: Bot = { difficulty: 'medium' };
const nova: Bot = { difficulty: 'hard' };

type StageSpec = [rows: number, columns: number, bots: Bot[], goals: [Goal, Goal], cpuFirst?: boolean];

const SPECS: StageSpec[][] = [
  [
    [4, 4, [bolt(0.4, 0.4)], [margin(3), combo(2)]],
    [4, 4, [bolt(0.55, 0.5)], [margin(4), maxGift(2)]],
    [4, 5, [bolt(0.65, 0.6)], [combo(3), margin(4)]],
    [5, 5, [bolt()], [margin(5), maxGift(3)]],
    [5, 5, [bolt()], [combo(4), margin(6)], true],
    [5, 6, [bolt(0.9, 0.85)], [margin(6), maxGift(3)]],
    [6, 6, [bolt(0.9, 0.9)], [combo(5), margin(8)]],
    [6, 6, [bolt(), bolt()], [margin(3), combo(4)]],
  ],
  [
    [4, 4, [pixel], [margin(1), combo(3)]],
    [4, 5, [pixel], [margin(2), maxGift(3)]],
    [5, 5, [pixel], [combo(4), margin(2)]],
    [5, 5, [pixel], [margin(3), maxGift(3)], true],
    [5, 6, [pixel], [combo(5), margin(3)]],
    [6, 6, [pixel], [margin(4), maxGift(4)]],
    [6, 6, [pixel], [combo(6), margin(4)], true],
    [6, 7, [pixel], [margin(5), combo(6)]],
  ],
  [
    [5, 5, [pixel], [combo(5), maxGift(2)]],
    [5, 6, [pixel], [combo(6), maxGift(3)]],
    [6, 5, [pixel], [maxGift(2), margin(4)], true],
    [6, 6, [pixel], [combo(7), maxGift(3)]],
    [6, 6, [nova], [margin(1), combo(4)]],
    [6, 7, [pixel], [combo(8), maxGift(3)], true],
    [7, 7, [pixel], [margin(6), maxGift(4)]],
    [7, 7, [nova], [margin(2), combo(6)]],
  ],
  [
    [4, 4, [nova], [margin(1), maxGift(2)], true],
    [4, 5, [nova], [margin(2), combo(3)], true],
    [5, 5, [nova], [margin(2), maxGift(3)], true],
    [5, 5, [nova], [combo(4), margin(2)], true],
    [5, 6, [nova], [margin(2), maxGift(3)]],
    [6, 6, [nova], [combo(5), margin(2)]],
    [6, 6, [nova], [margin(3), maxGift(3)]],
    [7, 7, [nova], [margin(3), combo(6)]],
  ],
  [
    [5, 5, [bolt(), bolt()], [margin(2), combo(4)]],
    [5, 6, [pixel, bolt()], [margin(2), maxGift(4)]],
    [6, 6, [bolt(), bolt(), bolt()], [margin(2), combo(4)]],
    [6, 6, [pixel, pixel], [margin(1), maxGift(4)], true],
    [6, 7, [pixel, bolt(), bolt()], [margin(2), combo(5)]],
    [7, 7, [nova, pixel], [margin(2), combo(5)]],
    [7, 7, [pixel, pixel, bolt()], [margin(2), maxGift(5)], true],
    [8, 8, [nova, nova], [margin(1), combo(6)]],
  ],
];

type ShapeStageSpec = [shape: ShapeId, bots: Bot[], goals: [Goal, Goal], cpuFirst?: boolean];

/** Chapter 6: shaped boards. */
const SHAPE_SPECS: ShapeStageSpec[] = [
  ['cross', [pixel], [margin(2), combo(3)]],
  ['mini', [nova], [margin(1), maxGift(2)]],
  ['ring', [pixel], [combo(4), margin(3)]],
  ['twins', [pixel], [margin(3), maxGift(3)], true],
  ['diamond', [pixel], [combo(5), margin(4)]],
  ['vault', [nova], [margin(2), combo(4)]],
  ['ring', [nova], [margin(2), maxGift(3)]],
  ['diamond', [pixel, nova], [margin(2), combo(4)]],
];

export const STAGES: readonly Stage[] = [
  ...SPECS.flatMap((specs, c) =>
    specs.map(([rows, columns, bots, [g2, g3], cpuFirst], i) => ({
      id: `${c + 1}-${i + 1}`,
      chapter: c + 1,
      rows,
      columns,
      bots,
      goals: [win, g2, g3] as [Goal, Goal, Goal],
      ...(cpuFirst && { cpuFirst }),
    })),
  ),
  ...SHAPE_SPECS.map(([shape, bots, [g2, g3], cpuFirst], i) => ({
    id: `${SPECS.length + 1}-${i + 1}`,
    chapter: SPECS.length + 1,
    ...shapeSize(SHAPES[shape]),
    shape,
    bots,
    goals: [win, g2, g3] as [Goal, Goal, Goal],
    ...(cpuFirst && { cpuFirst }),
  })),
];

export const MAX_STARS = STAGES.length * 3;

export function getStage(id: string): Stage | undefined {
  return STAGES.find((s) => s.id === id);
}

export function nextStage(id: string): Stage | undefined {
  const index = STAGES.findIndex((s) => s.id === id);
  return index >= 0 ? STAGES[index + 1] : undefined;
}

export function stagesOf(chapter: number): Stage[] {
  return STAGES.filter((s) => s.chapter === chapter);
}

export function goalLabel(goal: Goal): string {
  switch (goal.kind) {
    case 'win':
      return 'Win the game';
    case 'margin':
      return `Win by ${goal.n}+ boxes`;
    case 'combo':
      return `Take ${goal.n}+ boxes in one turn`;
    case 'maxGift':
      return `Never let a bot take more than ${goal.n} in a turn`;
  }
}

/** Compact form for the in-game goal strip. */
export function goalShort(goal: Goal): string {
  switch (goal.kind) {
    case 'win':
      return 'Win';
    case 'margin':
      return `Win by ${goal.n}+`;
    case 'combo':
      return `${goal.n}+ in a turn`;
    case 'maxGift':
      return `Bots ≤ ${goal.n} a turn`;
  }
}

const BOT_NAMES: Record<Difficulty, string> = { easy: 'Bolt', medium: 'Pixel', hard: 'Nova' };

export const HUMAN_ID = 'human';

export function stagePlayers(stage: Stage, name = 'You'): PlayerInit[] {
  const seen: Partial<Record<Difficulty, number>> = {};
  return [
    { id: HUMAN_ID, name, type: 'human', color: PLAYER_COLORS[0] },
    ...stage.bots.map((bot, i) => {
      const n = (seen[bot.difficulty] = (seen[bot.difficulty] ?? 0) + 1);
      return {
        id: `cpu-${i + 1}`,
        name: n > 1 ? `${BOT_NAMES[bot.difficulty]} ${n}` : BOT_NAMES[bot.difficulty],
        type: 'cpu' as const,
        color: PLAYER_COLORS[i + 1]!,
      };
    }),
  ];
}

/** `player` is the profile playing: it earns the stars and names the human seat. */
export function stageSetup(stage: Stage, seed: number, player?: { id: string; name: string }): LocalGameSetup {
  return {
    create: {
      mode: 'cpu',
      level: CUSTOM_LEVEL,
      rows: stage.rows,
      columns: stage.columns,
      ...(stage.shape && { shape: stage.shape }),
      players: stagePlayers(stage, player?.name),
      config: { extraTurnOnCapture: true },
    },
    seed,
    ...(stage.cpuFirst && { cpuFirst: true }),
    bots: Object.fromEntries(
      stage.bots.map((bot, i) => [
        `cpu-${i + 1}`,
        {
          difficulty: bot.difficulty,
          options: { easyCaptureChance: bot.captureChance, easySafeChance: bot.safeChance },
        },
      ]),
    ),
    campaignStage: stage.id,
    ...(player && { profileId: player.id }),
  };
}

/** Most boxes each player took in a single turn (a run of their consecutive moves). */
export function bestTurns(log: readonly LoggedMove[]): Map<string, number> {
  const best = new Map<string, number>();
  let run = 0;
  log.forEach((move, i) => {
    run = i > 0 && log[i - 1]!.playerId === move.playerId ? run + move.cells : move.cells;
    best.set(move.playerId, Math.max(best.get(move.playerId) ?? 0, run));
  });
  return best;
}

/** Which goals a finished game met (all need the human to win outright). */
export function goalsMet(stage: Stage, state: GameState, log: readonly LoggedMove[]): boolean[] {
  const me = state.players.find((p) => p.id === HUMAN_ID);
  const won = !!me && !state.isDraw && !!state.winnerIds?.includes(HUMAN_ID);
  if (!me || !won || state.status !== 'finished') return stage.goals.map(() => false);
  const rival = Math.max(...state.players.filter((p) => p.id !== HUMAN_ID).map((p) => p.score));
  const turns = bestTurns(log);
  const botBest = Math.max(0, ...[...turns].filter(([id]) => id !== HUMAN_ID).map(([, n]) => n));
  return stage.goals.map((goal) => {
    switch (goal.kind) {
      case 'win':
        return true;
      case 'margin':
        return me.score - rival >= goal.n;
      case 'combo':
        return (turns.get(HUMAN_ID) ?? 0) >= goal.n;
      case 'maxGift':
        return botBest <= goal.n;
    }
  });
}

export function starsFor(stage: Stage, state: GameState, log: readonly LoggedMove[]): number {
  return goalsMet(stage, state, log).filter(Boolean).length;
}

export interface CampaignProgress {
  /** Best stars per stage ID. */
  stars: Record<string, number>;
  /** Chapters opened by progress made before the campaign existed. */
  grantedChapter: number;
}

export const DEFAULT_CAMPAIGN: CampaignProgress = { stars: {}, grantedChapter: 1 };

/** Old players who had unlocked levels skip ahead (no stars are invented). */
export function chapterFromLegacyLevel(unlockedLevel: number): number {
  return unlockedLevel >= 6 ? 3 : unlockedLevel >= 3 ? 2 : 1;
}

export function totalStars(progress: CampaignProgress): number {
  return Object.values(progress.stars).reduce((sum, n) => sum + n, 0);
}

export function chapterUnlocked(progress: CampaignProgress, chapter: number): boolean {
  const def = CHAPTERS.find((c) => c.number === chapter);
  if (!def) return false;
  return chapter <= progress.grantedChapter || totalStars(progress) >= def.starsToUnlock;
}

/** A stage opens once its chapter is open and the previous stage in it has a star. */
export function stageUnlocked(progress: CampaignProgress, stage: Stage): boolean {
  if (!chapterUnlocked(progress, stage.chapter)) return false;
  const inChapter = stagesOf(stage.chapter);
  const index = inChapter.findIndex((s) => s.id === stage.id);
  return index === 0 || (progress.stars[inChapter[index - 1]!.id] ?? 0) > 0;
}

/** The first unlocked stage without three stars (what "Continue" plays). */
export function currentStage(progress: CampaignProgress): Stage {
  const open = STAGES.filter((s) => stageUnlocked(progress, s));
  return open.find((s) => !progress.stars[s.id]) ?? open.find((s) => (progress.stars[s.id] ?? 0) < 3) ?? open[open.length - 1]!;
}

export const boxesIn = (stage: Stage) =>
  stage.shape ? shapeCells(SHAPES[stage.shape]).size : cellCount(stage.rows, stage.columns);
