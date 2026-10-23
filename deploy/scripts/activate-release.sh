#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then echo "Usage: $0 RELEASE_DIRECTORY" >&2; exit 2; fi
ROOT="${SFHYL_ROOT:-/opt/sfhyl-platform}"
RELEASE="$(readlink -f "$1")"
case "${RELEASE}" in "${ROOT}"/releases/*) ;; *) echo "Release must be inside ${ROOT}/releases" >&2; exit 2;; esac

[[ -f "${RELEASE}/docker-compose.yml" ]] || { echo "docker-compose.yml is missing" >&2; exit 2; }
[[ -f "${RELEASE}/website/index.html" ]] || { echo "website build is missing" >&2; exit 2; }
[[ -f "${RELEASE}/admin/index.html" ]] || { echo "admin build is missing" >&2; exit 2; }
ln -sfn "${ROOT}/shared/.env" "${RELEASE}/.env"
ln -sfn "${RELEASE}" "${ROOT}/next"
cd "${ROOT}/next"
COMPOSE=(docker compose)
driver="${STORAGE_DRIVER:-$(sed -n 's/^STORAGE_DRIVER=//p' .env | tr -d '\r\042\047' | tail -n 1)}"
compose_minio="${MINIO_COMPOSE_ENABLED:-$(sed -n 's/^MINIO_COMPOSE_ENABLED=//p' .env | tr -d '\r\042\047' | tail -n 1)}"
if [[ "${driver}" == "minio" && "${compose_minio}" != "false" ]]; then
  COMPOSE+=(--profile minio)
  if [[ -f docker-compose.minio.yml ]]; then
    COMPOSE+=(-f docker-compose.yml -f docker-compose.minio.yml)
  fi
fi
"${COMPOSE[@]}" build api
if [[ "${driver}" == "minio" && "${compose_minio}" != "false" && ! -f docker-compose.minio.yml ]]; then
  # Older releases predate the dependency overlay used by 1.0.1.
  "${COMPOSE[@]}" up -d minio minio-init
fi
"${COMPOSE[@]}" up -d api
for attempt in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T api node -e "fetch('http://127.0.0.1:3002/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    echo "API readiness check failed after 30 attempts" >&2
    exit 1
  fi
  sleep 2
done
ln -sfn "${RELEASE}" "${ROOT}/current"
nginx -t
nginx -s reload
printf 'Activated %s\n' "${RELEASE}"
