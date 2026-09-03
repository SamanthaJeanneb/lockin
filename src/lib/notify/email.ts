import { Resend } from 'resend';
import { env, features } from '@/lib/env';
import { EMAIL } from '@/lib/brand';

let client: Resend | undefined;

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  if (!features.email) {
    console.warn('[email] RESEND_API_KEY not set — skipping:', opts.subject);
    return null;
  }
  client ??= new Resend(env.resendKey!);
  const res = await client.emails.send({
    from: env.emailFrom,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  return res.data?.id ?? null;
}

/** Plain, monochrome markup that matches the product. No images, no gradients. */
export function digestHtml(opts: {
  heading: string;
  intro?: string;
  items: { title: string; meta?: string }[];
  url: string;
}) {
  return `<!doctype html><html><body style="margin:0;background:${EMAIL.canvas};color:${EMAIL.ink};font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.6px;margin:0 0 8px">${escapeHtml(opts.heading)}</h1>
    ${opts.intro ? `<p style="color:${EMAIL.inkMuted};margin:0 0 24px">${escapeHtml(opts.intro)}</p>` : ''}
    <table style="width:100%;border-collapse:collapse">
      ${opts.items
        .map(
          (i) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${EMAIL.hairline}">
            <div>${escapeHtml(i.title)}</div>
            ${i.meta ? `<div style="color:${EMAIL.inkSubtle};font-size:12px">${escapeHtml(i.meta)}</div>` : ''}
          </td></tr>`,
        )
        .join('')}
    </table>
    <p style="margin:24px 0 0"><a href="${opts.url}" style="color:${EMAIL.ink};text-decoration:underline">Open LockIn</a></p>
  </div></body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
