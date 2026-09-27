import type { ReactNode } from 'react';
import { BottomAction, CardLabel, Screen, ScreenBody, ScreenHeader } from '@/components/kit';

/** Standard screen: round back button + title, scrolling body, optional pinned action. */
export function PageShell({
  title,
  backHref = '/',
  onBack,
  right,
  children,
  footer,
}: {
  title: string;
  backHref?: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Screen>
      <ScreenHeader title={title} backHref={backHref} onBack={onBack} right={right} />
      <ScreenBody withAction={!!footer}>{children}</ScreenBody>
      {footer && <BottomAction>{footer}</BottomAction>}
    </Screen>
  );
}

/** A white card with an uppercase label. */
export function Section({ title, children, description }: { title: string; children: ReactNode; description?: string }) {
  return (
    <section className="card-3d flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <CardLabel>{title}</CardLabel>
        {description && <p className="text-[13px] font-bold text-label">{description}</p>}
      </div>
      {children}
    </section>
  );
}
