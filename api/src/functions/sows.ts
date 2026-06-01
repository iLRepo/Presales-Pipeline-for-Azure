import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

app.http("sowGet", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sows/{id}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const id = req.params.id;
    const sow = await pool.query("SELECT * FROM sows WHERE id = $1", [id]);
    if (sow.rows.length === 0) return { status: 404, jsonBody: { error: "Not found" } };

    const ws = await pool.query(
      `SELECT w.id, json_build_object('account_name', a.account_name) AS accounts
       FROM workshops w JOIN accounts a ON a.id = w.account_id WHERE w.id = $1`,
      [sow.rows[0].workshop_id]
    );
    const tasks = await pool.query(
      "SELECT * FROM tasks WHERE related_sow_id = $1 ORDER BY created_at",
      [id]
    );

    return {
      jsonBody: {
        ...sow.rows[0],
        workshops: ws.rows[0] || null,
        tasks: tasks.rows,
      },
    };
  },
});

app.http("sowCreate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "sows",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const body = (await req.json()) as Record<string, unknown>;
    if (!body.workshop_id || !body.sow_name)
      return { status: 400, jsonBody: { error: "workshop_id and sow_name required" } };

    const result = await pool.query(
      `INSERT INTO sows (workshop_id, sow_name) VALUES ($1, $2) RETURNING *`,
      [body.workshop_id, body.sow_name]
    );
    return { status: 201, jsonBody: result.rows[0] };
  },
});

app.http("sowUpdate", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "sows/{id}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const id = req.params.id;
    const body = (await req.json()) as Record<string, unknown>;
    const allowed = [
      "sow_name", "status", "current_action_owner",
      "value", "afo_revenue", "notes", "submitted_date", "signed_date",
    ];
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
      `UPDATE sows SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (result.rows.length === 0) return { status: 404, jsonBody: { error: "Not found" } };
    return { jsonBody: result.rows[0] };
  },
});

app.http("sowDelete", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "sows/{id}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const id = req.params.id;
    const result = await pool.query("DELETE FROM sows WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) return { status: 404, jsonBody: { error: "Not found" } };
    return { status: 204 };
  },
});
