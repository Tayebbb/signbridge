import { test, expect } from "@playwright/test";
import { createServer, request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import type { RendererEvent } from "@/lib/player/rendererHost";

test("T23: opaque-origin CWASA animates, relays instance hooks and sends no owner cookie", async ({ page, context }, testInfo) => {
  const healthRequests: { origin?: string; cookiePresent: boolean; status?: number }[] = [];
  const consoleMessages: string[] = [];
  const errors: string[] = [];
  const server = createServer((req, res) => {
    const isHealth = req.url?.startsWith("/api/health");
    const observed = { origin: req.headers.origin, cookiePresent: Boolean(req.headers.cookie), status: undefined as number | undefined };
    if (isHealth) healthRequests.push(observed);
    const headers: IncomingHttpHeaders = { ...req.headers, host: "127.0.0.1:43181" };
    const upstream = httpRequest({ hostname: "127.0.0.1", port: 43181, path: req.url, method: req.method, headers }, response => {
      observed.status = response.statusCode;
      res.writeHead(response.statusCode ?? 502, response.headers); response.pipe(res);
    });
    upstream.on("error", () => { res.writeHead(502); res.end(); });
    req.pipe(upstream);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  page.on("console", message => { if (["error", "warning"].includes(message.type())) consoleMessages.push(message.text()); });
  page.on("pageerror", error => errors.push(error.message));
  const prefix = `${process.env.SIGNBRIDGE_EVIDENCE_PHASE==="6"?"docs/evidence/phase-6/foundation-t23":"docs/evidence/t23"}-${testInfo.project.name}`;
  let events: RendererEvent[] = [];
  let passed = false;
  let csp: string | undefined;
  try {
    await context.addCookies([{ name: "__Host-signbridge-owner", value: "synthetic-cookie-isolation-test", domain: "127.0.0.1", path: "/", httpOnly: true, secure: true, sameSite: "Lax" }]);
    await page.goto(origin + "/api/health");
    expect(healthRequests.some(r => r.cookiePresent && r.status === 200)).toBe(true);
    const response = await page.goto(origin + "/renderer-spike");
    expect(response?.status()).toBe(200);
    await expect(page.locator("iframe")).toHaveAttribute("sandbox", "allow-scripts");
    await expect(page.locator("iframe")).toHaveAttribute("src", /instanceId=/);
    await expect(page.getByTestId("engine-status")).toContainText("Avatar ready", { timeout: 60_000 });
    const frame = page.frames().find(f => f.url().includes("/renderer.html"));
    expect(frame).toBeTruthy();
    csp = (await context.request.get(frame!.url())).headers()["content-security-policy"];
    await page.getByRole("button", { name: "Animate technical fixture" }).click();
    await expect.poll(async () => {
      events = JSON.parse(await page.getByTestId("renderer-events").textContent() ?? "[]");
      const trial = events.filter(e => e.gen === 1);
      return trial.some(e => e.type === "animactive") && trial.some(e => e.type === "avatarframe") && trial.some(e => e.type === "animidle");
    }, { timeout: 40_000 }).toBe(true);
    const fixture = await readFile("public/fixtures/cross-file-case-1.sigml", "utf8");
    const expectedIds = [...fixture.matchAll(/gloss="([^"]+)"/g)].map(m => m[1]);
    const trial = events.filter(e => e.gen === 1);
    expect(trial.find(e => e.type === "sigmlloaded")?.payload).toMatchObject({ s: expectedIds.length });
    expect([...new Set(trial.filter(e => e.type === "avatarsign").map(e => e.payload.g))]).toEqual(expectedIds);
    expect(new Set(events.map(e => e.instanceId)).size).toBe(1);
    expect(events.filter(e => e.type === "cspviolation")).toEqual([]);
    expect(consoleMessages.filter(m => /violates|refused.*(script|connect|style)|unsafe-eval/i.test(m))).toEqual([]);
    await page.getByRole("button", { name: "Probe cookie isolation" }).click();
    await expect.poll(() => healthRequests.find(r => r.origin === "null")?.status).toBe(200);
    expect(healthRequests.find(r => r.origin === "null")?.cookiePresent).toBe(false);
    await expect.poll(async () => JSON.parse(await page.getByTestId("renderer-events").textContent() ?? "[]").some((e: RendererEvent) => e.type === "healthprobe")).toBe(true);
    passed = true;
  } finally {
    await mkdir("docs/evidence", { recursive: true });
    try { events = JSON.parse(await page.getByTestId("renderer-events").textContent({ timeout: 2000 }) ?? "[]"); } catch { /* Preserve earlier events on navigation failure. */ }
    await page.screenshot({ path: `${prefix}.png`, fullPage: true });
    await writeFile(`${prefix}.json`, JSON.stringify({ passed, browser: testInfo.project.name, environment: "Windows; headless; SwiftShader software WebGL", csp, healthRequests, consoleMessages, errors, events }, null, 2));
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
