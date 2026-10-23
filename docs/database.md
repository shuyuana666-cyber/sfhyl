# SFHYL Database Design

## Engine And Connection Rules

| Property | Required value |
| --- | --- |
| Server | MySQL 8.4 LTS |
| Engine | InnoDB |
| Character set | `utf8mb4` |
| Collation | `utf8mb4_0900_ai_ci` |
| Business timezone | `Asia/Shanghai` |
| Schema | `sfhyl` |

Local Compose maps MySQL to `127.0.0.1:3307`. Production should normally keep the database available only on the internal Docker network. The host MySQL 5.7 instance on `3306` is out of scope.

## Model Groups

### Identity and audit

`AdminUser`, `Role`, `Permission`, `AdminUserRole`, and `RolePermission` implement many-to-many RBAC. `RefreshToken` stores session hashes and rotation lineage. `LoginLog` records every login result. `AuditLog` stores administrative changes with action, resource, target, before/after JSON, network context, and request ID.

### Site and homepage

`SiteSetting` stores grouped typed JSON values and separately marks public and sensitive entries. `NavigationItem` supports nested navigation. `Page` stores structured page content and SEO metadata. `HomepageSection`, `Banner`, `FeatureItem`, and `HomepageRecommendation` describe fixed homepage modules with operator-controlled content and ordering.

### Vehicle catalogue

`Brand` -> `VehicleSeries` -> `VehicleModel` provides the catalogue hierarchy. `Vehicle` stores the sellable record, multilingual display content, commercial fields, technical specifications, publication state, and SEO data. `VehicleTag`, `VehicleTagRelation`, and `VehicleMedia` provide reusable tags and ordered media associations.

### Media

`MediaFolder` provides an optional folder tree. `MediaAsset` stores provider, bucket, object key, URL, original and generated names, MIME type, size, dimensions, duration, checksum, alt text, status, and audit timestamps. Binary files are never stored in MySQL.

### Inquiries

`Inquiry` stores visitor contact requests and attribution metadata. `InquiryNote` stores internal processing notes. `InquiryAssignment` keeps assignment history instead of overwriting the previous owner.

## Identifier And Time Conventions

- Primary keys are autoincrementing `BIGINT` values.
- Public website resources use unique slugs; numeric IDs are internal identifiers.
- Legacy website vehicle identifiers are preserved in `Vehicle.legacyId` during import.
- Timestamps use millisecond-capable `DATETIME(3)` fields and are interpreted in `Asia/Shanghai` at the application boundary.
- API serializers convert `bigint` values to decimal strings because JSON has no bigint type.

## Deletion And Referential Integrity

Business entities with operational history use `deletedAt` for soft deletion. Normal queries must explicitly exclude deleted records. Restore operations clear `deletedAt` after validating related entities.

Catalogue deletion is restrictive: a brand, series, or model with dependent vehicles must be disabled or rejected rather than cascaded. Join records and tightly owned history use cascade deletion where appropriate. Media references generally use `SET NULL` or `RESTRICT` so deleting content cannot silently destroy a shared asset.

## State Machines

Vehicle publication states are `DRAFT`, `PUBLISHED`, `OFFLINE`, and `ARCHIVED`. Sale states are `AVAILABLE`, `RESERVED`, and `SOLD`. Vehicle type is `NEW` or `USED`.

Banner state is independent of schedule. A public banner query must require `PUBLISHED`, `isEnabled`, `startAt <= now` when set, and `endAt > now` when set, then sort by `sortOrder`.

Inquiry states are `NEW`, `CONTACTED`, `FOLLOWING`, `QUOTED`, `WON`, `LOST`, and `INVALID`. State changes and assignments are administrative operations and must be audited.

## Indexing Strategy

Indexes cover the required operational access paths:

- unique username, email, role code, permission code, slugs, stock number, and optional VIN;
- publication, sale, featured, homepage, type, brand, and creation-time filters for vehicles;
- active schedule and order for banners and homepage sections;
- status/time, vehicle/time, contact fields, and client IP/time for inquiries;
- actor/time, resource/target, action/time, and request ID for audit logs;
- token hash, user/revocation, family, and expiration for refresh sessions;
- folder/time, MIME/time, state/deletion, and checksum for media assets.

Index changes must be based on production query plans and slow-query evidence. Avoid speculative duplicate indexes.

## Migrations

The authoritative database definition is `apps/api-server/prisma/schema.prisma`. Versioned SQL is stored under `apps/api-server/prisma/migrations` and deployed with `prisma migrate deploy`.

Rules:

1. Never use `prisma db push` against production.
2. Review generated SQL before deployment, especially destructive and locking operations.
3. Back up the database before structural changes and legacy imports.
4. Run migrations as a one-shot release task before switching application traffic.
5. Test upgrade and rollback procedures against a production-like MySQL 8.4 instance.
6. Prefer additive, backward-compatible migrations during staged website/API cutover.

The schema currently defines 31 Prisma models. Migrations under `apps/api-server/prisma/migrations` are authoritative. The seed is idempotent for core records and updates published service-module defaults only where the stored multilingual text still matches the former default, preserving operator edits and display settings.

## Seed Safety

The initial administrator username, email, and password are mandatory environment variables. The password must be at least 12 characters and include uppercase, lowercase, and numeric characters. Real values do not belong in `.env.example` or source control.

Running the seed repeatedly must not duplicate roles, permissions, assignments, settings, navigation, sections, features, banners, or brands. Seed verification should include two consecutive successful runs and stable record counts.
