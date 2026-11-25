import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const authLoginAttemptsTable = pgTable(
  "auth_login_attempts",
  {
    keyHash: text("key_hash").primaryKey(),
    failureCount: integer("failure_count").notNull(),
    windowExpiresAt: timestamp("window_expires_at", { withTimezone: true }).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (table) => ({
    expiryIdx: index("auth_login_attempts_expiry_idx").on(
      table.windowExpiresAt,
      table.lockedUntil,
    ),
  }),
);
