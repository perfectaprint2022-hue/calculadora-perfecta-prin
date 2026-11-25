import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { authUsersTable } from "./auth-users";

export const authSessionsTable = pgTable(
  "auth_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => authUsersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenUnique: uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
    userIdx: index("auth_sessions_user_id_idx").on(table.userId),
  }),
);

export const insertAuthSessionSchema = createInsertSchema(authSessionsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAuthSession = z.infer<typeof insertAuthSessionSchema>;
export type AuthSession = typeof authSessionsTable.$inferSelect;