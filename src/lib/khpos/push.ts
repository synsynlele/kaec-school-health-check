import { randomBytes, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  sendPushNotification,
  topicFromString,
  WebPushError,
  type PushSubscriptionData,
} from "@mmmike/web-push/send";
import { generateVapidKeys } from "@mmmike/web-push/vapid";
import { getKhposAlerts, pushEligibleAlerts } from "@/lib/khpos/notifications";

let service: SupabaseClient | undefined;

function admin() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error("KHP-OS Push is not configured.");
  }

  return (service ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ));
}

export type PushSubscriptionInput = PushSubscriptionData;

type StoredSubscription = {
  id: string;
  organisation_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
};

type PushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
  cronSecret: string;
};

let configCache:
  | { value: PushConfig; expiresAt: number }
  | undefined;

function normalizePushConfig(input: unknown): PushConfig | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const data = input as Record<string, unknown>;
  const publicKey = data.khpos_vapid_public_key;
  const privateKey = data.khpos_vapid_private_key;
  const subject = data.khpos_vapid_subject;
  const cronSecret = data.khpos_push_cron_secret;

  if (
    typeof publicKey !== "string" ||
    typeof privateKey !== "string" ||
    typeof subject !== "string" ||
    typeof cronSecret !== "string"
  ) {
    return null;
  }

  return { publicKey, privateKey, subject, cronSecret };
}

async function pushConfig(): Promise<PushConfig> {
  if (configCache && configCache.expiresAt > Date.now()) {
    return configCache.value;
  }

  const client = admin();
  const first = await client.rpc("khpos_get_push_config_server");
  if (first.error) {
    throw new Error("KHP-OS device alert configuration could not be read.");
  }

  let config = normalizePushConfig(first.data);

  if (!config) {
    const keys = await generateVapidKeys();
    const cronSecret = randomBytes(48).toString("base64url");
    const created = await client.rpc("khpos_save_push_config_server", {
      p_public_key: keys.publicKey,
      p_private_key: keys.privateKey,
      p_cron_secret: cronSecret,
      p_subject: "https://www.kshc.name.ng",
    });

    if (created.error) {
      throw new Error("KHP-OS device alert configuration could not initialize.");
    }
    config = normalizePushConfig(created.data);
  }

  if (!config) {
    throw new Error("KHP-OS device alerts are not configured.");
  }

  configCache = { value: config, expiresAt: Date.now() + 5 * 60_000 };
  return config;
}

export async function getKhposVapidPublicKey() {
  return (await pushConfig()).publicKey;
}

export async function verifyKhposPushCronAuthorization(
  authorization: string | null,
) {
  if (!authorization?.startsWith("Bearer ")) return false;
  const provided = authorization.slice(7);
  const expected = (await pushConfig()).cronSecret;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validEndpoint(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Invalid push subscription.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Push subscriptions must use HTTPS.");
  }

  const host = url.hostname.toLowerCase();
  const knownPushService =
    host === "fcm.googleapis.com" ||
    host.endsWith(".push.services.mozilla.com") ||
    host.endsWith(".push.apple.com");

  if (!knownPushService) {
    throw new Error(
      "This browser's push provider is not supported yet. Use current Chrome, Edge, Firefox or Safari.",
    );
  }
}

