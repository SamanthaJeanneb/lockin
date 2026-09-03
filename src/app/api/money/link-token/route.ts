import { requireUser } from '@/lib/auth';
import { handleError, ok } from '@/lib/api';
import { createLinkToken } from '@/lib/finance/plaid';

export async function POST() {
  try {
    const user = await requireUser();
    const token = await createLinkToken(user.id);
    return ok({ linkToken: token });
  } catch (e) {
    return handleError(e);
  }
}
