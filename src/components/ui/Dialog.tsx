'use client';
import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from './Button';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const WIDTH: Record<Size, string> = {
  sm: 'max-w-[420px]',
  md: 'max-w-[640px]',
  lg: 'max-w-[900px]',
  xl: 'max-w-[1040px]',
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  children,
  footer,
  /** On phone the modal becomes a full-screen sheet rising from the bottom. */
  fullScreenOnPhone = true,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: Size;
  children: React.ReactNode;
  footer?: React.ReactNode;
  fullScreenOnPhone?: boolean;
  className?: string;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="anim-overlay fixed inset-0 z-40 bg-scrim" />
        <RD.Content
          className={cn(
            'anim-modal fixed z-50 flex flex-col overflow-hidden bg-canvas text-ink',
            'border border-hairline shadow-modal',
            fullScreenOnPhone
              ? 'inset-x-0 bottom-0 top-0 rounded-none tablet:inset-auto tablet:left-1/2 tablet:top-1/2 tablet:max-h-[86vh] tablet:w-[92vw] tablet:-translate-x-1/2 tablet:-translate-y-1/2 tablet:rounded-lg'
              : 'left-1/2 top-1/2 max-h-[86vh] w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg',
            WIDTH[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-md border-b border-hairline px-xl py-lg">
            <div className="min-w-0">
              <RD.Title className="t-title truncate">{title}</RD.Title>
              {description ? (
                <RD.Description className="t-caption mt-xxs text-ink-subtle">
                  {description}
                </RD.Description>
              ) : (
                <RD.Description className="sr-only">{title}</RD.Description>
              )}
            </div>
            <RD.Close asChild>
              <IconButton label="Close">
                <X size={16} strokeWidth={1.5} />
              </IconButton>
            </RD.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

          {footer ? (
            <div className="flex items-center justify-end gap-sm border-t border-hairline px-xl py-md">
              {footer}
            </div>
          ) : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
