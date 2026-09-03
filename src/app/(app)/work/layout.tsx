'use client';
import { usePathname, useRouter } from 'next/navigation';
import { Segmented } from '@/components/ui';

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tab = pathname.split('/')[2] ?? 'board';
  const isDetail = pathname.split('/').length > 3;

  return (
    <div className="flex min-h-full flex-col p-xl">
      {!isDetail ? (
        <header className="mb-lg flex items-center justify-between gap-md">
          <h1 className="t-display">Work</h1>
          <Segmented
            options={[
              { value: 'board', label: 'Board' },
              { value: 'projects', label: 'Projects' },
              { value: 'backlog', label: 'Backlog' },
              { value: 'waiting', label: 'Waiting' },
            ]}
            value={tab as never}
            onChange={(v) => router.push(`/work/${v}`)}
          />
        </header>
      ) : null}
      {children}
    </div>
  );
}
