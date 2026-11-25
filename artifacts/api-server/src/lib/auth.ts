import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { RequestHandler } from "express";
import {
  db,
  authLoginAttemptsTable,
  authSessionsTable,
  authUsersTable,
  type AuthUser,
} from "@workspace/db";
import { logger } from "./logger";
import { getLoginThrottleKeys } from "./login-throttle";

export const SESSION_COOKIE_NAME = "pp_session";
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const PASSWORD_MIN_LENGTH = 12;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

type AuthRole = "master" | "user";
type AuthStatus = "active" | "blocked";

export type PublicAuthUser = Pick<
  AuthUser,
  "id" | "username" | "displayName" | "role" | "status" | "createdAt" | "updatedAt"
>;

declare global {
  namespace Express {
    interface Request {
      authUser?: PublicAuthUser;
      authSessionId?: number;
    }
  }
}

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAX_MEMORY },
      (error: Error | null, derivedKey: Buffer) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePasswordKey(password, salt);
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(encodedHash: string, password: string): Promise<boolean> {
  const [algorithm, rawN, rawR, rawP, encodedSalt, encodedKey, ...extra] = encodedHash.split("$");
  if (
    algorithm !== "scrypt" ||
    rawN !== String(SCRYPT_N) ||
    rawR !== String(SCRYPT_R) ||
    rawP !== String(SCRYPT_P) ||
    !encodedSalt ||
    !encodedKey ||
    extra.length > 0
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expectedKey = Buffer.from(encodedKey, "base64url");
    if (salt.length !== 16 || expectedKey.length !== SCRYPT_KEY_LENGTH) {
      return false;
    }
    const actualKey = await derivePasswordKey(password, salt);
    return timingSafeEqual(expectedKey, actualKey);
  } catch {
    return false;
  }
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,39}$/.test(value);
}

export function isValidPassword(value: string): boolean {
  return value.length >= PASSWORD_MIN_LENGTH && value.length <= 256;
}

export function toPublicAuthUser(user: AuthUser): PublicAuthUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role as AuthRole,
    status: user.status as AuthStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function setSessionCookie(res: Parameters<RequestHandler>[1], token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearSessionCookie(res: Parameters<RequestHandler>[1]): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(authSessionsTable).values({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
  });
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(authSessionsTable).where(eq(authSessionsTable.tokenHash, hashSessionToken(token)));
}

