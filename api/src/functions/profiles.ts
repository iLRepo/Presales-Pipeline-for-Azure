import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { ensureProfile, requireRole } from "../middleware/roles.js";

app.http("profilesList", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "profiles",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const result = await pool.query(`
      SELECT p.id, p.entra_id, p.email, p.full_name, p.created_at,
        COALESCE(json_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '[]') AS roles
      FROM profiles p
      LEFT JOIN user_roles ur ON ur.user_id = p.id
      GROUP BY p.id
      ORDER BY p.full_name
    `);
    return { jsonBody: result.rows };
  },
});

app.http("profileMe", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "profiles/me",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const profileId = await ensureProfile(user);
    const result = await pool.query(
      `SELECT p.id, p.entra_id, p.email, p.full_name,
        COALESCE(json_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '[]') AS roles
       FROM profiles p
       LEFT JOIN user_roles ur ON ur.user_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [profileId]
    );
    return { jsonBody: result.rows[0] };
  },
});

app.http("grantRole", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "user-roles",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const isAdmin = await requireRole(user, "ATO Admin");
    if (!isAdmin) return { status: 403, jsonBody: { error: "ATO Admin required" } };

    const body = (await req.json()) as Record<string, unknown>;
    if (!body.user_id || !body.role)
      return { status: 400, jsonBody: { error: "user_id and role required" } };

    try {
      await pool.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, $2)",
        [body.user_id, body.role]
      );
      return { status: 201, jsonBody: { ok: true } };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.includes("unique")) return { status: 409, jsonBody: { error: "Role already granted" } };
      return { status: 500, jsonBody: { error: msg } };
    }
  },
});

app.http("revokeRole", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "user-roles/{userId}/{role}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const isAdmin = await requireRole(user, "ATO Admin");
    if (!isAdmin) return { status: 403, jsonBody: { error: "ATO Admin required" } };

    const { userId, role } = req.params;
    await pool.query(
      "DELETE FROM user_roles WHERE user_id = $1 AND role = $2",
      [userId, role]
    );
    return { status: 204 };
  },
});
