import { Suspense } from 'react';
import { SetupScreen } from '@/components/setup-screen';

export const metadata = { title: 'New game' };

export default function SetupPage() {
  return (
    <Suspense>
      <SetupScreen />
    </Suspense>
  );
}
