import { Suspense } from 'react';
import { RoomScreen } from '@/components/online/room-screen';

export const metadata = { title: 'Room' };

// Static route with ?id= so the shell can be precached; data is live from Firestore.
export default function RoomPage() {
  return (
    <Suspense>
      <RoomScreen />
    </Suspense>
  );
}
