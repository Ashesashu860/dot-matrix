'use client';

import type { RoomDoc } from '@dots/protocol';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CardLabel } from '@/components/kit';
import { getFirebase } from '@/firebase/client';

type RoomRow = RoomDoc & { id: string };

function status(room: RoomRow, uid: string): { label: string; mine: boolean } {
  if (room.status === 'waiting') return { label: `Lobby · code ${room.code}`, mine: false };
  if (room.currentPlayerUid === uid) return { label: 'Your turn', mine: true };
  return { label: 'Their turn', mine: false };
}

/** The player's open rooms and games, live: lobbies, live games and async games. */
export function YourGames({ uid }: { uid: string }) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);

  useEffect(() => {
    const { firestore } = getFirebase();
    const q = query(
      collection(firestore, 'rooms'),
      where('playerUids', 'array-contains', uid),
      where('status', 'in', ['waiting', 'playing']),
      orderBy('updatedAt', 'desc'),
      limit(20),
    );
    return onSnapshot(
      q,
      (snap) => setRooms(snap.docs.map((d) => ({ ...(d.data() as RoomDoc), id: d.id }))),
      () => setRooms([]),
    );
  }, [uid]);

  if (!rooms.length) return null;
  // Games waiting on this player first.
  const sorted = [...rooms].sort((a, b) => Number(status(b, uid).mine) - Number(status(a, uid).mine));

  return (
    <section className="card-3d flex flex-col gap-2 p-4" aria-label="Your games">
      <CardLabel>Your games</CardLabel>
      <ul className="flex flex-col gap-2">
        {sorted.map((room) => {
          const s = status(room, uid);
          return (
            <li key={room.id}>
              <Link
                href={`/online/room?id=${room.id}`}
                className="flex items-center gap-3 rounded-[16px] bg-soft px-3.5 py-2.5"
                aria-label={`${s.label}, ${room.rows} by ${room.columns}${room.pace === 'async' ? ', play anytime' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className={s.mine ? 'size-2.5 flex-none rounded-full bg-pink' : 'size-2.5 flex-none rounded-full bg-[#CFC3E0]'}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-extrabold text-ink">{s.label}</span>
                  <span className="text-xs font-bold text-label">
                    {room.rows}×{room.columns} · {room.pace === 'async' ? 'Play anytime' : 'Live'}
                  </span>
                </span>
                <span aria-hidden="true" className="font-display text-2xl text-ink">
                  ›
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
