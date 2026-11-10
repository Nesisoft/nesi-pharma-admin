# Adurofie PMS - Admin Platform (nesi-pharma-admin)

Web platform Nesisoft uses to run the Adurofie PMS business: issue and revoke licence
keys, configure licence tiers and the features they unlock, register pharmacies, manage
Nesisoft staff accounts, and review the audit log. The desktop app (`nesi-pharma`)
activates and verifies its licence against this platform's public API.

- `server/` - Express + TypeScript + Prisma (PostgreSQL). Runs on Render (`render.yaml`),
  with the database on Supabase. (`server/vercel.json` and `server/api/` are an unused
  serverless entry.)
- `client/` - React + TypeScript + Vite + Tailwind + React Query, on Vercel at
  https://pharma.nesisoft.com: the Adurofie PMS landing page at `/` (`client/src/landing/`)
  and the admin dashboard under `/admin`. Vercel forwards `/api/*` to the server.

## Getting started

Requirements: Node.js 22 LTS and a PostgreSQL database.

```bash
npm run install:all
cp server/.env.example server/.env    # set DATABASE_URL and the secrets
cp client/.env.example client/.env
npm run db:push                       # create tables from server/prisma/schema.prisma
npm run db:seed                       # tiers, features and the first super admin
npm run dev                           # API on :5000, site on :3300 (landing /, admin /admin)
```

Locally the seed creates `admin@nesipharma.com` / `Admin@123456` unless `ADMIN_EMAIL` and
`ADMIN_PASSWORD` are set; in production it refuses to run without them.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `dev:server` / `dev:client` | Run both, or one side |
| `npm run build` | Build server and client |
| `npm start` | Start the built server |
| `npm run db:generate` / `db:push` / `db:migrate` / `db:seed` | Prisma |

## Hosting

```
browser / desktop app ──> https://pharma.nesisoft.com (Vercel, client/)
                              /          landing page
                              /admin/*   admin dashboard
                              /api/*  ──> https://nesisoft-pharma-api.onrender.com (Render, server/)
                                                └──> Supabase Postgres
```

Everyone, including installed desktop apps, uses `pharma.nesisoft.com`, so the server
can move hosts without breaking anything: only the `/api/*` rewrite in
`client/vercel.json` names the Render URL.

### Database (Supabase)

Use the **Session pooler** connection string (Connect > Session pooler, port 5432). It
works over IPv4, which Render needs; the direct `db.<ref>.supabase.co` host is IPv6-only.

### Server (Render)

New > Blueprint > this repository: Render reads `render.yaml` (free web service,
`rootDir: server`). Enter the values it asks for:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Supabase session pooler string, with the database password |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | the first super admin, created on a new database |

It generates `JWT_SECRET`, `JWT_REFRESH_SECRET` and `LICENSE_SECRET_KEY` and sets the
rest. Each deploy builds the server, applies the schema with `prisma db push`, and seeds
the database only if it has no admin user yet (`prisma/seed-if-empty.ts`). Change the
admin password after the first sign-in.

- The server refuses to start in production without `JWT_SECRET` and `JWT_REFRESH_SECRET`.
- Keep `LICENSE_SECRET_KEY` stable: it signs the checksum of every licence key, so
  changing it invalidates keys already issued.
- `TRUST_PROXY` is the number of proxies in front of the server (2: Vercel and Render's
  load balancer). `GET /api/health` returns `ip`; through pharma.nesisoft.com it must be
  your own public IP, or rate limits would count all visitors together.
- On the free plan the server sleeps after 15 minutes without requests and takes about a
  minute to wake. Vercel waits up to 120 seconds, so the first request is slow, not lost.

### Website (Vercel)

Import this repository with **Root Directory** `client` (framework Vite; `client/vercel.json`
holds the build and the rewrites). Don't set `VITE_API_URL`: the site calls `/api` on its
own domain. Add the domain `pharma.nesisoft.com` under Settings > Domains and create the
DNS record Vercel shows (a CNAME for `pharma`).

The landing page's Download button offers the newest installer published in the public
`Nesisoft/adurofie-pms-releases` repository (`client/src/landing/site.ts`), and its plans
section reads `GET /api/public/license/plans`.

## Admin roles

| Role | Can |
|---|---|
| SUPER_ADMIN | Everything: tier configuration, the feature catalogue, creating/deleting admin users and resetting their passwords |
| ADMIN | Generate, edit and revoke licences; manage pharmacies; view and edit (non-admin) staff; audit log |
| SUPPORT | Dashboard, and view licences and pharmacies |
| VIEWER | Sign in and view the feature list only |

## Public licence API (used by the desktop app)

Base path `/api/public/license`, no authentication, rate limited.

| Endpoint | Purpose |
|---|---|
| `POST /verify` | `{ licenseKey, deviceId }` - is this key valid for this device; returns tier and features |
| `POST /activate` | `{ licenseKey, deviceId, deviceName, pharmacy }` - bind the key to a device |
| `POST /deactivate` | `{ licenseKey, deviceId }` - release a device activation |
| `GET /tiers` | Tier definitions (kept for older app versions) |
| `GET /plans` | `{ plans, features }`: each active plan with its limits (`-1` = unlimited) and every active feature switched on or off, plus the feature catalogue. The app's plan comparison (Settings > License) is built from it |

Request and response details: `server/src/controllers/licensePublic.controller.ts`.
Keys look like `XXXX-XXXX-XXXX-XXXX-XXXX`; the first character encodes the tier and the
last group is an HMAC checksum (`server/src/utils/licenseKey.ts`).

See [CLAUDE.md](CLAUDE.md) for conventions and known issues.

Proprietary software of Nesisoft.
