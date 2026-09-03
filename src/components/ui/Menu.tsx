'use client';
import * as DM from '@radix-ui/react-dropdown-menu';
import * as CM from '@radix-ui/react-context-menu';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const CONTENT =
  'anim-menu z-50 min-w-[180px] rounded-md border border-hairline bg-canvas p-xs shadow-popover';
const ITEM =
  't-body-sm flex h-control-md cursor-default select-none items-center gap-sm rounded-sm px-sm text-ink outline-none data-[highlighted]:bg-surface-2 data-[disabled]:text-ink-disabled';

export interface MenuItem {
  key: string;
  label: string;
  onSelect?: () => void;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  separatorBefore?: boolean;
  submenu?: MenuItem[];
}

function renderItems(items: MenuItem[], Primitive: typeof DM | typeof CM) {
  const P = Primitive as typeof DM;
  return items.map((item) => (
    <div key={item.key} className="contents">
      {item.separatorBefore ? <P.Separator className="my-xs h-px bg-hairline" /> : null}
      {item.submenu ? (
        <P.Sub>
          <P.SubTrigger className={ITEM}>
            {item.icon}
            <span className="flex-1">{item.label}</span>
            <ChevronRight size={14} strokeWidth={1.5} className="text-ink-subtle" />
          </P.SubTrigger>
          <P.Portal>
            <P.SubContent className={CONTENT}>{renderItems(item.submenu, Primitive)}</P.SubContent>
          </P.Portal>
        </P.Sub>
      ) : (
        <P.Item className={ITEM} disabled={item.disabled} onSelect={() => item.onSelect?.()}>
          {item.icon}
          <span className="flex-1">{item.label}</span>
          {item.checked ? <Check size={14} strokeWidth={1.5} /> : null}
          {item.shortcut ? <span className="t-mono text-ink-faint">{item.shortcut}</span> : null}
        </P.Item>
      )}
    </div>
  ));
}

export function Menu({
  trigger,
  items,
  align = 'start',
}: {
  trigger: React.ReactNode;
  items: MenuItem[];
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <DM.Root>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content className={CONTENT} align={align} sideOffset={4}>
          {renderItems(items, DM)}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

/** Right-click on any object. Every drag operation also has an entry here, so
 *  drag is never the only way to do something. */
export function ContextMenu({
  children,
  items,
  className,
}: {
  children: React.ReactNode;
  items: MenuItem[];
  className?: string;
}) {
  return (
    <CM.Root>
      <CM.Trigger asChild className={className}>
        {children}
      </CM.Trigger>
      <CM.Portal>
        <CM.Content className={CONTENT}>{renderItems(items, CM)}</CM.Content>
      </CM.Portal>
    </CM.Root>
  );
}
