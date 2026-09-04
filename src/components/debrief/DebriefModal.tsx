'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/lib/store';
import { api, type DebriefResult, type SerializedObject } from '@/lib/client-api';
import { debounce } from '@/lib/utils';
import { Button, Checkbox, Dialog, Icon, Meta, SectionHeader, Skeleton, Textarea } from '@/components/ui';
import { MentionTextarea } from '@/components/capture/MentionTextarea';
import { VoiceRecorder } from '@/components/capture/VoiceRecorder';
import { iconFor } from '@/components/composite/ObjectDetail';

const MOODS = ['rough', 'flat', 'fine', 'good', 'great'] as const;

/**
 * Two columns at ≥768px: you write on the left, the system shows what it
 * understood on the right, updating as you type. The manual checklist beneath
 * the writing area is always present and stays in sync — you can ignore the
 * text box entirely.
 */
export function DebriefModal() {
  const modal = useApp((s) => s.modal);
  const close = useApp((s) => s.closeModal);
  const open = modal === 'debrief';
  const qc = useQueryClient();

  const [text, setText] = useState('');
  const [result, setResult] = useState<DebriefResult | null>(null);
  const [matching, setMatching] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [newAccepted, setNewAccepted] = useState<Set<string>>(new Set());
  const [mood, setMood] = useState<string | null>(null);
  const [tomorrow, setTomorrow] = useState('');
  const [summary, setSummary] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);

  const { data: openItems } = useQuery({
    queryKey: ['debrief-open'],
    queryFn: () =>
      api.get<{ objects: SerializedObject[] }>(
        '/api/objects?type=task&type=habit&type=milestone&completed=false&status=today&status=doing&status=next',
      ),
    enabled: open,
  });

  const runMatch = useMemo(
    () =>
      debounce(async (value: string) => {
        if (value.trim().length < 8) {
          setResult(null);
          setMatching(false);
          return;
        }
        try {
          const res = await api.post<DebriefResult>('/api/debrief', { text: value });
          setResult(res);
          setChecked(new Set(res.matches.filter((m) => m.score >= 0.85).map((m) => m.id)));
          setNewAccepted(new Set(res.newObjects.map((n) => n.tmp)));
        } finally {
          setMatching(false);
        }
      }, 600),
    [],
  );

  useEffect(() => {
    if (!open) {
      setText('');
      setResult(null);
      setChecked(new Set());
      setRejected(new Set());
      setSummary(null);
      setMood(null);
      setTomorrow('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setMatching(text.trim().length >= 8);
    runMatch(text);
  }, [text, open, runMatch]);

  const toggle = useCallback((id: string) => {
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function confirm() {
    setConfirming(true);
    try {
      const res = await api.post<{ summary: string[]; deltas: Record<string, number> }>(
        '/api/debrief/confirm',
        {
          captureId: result?.captureId ?? null,
          text,
          completed: [...checked],
          notDone: (result?.notDone ?? []).filter((n) => !rejected.has(n.id)),
          newObjects: [...newAccepted],
          expenses: result?.expenses ?? [],
          journal: result?.journal ?? (text.trim() ? { body: text, mood, themes: [] } : null),
          mood,
          tomorrow,
        },
      );
      setSummary(res.summary);
      void qc.invalidateQueries({ queryKey: ['objects'] });
      void qc.invalidateQueries({ queryKey: ['today'] });
      void qc.invalidateQueries({ queryKey: ['areas'] });
      setTimeout(close, 3000);
    } finally {
      setConfirming(false);
    }
  }

  const highConfidence = (result?.matches ?? []).filter((m) => m.score >= 0.85);
  const midConfidence = (result?.matches ?? []).filter((m) => m.score >= 0.5 && m.score < 0.85);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close()}
      title="How did today go?"
      size="lg"
      footer={
        summary ? null : (
          <>
            <span className="t-caption mr-auto text-ink-faint">⌘↵ to confirm</span>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={() => void confirm()} disabled={confirming}>
              Confirm
            </Button>
          </>
        )
      }
    >
      {summary ? (
        <div className="flex flex-col gap-xs px-xl py-xl">
          {summary.map((line) => (
            <p key={line} className="t-body">
              {line}
            </p>
          ))}
        </div>
      ) : (
        <div
          className="grid grid-cols-1 tablet:grid-cols-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void confirm();
            }
          }}
        >
          {/* Left: you write */}
          <div className="flex flex-col border-hairline px-xl py-lg tablet:border-r">
            <MentionTextarea
              autoFocus
              rows={8}
              value={text}
              placeholder="Finished the report and sent it. Went for a run. Caught up with @Jordan…"
              onChange={setText}
              className="min-h-[160px] border-0 p-0 focus:border-0"
            />
            <div className="mt-sm flex justify-end">
              <VoiceRecorder onText={(t) => setText(text ? `${text} ${t}` : t)} />
            </div>

            <div className="mt-lg border-t border-hairline pt-md">
              <SectionHeader title="Or check them off yourself" size="micro" as="h3" />
              <div className="flex flex-col">
                {(openItems?.objects ?? []).map((o) => (
                  <label
                    key={o.id}
                    className="flex h-row cursor-default items-center gap-sm rounded-sm px-xs hover:bg-surface-1"
                  >
                    <Checkbox
                      checked={checked.has(o.id)}
                      label={`Completed ${o.title}`}
                      onCheckedChange={() => toggle(o.id)}
                    />
                    <span className="t-body-sm truncate">{o.title}</span>
                  </label>
                ))}
                {!openItems?.objects.length ? <Meta>Nothing open today.</Meta> : null}
              </div>
            </div>

            <div className="mt-lg border-t border-hairline pt-md">
              <SectionHeader title="How are you feeling?" size="micro" as="h3" />
              <div className="flex flex-wrap gap-xs">
                {MOODS.map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={mood === m ? 'secondary' : 'ghost'}
                    onClick={() => setMood(mood === m ? null : m)}
                  >
                    {m}
                  </Button>
                ))}
              </div>
              <Textarea
                rows={2}
                value={tomorrow}
                placeholder="Anything for tomorrow?"
                onChange={(e) => setTomorrow(e.target.value)}
                className="mt-sm"
              />
            </div>
          </div>

          {/* Right: what it understood */}
          <div className="flex flex-col px-xl py-lg">
            <SectionHeader title="What I matched" size="micro" as="h3" />

            {matching ? (
              <div className="flex flex-col gap-xs">
                <Skeleton className="h-row w-full" />
                <Skeleton className="h-row w-4/5" />
              </div>
            ) : null}

            {!matching && !result ? (
              <Meta>Start writing and matches appear here.</Meta>
            ) : null}

            {highConfidence.length ? (
              <>
                <p className="t-micro mt-md text-ink-subtle">Done</p>
                {highConfidence.map((m) => (
                  <MatchRow key={m.id} m={m} checked={checked.has(m.id)} onToggle={() => toggle(m.id)} />
                ))}
              </>
            ) : null}

            {midConfidence.length ? (
              <>
                <p className="t-micro mt-md text-ink-subtle">Not sure</p>
                {midConfidence.map((m) => (
                  <MatchRow key={m.id} m={m} checked={checked.has(m.id)} onToggle={() => toggle(m.id)} />
                ))}
              </>
            ) : null}

            {result?.notDone.length ? (
              <>
                <p className="t-micro mt-md text-ink-subtle">Not done</p>
                {result.notDone.map((n) => (
                  <div key={n.id} className="flex h-row items-center gap-sm px-xs">
                    <Checkbox
                      shape="square"
                      checked={!rejected.has(n.id)}
                      label={`Snooze ${n.title}`}
                      onCheckedChange={(v) =>
                        setRejected((s) => {
                          const next = new Set(s);
                          if (v) next.delete(n.id);
                          else next.add(n.id);
                          return next;
                        })
                      }
                    />
                    <span className="t-body-sm truncate">{n.title}</span>
                    <Meta className="ml-auto">→ {n.snoozeTo}</Meta>
                  </div>
                ))}
              </>
            ) : null}

            {result?.newObjects.length || result?.expenses.length || result?.journal ? (
              <>
                <p className="t-micro mt-md text-ink-subtle">New</p>
                {result.newObjects.map((n) => (
                  <div key={n.tmp} className="flex h-row items-center gap-sm px-xs">
                    <Checkbox
                      shape="square"
                      checked={newAccepted.has(n.tmp)}
                      label={`Create ${n.title}`}
                      onCheckedChange={(v) =>
                        setNewAccepted((s) => {
                          const next = new Set(s);
                          if (v) next.add(n.tmp);
                          else next.delete(n.tmp);
                          return next;
                        })
                      }
                    />
                    <span className="text-ink-subtle">
                      <Icon name={iconFor(n.type)} size={14} />
                    </span>
                    <span className="t-body-sm truncate">{n.title}</span>
                  </div>
                ))}
                {result.expenses.map((e, i) => (
                  <div key={i} className="flex h-row items-center gap-sm px-xs">
                    <span className="text-ink-subtle">
                      <Icon name="Receipt" size={14} />
                    </span>
                    <span className="t-body-sm truncate">
                      ${e.amount} {e.merchant}
                    </span>
                    <Meta className="ml-auto">{e.category}</Meta>
                  </div>
                ))}
                {result.journal ? (
                  <div className="flex h-row items-center gap-sm px-xs">
                    <span className="text-ink-subtle">
                      <Icon name="BookOpen" size={14} />
                    </span>
                    <span className="t-body-sm">Journal entry</span>
                    {result.journal.themes.length ? (
                      <Meta className="ml-auto truncate">{result.journal.themes.join(' · ')}</Meta>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      )}
    </Dialog>
  );
}

function MatchRow({
  m,
  checked,
  onToggle,
}: {
  m: { id: string; title: string; score: number; effect?: string | null; value?: number | null; unit?: string | null };
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col border-b border-hairline py-xs">
      <div className="flex items-center gap-sm">
        <Checkbox checked={checked} label={`Complete ${m.title}`} onCheckedChange={onToggle} />
        <span className="t-body-sm min-w-0 flex-1 truncate">{m.title}</span>
        <span className="t-micro shrink-0 text-ink-subtle tabular">{Math.round(m.score * 100)}%</span>
      </div>
      {m.effect ? <Meta className="ml-xl">→ {m.effect}</Meta> : null}
      {m.value != null ? (
        <Meta className="ml-xl">
          {m.value} {m.unit ?? ''}
        </Meta>
      ) : null}
      {m.score < 0.85 ? <Meta className="ml-xl">low confidence — left unchecked</Meta> : null}
    </div>
  );
}
