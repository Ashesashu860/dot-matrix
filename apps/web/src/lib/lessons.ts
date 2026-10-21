import { positionFromEdges } from './puzzle-setup';
import type { PuzzlePosition } from './puzzle-setup';

/**
 * Interactive lessons on chain strategy. Each is a small position against a
 * perfect bot; the target is the best score possible (checked by the solver in
 * lessons.test.ts). Positions were found by searching safe-move openings for
 * ones where the lesson's idea is the only winning plan.
 */
export interface Lesson {
  id: string;
  title: string;
  /** What to learn, shown before playing. */
  intro: string[];
  /** One-line reminder shown during play. */
  tip: string;
  position: PuzzlePosition;
  target: number;
  totalBoxes: number;
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'free-boxes',
    title: 'Take free boxes',
    intro: [
      'A box with three sides drawn is a gift: draw the fourth side and it is yours.',
      'Capturing gives you another turn, so you can keep collecting down a whole chain.',
    ],
    tip: 'Find the boxes with three sides and take them all.',
    position: positionFromEdges(4, 4, [
      'H-0-2', 'V-1-0', 'H-2-1', 'H-0-1', 'V-2-0', 'V-0-2', 'H-2-0',
      'H-2-2', 'V-1-2', 'H-3-2', 'V-0-0', 'H-3-1', 'H-0-0', 'H-1-2',
    ]),
    target: 5,
    totalBoxes: 9,
  },
  {
    id: 'third-side',
    title: 'Never draw a third side',
    intro: [
      'Drawing the third side of a box hands it to the next player.',
      'While safe lines remain (lines that touch no box with two sides), play those.',
    ],
    tip: 'Pick a line that leaves every box with at most two sides.',
    position: positionFromEdges(4, 4, [
      'H-1-0', 'H-3-0', 'H-2-2', 'V-0-3', 'V-1-0', 'H-0-2',
      'V-2-1', 'H-3-1', 'V-0-0', 'H-1-1', 'H-0-1', 'V-1-2',
    ]),
    target: 7,
    totalBoxes: 9,
  },
  {
    id: 'smallest-chain',
    title: 'Give away the smallest chain',
    intro: [
      'When no safe lines are left, every move opens a chain for your opponent.',
      'Count the chains. Open the shortest one so the long ones come back to you.',
    ],
    tip: 'Every move gives something away. Give the least.',
    position: positionFromEdges(4, 4, [
      'H-3-1', 'V-2-0', 'H-0-0', 'V-1-2', 'H-2-2', 'H-2-1', 'H-1-0',
      'H-3-2', 'H-0-2', 'V-1-0', 'V-0-3', 'H-3-0', 'H-0-1',
    ]),
    target: 8,
    totalBoxes: 9,
  },
  {
    id: 'double-deal',
    title: 'Double-dealing',
    intro: [
      'Taking a whole chain means you must move next, often opening a bigger chain.',
      'Instead, take all but the last two boxes, then draw the line that leaves them as a pair. Your opponent gets two, and must open the next chain for you.',
    ],
    tip: 'Leave the last two boxes of the chain for Nova. Keep control.',
    position: positionFromEdges(4, 4, [
      'V-1-0', 'H-1-0', 'V-2-0', 'H-2-2', 'V-0-2', 'H-2-1', 'H-0-0',
      'H-0-2', 'H-1-1', 'H-3-2', 'H-3-0', 'H-3-1', 'V-1-3', 'H-0-1',
    ]),
    target: 7,
    totalBoxes: 9,
  },
  {
    id: 'parity',
    title: 'Count the safe moves',
    intro: [
      'Whoever runs out of safe lines first has to open the first chain.',
      'Some safe lines merge areas or split them. Pick the one that leaves an even number of safe lines after your move, so Nova runs out first.',
    ],
    tip: 'Plan ahead: make Nova open the first chain.',
    position: positionFromEdges(4, 5, [
      'V-2-3', 'H-1-1', 'H-3-0', 'H-0-2', 'V-1-4', 'H-1-2', 'V-1-0', 'H-3-3',
      'V-1-3', 'H-0-1', 'H-0-3', 'V-2-0', 'V-1-1', 'V-0-0', 'V-2-2',
    ]),
    target: 8,
    totalBoxes: 12,
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
