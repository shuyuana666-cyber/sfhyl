#!/usr/bin/env bash
set -euo pipefail

ROOT="${SFHYL_ROOT:-/opt/sfhyl-platform}"
CURRENT="$(readlink -f "${ROOT}/current")"
PREVIOUS="$(find "${ROOT}/releases" -mindepth 1 -maxdepth 1 -type d ! -path "${CURRENT}" -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2-)"
[[ -n "${PREVIOUS}" ]] || { echo "No previous release found" >&2; exit 1; }
"${ROOT}/current/deploy/scripts/activate-release.sh" "${PREVIOUS}"
