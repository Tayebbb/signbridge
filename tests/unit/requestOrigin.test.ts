import {test,expect,vi,afterEach} from "vitest";
import {requestOrigin} from "@/lib/server/origin";
afterEach(()=>vi.unstubAllEnvs());
test("Browser origin uses validated Host when Next normalizes its internal URL",()=>{
  vi.stubEnv("APP_ORIGIN","");expect(requestOrigin(new Request("http://localhost:43182/api/projects",{headers:{host:"127.0.0.1:43182"}}))).toBe("http://127.0.0.1:43182");
  expect(requestOrigin(new Request("https://example.test/api/projects"))).toBe("https://example.test");
  expect(()=>requestOrigin(new Request("https://example.test/api/projects",{headers:{host:"foreign.test/path"}}))).toThrow();
});
test("Configured canonical origin wins and rejects a path or trailing slash",()=>{
  vi.stubEnv("APP_ORIGIN","https://signbridge.example");expect(requestOrigin(new Request("http://internal.test/api/projects",{headers:{host:"untrusted.test"}}))).toBe("https://signbridge.example");
  vi.stubEnv("APP_ORIGIN","https://signbridge.example/");expect(()=>requestOrigin(new Request("http://internal.test"))).toThrow();
});
