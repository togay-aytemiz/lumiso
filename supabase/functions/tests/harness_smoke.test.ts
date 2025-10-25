import { assert } from "std/testing/asserts.ts";

Deno.test("deno harness is configured", () => {
  assert(typeof Deno.version.deno === "string" && Deno.version.deno.length > 0);
});
