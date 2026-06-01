import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { ensureProfile } from "../middleware/roles.js";

app.http("accountsList", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "accounts",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };
    await ensureProfile(user);

    const result = await pool.query(`
      SELECT a.*,
        COALESCE(json_agg(json_build_object('id', w.id, 'stage', w.stage))
          FILTER (WHERE w.id IS NOT NULL), '[]') AS workshops
      FROM accounts a
      LEFT JOIN workshops w ON w.account_id = a.id
      GROUP BY a.id
      ORDER BY a.account_name
    `);
    return { jsonBody: result.rows };
  },
});

app.http("accountGet", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "accounts/{id}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const id = req.params.id;
    const acct = await pool.query("SELECT * FROM accounts WHERE id = $1", [id]);
    if (acct.rows.length === 0) return { status: 404, jsonBody: { error: "Not found" } };

    const workshops = await pool.query(
      `SELECT id, workshop_name, part_101_complete, part_201_complete, part_301_complete,
              stage, planned_date_time, ato_owner
       FROM workshops WHERE account_id = $1`,
      [id]
    );

    return { jsonBody: { ...acct.rows[0], workshops: workshops.rows } };
  },
});

app.http("accountCreate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "accounts",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const body = (await req.json()) as Record<string, unknown>;
    if (!body.account_name) return { status: 400, jsonBody: { error: "account_name required" } };

    try {
      const result = await pool.query(
        `INSERT INTO accounts (account_name, account_manager_name, region, classification, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [body.account_name, body.account_manager_name || null, body.region || null, body.classification || null, body.notes || null]
      );
      return { status: 201, jsonBody: result.rows[0] };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.includes("unique")) return { status: 409, jsonBody: { error: "Account name already exists" } };
      return { status: 500, jsonBody: { error: msg } };
    }
  },
});

app.http("accountUpdate", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "accounts/{id}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const id = req.params.id;
    const body = (await req.json()) as Record<string, unknown>;
    const allowed = ["account_name", "account_manager_name", "region", "classification", "notes"];
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
      `UPDATE accounts SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (result.rows.length === 0) return { status: 404, jsonBody: { error: "Not found" } };
    return { jsonBody: result.rows[0] };
  },
});
