import { z } from 'zod';
import { LANGUAGES } from './constants.js';

/** A browser PushSubscription, as `subscription.toJSON()` returns it. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});
export type PushSubscriptionJson = z.infer<typeof pushSubscriptionSchema>;

export const pushSubscribeSchema = z.object({
  subscription: pushSubscriptionSchema,
  lang: z.enum(LANGUAGES),
});
export type PushSubscribe = z.infer<typeof pushSubscribeSchema>;
