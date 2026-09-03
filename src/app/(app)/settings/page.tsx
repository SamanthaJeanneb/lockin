'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import { useApp } from '@/lib/store';
import { relative } from '@/lib/format';
import { supabaseBrowser } from '@/lib/supabase/browser';
import {
  Button, Divider, FieldRow, Input, InlineField, Meta, SectionHeader, Segmented, Skeleton, useToast,
} from '@/components/ui';

interface SettingsData {
  user: { id: string; email: string; name: string | null; timezone: string; identityStatement: string | null };
  settings: {
    notify: Record<string, unknown>;
    ai: Record<string, unknown>;
    privacy: Record<string, unknown>;
    areaPriority: string[];
  };
  areas: { id: string; key: string; label: string; priority: number | null }[];
  integrations: { id: string; kind: string; status: string; lastSyncAt: string | null; error: string | null }[];
  available: Record<string, boolean>;
}

const CAPABILITIES = [
  ['extract', 'Turn captures into objects'],
  ['categorize', 'Categorise transactions'],
  ['recommend', 'Rank what to do today'],
  ['draft', 'Write drafts for you'],
  ['schedule', 'Suggest times on your calendar'],
  ['reach_out', 'Draft messages to people'],
] as const;

const LEVELS = [
  { value: 'observe', label: 'Observe' },
  { value: 'suggest', label: 'Suggest' },
  { value: 'draft', label: 'Draft' },
  { value: 'execute', label: 'Execute' },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const ui = useApp((s) => s.ui);
  const setUi = useApp((s) => s.setUi);
  const [voiceSample, setVoiceSample] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsData>('/api/settings'),
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch('/api/settings', patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      toast.show('Saved');
    },
  });

  // The theme is mirrored into a cookie so the pre-paint script can read it.
  useEffect(() => {
    document.cookie = `lockin_theme=${ui.theme};path=/;max-age=31536000;samesite=lax`;
    document.cookie = `lockin_density=${ui.density};path=/;max-age=31536000;samesite=lax`;
  }, [ui.theme, ui.density]);

  if (isLoading || !data) return <Skeleton className="m-xl h-[400px]" />;

  const ai = data.settings.ai as { permission?: string; capabilities?: Record<string, string>; voice_samples?: string[] };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[760px] flex-col p-xl">
      <h1 className="t-display mb-lg">Settings</h1>

      <SectionHeader title="You" size="heading-sm" as="h2" />
      <div className="flex flex-col gap-xxs">
        <FieldRow label="Name">
          <InlineField label="Name" value={data.user.name ?? ''} onSave={(v) => save.mutate({ name: v })} />
        </FieldRow>
        <FieldRow label="Email">
          <span className="t-body-sm text-ink-muted">{data.user.email}</span>
        </FieldRow>
        <FieldRow label="Timezone">
          <InlineField label="Timezone" value={data.user.timezone} onSave={(v) => save.mutate({ timezone: v })} />
        </FieldRow>
        <FieldRow label="Identity">
          <InlineField
            multiline
            label="Identity statement"
            value={data.user.identityStatement ?? ''}
            placeholder="Build ambitious things, stay free, stay connected."
            onSave={(v) => save.mutate({ identityStatement: v })}
          />
        </FieldRow>
      </div>

      <Divider clearance="lg" />

      <SectionHeader title="Appearance" size="heading-sm" as="h2" />
      <div className="flex flex-col gap-md">
        <FieldRow label="Theme">
          <Segmented
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
            value={ui.theme}
            onChange={(v) => setUi({ theme: v })}
            size="sm"
          />
        </FieldRow>
        <FieldRow label="Density">
          <Segmented
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
            value={ui.density}
            onChange={(v) => setUi({ density: v })}
            size="sm"
          />
        </FieldRow>
      </div>

      <Divider clearance="lg" />

      <SectionHeader title="Life area priority" size="heading-sm" as="h2" />
      <Meta className="mb-sm block">
        The order you state here is what the drift view compares your actual effort against.
      </Meta>
      <div className="flex flex-col">
        {data.settings.areaPriority.map((key, i) => (
          <div key={key} className="flex h-row items-center gap-sm border-b border-hairline px-xs">
            <span className="t-numeric w-[20px] text-ink-subtle tabular">{i + 1}</span>
            <span className="t-body-sm flex-1">{key}</span>
            <Button
              size="sm"
              disabled={i === 0}
              onClick={() => {
                const next = [...data.settings.areaPriority];
                [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                save.mutate({ areaPriority: next });
              }}
            >
              Up
            </Button>
            <Button
              size="sm"
              disabled={i === data.settings.areaPriority.length - 1}
              onClick={() => {
                const next = [...data.settings.areaPriority];
                [next[i + 1], next[i]] = [next[i]!, next[i + 1]!];
                save.mutate({ areaPriority: next });
              }}
            >
              Down
            </Button>
          </div>
        ))}
      </div>

      <Divider clearance="lg" />

      <SectionHeader title="What the assistant may do" size="heading-sm" as="h2" />
      <Meta className="mb-sm block">
        Observe reads only. Suggest proposes. Draft writes but never sends. Execute acts.
      </Meta>
      <div className="flex flex-col gap-sm">
        {CAPABILITIES.map(([key, label]) => (
          <FieldRow key={key} label={label} className="items-center">
            <Segmented
              options={LEVELS}
              value={(ai.capabilities?.[key] ?? ai.permission ?? 'suggest') as never}
              onChange={(v) =>
                save.mutate({
                  ai: { ...ai, capabilities: { ...(ai.capabilities ?? {}), [key]: v } },
                })
              }
              size="sm"
            />
          </FieldRow>
        ))}
      </div>

      <Divider clearance="lg" />

      <SectionHeader title="Your writing voice" size="heading-sm" as="h2" />
      <Meta className="mb-sm block">
        Paste something you wrote. “Sound like me” matches these samples and nothing else.
      </Meta>
      <div className="flex gap-sm">
        <Input
          value={voiceSample}
          placeholder="Paste a message or a paragraph you wrote…"
          onChange={(e) => setVoiceSample(e.target.value)}
        />
        <Button
          variant="primary"
          disabled={!voiceSample.trim()}
          onClick={() => {
            save.mutate({ ai: { ...ai, voice_samples: [...(ai.voice_samples ?? []), voiceSample] } });
            setVoiceSample('');
          }}
        >
          Add
        </Button>
      </div>
      {(ai.voice_samples ?? []).length ? (
        <Meta className="mt-sm block">{(ai.voice_samples ?? []).length} samples stored.</Meta>
      ) : null}

      <Divider clearance="lg" />

      <SectionHeader title="Integrations" size="heading-sm" as="h2" />
      <div className="flex flex-col">
        {Object.entries(data.available).map(([key, on]) => {
          const live = data.integrations.find((i) => i.kind.startsWith(key.slice(0, 6)));
          return (
            <div key={key} className="flex h-row items-center gap-sm border-b border-hairline px-xs">
              <span className="t-body-sm w-[160px] shrink-0">{humanize(key)}</span>
              <Meta className="flex-1">
                {!on
                  ? 'no key configured'
                  : live
                    ? `${live.status}${live.lastSyncAt ? ` · synced ${relative(live.lastSyncAt)}` : ''}`
                    : 'ready to connect'}
                {live?.error ? ` · ${live.error}` : ''}
              </Meta>
              {key === 'googleCalendar' && on && !live ? (
                <Button size="sm" onClick={() => (window.location.href = '/api/integrations/google/start')}>
                  Connect
                </Button>
              ) : null}
              {key === 'push' && on ? <PushButton /> : null}
            </div>
          );
        })}
      </div>

      <Divider clearance="lg" />

      <SectionHeader title="Data" size="heading-sm" as="h2" />
      <div className="flex flex-wrap gap-sm">
        <Button asChild>
          <a href="/api/export?format=json" download>
            Export JSON
          </a>
        </Button>
        <Button asChild>
          <a href="/api/export?format=markdown" download>
            Export Markdown
          </a>
        </Button>
        <Button
          onClick={async () => {
            await supabaseBrowser().auth.signOut();
            window.location.href = '/login';
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}

function PushButton() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            toast.show('Notifications blocked — email is the fallback.');
            return;
          }
          const reg = await navigator.serviceWorker.register('/sw.js');
          const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key,
          });
          await api.post('/api/push/subscribe', {
            ...sub.toJSON(),
            userAgent: navigator.userAgent,
          });
          toast.show('Notifications on for this browser');
        } catch (e) {
          toast.show(e instanceof Error ? e.message : 'Could not subscribe');
        } finally {
          setBusy(false);
        }
      }}
    >
      Enable
    </Button>
  );
}

function humanize(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
