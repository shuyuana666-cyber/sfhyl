#!/bin/sh
set -eu

for directory in /app/storage /app/logs; do
  marker="${directory}/.sfhyl-node-owned-v1"
  if [ ! -f "$marker" ]; then
    chown -R node:node "$directory"
    touch "$marker"
    chown node:node "$marker"
  fi
done

exec gosu node "$@"
