import { assertEquals, assertStringIncludes } from "std/testing/asserts.ts";
import { corsHeaders, handler } from "../test-callback/index.ts";

Deno.test("handler returns CORS headers for OPTIONS requests", async () => {
  const response = await handler(new Request("https://example.com", { method: "OPTIONS" }));

  assertEquals(response.status, 200);
  for (const [key, value] of Object.entries(corsHeaders)) {
    assertEquals(response.headers.get(key), value);
  }
});

Deno.test("handler renders request metadata for GET requests", async () => {
  const response = await handler(
    new Request("https://example.com/test-callback?code=abc123&state=my-state", { method: "GET" }),
  );

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Content-Type"), "text/html");

  const body = await response.text();
  assertStringIncludes(body, "Test Callback Function");
  assertStringIncludes(body, "code");
  assertStringIncludes(body, "abc123");
  assertStringIncludes(body, "state");
  assertStringIncludes(body, "my-state");
  assertStringIncludes(body, "Search Params:");
});

Deno.test("handler surfaces errors when URL parsing fails", async () => {
  const originalURL = globalThis.URL;
  (globalThis as unknown as { URL: typeof URL }).URL = function brokenURL() {
    throw new Error("boom");
  } as unknown as typeof URL;

  try {
    const response = await handler(new Request("https://example.com", { method: "GET" }));
    assertEquals(response.status, 500);
    const body = await response.text();
    assertStringIncludes(body, "Error in Test Callback");
    assertStringIncludes(body, "boom");
  } finally {
    (globalThis as unknown as { URL: typeof URL }).URL = originalURL;
  }
});
