'use client';

import { PLAYER_NAME_MAX } from '@dots/protocol';
import { useState } from 'react';
import { Chunky, PlayerToken } from '@/components/kit';
import { COLOR_CHOICES, PLAYER_SHAPES } from '@/lib/players';
import { cleanName, nameTaken } from '@/lib/profiles';
import type { ProfileLook } from '@/lib/profiles';
import { useProgress } from '@/stores/progress-store';

const inputClass =
  'w-full rounded-xl border-none bg-soft px-3 py-[11px] text-base font-extrabold text-ink outline-none focus:shadow-[0_0_0_3px_#7B5CFF]';

/** Name, colour and shape for a new or edited profile. */
export function ProfileForm({
  initial,
  editingId,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: ProfileLook;
  editingId?: string;
  submitLabel: string;
  onSubmit(look: ProfileLook): void | Promise<void>;
  onCancel?(): void;
}) {
  const book = useProgress((s) => s.book);
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? COLOR_CHOICES[book.profiles.length % COLOR_CHOICES.length]!);
  const [shape, setShape] = useState(initial?.shape ?? PLAYER_SHAPES[book.profiles.length % PLAYER_SHAPES.length]!);
  const [busy, setBusy] = useState(false);

  const clean = cleanName(name);
  const taken = clean !== '' && nameTaken(book, clean, editingId);
  const id = editingId ?? 'new';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clean || taken || busy) return;
    setBusy(true);
    try {
      await onSubmit({ name: clean, color, shape });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`profile-name-${id}`} className="card-label">
          Name
        </label>
        <input
          id={`profile-name-${id}`}
          value={name}
          maxLength={PLAYER_NAME_MAX}
          autoComplete="nickname"
          placeholder="Your name"
          aria-invalid={taken}
          aria-describedby={taken ? `profile-name-${id}-error` : undefined}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        {taken && (
          <p id={`profile-name-${id}-error`} className="text-[13px] font-extrabold text-[#DB1F63]">
            A profile called {clean} already exists.
          </p>
        )}
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="card-label mb-1.5">Colour</legend>
        <div className="flex gap-2.5" role="radiogroup" aria-label="Colour">
          {COLOR_CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={COLOR_NAMES[c.toLowerCase()] ?? c}
              onClick={() => setColor(c)}
              className="size-11 cursor-pointer rounded-full border-none transition-transform duration-150"
              style={{
                background: c,
                boxShadow: color === c ? '0 0 0 3px #fff, 0 0 0 6px #2B1B4A' : 'none',
                transform: color === c ? 'scale(1.05)' : undefined,
              }}
            />
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="card-label mb-1.5">Badge</legend>
        <div className="flex gap-2.5" role="radiogroup" aria-label="Badge">
          {PLAYER_SHAPES.map((sh) => (
            <button
              key={sh}
              type="button"
              role="radio"
              aria-checked={shape === sh}
              aria-label={sh}
              onClick={() => setShape(sh)}
              className="flex size-12 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0"
              style={{ boxShadow: shape === sh ? '0 0 0 3px #2B1B4A' : 'none' }}
            >
              <PlayerToken color={color} shape={sh} size={40} flat />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2.5 pt-1">
        {onCancel && (
          <Chunky type="button" tone="soft" lift={4} onClick={onCancel} className="h-12 flex-1 rounded-[18px] text-lg">
            Cancel
          </Chunky>
        )}
        <Chunky type="submit" tone="pink" lift={5} disabled={!clean || taken || busy} className="h-12 flex-[2] rounded-[18px] text-lg">
          {submitLabel}
        </Chunky>
      </div>
    </form>
  );
}

const COLOR_NAMES: Record<string, string> = {
  '#ff3d7f': 'Pink',
  '#1e9bff': 'Blue',
  '#ffb21e': 'Amber',
  '#21c46b': 'Green',
};
