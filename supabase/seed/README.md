# Supabase Seed Reference

All default data we inject via migrations/functions is mirrored here for quick lookup.

## Files

- `services.json` – master list of sample services seeded for new organizations (used by `ensure_default_services_for_org`).
- `packages.json` – default package definitions including linked services and delivery methods (used by `ensure_default_packages_for_org`).
- `package_delivery_methods.json` – reusable delivery methods seeded when an organization has no catalog yet (used by `ensure_default_package_delivery_methods_for_org`).

Keep these JSON files in sync with the corresponding Supabase functions when updating defaults.
