import { test, expect } from "vitest";
import { validateRendererEvent } from "@/lib/player/rendererHost";
test("T23: source, instance and payload are all validated", () => {
  const source = {} as Window;
  const instanceId = "00000000-0000-4000-8000-000000000001";
  const data = { instanceId, gen: 0, type: "avatarready", payload: null };
  expect(validateRendererEvent({ source, data }, source, instanceId)).toEqual(data);
  expect(validateRendererEvent({ source: {} as Window, data }, source, instanceId)).toBeNull();
  expect(validateRendererEvent({ source, data: { ...data, instanceId: "foreign" } }, source, instanceId)).toBeNull();
  expect(validateRendererEvent({ source, data: { ...data, payload: { bad: true } } }, source, instanceId)).toBeNull();
  expect(validateRendererEvent({ source, data: { ...data, type: "unknown" } }, source, instanceId)).toBeNull();
});
