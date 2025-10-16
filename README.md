# Lumiso CRM

Lumiso is a CRM platform designed for photographers and studios to manage leads, clients, sessions, and projects with ease.

## 🔧 Tech Stack

- **React + TypeScript**
- **Vite**
- **TailwindCSS**
- **shadcn/ui**
- **Bun** (as package manager)
- **Netlify** (for CI/CD)

## 🚀 Local Development

```bash
bun install
bun run dev
```

## 🛠 Build for Production

```bash
bun run build
```

## 📦 Deployment

Pushed commits to `main` are automatically deployed via **Netlify**.

### Supabase Edge Functions

Any change under `supabase/functions/**` (including shared helpers and templates) must be deployed to Supabase after merging. Run the following from the repo root:

```bash
npx supabase functions deploy notification-processor --project-ref rifdykpdubrowzbylffe
npx supabase functions deploy send-reminder-notifications --project-ref rifdykpdubrowzbylffe
# Deploy additional functions here as needed when they are modified.
```

Make sure the Supabase CLI is authenticated and linked (`npx supabase login`, `npx supabase link --project-ref rifdykpdubrowzbylffe`) before deploying.

## 🤝 Contributors

This repo is maintained by [Togay Aytemiz](https://github.com/togay-aytemiz).
