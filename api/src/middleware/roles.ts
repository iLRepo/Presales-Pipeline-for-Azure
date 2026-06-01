import pool from "../db/pool.js";
import { AuthUser } from "./auth.js";

export type AppRole = "ATO Admin" | "Account Manager" | "Alliance Team";

export async function getUserRoles(user: AuthUser): Promise<AppRole[]> {
  const result = await pool.query(
    `SELECT ur.role FROM user_roles ur
     JOIN profiles p ON p.id = ur.user_id
     WHERE p.entra_id = $1`,
    [user.oid]
  );
  return result.rows.map((r: { role: AppRole }) => r.role);
}

export async function ensureProfile(user: AuthUser): Promise<string> {
  const existing = await pool.query(
    "SELECT id FROM profiles WHERE entra_id = $1",
    [user.oid]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const inserted = await pool.query(
    "INSERT INTO profiles (entra_id, email, full_name) VALUES ($1, $2, $3) RETURNING id",
    [user.oid, user.email, user.name]
  );
  return inserted.rows[0].id;
}

export async function requireRole(
  user: AuthUser,
  ...allowedRoles: AppRole[]
): Promise<boolean> {
  const roles = await getUserRoles(user);
  return allowedRoles.some((r) => roles.includes(r));
}
