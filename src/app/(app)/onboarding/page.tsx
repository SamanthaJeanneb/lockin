'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import { DEFAULT_AREAS, HORIZONS, HORIZON_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Button, Divider, Input, Meta, Select, Textarea, useToast } from '@/components/ui';

const STEPS = ['Who you are', 'Three goals', 'First capture', 'Connect something'] as const;

/** Four screens. Every one skippable — the product has no required fields
 *  anywhere else either. */
export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [identity, setIdentity] = useState('');
  const [priority, setPriority] = useState<string[]>([...DEFAULT_AREAS].slice(0, 5));
  const [goals, setGoals] = useState([
    { title: '', area: 'career', horizon: '1y' },
    { title: '', area: 'finance', horizon: '1y' },
    { title: '', area: 'health', horizon: '3m' },
  ]);
  const [capture, setCapture] = useState('');

  const finish = useMutation({
    mutationFn: async () => {
      await api.patch('/api/settings', {
        identityStatement: identity || null,
        areaPriority: priority,
        onboarded: true,
      });
      for (const g of goals.filter((g) => g.title.trim())) {
        await api.post('/api/objects', {
          type: 'goal',
          title: g.title,
          area: g.area,
          horizon: g.horizon,
          status: 'active',
        });
      }
      if (capture.trim()) {
        await api.post('/api/capture', { rawText: capture, channel: 'app' });
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.show('You&rsquo;re set up.');
      router.push('/');
    },
  });

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[640px] flex-col justify-center p-xl">
      <nav className="mb-lg flex gap-xs" aria-label="Onboarding progress">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn('h-[3px] flex-1 rounded-full', i <= step ? 'bg-ink' : 'bg-surface-3')}
          />
        ))}
      </nav>

      <h1 className="t-display">{STEPS[step]}</h1>

      {step === 0 ? (
        <div className="mt-lg flex flex-col gap-md">
          <Meta>
            One sentence at the top of the tree. It is the thing every goal beneath it is supposed
            to serve.
          </Meta>
          <Textarea
            autoFocus
            rows={2}
            value={identity}
            placeholder="Build ambitious things, stay free, stay connected."
            onChange={(e) => setIdentity(e.target.value)}
          />
          <Divider clearance="sm" />
          <Meta>
            Rank your life areas. This is what the drift view compares your actual effort against —
            and the only place the system will ever tell you that you are not doing what you said.
          </Meta>
          <div className="flex flex-col">
            {priority.map((key, i) => (
              <div key={key} className="flex h-row items-center gap-sm border-b border-hairline px-xs">
                <span className="t-numeric w-[20px] text-ink-subtle tabular">{i + 1}</span>
                <span className="t-body-sm flex-1">{key}</span>
                <Button
                  size="sm"
                  disabled={i === 0}
                  onClick={() =>
                    setPriority((p) => {
                      const n = [...p];
                      [n[i - 1], n[i]] = [n[i]!, n[i - 1]!];
                      return n;
                    })
                  }
                >
                  Up
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="mt-lg flex flex-col gap-md">
          <Meta>Three is enough to start. A goal is a sentence — everything else is inferred.</Meta>
          {goals.map((g, i) => (
            <div key={i} className="flex gap-sm">
              <Input
                autoFocus={i === 0}
                value={g.title}
                placeholder={
                  i === 0 ? 'Get a design engineering role' : i === 1 ? '$1M invested by 35' : 'Run a marathon'
                }
                onChange={(e) =>
                  setGoals((s) => s.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                }
              />
              <Select
                ariaLabel="Area"
                value={g.area}
                onChange={(v) => setGoals((s) => s.map((x, j) => (j === i ? { ...x, area: v } : x)))}
                options={DEFAULT_AREAS.map((a) => ({ value: a, label: a }))}
                className="w-[130px]"
              />
              <Select
                ariaLabel="Horizon"
                value={g.horizon}
                onChange={(v) => setGoals((s) => s.map((x, j) => (j === i ? { ...x, horizon: v } : x)))}
                options={HORIZONS.map((h) => ({ value: h, label: HORIZON_LABEL[h] }))}
                className="w-[130px]"
              />
            </div>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-lg flex flex-col gap-md">
          <Meta>
            Type anything — a sentence about your day, a person you met, something you need to do.
            This is the field you will use every day.
          </Meta>
          <Textarea
            autoFocus
            rows={4}
            value={capture}
            placeholder="Met Alex at lunch, he's at OpenAI and interested in robotics. Follow up Tuesday."
            onChange={(e) => setCapture(e.target.value)}
          />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-lg flex flex-col gap-md">
          <Meta>
            Optional, and you can do it later. A calendar makes the Today ranking aware of your
            real free time; a bank account makes the money screens live.
          </Meta>
          <div className="flex flex-wrap gap-sm">
            <Button onClick={() => (window.location.href = '/api/integrations/google/start')}>
              Connect Google Calendar
            </Button>
            <Button onClick={() => router.push('/money')}>Connect a bank</Button>
          </div>
        </div>
      ) : null}

      <div className="mt-xl flex items-center gap-sm">
        <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <>
            <Button variant="primary" onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
            <Button onClick={() => setStep((s) => s + 1)}>Skip</Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => finish.mutate()} disabled={finish.isPending}>
            Start using it
          </Button>
        )}
      </div>
    </div>
  );
}
