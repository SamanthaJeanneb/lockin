import { flushDueNotifications } from '@/lib/notify/push';

export async function sendNotificationsJob() {
  const sent = await flushDueNotifications();
  return { sent };
}
