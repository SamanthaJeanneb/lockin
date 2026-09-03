import { db } from '@/lib/db/client';
import { attachment } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth';
import { fail, handleError, ok } from '@/lib/api';
import { createAdminClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TEXTUAL = /^(text\/|application\/(json|xml|csv))/;

/** Files land in Supabase Storage; textual content is extracted so search and
 *  the extraction prompt can both see it. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get('file');
    const objectId = form.get('objectId');
    if (!(file instanceof File)) return fail('No file supplied', 422);
    if (file.size > 25 * 1024 * 1024) return fail('File is larger than 25MB', 413);

    let text: string | null = null;
    if (TEXTUAL.test(file.type)) text = (await file.text()).slice(0, 100_000);

    let storagePath = `local/${Date.now()}-${file.name}`;
    if (env.supabaseServiceKey) {
      const supabase = createAdminClient();
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from('attachments')
        .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
      if (error && !/already exists/i.test(error.message)) {
        return fail(`Upload failed: ${error.message}. Create an "attachments" bucket — see SETUP.md.`, 502);
      }
      storagePath = path;
    }

    const [row] = await db
      .insert(attachment)
      .values({
        userId: user.id,
        objectId: typeof objectId === 'string' && objectId ? objectId : null,
        storagePath,
        filename: file.name,
        mime: file.type,
        bytes: file.size,
        extractedText: text,
      })
      .returning({ id: attachment.id });

    return ok({ id: row!.id, filename: file.name, path: storagePath, text });
  } catch (e) {
    return handleError(e);
  }
}
