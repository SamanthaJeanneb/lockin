import OpenAI from 'openai';
import { requireUser } from '@/lib/auth';
import { fail, handleError, ok, rateLimit, tooMany } from '@/lib/api';
import { env, features } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!features.voice) return fail('Voice transcription needs OPENAI_API_KEY. See SETUP.md.', 503);
    if (!rateLimit(`transcribe:${user.id}`, 20)) return tooMany();

    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) return fail('No audio supplied', 422);
    if (audio.size > 25 * 1024 * 1024) return fail('Recording is too long (25MB limit)', 413);

    const client = new OpenAI({ apiKey: env.openaiKey! });
    const res = await client.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
      response_format: 'text',
    });

    return ok({ text: typeof res === 'string' ? res : (res as { text: string }).text });
  } catch (e) {
    return handleError(e);
  }
}
