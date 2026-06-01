import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import pool from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

app.http("reports", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "reports",
  handler: async (req: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const user = await requireAuth(req, context);
    if (!user) return { status: 401, jsonBody: { error: "Unauthorized" } };

    const [wsResult, acctResult] = await Promise.all([
      pool.query(`
        SELECT stage, account_id, planned_date_time, delivered_date_time,
               funding_recognized_amount, funding_anticipated_amount,
               technical_blocker, personnel_blocker,
               stage_last_updated_at, updated_at
        FROM workshops
      `),
      pool.query("SELECT id, region FROM accounts"),
    ]);

    const regionById: Record<string, string> = {};
    for (const a of acctResult.rows) {
      regionById[a.id] = a.region || "Unknown";
    }

    const workshops = wsResult.rows.map((w: Record<string, unknown>) => ({
      ...w,
      region: regionById[w.account_id as string] || "Unknown",
    }));

    return { jsonBody: workshops };
  },
});
