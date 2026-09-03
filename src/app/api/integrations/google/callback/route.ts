import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { handleError } from '@/lib/api';
import { completeOAuth } from '@/lib/calendar/google';
import { env } from '@/lib/env';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const code = new URL(req.url).searchParams.get('code');
    if (!code) return NextResponse.redirect(`${env.appUrl}/settings?calendar=denied`);
    await completeOAuth(user.id, code);
    return NextResponse.redirect(`${env.appUrl}/settings?calendar=connected`);
  } catch (e) {
    return handleError(e);
  }
}
