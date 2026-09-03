'use client';
import * as RS from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className,
  ariaLabel,
  bare,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  ariaLabel: string;
  /** Bare renders as plain text until hovered — the InlineField presentation. */
  bare?: boolean;
}) {
  return (
    <RS.Root value={value ?? undefined} onValueChange={onChange}>
      <RS.Trigger
        aria-label={ariaLabel}
        className={cn(
          't-body-sm flex items-center justify-between gap-xs rounded-sm text-ink',
          bare
            ? 'h-auto min-h-[22px] bg-transparent px-xs py-xxs hover:bg-surface-2'
            : 'h-control-md border border-hairline-strong bg-canvas px-sm',
          'transition-colors duration-[120ms] data-[placeholder]:text-ink-faint',
          className,
        )}
      >
        <RS.Value placeholder={placeholder} />
        <RS.Icon>
          <ChevronDown size={14} strokeWidth={1.5} className="text-ink-subtle" />
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={4}
          className="anim-menu z-50 max-h-[320px] min-w-[180px] overflow-y-auto rounded-md border border-hairline bg-canvas p-xs shadow-popover"
        >
          <RS.Viewport>
            {options.map((o) => (
              <RS.Item
                key={o.value}
                value={o.value}
                className="t-body-sm flex h-control-md cursor-default select-none items-center gap-sm rounded-sm px-sm text-ink outline-none data-[highlighted]:bg-surface-2"
              >
                <RS.ItemText>{o.label}</RS.ItemText>
                <RS.ItemIndicator className="ml-auto">
                  <Check size={14} strokeWidth={1.5} />
                </RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
