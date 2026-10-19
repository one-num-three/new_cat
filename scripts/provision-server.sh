#!/usr/bin/env bash
set -euo pipefail

# First deployment only. Keep this host-local service private until an HTTPS
# hostname and real WeChat credentials are configured and verified.
base=/opt/cat-mouse
release="$base/release-20261011"
test -f "$release/v2/server.js"
test ! -e /etc/systemd/system/catmouse-api.service
test ! -e "$base/api.env"
test ! -e "$base/db-password"

if ! id -u catmouse >/dev/null 2>&1; then
  useradd --system --home-dir "$base" --shell /usr/sbin/nologin catmouse
fi
install -d -m 0750 -o catmouse -g catmouse "$base"
chown -R catmouse:catmouse "$release"

if runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='catmouse'" | grep -q 1; then
  echo 'catmouse database role already exists; check its provenance before provisioning' >&2
  exit 1
fi
if runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='catmouse'" | grep -q 1; then
  echo 'catmouse database already exists; check its provenance before provisioning' >&2
  exit 1
fi

umask 077
password=$(openssl rand -hex 24)
printf '%s\n' "$password" > "$base/db-password"
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c "CREATE ROLE catmouse LOGIN PASSWORD '$password'"
runuser -u postgres -- createdb -O catmouse catmouse

cat > "$base/api.env" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
DATABASE_URL=postgres://catmouse:$password@127.0.0.1:5432/catmouse
WECHAT_APP_ID=
WECHAT_APP_SECRET=
EOF
chmod 0600 "$base/api.env" "$base/db-password"

runuser -u catmouse -- env npm_config_cache="$base/.npm" npm ci --omit=dev --ignore-scripts --prefix "$release"

cat > /etc/systemd/system/catmouse-api.service <<EOF
[Unit]
Description=Cat Mouse pilot API
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=simple
User=catmouse
Group=catmouse
WorkingDirectory=$release
EnvironmentFile=$base/api.env
ExecStart=/usr/bin/node v2/server.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now catmouse-api.service
echo 'PROVISIONED_PRIVATE_API'
