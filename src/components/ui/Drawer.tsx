'use client';
import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from './Button';

/** The tablet presentation of the context pane: right-side overlay with a scrim. */
export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="anim-overlay fixed inset-0 z-40 bg-scrim" />
        <RD.Content
          className={cn(
            'anim-drawer fixed right-0 top-0 z-50 flex h-full w-[380px] max-w-[90vw] flex-col',
            'border-l border-hairline bg-canvas shadow-modal',
            className,
          )}
        >
          <div className="flex items-center justify-between gap-sm border-b border-hairline px-lg py-md">
            <RD.Title className="t-heading-sm truncate">{title}</RD.Title>
            <RD.Close asChild>
              <IconButton label="Close">
                <X size={16} strokeWidth={1.5} />
              </IconButton>
            </RD.Close>
          </div>
          <RD.Description className="sr-only">{title}</RD.Description>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
