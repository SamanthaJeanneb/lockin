'use client';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { api } from '@/lib/client-api';
import { Avatar, Icon, Textarea } from '@/components/ui';
import { iconFor } from '@/components/composite/ObjectDetail';

export interface MentionCandidate {
  id: string;
  title: string;
  type: string;
  subtitle: string | null;
}

/** Properties that must match for the mirror to measure the caret correctly. */
const MIRRORED = [
  'boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
  'borderLeftWidth', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontFamily',
  'lineHeight', 'letterSpacing', 'textTransform', 'wordSpacing', 'textIndent', 'whiteSpace',
] as const;

/**
 * Where the caret is, in pixels relative to the textarea.
 *
 * A textarea exposes no caret geometry, so the text up to the caret is rendered
 * into an off-screen div that copies every property affecting layout, and the
 * position of a marker span is measured. Anything less — anchoring to the whole
 * field, or guessing from character width — puts the menu in the wrong place
 * the moment the text wraps.
 */
function caretPosition(el: HTMLTextAreaElement, index: number) {
  const mirror = document.createElement('div');
  const style = getComputedStyle(el);

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  for (const prop of MIRRORED) {
    mirror.style[prop as never] = style[prop as never];
  }
  mirror.style.height = 'auto';

  mirror.textContent = el.value.slice(0, index);
  const marker = document.createElement('span');
  marker.textContent = el.value.slice(index) || '.';
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const top = marker.offsetTop;
  const left = marker.offsetLeft;
  document.body.removeChild(mirror);

  return { top: top - el.scrollTop, left, lineHeight: parseFloat(style.lineHeight) || 20 };
}

/** The `@query` immediately before the caret, if there is one. */
function activeMention(value: string, caret: number) {
  const upto = value.slice(0, caret);
  const at = upto.lastIndexOf('@');
  if (at === -1) return null;

  // Must start a word — an email address is not a mention.
  const before = at === 0 ? '' : upto[at - 1]!;
  if (before && !/[\s(\[]/.test(before)) return null;

  const query = upto.slice(at + 1);
  // A mention is one or two words; more than that and they have moved on.
  if (/[\n]/.test(query) || query.split(/\s+/).length > 2 || query.length > 40) return null;

  return { start: at, query };
}

export interface MentionTextareaHandle {
  focus: () => void;
}

export const MentionTextarea = forwardRef<
  MentionTextareaHandle,
  {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
    autoFocus?: boolean;
    onSubmit?: () => void;
  }
>(function MentionTextarea(
  { value, onChange, placeholder, rows = 4, className, autoFocus, onSubmit },
  ref,
) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [selected, setSelected] = useState(0);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  const { data } = useQuery({
    queryKey: ['mentions', mention?.query ?? null],
    queryFn: () =>
      api.get<{ candidates: MentionCandidate[] }>(
        `/api/mentions?q=${encodeURIComponent(mention?.query ?? '')}`,
      ),
    enabled: mention !== null,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  const candidates = data?.candidates ?? [];

  useEffect(() => setSelected(0), [mention?.query]);

  const sync = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const next = activeMention(el.value, el.selectionStart ?? 0);
    setMention(next);
    if (next) {
      const { top, left, lineHeight } = caretPosition(el, next.start);
      setAnchor({ top: top + lineHeight + 4, left });
    } else {
      setAnchor(null);
    }
  }, []);

  const insert = useCallback(
    (candidate: MentionCandidate) => {
      const el = inputRef.current;
      if (!el || !mention) return;
      const caret = el.selectionStart ?? 0;
      const next = `${value.slice(0, mention.start)}@${candidate.title} ${value.slice(caret)}`;
      onChange(next);
      setMention(null);
      setAnchor(null);
      // Put the caret after the inserted name, once React has written the value.
      const at = mention.start + candidate.title.length + 2;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(at, at);
      });
    },
    [mention, onChange, value],
  );

  const open = mention !== null && candidates.length > 0 && anchor !== null;

  return (
    <div className="relative">
      <Textarea
        ref={inputRef}
        rows={rows}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          requestAnimationFrame(sync);
        }}
        onClick={sync}
        onKeyUp={(e) => {
          // Arrows move the caret, so the menu has to follow it.
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) sync();
        }}
        onBlur={() => setTimeout(() => setMention(null), 120)}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelected((s) => (s + 1) % candidates.length);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelected((s) => (s - 1 + candidates.length) % candidates.length);
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              insert(candidates[selected]!);
              return;
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setMention(null);
              return;
            }
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
            e.preventDefault();
            onSubmit?.();
          }
        }}
      />

      {open ? (
        <div
          role="listbox"
          aria-label="People and projects"
          className="anim-menu absolute z-50 min-w-[240px] max-w-[320px] overflow-hidden rounded-md border border-hairline bg-canvas p-xs shadow-popover"
          style={{ top: anchor.top, left: anchor.left }}
        >
          {candidates.map((c, i) => (
            <button
              key={c.id}
              role="option"
              aria-selected={i === selected}
              onMouseEnter={() => setSelected(i)}
              onMouseDown={(e) => {
                // mousedown, not click — blur would close the menu first.
                e.preventDefault();
                insert(c);
              }}
              className={cn(
                'flex h-control-md w-full items-center gap-sm rounded-sm px-sm text-left',
                i === selected ? 'bg-surface-2' : 'hover:bg-surface-1',
              )}
            >
              {c.type === 'person' ? (
                <Avatar name={c.title} />
              ) : (
                <span className="text-ink-subtle">
                  <Icon name={iconFor(c.type)} size={14} />
                </span>
              )}
              <span className="t-body-sm min-w-0 flex-1 truncate">{c.title}</span>
              {c.subtitle ? (
                <span className="t-caption shrink-0 truncate text-ink-subtle">{c.subtitle}</span>
              ) : (
                <span className="t-micro shrink-0 text-ink-faint">{c.type}</span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