export const requireAuthentication: RequestHandler = async (req, res, next) => {
  try {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token !== "string" || token.length < 32) {
      res.status(401).json({ error: "Not signed in" });
      return;
    }

    const [session] = await db
      .select({
        sessionId: authSessionsTable.id,
        id: authUsersTable.id,
        username: authUsersTable.username,
        displayName: authUsersTable.displayName,
        role: authUsersTable.role,
        status: authUsersTable.status,
        createdAt: authUsersTable.createdAt,
        updatedAt: authUsersTable.updatedAt,
      })
      .from(authSessionsTable)
      .innerJoin(authUsersTable, eq(authSessionsTable.userId, authUsersTable.id))
      .where(
        and(
          eq(authSessionsTable.tokenHash, hashSessionToken(token)),
          gt(authSessionsTable.expiresAt, new Date()),
          eq(authUsersTable.status, "active"),
        ),
      )
      .limit(1);

    if (!session) {
      clearSessionCookie(res);
      res.status(401).json({ error: "Not signed in" });
      return;
    }

    req.authSessionId = session.sessionId;
    req.authUser = {
      id: session.id,
      username: session.username,
      displayName: session.displayName,
      role: session.role,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireMaster: RequestHandler = (req, res, next) => {
  if (req.authUser?.role !== "master") {
    res.status(403).json({ error: "Master access required" });
    return;
  }
  next();
};

export async function isLoginThrottled(ip: string, username: string): Promise<boolean> {
  const throttleKeys = getLoginThrottleKeys(ip, username);
  const attempts = await db
    .select({
      keyHash: authLoginAttemptsTable.keyHash,
      locked: sql<boolean>`COALESCE(${authLoginAttemptsTable.lockedUntil} > NOW(), FALSE)`,
    })
    .from(authLoginAttemptsTable)
    .where(
      inArray(
        authLoginAttemptsTable.keyHash,
        throttleKeys.map(({ keyHash }) => keyHash),
      ),
    );
  return attempts.some((attempt) => attempt.locked);
}

export async function recordFailedLogin(ip: string, username: string): Promise<void> {
  const throttleKeys = getLoginThrottleKeys(ip, username);

  const expiredWindow = sql`
    ${authLoginAttemptsTable.windowExpiresAt} <= NOW()
    OR (
      ${authLoginAttemptsTable.lockedUntil} IS NOT NULL
      AND ${authLoginAttemptsTable.lockedUntil} <= NOW()
    )
  `;
  const windowDuration = sql`${LOGIN_WINDOW_MS} * INTERVAL '1 millisecond'`;

  await db.transaction(async (transaction) => {
    for (const { keyHash, failureLimit } of throttleKeys) {
      await transaction
        .insert(authLoginAttemptsTable)
        .values({
          keyHash,
          failureCount: 1,
          windowExpiresAt: sql`NOW() + ${windowDuration}`,
        })
        .onConflictDoUpdate({
          target: authLoginAttemptsTable.keyHash,
          set: {
            failureCount: sql`
              CASE WHEN ${expiredWindow}
                THEN 1
                ELSE ${authLoginAttemptsTable.failureCount} + 1
              END
            `,
            windowExpiresAt: sql`
              CASE WHEN ${expiredWindow}
                THEN NOW() + ${windowDuration}
                ELSE ${authLoginAttemptsTable.windowExpiresAt}
              END
            `,
            lockedUntil: sql`
              CASE
                WHEN ${expiredWindow} THEN NULL
                WHEN ${authLoginAttemptsTable.failureCount} + 1 >= ${failureLimit}
                  THEN NOW() + ${windowDuration}
                ELSE ${authLoginAttemptsTable.lockedUntil}
              END
            `,
          },
        });
    }

    await transaction
      .delete(authLoginAttemptsTable)
      .where(sql`
        ${authLoginAttemptsTable.windowExpiresAt} <= NOW()
        AND (
          ${authLoginAttemptsTable.lockedUntil} IS NULL
          OR ${authLoginAttemptsTable.lockedUntil} <= NOW()
        )
      `);
  });
}

export async function clearFailedLogins(ip: string, username: string): Promise<void> {
  const throttleKeys = getLoginThrottleKeys(ip, username);
  await db
    .delete(authLoginAttemptsTable)
    .where(
      inArray(
        authLoginAttemptsTable.keyHash,
        throttleKeys.map(({ keyHash }) => keyHash),
      ),
    );
}

export async function ensureMasterAccount(): Promise<void> {
  const configuredUsername = normalizeUsername(process.env.MASTER_USERNAME ?? "");
  const configuredPassword = process.env.MASTER_PASSWORD ?? "";

  if (!configuredUsername || !configuredPassword) {
    logger.warn("Master credentials are not configured; initial account provisioning was skipped");
    return;
  }
  if (!isValidUsername(configuredUsername)) {
    throw new Error("MASTER_USERNAME must be 3–40 lowercase letters, numbers, dots, underscores, or hyphens.");
  }
  if (!isValidPassword(configuredPassword)) {
    throw new Error("MASTER_PASSWORD must contain at least 12 characters.");
  }

  await db.transaction(async (transaction) => {
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(71428193)`);

    const [existingMaster] = await transaction
      .select({ id: authUsersTable.id })
      .from(authUsersTable)
      .where(eq(authUsersTable.role, "master"))
      .limit(1);
    if (existingMaster) {
      return;
    }

    const [usernameCollision] = await transaction
      .select({ id: authUsersTable.id })
      .from(authUsersTable)
      .where(eq(authUsersTable.username, configuredUsername))
      .limit(1);
    if (usernameCollision) {
      throw new Error("The configured master username already belongs to another account. No account was changed.");
    }

    const passwordHash = await hashPassword(configuredPassword);
    await transaction.insert(authUsersTable).values({
      username: configuredUsername,
      displayName: "Master",
      passwordHash,
      role: "master",
      status: "active",
    });
    logger.info("Initial master account provisioned");
  });
}
