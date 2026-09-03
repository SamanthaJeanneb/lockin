'use client';
import { useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { IconButton } from '@/components/ui';

/** MediaRecorder → /api/transcribe → text dropped into the field to read
 *  before saving. Never auto-submits — you always see it first. */
export function VoiceRecorder({ onText }: { onText: (text: string) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState('transcribing');
        const blob = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' });
        const form = new FormData();
        form.append('audio', blob, 'capture.webm');
        try {
          const res = await fetch('/api/transcribe', { method: 'POST', body: form });
          const data = (await res.json()) as { text?: string; error?: string };
          if (data.text) onText(data.text);
        } finally {
          setState('idle');
        }
      };
      mr.start();
      recorder.current = mr;
      setState('recording');
    } catch {
      setState('idle');
    }
  }

  return (
    <IconButton
      label={state === 'recording' ? 'Stop recording' : 'Record voice note'}
      disabled={state === 'transcribing'}
      onClick={() => (state === 'recording' ? recorder.current?.stop() : void start())}
      className={state === 'recording' ? 'bg-surface-2 text-ink' : ''}
    >
      {state === 'recording' ? <Square size={14} strokeWidth={1.5} /> : <Mic size={16} strokeWidth={1.5} />}
    </IconButton>
  );
}
