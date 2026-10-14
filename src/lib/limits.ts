/**
 * Fair-use limits. They apply per account (not per key), so extra keys never
 * add capacity. Tiers are assigned by admins; everyone starts on "standard".
 */
export const tiers = {
  standard: { label: "Standard", perMinute: 60, perMonth: 50_000 },
  elevated: { label: "Elevated", perMinute: 300, perMonth: 500_000 },
} as const;

export type Tier = keyof typeof tiers;

export function isTier(value: unknown): value is Tier {
  return typeof value === "string" && value in tiers;
}

/** Active (non-revoked) keys one account may hold. */
export const MAX_ACTIVE_KEYS = 5;

/** Key creations allowed per account per hour (stops create/revoke churn). */
export const KEY_CREATIONS_PER_HOUR = 10;

/** Requests per minute per IP that fail authentication before we stop looking keys up. */
export const FAILED_AUTH_PER_MINUTE = 30;
