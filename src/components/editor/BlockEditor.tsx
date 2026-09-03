'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Mention from '@tiptap/extension-mention';
import { api } from '@/lib/client-api';
import { debounce } from '@/lib/utils';
import { cn } from '@/lib/utils';

export interface MentionHit {
  id: string;
  title: string;
  type: string;
}

/**
 * @-mentions create real graph edges, not decorated text. The mention node
 * carries the object id and the parent writes an edge on save.
 */
function mentionExtension(onMention: (id: string) => void) {
  return Mention.configure({
    HTMLAttributes: { class: 'mention' },
    suggestion: {
      char: '@',
      items: async ({ query }: { query: string }) => {
        if (query.length < 1) return [];
        const res = await api.post<{ results: MentionHit[] }>('/api/search', { query });
        return res.results.slice(0, 8);
      },
      render: () => {
        let el: HTMLDivElement | null = null;
        let items: MentionHit[] = [];
        let selected = 0;
        let command: ((item: { id: string; label: string }) => void) | null = null;

        const paint = () => {
          if (!el) return;
          el.innerHTML = '';
          items.forEach((item, i) => {
            const b = document.createElement('button');
            b.textContent = item.title;
            b.className = `t-body-sm flex h-control-md w-full items-center rounded-sm px-sm text-left ${
              i === selected ? 'bg-surface-2' : ''
            }`;
            b.onmousedown = (e) => {
              e.preventDefault();
              command?.({ id: item.id, label: item.title });
              onMention(item.id);
            };
            el!.appendChild(b);
          });
        };

        return {
          onStart: (props: { clientRect?: (() => DOMRect | null) | null; items: MentionHit[]; command: (i: { id: string; label: string }) => void }) => {
            items = props.items;
            command = props.command;
            el = document.createElement('div');
            el.className =
              'anim-menu fixed z-50 min-w-[200px] rounded-md border border-hairline bg-canvas p-xs shadow-popover';
            document.body.appendChild(el);
            const rect = props.clientRect?.();
            if (rect) {
              el.style.left = `${rect.left}px`;
              el.style.top = `${rect.bottom + 4}px`;
            }
            paint();
          },
          onUpdate: (props: { items: MentionHit[]; clientRect?: (() => DOMRect | null) | null }) => {
            items = props.items;
            selected = 0;
            const rect = props.clientRect?.();
            if (rect && el) {
              el.style.left = `${rect.left}px`;
              el.style.top = `${rect.bottom + 4}px`;
            }
            paint();
          },
          onKeyDown: (props: { event: KeyboardEvent }) => {
            if (props.event.key === 'ArrowDown') {
              selected = (selected + 1) % Math.max(1, items.length);
              paint();
              return true;
            }
            if (props.event.key === 'ArrowUp') {
              selected = (selected - 1 + items.length) % Math.max(1, items.length);
              paint();
              return true;
            }
            if (props.event.key === 'Enter' && items[selected]) {
              command?.({ id: items[selected]!.id, label: items[selected]!.title });
              onMention(items[selected]!.id);
              return true;
            }
            if (props.event.key === 'Escape') {
              el?.remove();
              el = null;
              return true;
            }
            return false;
          },
          onExit: () => {
            el?.remove();
            el = null;
          },
        };
      },
    },
  });
}

export function BlockEditor({
  content,
  placeholder = 'Start writing…',
  onSave,
  onMention,
  reading,
  className,
  autofocus,
}: {
  content: string;
  placeholder?: string;
  onSave: (html: string, text: string) => void;
  onMention?: (id: string) => void;
  /** Journal presentation: 17px / 1.75 at a 680px measure. */
  reading?: boolean;
  className?: string;
  autofocus?: boolean;
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const save = useMemo(
    () =>
      debounce((editor: Editor) => {
        setStatus('saving');
        onSave(editor.getHTML(), editor.getText());
        setTimeout(() => setStatus('saved'), 200);
      }, 900),
    [onSave],
  );

  const editor = useEditor({
    immediatelyRender: false,
    autofocus,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      mentionExtension((id) => onMention?.(id)),
    ],
    content,
    editorProps: {
      attributes: {
        class: cn('tiptap outline-none', reading ? 't-read' : 't-body'),
      },
    },
    onUpdate: ({ editor }) => save(editor),
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) editor.commands.setContent(content, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  return (
    <div className={cn('relative', className)}>
      <EditorContent editor={editor} />
      <span
        aria-live="polite"
        className="t-micro pointer-events-none absolute right-0 top-0 text-ink-faint"
      >
        {status === 'saving' ? 'saving…' : status === 'saved' ? 'saved' : ''}
      </span>
    </div>
  );
}

export function WritingAssistant({
  text,
  personId,
  onResult,
}: {
  text: string;
  personId?: string;
  onResult: (next: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const actions = [
    ['improve', 'Improve'],
    ['shorter', 'Shorter'],
    ['warmer', 'Warmer'],
    ['professional', 'Professional'],
    ['casual', 'Casual'],
    ['clearer', 'Clearer'],
    ['sound_like_me', 'Sound like me'],
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-xs border-t border-hairline pt-md">
      {actions.map(([key, label]) => (
        <button
          key={key}
          disabled={busy !== null || !text.trim()}
          onClick={async () => {
            setBusy(key);
            try {
              const res = await api.post<{ text: string }>('/api/ai/rewrite', {
                text,
                action: key,
                ...(personId ? { personId } : {}),
              });
              onResult(res.text);
            } finally {
              setBusy(null);
            }
          }}
          className="t-button h-control-sm rounded-md px-sm text-ink-muted transition-colors duration-[120ms] hover:bg-surface-2 hover:text-ink disabled:text-ink-disabled"
        >
          {busy === key ? '…' : label}
        </button>
      ))}
    </div>
  );
}
