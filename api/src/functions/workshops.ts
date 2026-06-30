import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { ensureProfile } from "../middleware/roles.js";

app.http("workshopsList", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "workshops",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };
    await ensureProfile(user);

    const view = req.query.get("view");

    if (view === "pipeline") {
      const result = await pool.query(`
        SELECT w.id, w.account_id, w.stage, w.stage_last_updated_at, w.updated_at,
               w.planned_date_time,
               w.ato_owner, w.eligibility_status, w.funding_anticipated_amount,
               w.technical_blocker, w.personnel_blocker,
               w.poc_name, w.est_revenue_text, w.est_revenue_url, w.ms_funding_status,
               w.bucket, w.use_cases_status, w.proposal_status, w.current_status,
               w.workshop_details, w.dependency_risks, w.next_steps, w.opportunities,
               json_build_object('account_name', a.account_name,
                                 'account_manager_name', a.account_manager_name,
                                 'region', a.region) AS accounts,
               COALESCE((SELECT json_agg(json_build_object('id', s.id, 'value', s.value, 'afo_revenue', s.afo_revenue))
                 FROM sows s WHERE s.workshop_id = w.id), '[]') AS sows,
               COALESCE((SELECT json_agg(json_build_object('id', t.id, 'status', t.status))
                 FROM tasks t WHERE t.related_workshop_id = w.id), '[]') AS tasks
        FROM workshops w
        JOIN accounts a ON a.id = w.account_id
        ORDER BY w.stage_last_updated_at DESC
      `);
      return { jsonBody: result.rows };
    }

    const result = await pool.query(`
      SELECT w.id, w.account_id, w.stage, w.stage_last_updated_at,
             w.planned_date_time, w.delivered_date_time, w.eligibility_status,
             w.ato_owner, w.workshop_results_sent,
             w.funding_recognized_amount, w.funding_anticipated_amount, w.updated_at,
             json_build_object('account_name', a.account_name,
                               'account_manager_name', a.account_manager_name,
                               'region', a.region) AS accounts,
             COALESCE((SELECT json_agg(json_build_object('id', s.id, 'status', s.status))
               FROM sows s WHERE s.workshop_id = w.id), '[]') AS sows
      FROM workshops w
      JOIN accounts a ON a.id = w.account_id
      ORDER BY w.updated_at DESC
    `);
    return { jsonBody: result.rows };
  },
});

app.http("workshopGet", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "workshops/{id}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const id = req.params.id;
    const ws = await pool.query(
      `SELECT w.*, json_build_object('id', a.id, 'account_name', a.account_name,
         'account_manager_name', a.account_manager_name, 'region', a.region) AS accounts
       FROM workshops w JOIN accounts a ON a.id = w.account_id WHERE w.id = $1`,
      [id]
    );
    if (ws.rows.length === 0) return { status: 404, jsonBody: { error: "Not found" } };

    const [sows, tasks] = await Promise.all([
      pool.query("SELECT * FROM sows WHERE workshop_id = $1 ORDER BY created_at", [id]),
      pool.query("SELECT * FROM tasks WHERE related_workshop_id = $1 ORDER BY created_at", [id]),
    ]);

    return { jsonBody: { ...ws.rows[0], sows: sows.rows, tasks: tasks.rows } };
  },
});

app.http("workshopCreate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "workshops",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const body = (await req.json()) as Record<string, unknown>;
    if (!body.account_id) return { status: 400, jsonBody: { error: "account_id required" } };

    const result = await pool.query(
      `INSERT INTO workshops (account_id, stakeholder_contact)
       VALUES ($1, $2) RETURNING *`,
      [body.account_id, body.stakeholder_contact || null]
    );
    return { status: 201, jsonBody: result.rows[0] };
  },
});

app.http("workshopUpdate", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "workshops/{id}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const id = req.params.id;
    const body = (await req.json()) as Record<string, unknown>;
    const allowed = [
      "workshop_name", "stage", "stakeholder_contact",
      "first_meeting_scheduled", "envisioning_proposed", "workshop_agreed",
      "attendees_roles_collected", "additional_use_cases_needed", "content_built",
      "planned_date_time", "delivered_date_time",
      "part_101_complete", "part_201_complete", "part_301_complete",
      "workshop_results_sent", "use_cases_identified", "use_cases_id",
      "ato_proposed", "proposal_created",
      "eligibility_status", "account_designation",
      "funding_submitted", "funding_submitted_date",
      "funding_recognized_amount", "funding_anticipated_amount",
      "technical_blocker", "technical_blocker_comments",
      "personnel_blocker", "personnel_blocker_comments",
      "ato_owner", "poc_name", "est_revenue_text", "est_revenue_url", "ms_funding_status",
      "bucket", "use_cases_status", "proposal_status", "current_status",
      "workshop_details", "dependency_risks", "next_steps", "opportunities",
      "notes",
    ];
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    for (const key of allowed) {
      if (key in body) {
        if (key === "opportunities") {
          sets.push(`${key} = $${idx++}::jsonb`);
          vals.push(JSON.stringify(body[key]));
        } else {
          sets.push(`${key} = $${idx++}`);
          vals.push(body[key]);
        }
      }
    }
    if (sets.length === 0) return { status: 400, jsonBody: { error: "No fields to update" } };
    vals.push(id);

    const result = await pool.query(
      `UPDATE workshops SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (result.rows.length === 0) return { status: 404, jsonBody: { error: "Not found" } };
    return { jsonBody: result.rows[0] };
  },
});

app.http("workshopDelete", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "workshops/{id}",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const id = req.params.id;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM tasks WHERE related_workshop_id = $1", [id]);
      await client.query("DELETE FROM sows WHERE workshop_id = $1", [id]);
      const result = await client.query("DELETE FROM workshops WHERE id = $1 RETURNING id", [id]);
      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return { status: 404, jsonBody: { error: "Not found" } };
      }
      await client.query("COMMIT");
      return { status: 204 };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
});
