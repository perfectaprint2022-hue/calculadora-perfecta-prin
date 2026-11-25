import { createHmac } from "node:crypto";

export const LOGIN_THROTTLE_FAILURE_LIMITS = {
  combined: 10,
  account: 10,
  origin: 100,
} as const;

export type LoginThrottleScope = keyof typeof LOGIN_THROTTLE_FAILURE_LIMITS;

export interface LoginThrottleKey {
  scope: LoginThrottleScope;
  keyHash: string;
  failureLimit: number;
}

function hashLoginIdentity(secret: string, namespace: string, identity: string): string {
  return createHmac("sha256", secret)
    .update(namespace)
    .update(identity)
    .digest("hex");
}

export function getLoginThrottleKeys(ip: string, username: string): LoginThrottleKey[] {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET must be configured for shared login throttling.");
  }

  const normalizedUsername = username.trim().toLowerCase();

  return [
    {
      scope: "combined",
      // Keep the original combined key derivation so active lockouts survive this update.
      keyHash: hashLoginIdentity(
        secret,
        "login-throttle\0",
        JSON.stringify([ip, normalizedUsername]),
      ),
      failureLimit: LOGIN_THROTTLE_FAILURE_LIMITS.combined,
    },
    {
      scope: "account",
      keyHash: hashLoginIdentity(
        secret,
        "login-throttle\0account\0",
        normalizedUsername,
      ),
      failureLimit: LOGIN_THROTTLE_FAILURE_LIMITS.account,
    },
    {
      scope: "origin",
      keyHash: hashLoginIdentity(secret, "login-throttle\0origin\0", ip),
      failureLimit: LOGIN_THROTTLE_FAILURE_LIMITS.origin,
    },
  ];
}
