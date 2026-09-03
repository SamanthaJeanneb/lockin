'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useApp } from '@/lib/store';
import { api } from '@/lib/client-api';
import type { Extraction } from '@/lib/db/schema';
import { Dialog, IconButton, Textarea, useToast } from '@/components/ui';
import { VoiceRecorder } from './VoiceRecorder';
import { ExtractionReview } from './ExtractionReview';

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
  const [polling, setPolling] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const open = modal === 'capture';

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
    else {
      setCaptureId(null);
      setExtraction(null);
      setPolling(false);
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

  // Poll for the extraction. Ten attempts at 700ms covers the p95 budget.
  useEffect(() => {
    if (!polling || !captureId) return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      attempts++;
      const res = await api.get<{ processedAt: string | null; extraction: Extraction | null }>(
        `/api/capture/${captureId}`,
      );
      if (cancelled) return;
      if (res.processedAt) {
        setExtraction(res.extraction);
        setPolling(false);
        return;
      }
      if (attempts < 14) setTimeout(tick, 700);
      else {
        setPolling(false);
        setExtraction(null);
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
    if (captureId && extraction?.objects.length) {
      void api
        .post(`/api/capture/${captureId}/resolve`, {
          accept: extraction.objects.filter((o) => o.confidence >= 0.5).map((o) => o.tmp),
        })
        .then(() => toast.show('Added from your capture.'));
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
          loading={polling}
          onDone={(summary) => {
            toast.show(summary);
            close();
          }}
        />
      ) : (
        <div className="flex flex-col px-xl py-lg">
          <Textarea
            ref={inputRef}
            autoGrow
            rows={4}
            value={draft}
            placeholder="Met Alex at lunch, he's at OpenAI and interested in robotics. Follow up Tuesday."
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                e.preventDefault();
                void submit();
              }
            }}
            className="min-h-[120px] border-0 p-0 focus:border-0"
          />

          <div className="mt-lg flex items-center justify-between border-t border-hairline pt-md">
            <span className="t-caption text-ink-faint">↵ to capture · ⇧↵ for a new line</span>
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
