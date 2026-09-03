'use client';
import * as RT from '@radix-ui/react-tooltip';

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <RT.Provider delayDuration={120} skipDelayDuration={200}>
      {children}
    </RT.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  if (!content) return <>{children}</>;
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          sideOffset={6}
          className="anim-menu t-caption z-50 max-w-[280px] rounded-md border border-hairline bg-canvas px-sm py-xs text-ink shadow-popover"
        >
          {content}
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
