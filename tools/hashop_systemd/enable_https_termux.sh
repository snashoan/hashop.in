#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

DOMAIN="${1:-}"
SSH_HOST="${2:-hoanull}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain> [ssh-host]"
  echo "Example: $0 hashop.in hoanull"
  exit 1
fi

REMOTE_SITE_DIR="${REMOTE_SITE_DIR:-/home/ec2-user/hashop_site}"
REMOTE_HUB_PATH="${REMOTE_HUB_PATH:-/home/ec2-user/hashop_hub.py}"
REMOTE_DB_PATH="${REMOTE_DB_PATH:-/home/ec2-user/hashop.sqlite3}"
REMOTE_UPLOADS_DIR="${REMOTE_UPLOADS_DIR:-/home/ec2-user/hashop_uploads}"
CADDY_URL="${CADDY_URL:-https://github.com/caddyserver/caddy/releases/download/v2.11.2/caddy_2.11.2_linux_amd64.tar.gz}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

log() {
  printf '[https] %s\n' "$1"
}

need_cmd ssh
need_cmd scp
need_cmd curl
need_cmd python

SERVER_IP="$(ssh "$SSH_HOST" "python3 - <<'PY'
import urllib.request
base='http://169.254.169.254/latest/'
req=urllib.request.Request(base + 'api/token', method='PUT', headers={'X-aws-ec2-metadata-token-ttl-seconds':'60'})
token=urllib.request.urlopen(req, timeout=2).read().decode()
request=urllib.request.Request(base + 'meta-data/public-ipv4', headers={'X-aws-ec2-metadata-token': token})
print(urllib.request.urlopen(request, timeout=2).read().decode().strip())
PY")"

DOMAIN_IP="$(python - "$DOMAIN" <<'PY'
import socket
import sys
print(socket.gethostbyname(sys.argv[1]))
PY
)"

log "server ip: $SERVER_IP"
log "domain ip: $DOMAIN_IP"

if [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
  echo "DNS mismatch."
  echo "Point $DOMAIN to $SERVER_IP first, then rerun."
  exit 1
fi

cat >"$TMP_DIR/Caddyfile" <<EOF
{
    admin off
}

$DOMAIN {
    reverse_proxy 127.0.0.1:8080
}

http://$SERVER_IP {
    reverse_proxy 127.0.0.1:8080
}
EOF

cat >"$TMP_DIR/hashop-hub.service" <<EOF
[Unit]
Description=Hashop Hub
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ec2-user
Group=ec2-user
WorkingDirectory=/home/ec2-user
ExecStart=/home/ec2-user/.venvs/hashop/bin/python $REMOTE_HUB_PATH --host 127.0.0.1 --port 8080 --public-base-url https://$DOMAIN --site-dir $REMOTE_SITE_DIR --shop-db $REMOTE_DB_PATH --uploads-dir $REMOTE_UPLOADS_DIR
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

cat >"$TMP_DIR/caddy.service" <<'EOF'
[Unit]
Description=Caddy
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Environment=HOME=/var/lib/caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
ExecStop=/usr/bin/pkill -TERM -f '^/usr/local/bin/caddy run'
Restart=on-failure
RestartSec=2
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF

log "copying config to $SSH_HOST"
scp "$TMP_DIR/Caddyfile" "$SSH_HOST:/home/ec2-user/Caddyfile"
scp "$TMP_DIR/hashop-hub.service" "$SSH_HOST:/home/ec2-user/hashop-hub.service"
scp "$TMP_DIR/caddy.service" "$SSH_HOST:/home/ec2-user/caddy.service"

log "installing and starting services"
ssh "$SSH_HOST" "DOMAIN='$DOMAIN' SERVER_IP='$SERVER_IP' CADDY_URL='$CADDY_URL' REMOTE_SITE_DIR='$REMOTE_SITE_DIR' REMOTE_HUB_PATH='$REMOTE_HUB_PATH' REMOTE_DB_PATH='$REMOTE_DB_PATH' REMOTE_UPLOADS_DIR='$REMOTE_UPLOADS_DIR' bash -s" <<'EOF'
set -euo pipefail

if ! command -v /usr/local/bin/caddy >/dev/null 2>&1; then
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT
  curl -L --fail --silent --show-error "$CADDY_URL" -o "$tmp_dir/caddy.tgz"
  tar -xzf "$tmp_dir/caddy.tgz" -C "$tmp_dir" caddy
  sudo install -m 0755 "$tmp_dir/caddy" /usr/local/bin/caddy
fi

sudo mkdir -p /etc/caddy /var/lib/caddy /var/log/caddy
sudo install -d -o ec2-user -g ec2-user "$REMOTE_UPLOADS_DIR"
sudo cp /home/ec2-user/Caddyfile /etc/caddy/Caddyfile
sudo cp /home/ec2-user/hashop-hub.service /etc/systemd/system/hashop-hub.service
sudo cp /home/ec2-user/caddy.service /etc/systemd/system/caddy.service
sudo systemctl daemon-reload
sudo systemctl enable hashop-hub.service caddy.service
sudo systemctl restart hashop-hub.service
sleep 1
curl -fsS http://127.0.0.1:8080/healthz >/dev/null

old_pids="$(pgrep -f 'hashop_hub.py --host 0.0.0.0 --port 80' || true)"
if [ -n "$old_pids" ]; then
  sudo kill $old_pids >/dev/null 2>&1 || true
fi

sudo systemctl restart caddy.service
sleep 2
sudo systemctl --no-pager --full status hashop-hub.service | sed -n '1,12p'
echo '---'
sudo systemctl --no-pager --full status caddy.service | sed -n '1,12p'
echo '---'
sudo ss -ltnp | grep -E ':80|:443|:8080' || true
EOF

log "checking local https from server"
ssh "$SSH_HOST" "curl -I -m 10 -sS --resolve $DOMAIN:443:127.0.0.1 https://$DOMAIN/healthz"

log "checking public https"
if curl -I -m 20 -sS "https://$DOMAIN/healthz" >/dev/null; then
  log "https is live at https://$DOMAIN"
else
  echo "Public HTTPS still failed."
  echo "Most likely causes:"
  echo "- port 443 is not open on the EC2 security group"
  echo "- GoDaddy is still forwarding/masking instead of using DNS"
  echo "- DNS has not fully propagated yet"
  exit 2
fi
