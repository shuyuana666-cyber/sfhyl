#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(realpath -m "${SFHYL_ROOT:-/opt/sfhyl-platform}")"
if [[ "${ROOT}" == "/" ]]; then
  printf 'Refusing to use the filesystem root as SFHYL_ROOT.\n' >&2
  exit 1
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="${ROOT}/backups"
TARGET="${BACKUP_ROOT}/${STAMP}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "${TARGET}"
chmod 700 "${TARGET}"
cd "${ROOT}/current"
docker compose exec -T mysql sh -c 'exec mysqldump --single-transaction --quick --lock-tables=false -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' | gzip -9 > "${TARGET}/mysql.sql.gz"
docker compose run --rm --no-deps --entrypoint /bin/sh --volume "${TARGET}/minio:/backup" minio-init -c 'mc alias set source http://minio:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null && mc mirror --quiet source/"$MINIO_BUCKET" /backup'
docker compose run --rm --no-deps --entrypoint tar --volume "${TARGET}:/backup" api \
  -C /app/storage -czf /backup/local-storage.tar.gz .
cp .env "${TARGET}/environment.snapshot"
chmod 600 "${TARGET}/environment.snapshot"
while IFS= read -r -d '' expired; do
  resolved="$(realpath -m "${expired}")"
  if [[ "${resolved}" == "${BACKUP_ROOT}/"* ]]; then
    rm -rf -- "${resolved}"
  else
    printf 'Refusing to remove unexpected backup path: %s\n' "${resolved}" >&2
    exit 1
  fi
done < <(find "${BACKUP_ROOT}" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -print0)
printf 'Backup created at %s\n' "${TARGET}"
