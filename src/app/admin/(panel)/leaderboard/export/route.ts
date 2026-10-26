import type { NextRequest } from "next/server";
import { z } from "zod";
import { adminStandings, periodStatus } from "@/lib/admin-leaderboard";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { exportFileStem, standingsCsv } from "@/lib/standings-export";

// Downloads a period's standings with real usernames, for admins only.
//   GET /admin/leaderboard/export?period=<id>&format=csv|json

const query = z.object({ period: z.string().min(1).max(64), format: z.enum(["csv", "json"]) });

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: "Expected ?period=<id>&format=csv|json" }, { status: 400 });
  const period = await db.period.findUnique({ where: { id: parsed.data.period } });
  if (!period) return Response.json({ error: "Period not found" }, { status: 404 });

  const rows = await adminStandings(period);
  const status = periodStatus(period);
  const name = `zeedude-${exportFileStem(period.name)}-${status === "ended" ? "final" : "live"}`;
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

  if (parsed.data.format === "csv") {
    return new Response(standingsCsv(rows), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` },
    });
  }
  const body = {
    period: {
      id: period.id,
      name: period.name,
      startsAt: period.startsAt.toISOString(),
      endsAt: period.endsAt.toISOString(),
      prizePoolSol: period.prizePoolSol,
      status,
      dataUpdatedAt: period.dataUpdatedAt?.toISOString() ?? null,
    },
    exportedAt: new Date().toISOString(),
    rows,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.json"` },
  });
}
