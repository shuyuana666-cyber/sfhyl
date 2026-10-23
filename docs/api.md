# SFHYL Operations API

## Local Start

The API uses Node.js 22, pnpm 10.13.1, and MySQL 8.4. Local development can store uploads under `apps/api-server/storage/uploads`. Existing site media is in MinIO; keep the matching `sfhyl` bucket when moving that database to a new server.

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm infra:up
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm api:dev
```

Replace the database, JWT, encryption, and seed-admin placeholders in `.env` before starting infrastructure or seeding. `pnpm infra:up` starts MySQL and Redis for local storage; use `pnpm infra:up:minio` with `STORAGE_DRIVER=minio` when working with existing media. The API binds to `127.0.0.1:3002` by default, and the website development proxy uses this API.

Health and documentation:

```text
GET  http://127.0.0.1:3002/health
GET  http://127.0.0.1:3002/health/live
GET  http://127.0.0.1:3002/health/ready
GET  http://127.0.0.1:3002/api/docs
```

The readiness check requires MySQL and the selected storage provider. Redis is an optional public-response cache: when enabled but unavailable, readiness reports `redis: "down"` and `status: "degraded"` while requests continue to use MySQL.

## API Boundaries

| Prefix | Access |
| --- | --- |
| `/api/v1/public` | Anonymous, response fields explicitly limited |
| `/api/v1/auth` | Login and refresh are anonymous; account operations require access token |
| `/api/v1/admin` | JWT authentication and database-backed permission checks |

Successful responses use:

```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "requestId": "request-id"
}
```

Errors use the correct HTTP status and include a stable numeric code, message, optional validation errors, and request ID. `bigint` IDs and decimal values are serialized as strings.

## Authentication

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/logout-all
GET  /api/v1/auth/me
PUT  /api/v1/auth/password
```

Send access tokens as `Authorization: Bearer <token>`. Refresh calls rotate the refresh token. Reusing a rotated or revoked token revokes its token family. Logout revokes one refresh session; logout-all and password changes revoke every active session for the administrator.

Login accepts username or email, records IP/user agent/result, and temporarily locks an account after the configured number of failures. `/auth/me` returns role codes, permission codes, and the permitted menu tree.

## Public Resources

```text
GET /api/v1/public/site
GET /api/v1/public/home
GET /api/v1/public/exchange-rates
GET /api/v1/public/banners
GET /api/v1/public/brands
GET /api/v1/public/vehicles
GET /api/v1/public/vehicles/:slug
GET /api/v1/public/pages/:slug
```

Public vehicle queries support bounded pagination, keyword, catalogue filters, type, sale status, featured status, year/price ranges, and whitelisted sorting. Only published, non-deleted, currently scheduled vehicles are returned. VIN, internal actor IDs, drafts, audit data, and sensitive settings are not returned.

The former Express JSON content and upload endpoints are retired. Website development proxies `/api/v1` directly to the NestJS API; local storage and media uploads use the same authenticated API as production.

Public site, homepage, banner, brand, page, and vehicle responses use a short-lived cache. With Redis enabled, each read checks a shared generation and skips process-local cached values, so another API instance sees invalidation after a successful `/admin` mutation. Without Redis, a bounded process-local cache is used. Exchange rates use a ten-minute in-process cache and return the last known or bundled fallback values when the provider is unavailable. If Redis is unavailable during an update, previously cached Redis values may remain until their TTL expires after recovery.

## Administrative Resources

### Identity and audit

```text
GET    /api/v1/admin/users
POST   /api/v1/admin/users
PATCH  /api/v1/admin/users/:id
DELETE /api/v1/admin/users/:id
GET    /api/v1/admin/roles
POST   /api/v1/admin/roles
PATCH  /api/v1/admin/roles/:id
DELETE /api/v1/admin/roles/:id
GET    /api/v1/admin/permissions
GET    /api/v1/admin/audit-logs
GET    /api/v1/admin/login-logs
```

### Media and configuration

```text
POST   /api/v1/admin/media/upload
POST   /api/v1/admin/media/upload-multiple
GET    /api/v1/admin/media
POST   /api/v1/admin/media/batch-action
GET    /api/v1/admin/media/uploads
DELETE /api/v1/admin/media/uploads
PATCH  /api/v1/admin/media/:id
DELETE /api/v1/admin/media/:id
POST   /api/v1/admin/media/:id/restore
DELETE /api/v1/admin/media/:id/permanent
GET    /api/v1/admin/media/folders
POST   /api/v1/admin/media/folders
PATCH  /api/v1/admin/media/folders/:id
DELETE /api/v1/admin/media/folders/:id
GET    /api/v1/admin/settings
PATCH  /api/v1/admin/settings/:group
```

Uploads use server-generated object keys. The service checks file signatures rather than trusting multipart MIME headers, enforces type-specific size limits, reads image dimensions, computes SHA-256, sanitizes SVG, and rejects deletion while an asset is referenced.

