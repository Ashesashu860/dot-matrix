'use client';

import type { Difficulty } from '@dots/cpu-engine';
import { CUSTOM_LEVEL, MAX_PLAYERS, cellCount, getLevel } from '@dots/game-engine';
import type { PlayerInit } from '@dots/game-engine';
import { PLAYER_COLORS, PLAYER_NAME_MAX, sanitizePlayerName } from '@dots/protocol';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BoardPicker } from '@/components/board-picker';
import type { BoardChoice } from '@/components/board-picker';
import { Chunky, Pill, PlayerToken } from '@/components/kit';
import { PageShell, Section } from '@/components/page-shell';
import { Switch } from '@/components/ui/switch';
import type { LocalGameSetup } from '@/controllers/local-controller';
import { navigate } from '@/lib/navigation';
import { shapeForIndex } from '@/lib/players';
import { useProgress } from '@/stores/progress-store';
import { useSession } from '@/stores/session-store';
import { useSettings } from '@/stores/settings-store';

type Mode = 'cpu' | 'local';

const CPU_NAMES = ['Bolt', 'Pixel', 'Nova'];
const DIFFICULTY_OPTIONS: Array<{ value: Difficulty; label: string; desc: string; pips: string }> = [
  { value: 'easy', label: 'Easy', desc: 'Chill bots', pips: '●○○' },
  { value: 'medium', label: 'Medium', desc: 'Sneaky', pips: '●●○' },
  { value: 'hard', label: 'Hard', desc: 'Ruthless', pips: '●●●' },
];

