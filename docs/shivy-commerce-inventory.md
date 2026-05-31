# Shivy Commerce Inventory

Last updated: 2026-05-31

This inventory maps the current Hashop implementation into the future Shivy Commerce layers. It is intentionally practical: extract small pure pieces first, keep Hashop live, then move larger services behind adapters.

## Frontend Inventory

Source: `tools/hashop_site/home.js`

### Pure Commerce Helpers

Move first.

- pricing normalization
- price formatting
- total formatting
- currency-code inference
- numeric price parsing
- cart count
- cart item projection
- payment-mode normalization
- stable order status normalization
- order status flag derivation

Target:

- `tools/hashop_site/commerce-core.js` now starts this layer.
- Later location: Shivy Commerce package.

### Buyer Flow

Move after API client exists.

- guest buyer key
- local buyer profile
- buyer account session
- buyer order history
- account order sub-state
- cart-to-order payload creation
- confirmation polling

Target:

- Shivy Commerce buyer module.
- Brand supplies copy and account labels.

### Owner Flow

Move after buyer flow is stable.

- owner session
- owner shop list
- stock list
- owner orders
- shop settings
- item editing
- payment setup
- add menu
- shop password reset UI

Target:

- Shivy Commerce owner module.
- Brand supplies section labels and theme.

### Map Flow

Move after brand config exists.

- map theme selection
- provider fallback
- discovery-point clustering
- shop marker popup
- locate/compass behavior
- fit/padding behavior

Target:

- Shivy Commerce map adapter.
- Brand supplies map defaults and marker styling.

### Presentation Helpers

Move only pure helpers first.

- text cleanup rules
- state-motion signature generation
- public page theme normalization
- public page theme application

Target:

- `tools/hashop_site/home-polish-core.js` now starts the UI polish helper layer.
- `tools/hashop_site/public-theme.js` now starts the public theme helper layer.
- Later location: brand-aware Shivy Commerce presentation package.

### Debug Flow

Move as a Shivy plugin.

- visible UI collection
- debug route link rewriting
- Codex prompt/context formatting
- local bridge progress
- OMDXE-style dock

Target:

- Shivy debug plugin.
- Hashop only configures selectors and route labels.

## Backend Inventory

Source: `tools/hashop_hub.py`

### Repositories

Move behind service boundaries.

- shop repository
- shop console repository
- buyer account repository
- buyer password reset repository
- shop recovery contact repository
- order repository

Target:

- Shivy Commerce backend services.
- Hashop aiohttp hub remains first host adapter.

### Domain Services

Extract after repositories.

- order creation
- order status transitions
- buyer history lookup
- owner membership checks
- password reset code generation
- SMTP delivery
- debug Codex proxy

Target:

- reusable commerce services with aiohttp wrappers.

### Host Adapter

Keep Hashop-specific first.

- static file serving
- debug route injection
- Caddy/systemd deployment
- SQLite path and upload path
- environment variable names

Target:

- Hashop host adapter.
- Later generalized as Shivy Commerce deployment examples.

## First Extraction Slice

Implemented first:

- `tools/hashop_site/commerce-core.js`
- `tools/hashop_tests/commerce-core.test.js`
- Hashop `home.js` delegates price/cart/status helpers through the core module.

The first slice must not change UI behavior.

## Second Extraction Slice

Implemented next:

- `tools/hashop_site/home-polish-core.js`
- `tools/hashop_tests/home-polish-core.test.js`
- `tools/hashop_site/public-theme.js`
- `tools/hashop_tests/public-theme.test.js`

This slice removes duplicated presentation logic without changing the visible app flow.
