'use client';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ObjectDetail } from '@/components/composite/ObjectDetail';
import { Button } from '@/components/ui';

/** Below 768px the context pane is a real route, so browser back returns to
 *  wherever you clicked from. Same component, different container. */
export default function ObjectRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-hairline px-lg py-sm">
        <Button size="sm" onClick={() => router.back()}>
          <ArrowLeft size={14} strokeWidth={1.5} /> Back
        </Button>
      </div>
      <ObjectDetail id={id} />
    </div>
  );
}
