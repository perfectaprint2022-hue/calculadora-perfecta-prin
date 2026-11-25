import { clerkClient, getAuth } from "@clerk/express";
import { db, accessUsersTable, type AccessUser } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type RequestHandler } from "express";

const router: IRouter = Router();
const accessStatuses = ["pending", "approved", "blocked"] as const;
type AccessStatus = (typeof accessStatuses)[number];

function masterEmail() {
  return process.env.MASTER_EMAIL?.trim().toLowerCase() ?? "";
}

function primaryEmail(user: Awaited<ReturnType<typeof clerkClient.users.getUser>>) {
  const address = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
  return address?.emailAddress.trim().toLowerCase() ?? "";
}

function displayName(user: Awaited<ReturnType<typeof clerkClient.users.getUser>>) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || primaryEmail(user);
}

function toPublicAccessUser(user: AccessUser, isMaster: boolean) {
  return {
    id: user.id,
    clerkUserId: user.clerkUserId,
    email: user.email,
    name: user.name,
    status: user.status,
    isMaster,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function getCurrentAccessUser(userId: string) {
  const clerkUser = await clerkClient.users.getUser(userId);
  const email = primaryEmail(clerkUser);
  if (!email) {
    throw new Error("The signed-in Clerk user has no email address.");
  }

  const isMaster = Boolean(masterEmail()) && email === masterEmail();
  let [accessUser] = await db.select().from(accessUsersTable).where(eq(accessUsersTable.clerkUserId, userId)).limit(1);

  if (!accessUser) {
    [accessUser] = await db
      .insert(accessUsersTable)
      .values({
        clerkUserId: userId,
        email,
        name: displayName(clerkUser),
        status: isMaster ? "approved" : "pending",
      })
      .onConflictDoNothing({ target: accessUsersTable.clerkUserId })
      .returning();
  }

  if (!accessUser) {
    [accessUser] = await db.select().from(accessUsersTable).where(eq(accessUsersTable.clerkUserId, userId)).limit(1);
  }

  if (!accessUser) {
    throw new Error("Could not create the local access record.");
  }

  if (isMaster && accessUser.status !== "approved") {
    [accessUser] = await db
      .update(accessUsersTable)
      .set({ email, name: displayName(clerkUser), status: "approved", updatedAt: new Date() })
      .where(eq(accessUsersTable.id, accessUser.id))
      .returning();
  }

  return { user: accessUser, isMaster };
}

const requireAuth: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

router.get("/access/me", requireAuth, async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const current = await getCurrentAccessUser(userId);
    res.json({ user: toPublicAccessUser(current.user, current.isMaster) });
  } catch (error) {
    req.log.error({ err: error }, "Could not load access status");
    res.status(500).json({ error: "Could not load access status" });
  }
});

router.get("/access/users", requireAuth, async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const current = await getCurrentAccessUser(userId);
    if (!current.isMaster) {
      res.status(403).json({ error: "Master access required" });
      return;
    }

    const users = await db.select().from(accessUsersTable).orderBy(desc(accessUsersTable.createdAt));
    res.json({
      users: users.map((user) => toPublicAccessUser(user, user.email === masterEmail())),
    });
  } catch (error) {
    req.log.error({ err: error }, "Could not load access users");
    res.status(500).json({ error: "Could not load access users" });
  }
});

router.patch("/access/users/:id", requireAuth, async (req, res) => {
  try {
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const current = await getCurrentAccessUser(userId);
    if (!current.isMaster) {
      res.status(403).json({ error: "Master access required" });
      return;
    }

    const id = Number(req.params.id);
    const status = req.body?.status as unknown;
    if (!Number.isInteger(id) || typeof status !== "string" || !accessStatuses.includes(status as AccessStatus)) {
      res.status(400).json({ error: "Invalid access update" });
      return;
    }

    const [target] = await db.select().from(accessUsersTable).where(eq(accessUsersTable.id, id)).limit(1);
    if (!target) {
      res.status(404).json({ error: "Access user not found" });
      return;
    }
    if (target.email === masterEmail()) {
      res.status(400).json({ error: "The master account cannot be blocked" });
      return;
    }

    const [updated] = await db
      .update(accessUsersTable)
      .set({ status: status as AccessStatus, updatedAt: new Date() })
      .where(and(eq(accessUsersTable.id, id), eq(accessUsersTable.email, target.email)))
      .returning();

    res.json({ user: toPublicAccessUser(updated, false) });
  } catch (error) {
    req.log.error({ err: error }, "Could not update access user");
    res.status(500).json({ error: "Could not update access user" });
  }
});

export default router;