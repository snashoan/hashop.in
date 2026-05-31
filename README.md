# Hashop

Hashop is a web-first local commerce stack. It provides a buyer storefront, a shop-owner console, account flows, order handling, payments metadata, maps, uploaded assets, and deployment files for `hashop.in`.

The product rule is simple: buyers should find an item, place an order, and leave. Shop owners should manage stock and orders from the same interface without a separate dashboard product.

![Hashop system map](docs/assets/hashop-system-map.svg)

## Quick Start

Run the hub from the repository root:

```bash
python tools/hashop_hub.py --public-base-url http://127.0.0.1:8080
```

Open:

```text
http://127.0.0.1:8080/
```

Default paths:

- Static site: `tools/hashop_site`
- SQLite database: `tools/hashop.sqlite3`
- Uploaded assets: `tools/hashop_uploads`
- Bind address: `0.0.0.0:8080`

## Repository Layout

| Path | Purpose |
| --- | --- |
| `tools/hashop_hub.py` | aiohttp hub, API routes, SQLite persistence, mail integration, uploads, and static page routing. |
| `tools/hashop_site/` | Public storefront, buyer flow, owner flow, maps, account UI, static assets, and browser helpers. |
| `tools/hashop_site/commerce-core.js` | Browser and Node compatible commerce helpers for prices, carts, and order status. |
| `tools/hashop_site/home-polish-core.js` | Browser and Node compatible UI polish helpers for text cleanup and state motion signatures. |
| `tools/hashop_site/public-theme.js` | Shared public-page theme bootstrap for About and Privacy pages. |
| `tools/hashop_tests/` | Node and Python tests for extracted modules and auth guardrails. |
| `tools/hashop_systemd/` | Caddy and systemd deployment files. |
| `docs/` | Architecture, tutorial, UI standards, task tracker, and migration notes. |

## Product Model

Hashop keeps buyer and owner concepts separate while allowing one account to use both roles.

- Guest buyer: can browse, add to cart, and place an order without login.
- Buyer account: optional permanence for contact, history, and smoother repeat ordering.
- Shop owner: account extension for one or more shops.
- Shop: public listing surface plus owner-managed stock, payments, location, and orders.
- Order: server-side transaction record with buyer snapshot, cart items, payment mode, delivery or pickup context, and status.

## Main Routes

| Route | Use |
| --- | --- |
| `/` | Main buyer and owner app frame. |
| `/shops`, `/items`, `/cart`, `/account` | App state entry routes that resolve into the same home frame. |
| `/setup` | Minimal account setup route. |
| `/about` | Public objective page. |
| `/privacy` or `/policies` | Public privacy and operating policy page. |
| `/healthz` | Health check. |
| `/api/shops` | Shop discovery and shop creation API. |
| `/api/items/library` | Public item library API. |
| `/api/shops/{shop_id}/console` | Owner console API. |
| `/api/shops/{shop_id}/orders` | Order creation API. |

## Configuration

Email verification and password reset use SMTP when configured:

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

Map provider configuration:

```bash
HASHOP_GOOGLE_MAPS_API_KEY=your-google-maps-key
```

Without a Google Maps key, Hashop falls back to the street-map provider used by the static site.

## Verification

Run the current low-risk checks:

```bash
node --check tools/hashop_site/home.js
node --check tools/hashop_site/home-ui.js
node --check tools/hashop_site/home-polish-core.js
node --check tools/hashop_site/public-theme.js
node tools/hashop_tests/commerce-core.test.js
node tools/hashop_tests/home-polish-core.test.js
node tools/hashop_tests/public-theme.test.js
python -m py_compile tools/hashop_hub.py
python -m unittest tools/hashop_tests/auth_guardrails_test.py
git diff --check
```

## Documentation

- [Architecture](docs/hashop-architecture.md)
- [End-to-end tutorial](docs/hashop-end-to-end-tutorial.md)
- [UI guidelines](docs/hashop-ui-guidelines.md)
- [Task tracker](docs/hashop-task-tracker.md)
- [Shivy Commerce plan](docs/shivy-commerce-plan.md)
- [Shivy Commerce inventory](docs/shivy-commerce-inventory.md)

## Deployment

The hosted site currently uses the aiohttp hub behind Caddy. The known live target is:

- Site directory: `/home/ec2-user/hashop_site/`
- Hub file: `/home/ec2-user/hashop_hub.py`
- Health check: `https://hashop.in/healthz`

After changing public assets, bump the build token in the HTML, deploy the changed files, and verify that the served HTML references the new token.
