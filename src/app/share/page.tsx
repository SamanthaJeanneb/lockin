import { redirect } from 'next/navigation';

/**
 * PWA share target. Android's share sheet lands here; we fold whatever was
 * shared into a capture and bounce to Home with the modal open.
 */
export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; text?: string; url?: string }>;
}) {
  const { title, text, url } = await searchParams;
  const draft = [title, text, url].filter(Boolean).join('\n');
  redirect(`/?capture=1&draft=${encodeURIComponent(draft)}`);
}
