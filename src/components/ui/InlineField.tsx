'use client';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Select, type SelectOption } from './Select';

export type InlineFieldKind = 'text' | 'number' | 'date' | 'select' | 'textarea';

/**
 * The dominant editing pattern. Plain text at rest with no input chrome; hover
 * reveals a surface-2 background; click edits; blur or Enter saves.
 *
 * `inferred` marks an AI-populated, unconfirmed value: ink-muted with a 1px
 * dashed underline that disappears on any interaction. This is the system's one
 * decorative border and it carries real meaning.
 */
export function InlineField({
  kind = 'text',
  value,
  onSave,
  options,
  placeholder = '—',
  inferred,
  label,
  className,
  multiline,
}: {
  kind?: InlineFieldKind;
  value: string | number | null | undefined;
  onSave: (next: string) => void | Promise<void>;
  options?: SelectOption[];
  placeholder?: string;
  inferred?: boolean;
  label: string;
  className?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [confirmed, setConfirmed] = useState(false);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => setDraft(String(value ?? '')), [value]);
  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select?.();
    }
  }, [editing]);

  const showInferred = inferred && !confirmed;

  function commit() {
    setEditing(false);
    setConfirmed(true);
    if (draft !== String(value ?? '')) void onSave(draft);
  }

  if (kind === 'select') {
    return (
      <Select
        bare
        ariaLabel={label}
        value={value == null ? undefined : String(value)}
        onChange={(v) => {
          setConfirmed(true);
          void onSave(v);
        }}
        options={options ?? []}
        placeholder={placeholder}
        className={cn(showInferred && 'border-b border-dashed border-hairline-focus text-ink-muted', className)}
      />
    );
  }

  if (editing) {
    const shared = {
      ref: ref as never,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
      'aria-label': label,
      className: cn(
        't-body-sm w-full rounded-sm bg-surface-2 px-xs py-xxs text-ink outline-none',
        className,
      ),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (!multiline || e.metaKey)) {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(String(value ?? ''));
          setEditing(false);
        }
      },
    };
    return multiline || kind === 'textarea' ? (
      <textarea rows={3} {...shared} />
    ) : (
      <input type={kind === 'date' ? 'date' : kind === 'number' ? 'number' : 'text'} {...shared} />
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => setEditing(true)}
      className={cn(
        't-body-sm w-full rounded-sm px-xs py-xxs text-left transition-colors duration-[120ms]',
        'hover:bg-surface-2',
        showInferred
          ? 'border-b border-dashed border-hairline-focus text-ink-muted'
          : 'text-ink',
        value == null || value === '' ? 'text-ink-faint' : '',
        className,
      )}
    >
      {value == null || value === '' ? placeholder : String(value)}
    </button>
  );
}

/** Label + value row, the shape every detail pane repeats. */
export function FieldRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-[26px] items-baseline gap-sm', className)}>
      <span className="t-caption w-[76px] shrink-0 text-ink-subtle">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
