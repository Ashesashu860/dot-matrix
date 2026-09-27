import Link from 'next/link';
import { Chunky } from '@/components/kit';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="card-3d flex flex-col items-center gap-3 p-6">
        <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-amber font-display text-3xl font-extrabold text-ink shadow-[0_5px_0_#D98900]">
          !
        </span>
        <h1 className="font-display text-3xl font-extrabold text-ink">You&apos;re offline</h1>
        <p className="text-sm font-bold text-label">
          Online games need a connection, but you can still play against the CPU or with friends on this device.
        </p>
        <Chunky asChild tone="pink" lift={6} className="mt-1 flex h-14 items-center rounded-[20px] px-6 text-xl">
          <Link href="/">Back to home</Link>
        </Chunky>
      </div>
    </main>
  );
}
