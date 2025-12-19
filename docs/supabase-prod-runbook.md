# Supabase Prod Migration Runbook

Use this guide whenever we need to apply database migrations to the Lumiso production Supabase project.

## Prerequisites
- Confirm you have the Supabase CLI installed (`npx supabase --version`).
- Make sure you are authenticated: `npx supabase login`.
- Keep `.codex/rules.md` handy for any additional deployment expectations.

## Deployment Steps
1. **Link the project**  
   ```bash
   npx supabase link --project-ref rifdykpdubrowzbylffe
   ```  
   The command can be run from the repo root or `supabase/`. It will warn if the local `supabase/config.toml` `major_version` differs; capture the warning if it appears.

2. **Dry-run the push**  
   ```bash
   npx supabase db push --dry-run
   ```  
   - Expect “Remote database is up to date” when nothing new is pending.  
   - If the CLI suggests rerunning with `--include-all`, note the migrations it lists and move to Troubleshooting.

3. **Push migrations**  
   ```bash
   npx supabase db push
   ```  
   Review the prompt that shows which files are about to run and confirm.

4. **Post-push dry-run**  
   ```bash
   npx supabase db push --dry-run
   ```  
   This should again report that the remote database is up to date.

5. **Deploy edge functions (if updated)**  
   ```bash
   npx supabase functions deploy gallery-download
   npx supabase functions deploy gallery-download-processor
   ```  
   Repeat for any other Supabase Edge functions touched in the release.

## Post-Deployment Checks
- Spot-check key tables in Supabase Studio if data changes are expected (e.g., new columns populated by backfill scripts).
- Record the migration file names and timestamp in the deployment notes or ticket.
- If new cron jobs were introduced (for example, gallery download processing), verify them in `cron.job` after the push.

## Troubleshooting
- **Skipped migrations due to naming**  
  If the CLI outputs `Skipping migration ... (file name must match pattern "<timestamp>_name.sql")`, rename the files to use `_` instead of the first `-`, then run:  
  ```bash
  npx supabase migration repair --status applied <timestamp> [...]
  ```  
  Re-run the dry-run to ensure the remote history aligns.
- **Local Docker requirement errors**  
  Some `npx supabase db dump` commands expect Docker. If Docker is unavailable and the dump is optional, skip it; otherwise coordinate with someone who has Docker running.
- **Authentication issues**  
  Re-run `npx supabase login` and ensure you are using the correct account with access to `rifdykpdubrowzbylffe`.
- **Major version mismatch warnings**  
  When linking warns about `db.major_version`, capture the warning and sync with the team before modifying `supabase/config.toml`.

## Notes
- The project reference is hard-coded as `rifdykpdubrowzbylffe`; update this runbook if Supabase projects change.
- Always follow any additional rollout steps documented in `.codex/rules.md` or feature-specific plans (e.g., `docs/services-and-packages-plan.md`).
