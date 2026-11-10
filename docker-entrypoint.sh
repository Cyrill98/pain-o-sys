#!/bin/sh
# Starts the app as the unprivileged "node" user. Hosts such as Render mount persistent disks
# owned by root, so first make sure the photo folder belongs to "node", then drop privileges.
set -e

UPLOAD_DIR="${UPLOAD_DIR:-/app/data/uploads}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$UPLOAD_DIR"
  # Only the top folder, not recursive: the disk can hold many photos.
  chown node:node "$UPLOAD_DIR"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

exec "$@"
