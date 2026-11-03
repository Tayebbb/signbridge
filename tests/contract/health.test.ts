import { test, expect, vi, afterEach } from "vitest";
vi.mock("@/lib/db/queries/health", () => ({ healthStatus: vi.fn() }));
import { healthStatus } from "@/lib/db/queries/health";
import { GET } from "@/app/api/health/route";
afterEach(() => vi.resetAllMocks());
test("P1-HEALTH: success matches G.1, processing remains disabled", async () => {
  vi.mocked(healthStatus).mockResolvedValue({ db: "ok", processing: "disabled", renderer: "remote" });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ db: "ok", processing: "disabled", renderer: "remote" });
});
test("P1-HEALTH: DB failure returns 503 without leaking connection details", async () => {
  vi.mocked(healthStatus).mockRejectedValue(new Error("private connection detail"));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: { code: "DB_UNAVAILABLE", message: "Database is unavailable", retryable: true } });
});