`POST /admin/media/batch-action` accepts `{ ids, action, folderId? }`: `MOVE` requires `media:upload`; `DELETE` and legacy `ARCHIVE` require `media:delete`. `DELETE` validates all selected references before removing any file. `DELETE /admin/media/:id/permanent` also accepts active assets directly. Permanent deletion removes original and derivative objects from the asset's recorded storage driver/bucket before deleting its database record. The plain `DELETE /admin/media/:id` remains the legacy archive API; the current admin delete buttons use permanent deletion. Moving through `PATCH` or batch `MOVE` only changes folder metadata and preserves IDs and URLs.

Deleting a folder automatically moves its assets, upload-record folder metadata and active child folders to its parent; colliding child slugs receive a unique suffix. `DELETE /admin/media/uploads` requires `media:delete` and clears all upload records without deleting any assets. Completion updates tolerate history being cleared during an upload.

Homepage vehicle selection is shared by the website and the admin preview in `shared/homepage-vehicles.ts`: configured recommendations first, then vehicle recommendation flags, then published catalogue vehicles. The public home response includes the featured section's enabled state and total recommendation count so an expired, disabled or intentionally empty configuration does not silently fall back to automatic vehicles.

### Homepage

```text
GET    /api/v1/admin/banners
POST   /api/v1/admin/banners
PATCH  /api/v1/admin/banners/:id
DELETE /api/v1/admin/banners/:id
PUT    /api/v1/admin/banners/sort
GET    /api/v1/admin/features
POST   /api/v1/admin/features
PATCH  /api/v1/admin/features/:id
DELETE /api/v1/admin/features/:id
PUT    /api/v1/admin/features/sort
GET    /api/v1/admin/homepage-sections
PATCH  /api/v1/admin/homepage-sections/:id
PUT    /api/v1/admin/homepage-sections/sort
GET    /api/v1/admin/recommendations
POST   /api/v1/admin/recommendations
PATCH  /api/v1/admin/recommendations/:id
DELETE /api/v1/admin/recommendations/:id
PUT    /api/v1/admin/recommendations/sort
```

Public banners must be active, not deleted, after their start time, and before their end time.

### Catalogue and vehicles

```text
GET/POST/PATCH/DELETE /api/v1/admin/brands
GET/POST/PATCH/DELETE /api/v1/admin/series
GET/POST/PATCH/DELETE /api/v1/admin/models
GET/POST/PATCH/DELETE /api/v1/admin/tags

GET    /api/v1/admin/vehicles
POST   /api/v1/admin/vehicles
GET    /api/v1/admin/vehicles/:id
PATCH  /api/v1/admin/vehicles/:id
DELETE /api/v1/admin/vehicles/:id
POST   /api/v1/admin/vehicles/:id/publish
POST   /api/v1/admin/vehicles/:id/offline
POST   /api/v1/admin/vehicles/:id/restore
POST   /api/v1/admin/vehicles/:id/duplicate
POST   /api/v1/admin/vehicles/:id/sale-status
POST   /api/v1/admin/vehicles/:id/featured
POST   /api/v1/admin/vehicles/:id/media
DELETE /api/v1/admin/vehicles/:id/media/:mediaId
POST   /api/v1/admin/vehicles/batch-action
GET    /api/v1/admin/vehicles/export
```

Catalogue references are validated server side. Brands, series, and models with dependent data cannot be deleted. Vehicle deletion is soft; restore returns the record to draft. Publishing requires a cover image. Batch actions are limited to 100 unique IDs and a fixed action enum.

### Content and inquiries

```text
GET/POST       /api/v1/admin/navigation
PATCH/DELETE   /api/v1/admin/navigation/:id
PUT            /api/v1/admin/navigation/sort
GET/POST       /api/v1/admin/pages
GET/PATCH      /api/v1/admin/pages/:id
POST           /api/v1/admin/pages/:id/publish
POST           /api/v1/admin/pages/:id/restore
DELETE         /api/v1/admin/pages/:id

POST           /api/v1/public/inquiries
GET            /api/v1/admin/inquiries
GET/PATCH      /api/v1/admin/inquiries/:id
POST           /api/v1/admin/inquiries/:id/notes
POST           /api/v1/admin/inquiries/:id/assign
POST           /api/v1/admin/inquiries/batch-status
POST           /api/v1/admin/inquiries/batch-assign
GET            /api/v1/admin/inquiries/export
DELETE         /api/v1/admin/inquiries/:id
```

The public inquiry endpoint is rate limited, rejects duplicate fingerprints inside the configured time window, records source metadata, and saves the inquiry before optional notifications are attempted. Internal notes and assignment history are never returned by public APIs.

## Verification

```bash
pnpm api:lint
pnpm api:typecheck
pnpm api:test:e2e
pnpm api:build
pnpm build
```

The e2e suite requires the seed administrator environment variables and a disposable MySQL 8.4 database. It creates uniquely named records and cleans them after the run.
