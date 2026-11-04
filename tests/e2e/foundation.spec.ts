import { test, expect } from "@playwright/test";
test("P1-HEALTH: live DB round trip and honest global banner/footer", async ({ page, request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ db: "ok", processing: "disabled", renderer: "remote" });
  for (const path of ["/", "/about", "/p/foundation", "/s/foundation"]) {
    await page.goto(path);
    await expect(page.getByText("Experimental · not reviewed by BdSL signers", { exact: true })).toBeVisible();
    await expect(page.getByAltText("Official event sticker")).toBeVisible();
    await expect(page.locator("footer")).toContainText("IsharaKotha v2");
    await expect(page.locator("footer")).toContainText("UEA CWASA");
  }
});
