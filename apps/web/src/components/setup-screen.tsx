'use client';

import { DIFFICULTIES } from '@dots/cpu-engine';
import type { Difficulty } from '@dots/cpu-engine';
import { MAX_PLAYERS, getLevel } from '@dots/game-engine';
import type { PlayerInit } from '@dots/game-engine';
import { PLAYER_NAME_MAX, sanitizePlayerName } from '@dots/protocol';
import { Bot, Play } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BoardPicker } from '@/components/board-picker';
import type { BoardChoice } from '@/components/board-picker';
import { PlayerShapeIcon } from '@/components/game/player-shape';
import { PageShell, Section } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { LocalGameSetup } from '@/controllers/local-controller';
import { COLOR_CHOICES, COLOR_NAMES, shapeForIndex } from '@/lib/players';
import { navigate } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useProgress } from '@/stores/progress-store';
import { useSession } from '@/stores/session-store';
import { useSettings } from '@/stores/settings-store';

type Mode = 'cpu' | 'local';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const CPU_NAMES = ['Bolt', 'Pixel', 'Nova'];

export function SetupScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const mode: Mode = params.get('mode') === 'local' ? 'local' : 'cpu';
  const settings = useSettings();
  const unlockedLevel = useProgress((s) => s.unlockedLevel);

  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState<string[]>(settings.lastPlayerNames);
  const [colors, setColors] = useState<string[]>(COLOR_CHOICES.slice(0, MAX_PLAYERS));
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

  const setColor = (index: number, color: string) => {
    setColors((prev) => {
      const next = [...prev];
      const other = next.indexOf(color);
      // Swap so colours stay unique.
      if (other !== -1) next[other] = next[index]!;
      next[index] = color;
      return next;
    });
  };

  const start = async () => {
    const cleanNames = names.map((n, i) => sanitizePlayerName(n) || `Player ${i + 1}`);
    const players: PlayerInit[] =
      mode === 'cpu'
        ? [
            { id: 'human', name: cleanNames[0]!, type: 'human', color: colors[0]! },
            ...Array.from({ length: playerCount - 1 }, (_, i) => ({
              id: `cpu-${i + 1}`,
              name: `${CPU_NAMES[i]} (${DIFFICULTY_LABEL[difficulty]})`,
              type: 'cpu' as const,
              color: colors[i + 1]!,
            })),
          ]
        : Array.from({ length: playerCount }, (_, i) => ({
            id: `p${i + 1}`,
            name: cleanNames[i]!,
            type: 'human' as const,
            color: colors[i]!,
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
    };
    settings.set({
      lastPlayerNames: cleanNames.concat(settings.lastPlayerNames.slice(cleanNames.length)).slice(0, MAX_PLAYERS),
      extraTurnOnCapture: extraTurn,
    });
    await useSession.getState().startLocal(setup);
    navigate(router, '/play');
  };

  const humanCount = mode === 'cpu' ? 1 : playerCount;

  return (
    <PageShell
      title={mode === 'cpu' ? 'Play vs CPU' : 'Local Game'}
      footer={
        <Button size="lg" className="w-full text-base" onClick={start}>
          <Play /> Start game
        </Button>
      }
    >
      <ToggleGroup
        type="single"
        variant="outline"
        value={mode}
        onValueChange={(v) => v && navigate(router, `/play/setup?mode=${v}`, { replace: true })}
        className="w-full"
        aria-label="Mode"
      >
        <ToggleGroupItem value="cpu" className="flex-1">vs CPU</ToggleGroupItem>
        <ToggleGroupItem value="local" className="flex-1">Local</ToggleGroupItem>
      </ToggleGroup>

      <Section title={mode === 'cpu' ? 'Players' : 'Number of players'}>
        <ToggleGroup
          type="single"
          variant="outline"
          value={String(playerCount)}
          onValueChange={(v) => v && setPlayerCount(Number(v))}
          className="w-full"
          aria-label={mode === 'cpu' ? 'Total players including CPUs' : 'Number of players'}
        >
          {[2, 3, 4].map((n) => (
            <ToggleGroupItem key={n} value={String(n)} className="flex-1">
              {mode === 'cpu' ? `1 vs ${n - 1} CPU` : `${n} players`}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <ul className="flex flex-col gap-2">
          {Array.from({ length: playerCount }, (_, i) => {
            const isCpu = i >= humanCount;
            return (
              <li key={i} className="flex items-center gap-2 rounded-xl bg-card p-2 shadow-sm">
                <PlayerShapeIcon shape={shapeForIndex(i)} color={colors[i]!} size={22} />
                {isCpu ? (
                  <span className="flex flex-1 items-center gap-2 px-2 text-sm">
                    <Bot className="size-4 text-muted-foreground" /> {CPU_NAMES[i - 1]}
                  </span>
                ) : (
                  <>
                    <Label htmlFor={`player-${i}`} className="sr-only">
                      Player {i + 1} name
                    </Label>
                    <Input
                      id={`player-${i}`}
                      value={names[i] ?? ''}
                      maxLength={PLAYER_NAME_MAX}
                      onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
                      className="flex-1"
                    />
                  </>
                )}
                <div className="flex gap-1" role="radiogroup" aria-label={`Player ${i + 1} colour`}>
                  {COLOR_CHOICES.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      role="radio"
                      aria-checked={colors[i] === c}
                      aria-label={COLOR_NAMES[c] ?? c}
                      onClick={() => setColor(i, c)}
                      className={cn(
                        'size-5 rounded-full ring-offset-2 ring-offset-card transition',
                        colors[i] === c && 'ring-2 ring-foreground',
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      {mode === 'cpu' && (
        <Section title="Difficulty">
          <ToggleGroup
            type="single"
            variant="outline"
            value={difficulty}
            onValueChange={(v) => v && setDifficulty(v as Difficulty)}
            className="w-full"
            aria-label="CPU difficulty"
          >
            {DIFFICULTIES.map((d) => (
              <ToggleGroupItem key={d} value={d} className="flex-1">
                {DIFFICULTY_LABEL[d]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Section>
      )}

      <Section
        title="Board"
        description={mode === 'cpu' ? 'Win a level to unlock the next.' : 'Any level or a custom size.'}
      >
        <BoardPicker value={board} onChange={setBoard} unlockedLevel={mode === 'cpu' ? unlockedLevel : undefined} />
      </Section>

      <Section title="Rules">
        <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-sm">
          <Label htmlFor="extra-turn" className="flex flex-col items-start gap-0.5">
            <span>Extra turn on capture</span>
            <span className="text-xs font-normal text-muted-foreground">Completing a box lets you move again</span>
          </Label>
          <Switch id="extra-turn" checked={extraTurn} onCheckedChange={setExtraTurn} />
        </div>
      </Section>
    </PageShell>
  );
}
