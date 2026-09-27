'use client';

import { getLevel } from '@dots/game-engine';
import { PageShell, Section } from '@/components/page-shell';
import { formatDuration, textShade } from '@/lib/players';
import { useProgress } from '@/stores/progress-store';

const MODE_LABEL = { cpu: 'vs CPU', local: 'Local', online: 'Online' } as const;
const OUTCOME_STYLE = {
  Won: { background: '#D2F5E1', color: '#0F7A40' },
  Lost: { background: '#FFE0EA', color: '#B8174F' },
  Draw: { background: '#F3EEF8', color: '#6E5E8D' },
} as const;

export function StatsScreen() {
  const { stats, history, unlockedLevel, hydrated } = useProgress();

  const tiles: Array<[string, number | string, string]> = [
    ['Played', stats.gamesPlayed, '#2B1B4A'],
    ['Won', stats.gamesWon, '#DB1F63'],
    ['Draws', stats.draws, '#2B1B4A'],
    ['Boxes', stats.cellsCaptured, '#0A73CC'],
    ['Best score', stats.highestScore, '#9A5E00'],
    ['Best streak', stats.longestWinStreak, '#0F7A40'],
    ['Top level won', stats.highestLevel || '—', '#DB1F63'],
    ['Win streak', stats.currentWinStreak, '#0F7A40'],
    ['Unlocked', unlockedLevel, '#0A73CC'],
  ];

  return (
    <PageShell title="Your stats">
      <p className="px-1 text-[13px] font-bold text-screen-soft">
        Wins and captures count games where you played as yourself (CPU and online).
      </p>
      <dl className="grid grid-cols-3 gap-2.5" aria-busy={!hydrated}>
        {tiles.map(([label, value, color]) => (
          <div key={label} className="flex flex-col-reverse items-center gap-0.5 rounded-[20px] bg-white px-1.5 py-3.5 shadow-[0_4px_0_#EFE3CE]">
            <dt className="text-center text-[10px] font-black tracking-[1px] text-label uppercase">{label}</dt>
            <dd className="font-display text-[28px] leading-none font-extrabold tabular-nums" style={{ color }}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <Section title="Games by mode">
        <div className="flex justify-around text-center">
          {(['cpu', 'local', 'online'] as const).map((m) => (
            <div key={m}>
              <div className="font-display text-2xl font-extrabold text-ink tabular-nums">{stats.byMode[m]}</div>
              <div className="text-xs font-extrabold text-label">{MODE_LABEL[m]}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Recent games">
        {history.length === 0 ? (
          <p className="text-sm font-bold text-label">No games yet — go play one!</p>
        ) : (
          <ul className="flex flex-col divide-y-[1.5px] divide-[#F3EEF8]">
            {history.map((g) => {
              const winners = g.players.filter((p) => g.winnerIds.includes(p.id));
              const me = g.perspectivePlayerId;
              const outcome = g.isDraw ? 'Draw' : me ? (g.winnerIds.includes(me) ? 'Won' : 'Lost') : null;
              return (
                <li key={g.gameId} className="flex items-center gap-3 py-2.5">
                  <span
                    className="rounded-full px-2.5 py-1.5 text-[10px] font-black tracking-[1px] uppercase"
                    style={outcome ? OUTCOME_STYLE[outcome] : OUTCOME_STYLE.Draw}
                  >
                    {outcome ?? 'Local'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-extrabold text-ink">
                      {outcome ? MODE_LABEL[g.mode] : `${winners[0]?.name ?? '?'} won`}
                    </div>
                    <div className="text-xs font-bold text-label">
                      {getLevel(g.level) ? `Level ${g.level}` : `${g.rows}×${g.columns}`} · {formatDuration(g.durationMs)}
                    </div>
                  </div>
                  <div className="font-display text-lg font-extrabold tabular-nums">
                    {g.players.map((p) => (
                      <span key={p.id} style={{ color: textShade(p.color) }} className="ml-2">
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
