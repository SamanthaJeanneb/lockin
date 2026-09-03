'use client';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/client-api';
import { formatMoney, formatMoneyCompact, formatPercent, formatShortDate } from '@/lib/format';
import { AREA_SERIES, SPEND_CATEGORIES, type Trajectory } from '@/lib/constants';
import { useContextPane } from '@/hooks/useContextPane';
import { MetricTile } from '@/components/views/MetricTile';
import { BarChart, LineChart } from '@/components/charts/Chart';
import { DataTable, type Column } from '@/components/views/DataTable';
import {
  Button, Divider, EmptyState, Input, Meta, ProgressBar, SectionHeader, Segmented, Skeleton,
  TrajectoryChip, useToast,
} from '@/components/ui';

interface Dashboard {
  metrics: {
    netWorth: number; cash: number; investments: number; debt: number;
    income: number; spending: number; savingsRate: number;
    runwayMonths: number; spendingDelta: number;
  };
  history: { netWorth: { at: string; value: number }[]; flows: { month: string; income: number; spending: number }[] };
  accounts: { id: string; name: string; kind: string; balanceCurrent: string | null; institution: string | null }[];
  spendingCategories: { category: string; total: number; count: number; average3m: number; deltaPercent: number }[];
  anomalies: { category: string; total: number; deltaPercent: number }[];
  recurring: { merchant: string; amount: number; cadence: string; lastChargedAt: string; occurrences: number }[];
  goals: {
    id: string; title: string; dueAt: string | null; progress: number;
    requiredMonthly: number; actualMonthly: number; shortfall: number;
    projected: number; projectedDate: string | null; monthsLate: number | null; onTrack: boolean;
  }[];
  debtPlan: { paidOff: { id: string; name: string; months: number; interest: number }[]; totalInterest: number } | null;
}

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'spending', label: 'Spending' },
  { value: 'goals', label: 'Goals' },
  { value: 'whatif', label: 'What-if' },
  { value: 'accounts', label: 'Accounts' },
];

export default function MoneyPage() {
  const [tab, setTab] = useState('overview');
  const [reality, setReality] = useState(false);
  const { open } = useContextPane();

  const { data, isLoading } = useQuery({
    queryKey: ['money-dashboard'],
    queryFn: () => api.get<Dashboard>('/api/money/dashboard'),
  });

  return (
    <div className="flex min-h-full flex-col p-xl">
      <header className="mb-lg flex flex-wrap items-center justify-between gap-md">
        <h1 className="t-display">Money</h1>
        <Segmented options={TABS} value={tab as never} onChange={setTab} size="sm" />
      </header>

      {isLoading ? (
        <Skeleton className="h-[320px] w-full" />
      ) : tab === 'overview' ? (
        <Overview data={data!} />
      ) : tab === 'spending' ? (
        <Spending data={data!} />
      ) : tab === 'goals' ? (
        <Goals data={data!} reality={reality} onReality={setReality} />
      ) : tab === 'whatif' ? (
        <WhatIf />
      ) : (
        <Accounts data={data!} />
      )}
    </div>
  );
}

