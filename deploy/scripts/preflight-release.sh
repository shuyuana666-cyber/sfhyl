#!/usr/bin/env bash
set -euo pipefail

usage() {
  printf 'Usage: %s RELEASE_DIRECTORY [--online]\n' "$0" >&2
  exit 2
}

[[ $# -ge 1 && $# -le 2 ]] || usage
RELEASE="$(readlink -f "$1")"
ONLINE_CHECK=false
if [[ $# -eq 2 ]]; then
  [[ "$2" == "--online" ]] || usage
  ONLINE_CHECK=true
fi

ROOT="$(realpath -m "${SFHYL_ROOT:-/opt/sfhyl-platform}")"
case "$RELEASE" in
  "$ROOT"/releases/*) ;;
  *) printf 'Release must be inside %s/releases\n' "$ROOT" >&2; exit 2 ;;
esac

ENV_FILE="$ROOT/shared/.env"
for required in "$RELEASE/docker-compose.yml" "$RELEASE/website/index.html" "$RELEASE/admin/index.html" "$RELEASE/public/about" "$RELEASE/public/cars" "$RELEASE/apps/api-server/src/infrastructure/storage/storage.module.ts" "$ENV_FILE"; do
  [[ -e "$required" ]] || { printf 'Missing required release path: %s\n' "$required" >&2; exit 1; }
done

if [[ ! -d "$RELEASE/apps/api-server" ]]; then
  printf 'Missing API source: %s/apps/api-server\n' "$RELEASE" >&2
  exit 1
fi

if [[ "$(stat -c '%a' "$ENV_FILE")" != "600" ]]; then
  printf '%s must have mode 600\n' "$ENV_FILE" >&2
  exit 1
fi

for key in MYSQL_PASSWORD MYSQL_ROOT_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET SETTINGS_ENCRYPTION_KEY REDIS_PASSWORD MINIO_ACCESS_KEY MINIO_SECRET_KEY SEED_ADMIN_EMAIL SEED_ADMIN_PASSWORD; do
  if ! grep -Eq "^[[:space:]]*${key}[[:space:]]*=[[:space:]]*[^[:space:]]" "$ENV_FILE"; then
    printf 'Required production value is missing: %s\n' "$key" >&2
    exit 1
  fi
  if grep -Eiq "^[[:space:]]*${key}[[:space:]]*=[[:space:]]*['\"]?(replace[_-]?(me|with)|change[_-]?me|changeme|your[_-])" "$ENV_FILE"; then
    printf 'Replace the example value for: %s\n' "$key" >&2
    exit 1
  fi
done
if grep -Eiq '^[[:space:]]*SEED_ADMIN_EMAIL[[:space:]]*=[[:space:]]*[^[:space:]]*@example\.(com|net|org)' "$ENV_FILE"; then
  printf 'Replace the example value for: SEED_ADMIN_EMAIL\n' >&2
  exit 1
fi

COMPOSE=(docker compose --env-file "$ENV_FILE")
driver="${STORAGE_DRIVER:-$(sed -n 's/^STORAGE_DRIVER=//p' "$ENV_FILE" | tr -d '\r\042\047' | tail -n 1)}"
compose_minio="${MINIO_COMPOSE_ENABLED:-$(sed -n 's/^MINIO_COMPOSE_ENABLED=//p' "$ENV_FILE" | tr -d '\r\042\047' | tail -n 1)}"
if [[ "$driver" == "minio" && "$compose_minio" != "false" && -f "$RELEASE/docker-compose.minio.yml" ]]; then
  COMPOSE+=(--profile minio -f "$RELEASE/docker-compose.yml" -f "$RELEASE/docker-compose.minio.yml")
else
  COMPOSE+=(-f "$RELEASE/docker-compose.yml")
fi
"${COMPOSE[@]}" config -q
nginx -t

if ! $ONLINE_CHECK; then
  printf 'Offline release preflight passed for %s\n' "$RELEASE"
  exit 0
fi

for domain in sfhyl.cn; do
  getent ahosts "$domain" >/dev/null || {
    printf 'DNS does not resolve for %s\n' "$domain" >&2
    exit 1
  }
  openssl s_client -connect "${domain}:443" -servername "$domain" -verify_return_error </dev/null 2>/dev/null \
    | openssl x509 -noout -checkhost "$domain" >/dev/null || {
      printf 'TLS certificate check failed for %s\n' "$domain" >&2
      exit 1
    }
done

printf 'Online release preflight passed for %s\n' "$RELEASE"