function validKey(value: string, minimum: number) {
  return (
    value.length >= minimum &&
    value.length <= 512 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export async function assertKhposPushAccess(
  organisationId: string,
  userId: string,
) {
  const client = admin();
  const [{ data: membership, error: membershipError }, { data: organisation, error: orgError }] =
    await Promise.all([
      client
        .from("organisation_memberships")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      client
        .from("organisations")
        .select("status,partner_status,partner_entitlements")
        .eq("id", organisationId)
        .maybeSingle(),
    ]);

  if (membershipError || orgError) {
    throw new Error("School access could not be verified.");
  }

  const entitlements = Array.isArray(organisation?.partner_entitlements)
    ? organisation.partner_entitlements
    : [];

  if (
    !membership ||
    organisation?.status !== "active" ||
    organisation?.partner_status !== "active" ||
    !entitlements.includes("khpos_core")
  ) {
    throw new Error("Active KHP-OS school access is required.");
  }
}

export async function savePushSubscription(
  organisationId: string,
  userId: string,
  subscription: PushSubscriptionInput,
  userAgent?: string | null,
) {
  await assertKhposPushAccess(organisationId, userId);
  await getKhposVapidPublicKey();

  const endpoint = subscription?.endpoint?.trim();
  const p256dh = subscription?.keys?.p256dh?.trim();
  const auth = subscription?.keys?.auth?.trim();

  if (
    !endpoint ||
    !p256dh ||
    !auth ||
    !validKey(p256dh, 40) ||
    !validKey(auth, 8)
  ) {
    throw new Error("Invalid push subscription.");
  }
  validEndpoint(endpoint);

  const client = admin();
  const now = new Date().toISOString();

  const { error: oldOwnerError } = await client
    .from("khpos_push_subscriptions")
    .update({ disabled_at: now, updated_at: now })
    .eq("endpoint", endpoint)
    .neq("user_id", userId)
    .is("disabled_at", null);

  if (oldOwnerError) throw new Error("Device alert ownership could not be secured.");

  const { error } = await client.from("khpos_push_subscriptions").upsert(
    {
      organisation_id: organisationId,
      user_id: userId,
      endpoint,
      p256dh,
      auth_secret: auth,
      user_agent: userAgent?.slice(0, 500) || null,
      disabled_at: null,
      updated_at: now,
      last_seen_at: now,
    },
    { onConflict: "organisation_id,user_id,endpoint" },
  );

  if (error) throw new Error("Device alert subscription could not be saved.");
}

export async function disablePushEndpoint(userId: string, endpoint: string) {
  if (!endpoint || endpoint.length > 4000) return;
  const client = admin();
  const now = new Date().toISOString();

  const { error } = await client
    .from("khpos_push_subscriptions")
    .update({ disabled_at: now, updated_at: now })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .is("disabled_at", null);

  if (error) throw new Error("Device alert subscription could not be disabled.");
}

async function disableStoredSubscription(id: string) {
  const now = new Date().toISOString();
  await admin()
    .from("khpos_push_subscriptions")
    .update({ disabled_at: now, updated_at: now })
    .eq("id", id);
}

export async function deliverKhposPushReminders() {
  const client = admin();
  const config = await pushConfig();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await client
    .from("khpos_push_subscriptions")
    .select("id,organisation_id,user_id,endpoint,p256dh,auth_secret")
    .is("disabled_at", null)
    .limit(500);

  if (error) throw new Error("Push subscriptions could not be loaded.");
  const subscriptions = (data ?? []) as StoredSubscription[];
  if (!subscriptions.length) {
    return { subscriptions: 0, delivered: 0, gone: 0, failed: 0, skipped: 0 };
  }

  const ids = subscriptions.map((item) => item.id);
  const { data: deliveryRows, error: deliveryError } = await client
    .from("khpos_push_deliveries")
    .select("subscription_id,alert_id")
    .in("subscription_id", ids)
    .eq("delivered_on", today)
    .limit(5000);

  if (deliveryError) throw new Error("Push delivery history could not be loaded.");

  const alreadyDelivered = new Set(
    (deliveryRows ?? []).map(
      (row) => `${row.subscription_id}:${row.alert_id}`,
    ),
  );
  const alertsByUserSchool = new Map<string, Awaited<ReturnType<typeof getKhposAlerts>>>();

  let delivered = 0;
  let gone = 0;
  let failed = 0;
  let skipped = 0;

  for (const subscription of subscriptions) {
    try {
      const scope = `${subscription.organisation_id}:${subscription.user_id}`;
      let alerts = alertsByUserSchool.get(scope);
      if (!alerts) {
        alerts = await getKhposAlerts(
          subscription.organisation_id,
          subscription.user_id,
        );
        alertsByUserSchool.set(scope, alerts);
      }

      const candidates = pushEligibleAlerts(alerts)
        .filter(
          (alert) =>
            !alreadyDelivered.has(`${subscription.id}:${alert.id}`),
        )
        .slice(0, 5);

      if (!candidates.length) {
        skipped += 1;
        continue;
      }

      const first = candidates[0];
      const accepted = await sendPushNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth_secret,
          },
        },
        {
          title:
            candidates.length === 1
              ? first.detail
              : `KHP-OS · ${candidates.length} actions need attention`,
          body:
            candidates.length === 1
              ? first.title
              : `${first.title} · plus ${candidates.length - 1} more`,
          url: first.href,
          tag: `khpos-${subscription.organisation_id}`,
        },
        config,
        {
          ttl: 86_400,
          urgency: candidates.some((item) => item.urgent) ? "high" : "normal",
          topic: await topicFromString(
            `khpos:${subscription.organisation_id}:${subscription.user_id}`,
          ),
          timeoutMs: 15_000,
        },
      );

      if (!accepted) {
        gone += 1;
        await disableStoredSubscription(subscription.id);
        continue;
      }

      const { error: recordError } = await client
        .from("khpos_push_deliveries")
        .upsert(
          candidates.map((alert) => ({
            subscription_id: subscription.id,
            alert_id: alert.id,
            delivered_on: today,
          })),
          {
            onConflict: "subscription_id,alert_id,delivered_on",
            ignoreDuplicates: true,
          },
        );

      if (recordError) {
        console.warn("[khpos][push] delivery recorded late", {
          subscriptionId: subscription.id,
        });
      }

      for (const alert of candidates) {
        alreadyDelivered.add(`${subscription.id}:${alert.id}`);
      }
      delivered += 1;
    } catch (cause) {
      failed += 1;
      if (cause instanceof WebPushError) {
        console.warn("[khpos][push] service rejected delivery", {
          statusCode: cause.statusCode,
          retryAfterMs: cause.retryAfterMs,
        });
      } else {
        console.warn("[khpos][push] delivery failed", {
          reason: cause instanceof Error ? cause.message : "unknown",
        });
      }
    }
  }

  return {
    subscriptions: subscriptions.length,
    delivered,
    gone,
    failed,
    skipped,
  };
}
