import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { runRefresh } from "@/lib/refresh";

// Scheduled refresh. Vercel Cron calls this with "Authorization: Bearer
// $CRON_SECRET" automatically; any other scheduler (cron-job.org, GitHub
// Actions, a Docker sidecar) must send the same header.

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16 || !header) return false;
  // Hash both sides so the comparison is constant-time regardless of length.
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export async function GET() {
  if (!authorized((await headers()).get("authorization"))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await runRefresh();
    // 200 even when the provider failed: the run itself worked and the old
    // data is still being served. Details are in the body and admin dashboard.
    return Response.json(report);
  } catch (error) {
    console.error("[cron] refresh failed", error);
    return Response.json({ ok: false, error: "Refresh failed. See server logs." }, { status: 500 });
  }
}
