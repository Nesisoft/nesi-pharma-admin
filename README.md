# Adurofie PMS - Admin Platform (nesi-pharma-admin)

Web platform Nesisoft uses to run the Adurofie PMS business: issue and revoke licence
keys, configure licence tiers and the features they unlock, register pharmacies, manage
Nesisoft staff accounts, and review the audit log. The desktop app (`nesi-pharma`)
activates and verifies its licence against this platform's public API.

- `server/` - Express + TypeScript + Prisma (PostgreSQL). Deployed on Vercel
  (`server/vercel.json`, `server/api/index.ts`) or Render (`server/render.yaml`).
- `client/` - React + TypeScript + Vite + Tailwind + React Query. Deployed on Vercel.

## Getting started

Requirements: Node.js 22 LTS and a PostgreSQL database.

```bash
npm run install:all
cp server/.env.example server/.env    # set DATABASE_URL and the secrets
cp client/.env.example client/.env
npm run db:push                       # create tables from server/prisma/schema.prisma
npm run db:seed                       # tiers, features and the first super admin
npm run dev                           # API on :5000, admin UI on :3300
```

The seed creates `admin@nesipharma.com` / `Admin@123456` - change it immediately.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `dev:server` / `dev:client` | Run both, or one side |
| `npm run build` | Build server and client |
| `npm start` | Start the built server |
| `npm run db:generate` / `db:push` / `db:migrate` / `db:seed` | Prisma |

## Production configuration

The server refuses to start in production without `JWT_SECRET` and `JWT_REFRESH_SECRET`
(generate with `openssl rand -base64 32`). Keep `LICENSE_SECRET_KEY` stable: it signs the
checksum of every licence key, so changing it invalidates keys already issued.
`CORS_ORIGIN` must list the admin UI origin(s).

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
| `GET /tiers` | Tier definitions with their features and limits |

Request and response details: `server/src/controllers/licensePublic.controller.ts`.
Keys look like `XXXX-XXXX-XXXX-XXXX-XXXX`; the first character encodes the tier and the
last group is an HMAC checksum (`server/src/utils/licenseKey.ts`).

See [CLAUDE.md](CLAUDE.md) for conventions and known issues.

Proprietary software of Nesisoft.
