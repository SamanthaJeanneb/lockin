'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { useApp } from '@/lib/store';
import { api } from '@/lib/client-api';
import { debounce } from '@/lib/utils';
import { Icon, Kbd } from '@/components/ui';
import { iconFor } from './ObjectDetail';
import { NAV, NAV_SECONDARY } from '@/components/shell/Sidebar';
import { useContextPane } from '@/hooks/useContextPane';

interface SearchHit {
  id: string;
  type: string;
  title: string;
  area: string | null;
}

/**
 * One field, three jobs. A sentence captures. A fragment searches. A verb
 * surfaces commands. You never have to know which one you wanted.
 */
export function CommandPalette() {
  const modal = useApp((s) => s.modal);
  const close = useApp((s) => s.closeModal);
  const openModal = useApp((s) => s.openModal);
  const [value, setValue] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [answer, setAnswer] = useState<string | null>(null);
  const router = useRouter();
  const { open: openContext } = useContextPane();
  const isOpen = modal === 'palette';

  const search = useMemo(
    () =>
      debounce(async (q: string) => {
        if (q.trim().length < 2) {
          setHits([]);
          return;
        }
        const res = await api.post<{ results: SearchHit[]; answer?: string }>('/api/search', {
          query: q,
        });
        setHits(res.results);
        setAnswer(res.answer ?? null);
      }, 220),
    [],
  );

  useEffect(() => {
    if (!isOpen) {
      setValue('');
      setHits([]);
      setAnswer(null);
    }
  }, [isOpen]);

  useEffect(() => {
    search(value);
  }, [value, search]);

  // A sentence — verbs, length, punctuation — means capture is the default.
  const looksLikeSentence = value.trim().split(/\s+/).length >= 4 || /[.,!?;]/.test(value);

  const commands = [
    ...NAV.concat(NAV_SECONDARY).map((n) => ({
      key: `go-${n.href}`,
      label: `Go to ${n.label}`,
      icon: n.icon,
      run: () => router.push(n.href),
    })),
    { key: 'new-task', label: 'New task', icon: 'Circle', run: () => openModal('capture') },
    { key: 'debrief', label: 'Debrief today', icon: 'MoonStar', run: () => openModal('debrief') },
    { key: 'shortcuts', label: 'Keyboard shortcuts', icon: 'Keyboard', run: () => openModal('shortcuts') },
  ];

  function run(fn: () => void) {
    close();
    setTimeout(fn, 0);
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="anim-overlay fixed inset-0 z-40 bg-scrim" onClick={close} />
      <Command
        label="Command palette"
        loop
        className="anim-modal fixed left-1/2 top-[12vh] z-50 w-[92vw] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-lg border border-hairline bg-canvas shadow-modal"
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            run(() => openModal('capture', value));
          }
        }}
      >
        <div className="flex items-center gap-sm border-b border-hairline px-md">
          <Kbd>⌘</Kbd>
          <Command.Input
            autoFocus
            value={value}
            onValueChange={setValue}
            placeholder="Search, capture, or type a command…"
            className="t-body h-[46px] flex-1 bg-transparent text-ink outline-none placeholder:text-ink-faint"
          />
        </div>

        <Command.List className="max-h-[52vh] overflow-y-auto p-xs">
          {value.trim() ? (
            <Command.Group heading={<GroupLabel>Capture</GroupLabel>}>
              <Item
                icon="Plus"
                label={`Capture “${value.length > 48 ? `${value.slice(0, 48)}…` : value}”`}
                hint="↵"
                onSelect={() => run(() => openModal('capture', value))}
              />
            </Command.Group>
          ) : null}

          {answer ? (
            <Command.Group heading={<GroupLabel>Answer</GroupLabel>}>
              <div className="t-body-sm px-sm py-sm text-ink-muted">{answer}</div>
            </Command.Group>
          ) : null}

          {hits.length ? (
            <Command.Group heading={<GroupLabel>Results</GroupLabel>}>
              {hits.map((h) => (
                <Item
                  key={h.id}
                  icon={iconFor(h.type)}
                  label={h.title}
                  hint={h.type.replace('_', ' ')}
                  onSelect={() => run(() => openContext(h.id))}
                />
              ))}
            </Command.Group>
          ) : null}

          {!looksLikeSentence ? (
            <Command.Group heading={<GroupLabel>Commands</GroupLabel>}>
              {commands.map((c) => (
                <Item key={c.key} icon={c.icon} label={c.label} onSelect={() => run(c.run)} />
              ))}
            </Command.Group>
          ) : null}

          <Command.Empty className="t-body-sm px-sm py-lg text-ink-subtle">
            Press ↵ to capture this.
          </Command.Empty>
        </Command.List>
      </Command>
    </>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <span className="t-micro px-sm text-ink-subtle">{children}</span>;
}

function Item({
  icon,
  label,
  hint,
  onSelect,
}: {
  icon: string;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="t-body-sm flex h-control-lg cursor-default select-none items-center gap-sm rounded-sm px-sm text-ink data-[selected=true]:bg-surface-2"
    >
      <span className="text-ink-subtle">
        <Icon name={icon} size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint ? <span className="t-micro text-ink-faint">{hint}</span> : null}
    </Command.Item>
  );
}
