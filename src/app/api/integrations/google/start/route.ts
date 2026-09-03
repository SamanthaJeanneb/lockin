import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { handleError } from '@/lib/api';
import { authUrl } from '@/lib/calendar/google';

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.redirect(authUrl(user.id));
  } catch (e) {
    return handleError(e);
  }
}
