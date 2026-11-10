# CLAUDE.md - Adurofie PMS admin platform (nesi-pharma-admin)

Licence and tenant administration for Adurofie PMS. Sister repo: `../nesi-pharma`
(the Electron desktop app, which calls this platform's public licence API). The shared
improvement roadmap lives in `../nesi-pharma/docs/ROADMAP.md`.

## Commands

```bash
npm run install:all        # root + server + client
npm run dev                # server (:5000, ts via tsx) + client (Vite :3300: landing /, admin /admin; proxies /api -> :5000)
npm run build              # tsc server + vite client
npm run db:push            # sync Prisma schema to the database (how environments are created today)
npm run db:seed            # server/prisma/seed.ts: tiers, features, first SUPER_ADMIN
```

There are no automated tests yet.

## Layout

- `server/src/app.ts` - Express app (helmet, CORS split between admin and public routes,
  rate limits, morgan); `server/src/index.ts` listens (production runs this on Render);
  `server/api/index.ts` is an unused Vercel serverless entry.
- `server/src/routes/*.routes.ts` -> `server/src/controllers/*.controller.ts`
  -> Prisma (`server/src/lib/prisma.ts`, schema in `server/prisma/schema.prisma`).
- Responses use `server/src/utils/apiResponse.ts`; errors go through
  `server/src/middleware/errorHandler.ts` (no stack traces in production).
- `client/src/pages/*Page.tsx`, layout in `client/src/layouts/DashboardLayout.tsx`,
  API wrapper `client/src/lib/api.ts`, auth state `client/src/contexts/AuthContext.tsx`.
- One site, two apps: `client/src/main.tsx` loads the landing page (`client/src/landing/`,
  settings in `site.ts`) at `/` and the admin (`client/src/AdminApp.tsx`, React Router
  `basename="/admin"`) under `/admin`. Admin routes stay relative (`/login`, `/licenses`);
  full-page URLs need `ADMIN_BASE` from `client/src/lib/config.ts`.

## Hosting

- https://pharma.nesisoft.com is the Vercel project with Root Directory `client`
  (`client/vercel.json`). It rewrites `/api/*` to the Render server
  (`https://nesisoft-pharma-api.onrender.com`, Blueprint `render.yaml`, `rootDir: server`),
  with caching off. The site and the desktop app only ever use pharma.nesisoft.com, so
  moving the server means changing that one rewrite. The database is Supabase (session
  pooler URL, IPv4). There is no Redis.
- Render's build runs `prisma db push` against production and then
  `prisma/seed-if-empty.ts` (seeds only a database without admin users).

## Conventions

- Guard every admin route with `authenticate` plus a role helper from
  `server/src/middleware/auth.ts`: `requireSuperAdmin` (tiers, features, admin users),
  `requireAdmin` (licences, pharmacies, audit), `requireSupport` (dashboard/read).
- Public licence endpoints (`/api/public/license/*`) are unauthenticated: keep inputs
  validated, responses minimal, and the public rate limiter on them.
- Feature keys and tier codes are consumed by the desktop app
  (`../nesi-pharma/src/config/features.js`). Renaming one is a breaking change for
  installed pharmacies.
- Which features a plan includes is data, edited on the Tier Configs page (tier features).
  Licence generation, activation and the public `GET /api/public/license/plans` (the
  desktop's plan comparison, and its free plan: unlicensed PCs use the `BASIC` plan's
  features) all read it, and share `server/src/utils/tierLimits.ts` (an empty limit means
  unlimited and is sent as `-1`). Keep the `/plans` response backward compatible:
  installed apps read it. Activation also sends `tierCode`, which the app stores as the
  licence's plan.
- Branch names describe the change: `feat/...`, `fix/...`, `chore/...`, `docs/...`.

## Working agreements (the owner's rules - follow them on every machine)

- Every change goes through a pull request from a descriptive branch; never commit to
  `main` directly.
- **Ask the owner before merging any PR and before deleting any branch or worktree.**
  Merge with merge commits (`gh pr merge --merge`). Stacked PRs: merge them all first,
  re-pointing each to `main`, and delete branches last. Deleting a base branch closes the
  PRs stacked on it.
- Commits are authored as `Anlimah <y.m.ratty7@gmail.com>`.
- Merging to `main` redeploys production (Vercel and Render) and applies schema changes to
  the production database (`prisma db push` in the Render build): call out deploy-impacting
  changes, such as schema changes or new required environment variables, before asking
  to merge.
- New PC setup (Node 22, GitHub CLI, cloning both repos side by side): see
  `../nesi-pharma/README.md`.

## Gotchas

- Production refuses to start without `JWT_SECRET` and `JWT_REFRESH_SECRET`
  (`server/src/config/index.ts`).
- Never rotate `LICENSE_SECRET_KEY` casually: activation recomputes the key checksum with
  it, so every previously issued key would fail validation.
- `server/prisma/migrations/` is in `.gitignore`, so environments are built with
  `db push` and schema changes are not versioned. Commit migrations before the next
  schema change.
- Admin JWTs live in `localStorage` with a 7-day lifetime.
- Never run `npm run db:seed` on a database in use: it rewrites the tiers and features and
  resets which features each plan includes, undoing Tier Configs edits. In production it
  refuses to run without `ADMIN_EMAIL` and `ADMIN_PASSWORD` (the defaults are public).
- `TRUST_PROXY` (hops in front of the server) decides `req.ip` for the rate limiters and
  audit logs: 2 behind Vercel + Render. Check it with `GET /api/health`, which returns `ip`.
- The landing page's plans list only features in `APP_FEATURE_KEYS`
  (`client/src/landing/site.ts`), a copy of the desktop app's list: update both together.
- Render's free plan sleeps after 15 minutes idle and takes about a minute to wake; the
  landing page and the desktop app wait for it (Vercel's proxy allows 120 s).
- Licence keys are not signed tokens: the desktop app stores the activated licence in
  its own database and trusts it (see the roadmap for the signed-licence plan).
