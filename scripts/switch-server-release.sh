#!/usr/bin/env bash
set -euo pipefail

unit=/etc/systemd/system/catmouse-api.service
backup=/etc/systemd/system/catmouse-api.service.pre-20261011b
old=/opt/cat-mouse/release-20261011
new=/opt/cat-mouse/release-20261011b

test -f "$new/v2/server.js"
test -f "$unit"
test ! -e "$backup"
grep -Fqx "WorkingDirectory=$old" "$unit"
cp -p "$unit" "$backup"

rollback() {
  cp -p "$backup" "$unit"
  systemctl daemon-reload
  systemctl restart catmouse-api.service
  echo 'RELEASE_SWITCH_ROLLED_BACK' >&2
}
trap rollback ERR

sed -i "s#^WorkingDirectory=$old\$#WorkingDirectory=$new#" "$unit"
systemctl daemon-reload
systemctl restart catmouse-api.service
sleep 2
systemctl is-active --quiet catmouse-api.service
curl --fail --silent --show-error http://127.0.0.1:4000/health >/dev/null
curl --fail --silent --show-error http://127.0.0.1:4000/ready >/dev/null
trap - ERR
echo 'RELEASE_SWITCH_VERIFIED'