function Overview({ data }: { data: Dashboard }) {
  const m = data.metrics;
  const history = data.history.netWorth.map((h) => h.value);

  return (
    <div className="flex flex-col gap-xl">
      <div className="grid gap-x-xl tablet:grid-cols-2 standard:grid-cols-4">
        <MetricTile label="Net worth" value={formatMoneyCompact(m.netWorth)} history={history} />
        <MetricTile label="Cash" value={formatMoneyCompact(m.cash)} />
        <MetricTile label="Investments" value={formatMoneyCompact(m.investments)} />
        <MetricTile label="Debt" value={formatMoneyCompact(-m.debt)} />
        <MetricTile label="Income (month)" value={formatMoneyCompact(m.income)} />
        <MetricTile
          label="Spending (month)"
          value={formatMoneyCompact(m.spending)}
          delta={m.spendingDelta ? `${m.spendingDelta > 0 ? '+' : ''}${m.spendingDelta}% vs 3-month average` : undefined}
        />
        <MetricTile label="Savings rate" value={formatPercent(m.savingsRate)} />
        <MetricTile
          label="Runway"
          value={Number.isFinite(m.runwayMonths) ? `${m.runwayMonths} mo` : '—'}
        />
      </div>

      {data.history.netWorth.length > 1 ? (
        <section>
          <SectionHeader title="Net worth" size="heading-sm" />
          <LineChart
            points={data.history.netWorth}
            label="Net worth"
            formatValue={(v) => formatMoneyCompact(v)}
          />
        </section>
      ) : null}

      <section>
        <SectionHeader title="Financial goals" size="heading-sm" />
        {data.goals.length ? (
          <div className="flex flex-col">
            {data.goals.map((g) => (
              <div key={g.id} className="flex flex-col gap-xs border-b border-hairline py-sm">
                <div className="flex items-baseline gap-sm">
                  <span className="t-body flex-1 truncate">{g.title}</span>
                  <span className="t-numeric tabular">{Math.round(g.progress)}%</span>
                  <TrajectoryChip trajectory={(g.onTrack ? 'on_track' : 'behind') as Trajectory} />
                </div>
                <ProgressBar value={g.progress} label={g.title} />
                <Meta>
                  {formatMoney(g.actualMonthly)}/mo actual · {formatMoney(g.requiredMonthly)}/mo required
                  {g.shortfall ? ` · ${formatMoney(g.shortfall)} short` : ''}
                  {g.projectedDate ? ` · projected ${formatShortDate(g.projectedDate)}` : ''}
                </Meta>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No financial goals yet. Capture “$1M invested by 35” to create one." />
        )}
      </section>
    </div>
  );
}

function Spending({ data }: { data: Dashboard }) {
  return (
    <div className="flex flex-col gap-xl">
      <section>
        <SectionHeader title="This month by category" size="heading-sm" />
        <BarChart
          data={data.spendingCategories.map((c, i) => ({
            key: c.category,
            label: c.category,
            series: (SPEND_CATEGORIES.indexOf(c.category as never) % 10) + 1,
            value: c.total,
          }))}
          formatValue={(v) => formatMoney(v)}
        />
      </section>

      {data.anomalies.length ? (
        <section>
          <SectionHeader title="Running hot" size="heading-sm" />
          <div className="flex flex-col">
            {data.anomalies.map((a) => (
              <div key={a.category} className="flex h-row items-center gap-sm border-b border-hairline px-xs">
                <span className="t-body-sm flex-1">{a.category}</span>
                <Meta>+{a.deltaPercent}% vs three-month average</Meta>
                <span className="t-numeric tabular">{formatMoney(a.total)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeader title="Recurring charges" size="heading-sm" count={data.recurring.length} />
        {data.recurring.length ? (
          <div className="flex flex-col">
            {data.recurring.map((r) => (
              <div key={r.merchant} className="flex h-row items-center gap-sm border-b border-hairline px-xs">
                <span className="t-body-sm flex-1 truncate">{r.merchant}</span>
                <Meta>{r.cadence}</Meta>
                <Meta>last {formatShortDate(r.lastChargedAt)}</Meta>
                <span className="t-numeric w-[80px] text-right tabular">{formatMoney(r.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <Meta>Nothing detected yet — three charges from one merchant is the threshold.</Meta>
        )}
      </section>
    </div>
  );
}

function Goals({
  data, reality, onReality,
}: {
  data: Dashboard;
  reality: boolean;
  onReality: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between gap-md">
        <SectionHeader title="Financial goals" size="heading-sm" className="pb-0" />
        <Button onClick={() => onReality(!reality)}>
          {reality ? 'Standard view' : 'Reality check'}
        </Button>
      </div>

      {data.goals.map((g) => (
        <section key={g.id} className="border-b border-hairline pb-lg">
          <div className="flex items-baseline gap-sm">
            <h3 className="t-heading-sm flex-1">{g.title}</h3>
            <TrajectoryChip trajectory={(g.onTrack ? 'on_track' : 'behind') as Trajectory} />
          </div>
          <ProgressBar value={g.progress} className="my-sm" label={g.title} />

          <div className="grid gap-x-lg gap-y-xs tablet:grid-cols-3">
            <Field label="Required monthly" value={formatMoney(g.requiredMonthly)} />
            <Field label="Actual monthly" value={formatMoney(g.actualMonthly)} />
            <Field label="Projected" value={formatMoneyCompact(g.projected)} />
            <Field label="Target date" value={g.dueAt ? formatShortDate(g.dueAt) : '—'} />
            <Field label="Projected date" value={g.projectedDate ? formatShortDate(g.projectedDate) : 'never at this rate'} />
            <Field label="Slip" value={g.monthsLate ? `${g.monthsLate} months` : 'none'} />
          </div>

          {reality && !g.onTrack ? (
            <div className="mt-md flex flex-col gap-xs">
              <p className="t-body text-ink">
                You are {formatMoney(g.shortfall)} a month short. At the current rate this lands
                {g.monthsLate ? ` ${g.monthsLate} months` : ' well'} past your date.
              </p>
              <p className="t-body-sm text-ink-muted">Levers:</p>
              <ul className="t-body-sm ml-lg list-disc text-ink-muted">
                <li>Cut {formatMoney(Math.round(g.shortfall * 0.5))} a month from discretionary spending.</li>
                <li>Increase income by {formatMoney(Math.round(g.shortfall * 0.6))} a month.</li>
                <li>Move the date out by {g.monthsLate ?? 12} months and keep the current rate.</li>
                <li>Reduce the target by {formatMoneyCompact(Math.round(g.projected * -0.1))}.</li>
              </ul>
            </div>
          ) : null}
        </section>
      ))}

      {data.debtPlan?.paidOff.length ? (
        <section>
          <SectionHeader title="Debt payoff order" size="heading-sm" />
          <Meta className="mb-sm block">
            Highest interest first — {formatMoney(data.debtPlan.totalInterest)} total interest.
          </Meta>
          {data.debtPlan.paidOff.map((d, i) => (
            <div key={d.id} className="flex h-row items-center gap-sm border-b border-hairline px-xs">
              <span className="t-numeric w-[20px] text-ink-subtle tabular">{i + 1}</span>
              <span className="t-body-sm flex-1">{d.name}</span>
              <Meta>{d.months} months</Meta>
              <span className="t-numeric w-[90px] text-right tabular">{formatMoney(d.interest)}</span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-sm">
      <span className="t-caption w-[120px] shrink-0 text-ink-subtle">{label}</span>
      <span className="t-numeric tabular">{value}</span>
    </div>
  );
}

interface WhatIfResult {
  scenario: string;
  assumptions: string[];
  cash: { before: number; after: number };
  monthly_savings: { before: number; after: number };
  runway_months: { before: number; after: number };
  goal_impacts: { goal_id: string; name: string; date_before: string; date_after: string; delta_months: number }[];
  summary: string;
}

function WhatIf() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const toast = useToast();

  const run = useMutation({
    mutationFn: () => api.post<WhatIfResult>('/api/money/what-if', { question }),
    onSuccess: setResult,
    onError: (e) => toast.show(e instanceof Error ? e.message : 'What-if failed'),
  });

  const { data: saved } = useQuery({
    queryKey: ['scenarios'],
    queryFn: () => api.get<{ scenarios: { id: string; question: string }[] }>('/api/money/what-if'),
  });

  return (
    <div className="flex flex-col gap-lg">
      <form
        className="flex gap-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) run.mutate();
        }}
      >
        <Input
          value={question}
          placeholder="What if I take three months off to build the product?"
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={run.isPending || !question.trim()}>
          {run.isPending ? 'Working…' : 'Model it'}
        </Button>
      </form>

      {result ? (
        <section className="flex flex-col gap-md">
          <h3 className="t-heading-sm">{result.scenario}</h3>
          <p className="t-body max-w-measure text-ink-muted">{result.summary}</p>

          <div className="grid gap-x-xl tablet:grid-cols-3">
            <Compare label="Cash" before={result.cash.before} after={result.cash.after} money />
            <Compare label="Monthly savings" before={result.monthly_savings.before} after={result.monthly_savings.after} money />
            <Compare label="Runway (months)" before={result.runway_months.before} after={result.runway_months.after} />
          </div>

          {result.goal_impacts.length ? (
            <div className="flex flex-col">
              <SectionHeader title="Goal impact" size="micro" as="h4" />
              {result.goal_impacts.map((g) => (
                <div key={g.goal_id} className="flex h-row items-center gap-sm border-b border-hairline px-xs">
                  <span className="t-body-sm flex-1 truncate">{g.name}</span>
                  <Meta>
                    {formatShortDate(g.date_before)} → {formatShortDate(g.date_after)}
                  </Meta>
                  <span className="t-numeric w-[80px] text-right tabular">
                    {g.delta_months > 0 ? '+' : ''}
                    {g.delta_months} mo
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {result.assumptions.length ? (
            <div>
              <SectionHeader title="Assumptions" size="micro" as="h4" />
              <ul className="t-body-sm ml-lg list-disc text-ink-muted">
                {result.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button
            className="self-start"
            onClick={() =>
              api.post('/api/money/what-if', { question, save: true }).then(() => toast.show('Scenario saved'))
            }
          >
            Save scenario
          </Button>
        </section>
      ) : null}

      {saved?.scenarios.length ? (
        <>
          <Divider clearance="md" />
          <SectionHeader title="Saved scenarios" size="micro" as="h3" />
          {saved.scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setQuestion(s.question)}
              className="t-body-sm flex h-row items-center border-b border-hairline px-xs text-left hover:bg-surface-1"
            >
              {s.question}
            </button>
          ))}
        </>
      ) : null}
    </div>
  );
}

function Compare({ label, before, after, money }: { label: string; before: number; after: number; money?: boolean }) {
  const fmt = (v: number) => (money ? formatMoneyCompact(v) : String(Math.round(v * 10) / 10));
  return (
    <div className="flex flex-col gap-xxs border-b border-hairline py-sm">
      <span className="t-micro text-ink-subtle">{label}</span>
      <span className="t-numeric tabular">
        {fmt(before)} → {fmt(after)}
      </span>
    </div>
  );
}

function Accounts({ data }: { data: Dashboard }) {
  const toast = useToast();
  const link = useMutation({
    mutationFn: () => api.post<{ linkToken: string }>('/api/money/link-token'),
    onSuccess: (res) => {
      // Plaid Link is loaded from its CDN and opened here; the public token is
      // exchanged server-side so the access token never reaches the browser.
      const w = window as unknown as { Plaid?: { create: (o: object) => { open: () => void } } };
      if (!w.Plaid) {
        toast.show('Plaid Link script not loaded — see SETUP.md § Money.');
        return;
      }
      w.Plaid.create({
        token: res.linkToken,
        onSuccess: (publicToken: string) => {
          void api.post('/api/money/exchange', { publicToken }).then(() => {
            toast.show('Account connected');
            window.location.reload();
          });
        },
      }).open();
    },
    onError: (e) => toast.show(e instanceof Error ? e.message : 'Could not start Plaid Link'),
  });

  const columns: Column<Dashboard['accounts'][number]>[] = [
    { key: 'name', header: 'Account', width: '34%', sortValue: (r) => r.name, render: (r) => r.name },
    { key: 'institution', header: 'Institution', from: 'tablet', width: '24%', render: (r) => r.institution ?? 'Manual' },
    { key: 'kind', header: 'Type', from: 'tablet', width: '18%', render: (r) => r.kind },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      width: '24%',
      sortValue: (r) => Number(r.balanceCurrent ?? 0),
      render: (r) => formatMoney(Number(r.balanceCurrent ?? 0)),
    },
  ];

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between gap-md">
        <SectionHeader title="Accounts" size="heading-sm" className="pb-0" />
        <Button variant="primary" onClick={() => link.mutate()} disabled={link.isPending}>
          Connect a bank
        </Button>
      </div>
      <DataTable
        rows={data.accounts}
        columns={columns}
        empty="No accounts yet. Connect one with Plaid, or add a manual account."
      />
    </div>
  );
}
