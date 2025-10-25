import { assertEquals, assertStringIncludes } from "std/testing/asserts.ts";
import {
  generateHTMLContent,
  replacePlaceholders
} from "../send-template-email/index.ts";

Deno.test("replacePlaceholders handles fallbacks and sanitization", () => {
  const data = {
    first_name: "Jordan",
    missing_value: "",
    session_location: "Studio",
    customer_phone: ""
  };

  const result = replacePlaceholders(
    "Hi {first_name}, meet at {session_location} ({customer_phone|no phone}) {missing_value|fallback}",
    data
  );

  assertEquals(result, "Hi Jordan, meet at - (no phone) fallback");
});

Deno.test("generateHTMLContent renders sorted blocks with placeholders", () => {
  const html = generateHTMLContent(
    [
      {
        id: "2",
        type: "text",
        order: 2,
        data: {
          content: "See you at {session_location}",
          formatting: { alignment: "center", fontFamily: "Helvetica" }
        }
      },
      {
        id: "1",
        type: "text",
        order: 1,
        data: {
          content: "Hello {first_name}!",
          formatting: { fontSize: "h2", bold: true }
        }
      }
    ],
    {
      first_name: "Jordan",
      session_location: "Beach"
    },
    "Reminder for {first_name}",
    "Don't forget {first_name}",
    { photography_business_name: "Lumiso" },
    false
  );

  assertStringIncludes(html, "<title>Reminder for Jordan</title>");
  const firstIndex = html.indexOf("Hello Jordan!");
  const secondIndex = html.indexOf("See you at Beach");
  assertEquals(firstIndex < secondIndex, true);
  assertStringIncludes(html, "Don't forget Jordan");
});
