import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function PageShell({
  title,
  backHref = '/',
  children,
  footer,
}: {
  title: string;
  backHref?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),0.75rem)]">
      <header className="flex items-center gap-2 py-2">
        <Button asChild variant="ghost" size="icon" aria-label="Back">
          <Link href={backHref}>
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      </header>
      <main className="flex flex-1 flex-col gap-6 pb-6">{children}</main>
      {footer && (
        <footer className="sticky bottom-0 -mx-4 border-t bg-background/90 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 backdrop-blur">
          {footer}
        </footer>
      )}
    </div>
  );
}

export function Section({ title, children, description }: { title: string; children: ReactNode; description?: string }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
