import { healthStatus } from "@/lib/db/queries/health";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(await healthStatus(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: { code: "DB_UNAVAILABLE", message: "Database is unavailable", retryable: true } }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
