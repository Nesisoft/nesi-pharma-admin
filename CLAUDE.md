# CLAUDE.md - Adurofie PMS admin platform (nesi-pharma-admin)

Licence and tenant administration for Adurofie PMS. Sister repo: `../nesi-pharma`
(the Electron desktop app, which calls this platform's public licence API). The shared
improvement roadmap lives in `../nesi-pharma/docs/ROADMAP.md`.

## Commands

```bash
npm run install:all        # root + server + client
npm run dev                # server (:5000, ts via tsx) + client (Vite :3300, proxies /api -> :5000)
npm run build              # tsc server + vite client
npm run db:push            # sync Prisma schema to the database (how environments are created today)
npm run db:seed            # server/prisma/seed.ts: tiers, features, first SUPER_ADMIN
```

There are no automated tests yet.

## Layout

- `server/src/app.ts` - Express app (helmet, CORS split between admin and public routes,
  rate limits, morgan); `server/src/index.ts` listens; `server/api/index.ts` is the
  Vercel serverless entry.
- `server/src/routes/*.routes.ts` -> `server/src/controllers/*.controller.ts`
  -> Prisma (`server/src/lib/prisma.ts`, schema in `server/prisma/schema.prisma`).
- Responses use `server/src/utils/apiResponse.ts`; errors go through
  `server/src/middleware/errorHandler.ts` (no stack traces in production).
- `client/src/pages/*Page.tsx`, layout in `client/src/layouts/DashboardLayout.tsx`,
  API wrapper `client/src/lib/api.ts`, auth state `client/src/contexts/AuthContext.tsx`.

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
  Activation (`getTierFeaturesFromDb`) and the public `GET /api/public/license/plans`
  (the desktop's plan comparison) both read it, and share `tierLimits()` (an empty limit
  means unlimited and is sent as `-1`). Keep the `/plans` response backward compatible:
  installed apps read it.
- Branch names describe the change: `feat/...`, `fix/...`, `chore/...`, `docs/...`.

## Working agreements (the owner's rules - follow them on every machine)

- Every change goes through a pull request from a descriptive branch; never commit to
  `main` directly.
- **Ask the owner before merging any PR and before deleting any branch or worktree.**
  Merge with merge commits (`gh pr merge --merge`). Stacked PRs: merge them all first,
  re-pointing each to `main`, and delete branches last. Deleting a base branch closes the
  PRs stacked on it.
- Commits are authored as `Anlimah <y.m.ratty7@gmail.com>`.
- Merging to `main` may redeploy production (Vercel/Render): call out deploy-impacting
  changes, such as new required environment variables, before asking to merge.
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
- Licence keys are not signed tokens: the desktop app stores the activated licence in
  its own database and trusts it (see the roadmap for the signed-licence plan).
