'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Chunky, Pill, PlayerToken } from '@/components/kit';
import { PageShell } from '@/components/page-shell';
import { ProfileForm } from '@/components/profile/profile-form';
import { MAX_STARS, currentStage, totalStars } from '@/lib/campaign';
import { MAX_PROFILES } from '@/lib/profiles';
import type { Profile } from '@/lib/profiles';
import { useProgress } from '@/stores/progress-store';

type Pending = { kind: 'reset' | 'delete'; profile: Profile };

/** Switch, add, edit, reset and delete the profiles on this device. */
export function ProfilesScreen() {
  const { book, hydrated } = useProgress();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const store = useProgress.getState;
  const noProfiles = hydrated && book.profiles.length === 0;

  return (
    <PageShell title="Profiles" backHref="/settings">
      <p className="px-1 text-[13px] font-bold text-screen-soft">
        Each profile keeps its own campaign stars on this device. Stats, lessons and daily puzzles are shared.
      </p>

      {book.profiles.map((profile) => {
        const active = profile.id === book.activeId;
        const stars = totalStars(profile.campaign);
        return (
          <section key={profile.id} className="card-3d flex flex-col gap-3 p-4" aria-label={`Profile ${profile.name}`}>
            {editing === profile.id ? (
              <ProfileForm
                initial={profile}
                editingId={profile.id}
                submitLabel="Save"
                onCancel={() => setEditing(null)}
                onSubmit={async (look) => {
                  await store().editProfile(profile.id, look);
                  setEditing(null);
                }}
              />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <PlayerToken color={profile.color} shape={profile.shape} size={46} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-display text-[22px] leading-tight font-extrabold text-ink">{profile.name}</span>
                    <span className="text-[13px] font-bold text-label">
                      <span className="text-amber">★</span> {stars} / {MAX_STARS} · {stars ? `Stage ${currentStage(profile.campaign).id}` : 'Not started'}
                    </span>
                  </div>
                  {active ? (
                    <Pill className="bg-[#E4F7EC]! text-[#0F7A40]!">PLAYING</Pill>
                  ) : (
                    <Chunky tone="pink" lift={4} onClick={() => void store().switchProfile(profile.id)} className="h-10 rounded-2xl px-4 text-base">
                      Switch
                    </Chunky>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Chunky tone="soft" lift={3} onClick={() => setEditing(profile.id)} className="h-10 rounded-[14px] text-sm">
                    Edit
                  </Chunky>
                  <Chunky
                    tone="soft"
                    lift={3}
                    disabled={stars === 0 && profile.campaign.grantedChapter <= 1}
                    onClick={() => setPending({ kind: 'reset', profile })}
                    className="h-10 rounded-[14px] text-sm"
                  >
                    Reset progress
                  </Chunky>
                  <Chunky tone="soft" lift={3} onClick={() => setPending({ kind: 'delete', profile })} className="h-10 rounded-[14px] text-sm text-[#DB1F63]!">
                    Delete
                  </Chunky>
                </div>
              </>
            )}
          </section>
        );
      })}

      {hydrated &&
        book.profiles.length < MAX_PROFILES &&
        (adding || noProfiles ? (
          <section className="card-3d flex flex-col gap-3 p-4" aria-label="New profile">
            <h2 className="font-display text-[22px] leading-tight font-extrabold text-ink">New profile</h2>
            <ProfileForm
              submitLabel="Create profile"
              onCancel={noProfiles ? undefined : () => setAdding(false)}
              onSubmit={async (look) => {
                await store().createProfile(look);
                setAdding(false);
              }}
            />
          </section>
        ) : (
          <Chunky tone="white" lift={5} onClick={() => setAdding(true)} className="h-14 rounded-[22px] text-xl">
            + Add profile
          </Chunky>
        ))}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.kind === 'delete' ? `Delete ${pending.profile.name}?` : `Reset ${pending?.profile.name ?? ''}?`}
        description={
          pending?.kind === 'delete'
            ? 'The profile and all its campaign stars will be removed. This can’t be undone.'
            : 'All campaign stars are cleared and the campaign starts again from stage 1-1. This can’t be undone.'
        }
        confirmLabel={pending?.kind === 'delete' ? 'Delete profile' : 'Reset progress'}
        onConfirm={() => {
          if (!pending) return;
          void (pending.kind === 'delete' ? store().deleteProfile(pending.profile.id) : store().resetProfile(pending.profile.id));
        }}
      />
    </PageShell>
  );
}
