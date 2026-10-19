#!/usr/bin/env bash
set -euo pipefail

source_file=/opt/cat-mouse/nginx-catmouse.conf
target=/etc/nginx/snippets/catmouse.conf
locations=/etc/nginx/snippets/seu-link-locations.conf
backup=/etc/nginx/snippets/seu-link-locations.conf.pre-catmouse-20261011

test -f "$source_file"
test -f "$locations"
test ! -e "$target"
test ! -e "$backup"
! grep -q 'include snippets/catmouse.conf;' "$locations"
cp -p "$locations" "$backup"

rollback() {
  cp -p "$backup" "$locations"
  rm -f "$target"
  nginx -t
  systemctl reload nginx
  echo 'NGINX_CATMOUSE_ROLLED_BACK' >&2
}
trap rollback ERR

install -m 0644 "$source_file" "$target"
printf '\ninclude snippets/catmouse.conf;\n' >> "$locations"
nginx -t
systemctl reload nginx
verified=false
for attempt in 1 2 3 4 5; do
  if curl --noproxy '*' --fail --silent --show-error --resolve seu-link.fit:443:127.0.0.1 https://seu-link.fit/catmouse/health >/dev/null; then
    verified=true
    break
  fi
  sleep 1
done
test "$verified" = true
trap - ERR
echo 'NGINX_CATMOUSE_VERIFIED'
