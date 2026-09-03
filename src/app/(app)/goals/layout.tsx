'use client';
import { usePathname, useRouter } from 'next/navigation';
import { Segmented } from '@/components/ui';

export default function GoalsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tab = pathname.split('/')[2] ?? 'tree';

  return (
    <div className="flex min-h-full flex-col p-xl">
      <header className="mb-lg flex items-center justify-between gap-md">
        <h1 className="t-display">Goals</h1>
        <Segmented
          options={[
            { value: 'tree', label: 'Tree' },
            { value: 'roadmap', label: 'Roadmap' },
            { value: 'drift', label: 'Drift' },
          ]}
          value={tab as never}
          onChange={(v) => router.push(`/goals/${v}`)}
        />
      </header>
      {children}
    </div>
  );
}
