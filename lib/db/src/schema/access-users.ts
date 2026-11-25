import { createInsertSchema } from "drizzle-zod";
import { boolean, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const accessStatusEnum = pgEnum("access_status", ["pending", "approved", "blocked"]);

export const accessUsersTable = pgTable(
  "access_users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    status: accessStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    clerkUserIdUnique: uniqueIndex("access_users_clerk_user_id_unique").on(table.clerkUserId),
  }),
);

export const insertAccessUserSchema = createInsertSchema(accessUsersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAccessUser = z.infer<typeof insertAccessUserSchema>;
export type AccessUser = typeof accessUsersTable.$inferSelect;