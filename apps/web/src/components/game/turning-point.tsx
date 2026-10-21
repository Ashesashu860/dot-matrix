'use client';

import type { TurningPoint } from '@dots/cpu-engine';
import type { GameState } from '@dots/game-engine';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GameBoard } from '@/components/board/game-board';
import { Chunky } from '@/components/kit';
import { newLocalGame } from '@/controllers/local-controller';
import type { LocalGameSetup, LoggedMove } from '@/controllers/local-controller';
import { sharedRunner } from '@/workers/cpu-runner';

const noop = () => {};

/**
 * After a two-player game, find the human's most expensive endgame move with
 * the exact solver and show it next to the better line.
 */
export function TurningPointCard({
  state,
  setup,
  log,
  playerId,
}: {
  state: GameState;
  setup: LocalGameSetup;
  log: readonly LoggedMove[];
  playerId: string;
}) {
  const [point, setPoint] = useState<TurningPoint | null | 'loading' | 'unavailable'>('loading');
  const [open, setOpen] = useState(false);
  const finished = state.status === 'finished';
  const gameId = state.gameId;

  useEffect(() => {
    if (!finished) return;
    let cancelled = false;
    const initial = newLocalGame(setup, `${gameId}-analysis`, 0);
    const moves = log.map(({ edgeId, playerId: p }) => ({ edgeId, playerId: p }));
    sharedRunner()
      .analyze(initial, moves, playerId)
      .then((p) => !cancelled && setPoint(p))
      // Older saves lack a full move log; just skip the analysis.
      .catch(() => !cancelled && setPoint('unavailable'));
    return () => {
      cancelled = true;
    };
  }, [finished, gameId, setup, log, playerId]);

  if (point === 'unavailable' || state.players.length !== 2) return null;

  if (point === 'loading') {
    return (
      <p className="flex items-center gap-2 text-sm font-extrabold text-screen-soft">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Reviewing your endgame…
      </p>
    );
  }

  if (point === null) {
    return (
      <p className="card-3d w-full px-4 py-3 text-center text-sm font-extrabold text-ink">
        Endgame review: every move you made from the endgame on was perfect.
      </p>
    );
  }

  return (
    <section className="card-3d flex w-full flex-col gap-2 px-4 py-3" aria-label="Turning point">
      <p className="text-sm font-extrabold text-ink">
        Turning point: one line cost you {point.boxes} {point.boxes === 1 ? 'box' : 'boxes'}.
      </p>
      {open ? (
        <>
          <GameBoard
            state={point.state}
            interactive={false}
            pendingEdgeId={point.played}
            hintEdgeId={point.better}
            lastEvent={null}
            onSelect={noop}
            showHints={false}
            maxHeight="240px"
            className="self-center"
          />
          <p className="text-[13px] font-bold text-label">
            The pulsing line is what you drew. The dotted line keeps {point.boxes} more{' '}
            {point.boxes === 1 ? 'box' : 'boxes'} with perfect play.
          </p>
        </>
      ) : (
        <Chunky tone="soft" onClick={() => setOpen(true)} className="h-11 rounded-[16px] text-base">
          Show me
        </Chunky>
      )}
    </section>
  );
}
