import twilio from 'twilio';
import { env, features } from '@/lib/env';

let client: ReturnType<typeof twilio> | undefined;

export async function sendSms(to: string, body: string) {
  if (!features.sms) {
    console.warn('[sms] Twilio not configured — skipping.');
    return null;
  }
  client ??= twilio(env.twilioSid!, env.twilioToken!);
  const msg = await client.messages.create({ from: env.twilioPhone!, to, body });
  return msg.sid;
}

export function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!features.sms || !signature) return false;
  return twilio.validateRequest(env.twilioToken!, signature, url, params);
}
