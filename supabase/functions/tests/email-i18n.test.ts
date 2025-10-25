import { assertEquals, assertArrayIncludes } from "std/testing/asserts.ts";
import { createEmailLocalization } from "../_shared/email-i18n.ts";

Deno.test("createEmailLocalization defaults to English when no language provided", () => {
  const localization = createEmailLocalization();
  assertEquals(localization.language, "en");
  assertEquals(
    localization.t("dailySummary.subject.defaultWithData"),
    "Your Daily Summary",
  );
});

Deno.test("createEmailLocalization supports Turkish translations", () => {
  const localization = createEmailLocalization("tr");
  assertEquals(localization.language, "tr");
  assertEquals(
    localization.t("dailySummary.subject.defaultEmpty"),
    "Günlük Özet - Bugün planlanan bir şey yok",
  );
  assertEquals(
    localization.t("common.footer.notice", { platformName: "Lumiso", businessName: "Foto" }),
    "Bu e-posta, Lumiso tarafından Foto için gönderilen otomatik bir bildiridir.",
  );
});

Deno.test("createEmailLocalization falls back to English for missing keys", () => {
  const localization = createEmailLocalization("tr-TR");
  assertEquals(
    localization.t("nonexistent.path"),
    "nonexistent.path",
  );
});

Deno.test("createEmailLocalization returns formatted lists", () => {
  const localization = createEmailLocalization("en");
  const tips = localization.list("dailySummary.empty.tips");
  assertEquals(tips.length, 4);
  assertArrayIncludes(tips, [
    "📞 Follow Up with Leads",
    "📋 Organize Your Projects",
  ]);
});
