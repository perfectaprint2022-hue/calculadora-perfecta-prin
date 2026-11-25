import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const authRoleEnum = pgEnum("auth_role", ["master", "user"]);
export const authAccountStatusEnum = pgEnum("auth_account_status", ["active", "blocked"]);

export const authUsersTable = pgTable(
  "auth_users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    role: authRoleEnum("role").notNull().default("user"),
    status: authAccountStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    usernameUnique: uniqueIndex("auth_users_username_unique").on(table.username),
    singleMaster: uniqueIndex("auth_users_single_master_idx")
      .on(table.role)
      .where(sql`${table.role} = 'master'`),
  }),
);

export const insertAuthUserSchema = createInsertSchema(authUsersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAuthUser = z.infer<typeof insertAuthUserSchema>;
export type AuthUser = typeof authUsersTable.$inferSelect;