'use client';

import { Dialog as DialogPrimitive } from 'radix-ui';
import { Chunky } from '@/components/kit';

/** A yes/no question for actions that can't be undone. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm(): void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(43,27,74,.55)] backdrop-blur-[6px]" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-48px)] max-w-[382px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-[32px] bg-white px-[22px] pt-7 pb-6 shadow-[0_10px_0_#E3D6EF] outline-none">
          <DialogPrimitive.Title className="text-center font-display text-[30px] leading-tight font-extrabold text-ink">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-center text-sm leading-snug font-extrabold text-label">{description}</DialogPrimitive.Description>
          <Chunky
            tone="pink"
            lift={6}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className="mt-1.5 h-14 w-full rounded-[22px] text-xl"
          >
            {confirmLabel}
          </Chunky>
          <DialogPrimitive.Close asChild>
            <Chunky tone="soft" lift={4} className="h-12 w-full rounded-[20px] text-lg">
              Cancel
            </Chunky>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
