import { extractCapture } from '@/lib/ai/extract';

export async function extractCaptureJob({ captureId }: { captureId: string }) {
  const extraction = await extractCapture(captureId);
  return { captureId, objects: extraction.objects.length, completions: extraction.completions.length };
}
