#!/usr/bin/env bash
set -euo pipefail

ROOT="$(realpath -m "${SFHYL_ROOT:-/opt/sfhyl-platform}")"
BACKUP_ROOT="${ROOT}/backups"
BACKUP="${1:-}"
CONFIRMATION="${2:-}"

if [[ -z "${BACKUP}" || "${CONFIRMATION}" != "--confirm-restore" ]]; then
  printf 'Usage: %s /opt/sfhyl-platform/backups/<timestamp> --confirm-restore\n' "$0" >&2
  exit 2
fi

BACKUP="$(realpath -e "${BACKUP}")"
if [[ "${ROOT}" == "/" || "${BACKUP}" != "${BACKUP_ROOT}/"* ]]; then
  printf 'Refusing to restore from a path outside %s\n' "${BACKUP_ROOT}" >&2
  exit 1
fi
if [[ ! -f "${BACKUP}/mysql.sql.gz" || ! -d "${BACKUP}/minio" || ! -f "${BACKUP}/local-storage.tar.gz" ]]; then
  printf 'Backup is incomplete: %s\n' "${BACKUP}" >&2
  exit 1
fi
if [[ ! -d "${ROOT}/current" || ! -f "${ROOT}/current/docker-compose.yml" ]]; then
  printf 'Active release is missing under %s/current\n' "${ROOT}" >&2
  exit 1
fi

cd "${ROOT}/current"
docker compose stop api
docker compose up -d mysql minio minio-init
gunzip -c "${BACKUP}/mysql.sql.gz" | docker compose exec -T mysql sh -c \
  'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
docker compose run --rm --no-deps --entrypoint /bin/sh \
  --volume "${BACKUP}/minio:/backup:ro" minio-init -c \
  'mc alias set target http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null && mc mirror --overwrite --remove /backup target/"$MINIO_BUCKET"'
docker compose run --rm --no-deps --entrypoint /bin/sh \
  --volume "${BACKUP}:/backup:ro" api -c \
  'find /app/storage -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -xzf /backup/local-storage.tar.gz -C /app/storage'
docker compose up -d api
docker compose exec -T api node -e \
  "fetch('http://127.0.0.1:3002/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
printf 'Restore completed from %s\n' "${BACKUP}"
