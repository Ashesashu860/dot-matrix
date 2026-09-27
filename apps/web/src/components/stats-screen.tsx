'use client';

import { getLevel } from '@dots/game-engine';
import { PageShell, Section } from '@/components/page-shell';
import { formatDuration } from '@/lib/players';
import { useProgress } from '@/stores/progress-store';

const MODE_LABEL = { cpu: 'vs CPU', local: 'Local', online: 'Online' } as const;

export function StatsScreen() {
  const { stats, history, unlockedLevel, hydrated } = useProgress();

  const tiles: Array<[string, number | string]> = [
    ['Games played', stats.gamesPlayed],
    ['Won', stats.gamesWon],
    ['Draws', stats.draws],
    ['Boxes captured', stats.cellsCaptured],
    ['Highest score', stats.highestScore],
    ['Highest level won', stats.highestLevel || '—'],
    ['Best win streak', stats.longestWinStreak],
    ['Levels unlocked', unlockedLevel],
  ];

  return (
    <PageShell title="Statistics">
      <Section title="On this device" description="Wins and captures count games where you played as yourself (CPU and online).">
        <dl className="grid grid-cols-2 gap-2" aria-busy={!hydrated}>
          {tiles.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-card p-3 shadow-sm">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-around rounded-2xl bg-muted p-3 text-center text-sm">
          {(['cpu', 'local', 'online'] as const).map((m) => (
            <div key={m}>
              <div className="font-bold tabular-nums">{stats.byMode[m]}</div>
              <div className="text-xs text-muted-foreground">{MODE_LABEL[m]}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Recent games">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No games yet — go play one!</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((g) => {
              const winners = g.players.filter((p) => g.winnerIds.includes(p.id));
              const me = g.perspectivePlayerId;
              const outcome = g.isDraw
                ? 'Draw'
                : me
                  ? g.winnerIds.includes(me)
                    ? 'Won'
                    : 'Lost'
                  : `${winners[0]?.name ?? '?'} won`;
              return (
                <li key={g.gameId} className="flex items-center justify-between rounded-xl bg-card p-3 text-sm shadow-sm">
                  <div>
                    <div className="font-medium">{outcome}</div>
                    <div className="text-xs text-muted-foreground">
                      {MODE_LABEL[g.mode]} · {getLevel(g.level) ? `Level ${g.level}` : `${g.rows}×${g.columns}`} ·{' '}
                      {formatDuration(g.durationMs)}
                    </div>
                  </div>
                  <div className="text-right font-semibold tabular-nums">
                    {g.players.map((p) => (
                      <span key={p.id} style={{ color: p.color }} className="ml-2">
                        {p.score}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}
