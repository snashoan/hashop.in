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
