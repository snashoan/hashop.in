# Hashop

Hashop is a web-first local marketplace stack. This repo contains the buyer storefront, merchant console, relay hub, and deployment files for `hashop.in`.

## Repo layout

- `tools/hashop_hub.py`: aiohttp hub and API server
- `tools/hashop_site/`: public storefront, buyer flow, and merchant UI
- `tools/hashop_systemd/`: systemd and Caddy deployment files
- `docs/`: task tracker and handoff notes

## Local run

```bash
python tools/hashop_hub.py --public-base-url https://hashop.in
```

Defaults:

- site dir: `tools/hashop_site`
- sqlite db: `tools/hashop.sqlite3`
- uploads dir: `tools/hashop_uploads`
- bind: `0.0.0.0:8080`

Open `http://127.0.0.1:8080/` for the storefront.

## Email reset codes

Password-reset codes are sent by SMTP when these environment variables are set:

```bash
HASHOP_SMTP_HOST=smtp.resend.com
HASHOP_SMTP_PORT=587
HASHOP_SMTP_SECURITY=starttls
HASHOP_SMTP_USERNAME=resend
HASHOP_SMTP_PASSWORD=your-smtp-password
HASHOP_SMTP_FROM=no-reply@hashop.in
HASHOP_SMTP_FROM_NAME=Hashop
HASHOP_EXPOSE_RESET_CODES=0
```

When SMTP is configured, reset codes are not returned by the API unless `HASHOP_EXPOSE_RESET_CODES=1` is explicitly set. Without SMTP, codes are returned for local development and testing.

For production, verify `hashop.in` with a transactional mail provider and use `no-reply@hashop.in` as the sender. The current DNS nameservers for `hashop.in` are under `domaincontrol.com`, so DNS verification records need to be added in the domain/DNS control panel.