export function SetupScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const mode: Mode = params.get('mode') === 'local' ? 'local' : 'cpu';
  const settings = useSettings();
  const unlockedLevel = useProgress((s) => s.unlockedLevel);

  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState<string[]>(settings.lastPlayerNames);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [board, setBoard] = useState<BoardChoice>({ level: 1, rows: 4, columns: 4 });
  const [extraTurn, setExtraTurn] = useState(settings.extraTurnOnCapture);

  // Adopt persisted settings once hydrated from IndexedDB.
  useEffect(() => {
    if (!settings.hydrated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNames(settings.lastPlayerNames);
    setExtraTurn(settings.extraTurnOnCapture);
  }, [settings.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default CPU games to the highest unlocked level.
  useEffect(() => {
    if (mode !== 'cpu') return;
    const def = getLevel(unlockedLevel);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (def) setBoard({ level: def.level, rows: def.rows, columns: def.columns });
  }, [mode, unlockedLevel]);

  const start = async () => {
    const cleanNames = names.map((n, i) => sanitizePlayerName(n) || `Player ${i + 1}`);
    const players: PlayerInit[] =
      mode === 'cpu'
        ? [
            { id: 'human', name: 'You', type: 'human', color: PLAYER_COLORS[0] },
            ...Array.from({ length: playerCount - 1 }, (_, i) => ({
              id: `cpu-${i + 1}`,
              name: CPU_NAMES[i]!,
              type: 'cpu' as const,
              color: PLAYER_COLORS[i + 1]!,
            })),
          ]
        : Array.from({ length: playerCount }, (_, i) => ({
            id: `p${i + 1}`,
            name: cleanNames[i]!,
            type: 'human' as const,
            color: PLAYER_COLORS[i]!,
          }));

    const setup: LocalGameSetup = {
      create: {
        mode,
        level: board.level,
        rows: board.rows,
        columns: board.columns,
        players,
        config: { extraTurnOnCapture: extraTurn },
      },
      difficulty: mode === 'cpu' ? difficulty : undefined,
      seed: Math.floor(Math.random() * 2 ** 31),
      ...(mode === 'cpu' && settings.cpuFirst && { cpuFirst: true }),
    };
    settings.set({
      ...(mode === 'local' && {
        lastPlayerNames: cleanNames.concat(settings.lastPlayerNames.slice(cleanNames.length)).slice(0, MAX_PLAYERS),
      }),
      extraTurnOnCapture: extraTurn,
    });
    await useSession.getState().startLocal(setup);
    navigate(router, '/play');
  };

  const custom = board.level === CUSTOM_LEVEL;
  const boxes = cellCount(board.rows, board.columns);

  return (
    <PageShell
      title={mode === 'cpu' ? 'Play vs CPU' : 'Local game'}
      footer={
        <Chunky tone="pink" lift={7} glow onClick={start} className="flex h-[72px] w-full flex-col items-center justify-center gap-0.5 rounded-3xl">
          <span className="text-[26px] leading-none">{custom ? 'Start custom game' : `Start level ${board.level}`}</span>
          <span className="font-sans text-xs font-extrabold">
            {board.rows}×{board.columns} dots · {boxes} boxes
          </span>
        </Chunky>
      }
    >
      <Section title="Players">
        <div className="flex gap-2" role="radiogroup" aria-label={mode === 'cpu' ? 'Number of CPU opponents' : 'Number of players'}>
          {[2, 3, 4].map((n) => {
            const selected = playerCount === n;
            return (
              <button
                key={n}
                role="radio"
                aria-checked={selected}
                onClick={() => setPlayerCount(n)}
                className="h-12 flex-1 cursor-pointer rounded-2xl font-display text-base font-extrabold transition-all duration-150"
                style={{ background: selected ? '#2B1B4A' : '#F6F1FB', color: selected ? '#fff' : '#2B1B4A' }}
              >
                {mode === 'cpu' ? `${n - 1} ${n > 2 ? 'bots' : 'bot'}` : `${n} players`}
              </button>
            );
          })}
        </div>
        <ul className="flex flex-col gap-2">
          {Array.from({ length: playerCount }, (_, i) => {
            const isCpu = mode === 'cpu' && i > 0;
            const color = PLAYER_COLORS[i]!;
            return (
              <li key={i} className="flex items-center gap-3">
                <PlayerToken color={color} shape={shapeForIndex(i)} />
                {mode === 'local' ? (
                  <input
                    aria-label={`Player ${i + 1} name`}
                    value={names[i] ?? ''}
                    placeholder={`Player ${i + 1}`}
                    maxLength={PLAYER_NAME_MAX}
                    onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
                    className="min-w-0 flex-1 rounded-xl border-none bg-soft px-3 py-[11px] text-base font-extrabold text-ink outline-none focus:shadow-[0_0_0_3px_#7B5CFF]"
                  />
                ) : (
                  <span className="flex-1 text-[17px] font-extrabold text-ink">{isCpu ? CPU_NAMES[i - 1] : 'You'}</span>
                )}
                <Pill>{isCpu ? 'CPU' : mode === 'cpu' ? 'YOU' : 'HUMAN'}</Pill>
              </li>
            );
          })}
        </ul>
      </Section>

      {mode === 'cpu' && (
        <Section title="Difficulty">
          <div className="flex gap-2" role="radiogroup" aria-label="CPU difficulty">
            {DIFFICULTY_OPTIONS.map((d) => {
              const selected = difficulty === d.value;
              return (
                <Chunky
                  key={d.value}
                  role="radio"
                  aria-checked={selected}
                  aria-label={d.label}
                  tone={selected ? 'blue' : 'soft'}
                  lift={4}
                  onClick={() => setDifficulty(d.value)}
                  className="flex flex-1 flex-col items-center gap-[3px] rounded-[18px] px-1 py-3 transition-all duration-150"
                  style={selected ? undefined : ({ '--edge': '#E6DCF0' } as React.CSSProperties)}
                >
                  <span aria-hidden="true" className="font-sans text-[11px] tracking-[2px]">{d.pips}</span>
                  <span className="text-lg leading-[1.1]">{d.label}</span>
                  <span className="font-sans text-[11px] font-extrabold">{d.desc}</span>
                </Chunky>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="Level" description={mode === 'cpu' ? 'Win a level to unlock the next.' : undefined}>
        <BoardPicker value={board} onChange={setBoard} unlockedLevel={mode === 'cpu' ? unlockedLevel : undefined} />
      </Section>

      <section className="card-3d flex items-center gap-3 px-4 py-3.5">
        <label htmlFor="extra-turn" className="flex flex-1 flex-col gap-px">
          <span className="text-[17px] font-extrabold text-ink">Extra turn on capture</span>
          <span className="text-[13px] font-bold text-label">Closing a box lets you go again</span>
        </label>
        <Switch id="extra-turn" checked={extraTurn} onCheckedChange={setExtraTurn} />
      </section>
    </PageShell>
  );
}
