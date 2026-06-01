import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

app.http("tasksList", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "tasks",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const role = req.query.get("role");
    const status = req.query.get("status");
    const conditions: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (role && role !== "all") {
      conditions.push(`t.assigned_role = $${idx++}`);
      vals.push(role);
    }
    if (status && status !== "all") {
      conditions.push(`t.status = $${idx++}`);
      vals.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT t.*,
        CASE WHEN w.id IS NOT NULL THEN json_build_object(
          'id', w.id,
          'accounts', json_build_object('account_name', a.account_name)
        ) ELSE NULL END AS workshops
      FROM tasks t
      LEFT JOIN workshops w ON w.id = t.related_workshop_id
      LEFT JOIN accounts a ON a.id = w.account_id
      ${where}
      ORDER BY t.created_at DESC`,
      vals
    );
    return { jsonBody: result.rows };
  },
});

app.http("taskCreate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "tasks",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const body = (await req.json()) as Record<string, unknown>;
    if (!body.title) return { status: 400, jsonBody: { error: "title required" } };

    const result = await pool.query(
      `INSERT INTO tasks (title, assigned_role, related_workshop_id, related_sow_id, due_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        body.title,
        body.assigned_role || "ATO Admin",
        body.related_workshop_id || null,
        body.related_sow_id || null,
        body.due_date || null,
        body.notes || null,
      ]
    );
    return { status: 201, jsonBody: result.rows[0] };
  },
});

app.http("taskUpdate", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "tasks/{id}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const id = req.params.id;
    const body = (await req.json()) as Record<string, unknown>;
    const allowed = ["title", "assigned_role", "status", "due_date", "notes"];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = $${idx++}`);
        vals.push(body[key]);
      }
    }
    if (sets.length === 0) return { status: 400, jsonBody: { error: "No fields to update" } };
    vals.push(id);

    const result = await pool.query(
      `UPDATE tasks SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (result.rows.length === 0) return { status: 404, jsonBody: { error: "Not found" } };
    return { jsonBody: result.rows[0] };
  },
});
