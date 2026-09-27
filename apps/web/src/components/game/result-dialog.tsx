'use client';

import { computeResultSummary, getLevel } from '@dots/game-engine';
import type { GameState } from '@dots/game-engine';
import { motion } from 'motion/react';
import { Crown, Home, RotateCcw, SkipForward, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDuration, shapeForIndex } from '@/lib/players';
import { PlayerShapeIcon } from './player-shape';

const MODE_LABEL = { cpu: 'vs CPU', local: 'Local', online: 'Online' } as const;

export function ResultDialog({
  state,
  open,
  onOpenChange,
  perspectiveId,
  onRematch,
  onNextLevel,
  onHome,
}: {
  state: GameState;
  open: boolean;
  onOpenChange(open: boolean): void;
  perspectiveId: string | null;
  onRematch?: () => void;
  onNextLevel?: () => void;
  onHome(): void;
}) {
  if (state.status !== 'finished') return null;
  const summary = computeResultSummary(state);
  const winners = summary.players.filter((p) => summary.winnerIds.includes(p.id));
  const iWon = perspectiveId !== null && !summary.isDraw && summary.winnerIds.includes(perspectiveId);
  const title = summary.isDraw
    ? "It's a draw!"
    : perspectiveId !== null
      ? iWon
        ? 'You win!'
        : `${winners[0]?.name ?? 'Someone'} wins`
      : `${winners[0]?.name ?? 'Someone'} wins!`;
  const ranked = [...summary.players].sort((a, b) => b.score - a.score);
  const indexOf = (id: string) => state.players.findIndex((p) => p.id === id);
  const levelLabel = getLevel(summary.level) ? `Level ${summary.level}` : 'Custom';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader className="items-center text-center">
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            className="mb-2 flex size-16 items-center justify-center rounded-full"
            style={{ backgroundColor: `${winners[0]?.color ?? '#888'}22` }}
          >
            <Trophy className="size-8" style={{ color: winners[0]?.color }} />
          </motion.div>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription>
            {levelLabel} · {summary.rows}×{summary.columns} dots · {MODE_LABEL[summary.mode]}
          </DialogDescription>
        </DialogHeader>

        <table className="w-full text-sm">
          <caption className="sr-only">Final scores</caption>
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium">Player</th>
              <th className="py-1 text-right font-medium">Cells</th>
              <th className="py-1 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="flex items-center gap-2 py-2">
                  <PlayerShapeIcon shape={shapeForIndex(indexOf(p.id))} color={p.color} />
                  <span className="font-medium">{p.name}</span>
                  {summary.winnerIds.includes(p.id) && (
                    <Crown className="size-4 text-amber-500" aria-label={summary.isDraw ? 'tied' : 'winner'} />
                  )}
                  {!p.active && <span className="text-xs text-muted-foreground">(left)</span>}
                </td>
                <td className="py-2 text-right tabular-nums">{p.cells}</td>
                <td className="py-2 text-right text-lg font-bold tabular-nums" style={{ color: p.color }}>
                  {p.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-3 text-center text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Moves</dt>
            <dd className="font-semibold tabular-nums">{summary.totalMoves}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Duration</dt>
            <dd className="font-semibold tabular-nums">{formatDuration(summary.durationMs)}</dd>
          </div>
        </dl>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {onNextLevel && (
            <Button size="lg" onClick={onNextLevel}>
              <SkipForward /> Next level
            </Button>
          )}
          {onRematch && (
            <Button size="lg" variant={onNextLevel ? 'outline' : 'default'} onClick={onRematch}>
              <RotateCcw /> Rematch
            </Button>
          )}
          <Button size="lg" variant="ghost" onClick={onHome}>
            <Home /> Home
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
