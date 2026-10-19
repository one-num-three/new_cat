#!/usr/bin/env bash
set -euo pipefail

cd /opt/cat-mouse/release-20261011b
test -f /opt/cat-mouse/api.env
if runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='catmouse_loadtest'" | grep -q 1; then
  echo 'Isolated load-test database already exists; inspect before running' >&2
  exit 1
fi
runuser -u postgres -- createdb -O catmouse catmouse_loadtest
cleanup() { runuser -u postgres -- dropdb catmouse_loadtest; }
trap cleanup EXIT

set -a
source /opt/cat-mouse/api.env
set +a
export LOAD_USE_COMPOSE_TEST_DB=true LOAD_ISOLATED_DB=true
node v2/load60.cjs /opt/cat-mouse/load60-server-20261011.json
echo 'ISOLATED_SERVER_LOAD_COMPLETE'
