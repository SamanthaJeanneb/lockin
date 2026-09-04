'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useApp } from '@/lib/store';
import { api } from '@/lib/client-api';
import type { Extraction } from '@/lib/db/schema';
import { Dialog, IconButton, useToast } from '@/components/ui';
import { MentionTextarea, type MentionTextareaHandle } from './MentionTextarea';
import { VoiceRecorder } from './VoiceRecorder';
import { ExtractionReview, type ReferencedObject } from './ExtractionReview';

/**
 * Save is instant — raw text hits the database immediately and the request
 * returns in under 100ms. Extraction lands one or two seconds later and replaces
 * the modal contents in place.
 */
export function CaptureModal() {
  const modal = useApp((s) => s.modal);
  const draft = useApp((s) => s.captureDraft);
  const setDraft = useApp((s) => s.setCaptureDraft);
  const close = useApp((s) => s.closeModal);
  const toast = useToast();

  const [captureId, setCaptureId] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [referenced, setReferenced] = useState<ReferencedObject[]>([]);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<MentionTextareaHandle>(null);
  const open = modal === 'capture';

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
    else {
      setCaptureId(null);
      setExtraction(null);
      setPolling(false);
      setError(null);
      setElapsed(0);
      setReferenced([]);
    }
  }, [open]);

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    const res = await api.post<{ captureId: string }>('/api/capture', {
      channel: 'app',
      rawText: text,
    });
    setCaptureId(res.captureId);
    setDraft('');
    setPolling(true);
  }, [draft, setDraft]);

  /**
   * Poll until the server says it is done, or a minute passes.
   *
   * The previous budget was ten seconds, which was under the real extraction
   * time — so the poller gave up, the review card fell through to its empty
   * state, and the only button left said "Keep as note". Every capture looked
   * like it had been filed as a note when in fact the objects were sitting in
   * the row, extracted and unread.
   */
  useEffect(() => {
    if (!polling || !captureId) return;
    let cancelled = false;
    const startedAt = Date.now();
    const LIMIT_MS = 60_000;

    const tick = async () => {
      try {
        const res = await api.get<{
          processedAt: string | null;
          extraction: Extraction | null;
          referenced: ReferencedObject[];
          error: string | null;
        }>(`/api/capture/${captureId}`);
        if (cancelled) return;

        if (res.processedAt || res.error) {
          setExtraction(res.extraction);
          setReferenced(res.referenced ?? []);
          setError(res.error);
          setPolling(false);
          return;
        }
      } catch {
        // A transient failure mid-poll is not a reason to give up.
      }
      if (cancelled) return;

      if (Date.now() - startedAt < LIMIT_MS) {
        setElapsed(Math.round((Date.now() - startedAt) / 1000));
        setTimeout(tick, 800);
      } else {
        setPolling(false);
        setError('Extraction is taking longer than a minute. Your text is saved — reopen this capture from Brain to see what it found.');
      }
    };

    const t = setTimeout(tick, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [polling, captureId]);

  // Dismissing means accepting.
  const handleOpenChange = (next: boolean) => {
    if (next) return;
    const hasSomething =
      (extraction?.objects.length ?? 0) > 0 || (extraction?.completions.length ?? 0) > 0;
    if (captureId && hasSomething) {
      void api
        .post<{ summary: string[] }>(`/api/capture/${captureId}/resolve`, {
          accept: extraction!.objects.filter((o) => o.confidence >= 0.5).map((o) => o.tmp),
          complete: extraction!.completions.filter((c) => c.confidence >= 0.85).map((c) => c.object_id),
          expenses: extraction!.expenses.map((_, i) => i),
        })
        .then((r) => toast.show(r.summary.join(' · ') || 'Added from your capture.'));
    }
    close();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={captureId ? 'What I found' : 'Capture'}
      description={captureId ? undefined : 'One field. Type anything.'}
      size="md"
    >
      {captureId ? (
        <ExtractionReview
          captureId={captureId}
          extraction={extraction}
          referenced={referenced}
          loading={polling}
          elapsed={elapsed}
          error={error}
          onDone={(summary) => {
            toast.show(summary);
            close();
          }}
        />
      ) : (
        <div className="flex flex-col px-xl py-lg">
          <MentionTextarea
            ref={inputRef}
            rows={4}
            value={draft}
            placeholder="Send @Jordan the meeting notes before Friday."
            onChange={setDraft}
            onSubmit={() => void submit()}
            className="min-h-[120px] border-0 p-0 focus:border-0"
          />

          <div className="mt-lg flex items-center justify-between border-t border-hairline pt-md">
            <span className="t-caption text-ink-faint">
              ↵ to capture · ⇧↵ for a new line · @ to mention
            </span>
            <div className="flex items-center gap-xs">
              <VoiceRecorder onText={(t) => setDraft(draft ? `${draft}\n${t}` : t)} />
              <IconButton label="Attach a file" onClick={() => document.getElementById('capture-file')?.click()}>
                <Paperclip size={16} strokeWidth={1.5} />
              </IconButton>
              <input
                id="capture-file"
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.append('file', file);
                  const res = await fetch('/api/upload', { method: 'POST', body: form });
                  const data = (await res.json()) as { text?: string; filename?: string };
                  setDraft((draft ? `${draft}\n` : '') + (data.text ?? `Attached ${data.filename}`));
                }}
              />
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
