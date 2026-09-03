'use client';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ObjectDetail } from '@/components/composite/ObjectDetail';

export default function TaskRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="mx-auto flex min-h-full w-full max-w-measure flex-col">
      <Link href="/work/board" className="t-caption m-lg flex w-fit items-center gap-xs text-ink-muted no-underline">
        <ArrowLeft size={14} strokeWidth={1.5} /> Work
      </Link>
      <ObjectDetail id={id} />
    </div>
  );
}
