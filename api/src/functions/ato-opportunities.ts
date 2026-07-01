import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { ensureProfile } from "../middleware/roles.js";

app.http("atoOpportunitiesList", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "ato-opportunities",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };
    await ensureProfile(user);

    const result = await pool.query(`
      SELECT o.*,
             json_build_object('id', a.id, 'account_name', a.account_name,
                               'account_manager_name', a.account_manager_name,
                               'region', a.region) AS accounts
      FROM ato_opportunities o
      JOIN accounts a ON a.id = o.account_id
      ORDER BY o.updated_at DESC
    `);
    return { jsonBody: result.rows };
  },
});

app.http("atoOpportunityGet", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "ato-opportunities/{id}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const id = req.params.id;
    const result = await pool.query(
      `SELECT o.*,
              json_build_object('id', a.id, 'account_name', a.account_name,
                                'account_manager_name', a.account_manager_name,
                                'region', a.region) AS accounts
       FROM ato_opportunities o
       JOIN accounts a ON a.id = o.account_id
       WHERE o.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return { status: 404, jsonBody: { error: "Not found" } };
    return { jsonBody: result.rows[0] };
  },
});

app.http("atoOpportunityCreate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "ato-opportunities",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const body = (await req.json()) as Record<string, unknown>;
    if (!body.account_id) return { status: 400, jsonBody: { error: "account_id required" } };

    const result = await pool.query(
      `INSERT INTO ato_opportunities (account_id, opportunity_name, poc_name)
       VALUES ($1, $2, $3) RETURNING *`,
      [body.account_id, body.opportunity_name || null, body.poc_name || null]
    );
    return { status: 201, jsonBody: result.rows[0] };
  },
});

app.http("atoOpportunityUpdate", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "ato-opportunities/{id}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const id = req.params.id;
    const body = (await req.json()) as Record<string, unknown>;
    const allowed = [
      "opportunity_name", "stage", "poc_name",
      "est_revenue_text", "est_revenue_url", "ms_funding_status",
      "bucket", "use_cases_status", "proposal_status", "current_status",
      "description", "dependency_risks", "next_steps", "opportunities",
      "funding_anticipated_amount", "funding_recognized_amount",
      "technical_blocker", "technical_blocker_comments",
      "personnel_blocker", "personnel_blocker_comments",
      "ato_owner", "notes",
    ];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        if (key === "opportunities") {
          sets.push(`${key} = $${idx++}::jsonb`);
          vals.push(JSON.stringify(body[key]));
        } else if (key === "stage") {
          sets.push(`${key} = $${idx++}`);
          sets.push(`stage_last_updated_at = now()`);
          vals.push(body[key]);
        } else {
          sets.push(`${key} = $${idx++}`);
          vals.push(body[key]);
        }
      }
    }
    if (sets.length === 0) return { status: 400, jsonBody: { error: "No fields to update" } };
    vals.push(id);

    const result = await pool.query(
      `UPDATE ato_opportunities SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (result.rows.length === 0) return { status: 404, jsonBody: { error: "Not found" } };
    return { jsonBody: result.rows[0] };
  },
});

app.http("atoOpportunityDelete", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "ato-opportunities/{id}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const id = req.params.id;
    const result = await pool.query("DELETE FROM ato_opportunities WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) return { status: 404, jsonBody: { error: "Not found" } };
    return { status: 204 };
  },
});
