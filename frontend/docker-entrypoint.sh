#!/bin/sh
set -e

# Install node_modules with Linux binaries if volume is empty or stale
if [ ! -f /app/node_modules/.install-stamp ]; then
  echo "[vaidya-frontend] Installing npm packages (first run)..."
  cd /app && npm install
  touch /app/node_modules/.install-stamp
  echo "[vaidya-frontend] Done."
fi

exec "$@"
