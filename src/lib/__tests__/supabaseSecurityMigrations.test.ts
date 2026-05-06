import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("Supabase security migrations", () => {
  it("keeps the temporary signup debug table out of the public schema", () => {
    const migrationsDir = join(process.cwd(), "supabase", "migrations");
    const migrations = readdirSync(migrationsDir)
      .filter((fileName) => fileName.endsWith(".sql"))
      .sort()
      .map((fileName) => ({
        fileName,
        sql: readFileSync(join(migrationsDir, fileName), "utf8").toLowerCase(),
      }));

    const remediationMigration = migrations.find(({ fileName, sql }) =>
      fileName.endsWith("_resolve_signup_debug_logs_rls_advisor.sql") &&
      sql.includes("rls_disabled_in_public"),
    );

    expect(remediationMigration?.sql).toContain(
      "drop table if exists public.signup_debug_logs",
    );
    expect(remediationMigration?.sql).not.toContain(
      "disable row level security",
    );
  });
});
