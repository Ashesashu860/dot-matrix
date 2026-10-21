import { Suspense } from 'react';
import { OnlineHome } from '@/components/online/online-home';

export const metadata = { title: 'Online' };

// Static route; invite links add ?code=, read on the client.
export default function OnlinePage() {
  return (
    <Suspense>
      <OnlineHome />
    </Suspense>
  );
}
