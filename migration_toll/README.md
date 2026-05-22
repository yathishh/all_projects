# DBMigrate Pro

Enterprise Database Migration, Backup & Restore Platform — a React SPA backed by [Supabase](https://supabase.com).

## Features

- **Migration Projects** — plan and track end-to-end database migrations across 15 database types (Oracle, PostgreSQL, MySQL, MongoDB, Cassandra, DynamoDB, and more)
- **Backup Jobs** — schedule and manage backups with 12 backup types and multiple storage backends (S3, Azure Blob, GCS, NFS, SFTP)
- **Restore Jobs** — full, point-in-time, selective, and cross-database restore operations
- **Connection Profiles** — centralized connection management with pool configuration
- **Storage Engines** — configure cloud/local storage (S3, Azure Blob, GCS, MinIO, Backblaze, Ceph, and more)
- **Compatibility Checker** — check source → target database compatibility before migrating
- **Audit Trail** — full event log of all actions
- **Alert Rules** — email/Slack notifications for failures, storage thresholds, and more
- **Dark mode** — full Tailwind CSS dark mode support

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 6 |
| Routing | React Router v6 |
| State / Data | TanStack React Query v5 |
| UI Components | shadcn/ui (Radix UI) + Tailwind CSS |
| Backend / Auth | Supabase (PostgreSQL + Auth) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |

## Getting Started

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- A free [Supabase](https://supabase.com) account

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Once created, go to **Project Settings → API**
3. Copy your **Project URL** and **anon / public key**

### 3. Set up the database

In your Supabase dashboard → **SQL Editor**, paste and run the contents of:

```
supabase/migrations/001_initial_schema.sql
```

This creates all 9 tables with Row Level Security enabled.

### 4. Configure environment variables

Copy the example file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — you'll see the login page. Sign up with any email/password to create your first account.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run typecheck` | Run TypeScript type checking |

## Deployment

### Docker (local production preview)

```bash
# Build and run the production image
docker compose --profile prod-preview up --build
# → http://localhost:8080
```

### CI/CD (GitHub Actions)

Three workflows are included:

| Workflow | Trigger | Environment |
|---|---|---|
| `.github/workflows/deploy-dev.yml` | push to `dev` branch | Development |
| `.github/workflows/deploy-stage.yml` | push to `stage` branch | Staging |
| `.github/workflows/deploy-prod.yml` | push to `main` branch | Production (manual approval) |

Add the following secrets to **GitHub → Settings → Secrets → Actions** for each environment:

```
DEV_SUPABASE_URL        / STAGE_SUPABASE_URL        / PROD_SUPABASE_URL
DEV_SUPABASE_ANON_KEY   / STAGE_SUPABASE_ANON_KEY   / PROD_SUPABASE_ANON_KEY
```

### Branch strategy

```
feature/* → PR → dev → stage → main (prod)
```

## Project Structure

```
src/
├── api/
│   ├── supabaseClient.js   # Supabase JS client
│   └── base44Client.js     # Data access layer (CRUD helpers over Supabase)
├── lib/
│   ├── AuthContext.jsx     # Supabase auth provider
│   ├── dbConstants.js      # Database type definitions
│   └── utils.js            # Shared utilities
├── components/
│   ├── layout/             # AppLayout, sidebar
│   ├── dashboard/          # StatsRow, RecentProjects, DbDistribution
│   ├── shared/             # StatusBadge, DbBadge, ProgressRing, MigrationArrow
│   └── ui/                 # shadcn/ui components
├── pages/                  # 14 pages (Dashboard, Projects, Backups, etc.)
└── hooks/                  # use-mobile
supabase/
└── migrations/
    └── 001_initial_schema.sql  # Full database schema
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |

## License

MIT
