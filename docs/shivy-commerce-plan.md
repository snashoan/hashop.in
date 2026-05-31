# Shivy Commerce Plan

Last updated: 2026-05-31

## Purpose

Hashop should become the reference commerce app built on top of Shivy, not a one-off site.

Shivy is the open-source foundation. Hashop is the default branded product on that foundation. Other sites, such as a future Snafleshub brand, should be able to reuse the same commerce engine while changing theme, assets, copy, domain, and selected business rules.

The public buyer and owner UI should still feel like a normal commerce app. Shivy, debug tooling, and framework language belong in developer surfaces only.

## Current Inputs

- `../shivy/` is the open-source runtime direction.
  - core app/runtime modules live under `../shivy/src/core/`
  - OMDXE/Codex dock behavior lives under `../shivy/src/omdxe/`
  - the current browser lab uses a service worker, simple runtime, app packages, and a keyboard-safe Codex dock
- `tools/hashop_site/` is the live Hashop frontend.
  - public buyer storefront
  - owner/shop management UI
  - account, cart, order, map, and debug screens
  - small browser-safe helper modules for commerce logic, UI polish, and public theme bootstrapping
- `tools/hashop_hub.py` is the live Hashop hub/API.
  - shops
  - shop console JSON
  - buyer accounts
  - orders
  - owner recovery
  - debug route injection
- `docs/hashop-task-tracker.md` remains the current Hashop delivery tracker.

## Target Model

The target stack should split into four layers.

### 1. Shivy Runtime

Open-source, commerce-agnostic foundation.

Responsibilities:

- app registration
- route registration
- state/event bus
- local storage helpers
- bridge/runtime hooks
- service worker and tiny local server patterns where useful
- debug/Codex dock as a developer plugin
- deployment/dev-server utilities

This layer must not know Hashop-specific shop rules.

### 2. Shivy Commerce

Reusable commerce engine on top of Shivy.

Responsibilities:

- shop model
- item/catalog model
- buyer cart model
- order model and order states
- buyer identity and guest buyer key
- owner membership
- shop console data
- map/location helpers
- payment method model
- account/session helpers
- standard API client
- reusable buyer and owner screen flows

This layer can provide default UI components, but the theme and brand should be replaceable.

### 3. Brand Package

Thin app package for a specific site.

Examples:

- `hashop`
- `snafleshub`
- any self-hosted shop network

Responsibilities:

- brand name
- logo and assets
- theme tokens
- default route map
- enabled features
- payment rules
- map defaults
- empty-state wording
- optional component overrides
- deployment/domain config

Brand packages should not fork core order/cart/shop logic unless there is a clear business rule that belongs behind a documented extension point.

### 4. Host Adapter

Deployment/runtime adapter.

Responsibilities:

- static asset serving
- API server selection
- database/storage adapter
- upload adapter
- mail adapter
- map provider config
- domain and TLS config

Hashop currently uses an aiohttp hub with SQLite and static files. That can be the first host adapter because it already works.

## Brand Contract

A brand should be mostly configuration.

Example shape:

```json
{
  "id": "hashop",
  "name": "Hashop",
  "domain": "hashop.in",
  "theme": {
    "accent": "#d8b35d",
    "surface": "#090909",
    "radius": "10px"
  },
  "features": {
    "guestBuying": true,
    "buyerAccounts": true,
    "ownerConsole": true,
    "mapDiscovery": true,
    "payOnReceive": true,
    "payBefore": true
  },
  "routes": {
    "home": "/",
    "debugHome": "/home-debug",
    "owner": "/hashop"
  }
}
```

Required brand hooks:

- `brand.id`
- `brand.name`
- `brand.theme`
- `brand.routes`
- `brand.features`
- `brand.assets`
- `brand.paymentPolicy`
- `brand.mapDefaults`
- `brand.copy`
- `brand.publicTheme`

Optional brand hooks:

- custom home header
- custom item card
- custom shop card
- custom owner dashboard section
- custom checkout note
- custom order receipt

## Commerce Domain Contract

These models should be stable before extraction.

### Shop

Fields:

- `shop_id`
- `display_name`
- `public_url`
- `map_color`
- `location`
- `lat`
- `lng`
- `owner_members`
- `profile`
- `items`
- `payments`
- `orders`

### Item

Fields:

- `item_id`
- `shop_id`
- `name`
- `description`
- `price`
- `quantity`
- `image`
- `available`
- `tags`

### Cart

Fields:

- `buyer_key`
- `shop_id`
- `items`
- `payment_mode`
- `buyer_snapshot`
- `total`

### Order

Fields:

- `order_id`
- `shop_id`
- `buyer_key`
- `buyer_account_id`
- `buyer_snapshot`
- `items`
- `payment_mode`
- `payment_method`
- `total`
- `status`
- `timestamps`

Allowed statuses:

- `created`
- `payment_pending`
- `accepted`
- `ready`
- `paid`
- `completed`
- `cancelled`

### Buyer Identity

Rules:

- guest buying remains first-class
- `buyer_key` works without login
- buyer account is optional
- signed-in buyer can sync history across devices
- buyer identity must not be merged into shop owner identity

### Owner Identity

Rules:

- owner membership grants access to shops
- one account may own/manage multiple shops
- owner mode is a role, not the default buyer state
- owner controls stay out of normal buyer flows

## API Contract

The first reusable API surface should include:

- `GET /api/shops`
- `GET /api/shops/{shop_id}`
- `GET /api/shops/{shop_id}/console`
- `PUT /api/shops/{shop_id}/console`
- `POST /api/shops/{shop_id}/orders`
- `GET /api/orders/recent`
- `GET /api/orders/by-buyer`
- `POST /api/buyer/accounts`
- `POST /api/buyer/login`
- `POST /api/buyer/reset`
- `POST /api/owner/login`
- `POST /api/owner/reset`
- `POST /api/debug/codex/start`
- `GET /api/debug/codex/progress/{run_id}`

Hashop can keep compatibility routes while Shivy Commerce introduces named API clients around these endpoints.

## UI Contract

Reusable Shivy Commerce UI should expose these screens:

- discovery map
- shop list
- item list
- shop detail
- cart
- checkout/payment choice
- order confirmation
- buyer account
- buyer order history
- owner shop list
- owner stock
- owner orders
- owner shop settings
- owner add flow

Reusable UI must accept:

- brand theme tokens
- brand copy tokens
- route adapter
- API adapter
- feature flags
- optional component overrides

Hashop-specific visual rules should move into a Hashop brand theme, not stay mixed with commerce behavior.

## Debug Contract

The OMDXE-style Codex dock should become a Shivy debug plugin.

Rules:

- debug tools only load on debug routes
- normal user routes stay clean
- the active app is the canvas
- the dock gathers current route, state, viewport, visible UI, and build data
- Codex can run through a local bridge during development
- copy-mode fallback remains available when no processor is connected

Hashop should use the plugin instead of owning a permanent custom debug implementation.

## Migration Strategy

Do not rewrite Hashop in one pass.

### Phase 0: Freeze The Contract

Deliverables:

- this plan
- tracker entry
- module boundary list
- extraction order

Exit condition:

- the team agrees what belongs to Shivy, Shivy Commerce, Hashop brand, and host adapter

### Phase 1: Extract Pure Commerce Helpers

Start with low-risk JavaScript helpers from `home.js`.

Candidates:

- price parsing/formatting
- order status normalization
- cart calculations
- buyer key/session helpers
- distance/map helper math
- route parsing helpers

Exit condition:

- Hashop imports or calls the extracted helpers through one compatibility object
- no visible UI change

### Phase 2: Extract API Client

Create a reusable commerce API client.

Candidates:

- shop listing/detail calls
- shop console save/load
- item library calls
- order creation/history calls
- buyer account calls
- owner account calls

Exit condition:

- Hashop frontend no longer hand-writes fetch logic for core commerce operations

### Phase 3: Introduce Brand Config

Add a Hashop brand config and make current UI read from it.

Start with:

- app name
- routes
- theme tokens
- feature flags
- map defaults
- payment labels

Exit condition:

- changing brand config can alter visible brand/theme without touching commerce behavior

### Phase 4: Move Debug Dock To Shivy Plugin

Port the current Hashop debug dock into Shivy.

Exit condition:

- Hashop debug routes import/use Shivy debug plugin
- normal routes still have no debug UI
- local bridge progress still works

### Phase 5: Backend Modularization

Split `tools/hashop_hub.py` behind service modules.

First modules:

- shop repository
- console repository
- buyer account repository
- order repository
- recovery/mail service
- debug proxy service

Exit condition:

- the aiohttp routes become thin wrappers around reusable commerce services

### Phase 6: Hashop As Reference Brand

Move Hashop-specific theme/config into a brand package.

Exit condition:

- Hashop still deploys to `hashop.in`
- Hashop remains visually the same unless intentionally changed
- core commerce can be reused by another brand package

### Phase 7: Second Brand Proof

Create a minimal second brand package.

Example:

- `snafleshub`

Exit condition:

- second brand can run the same shop/item/cart/order/account engine
- brand changes are limited to config/theme/assets and documented override points

### Phase 8: Open Source Template

Create public docs and starter files.

Deliverables:

- `create a Shivy commerce app`
- `brand config reference`
- `API adapter reference`
- `theme token reference`
- `deploy with aiohttp/sqlite`
- `debug with Codex dock`

Exit condition:

- someone can fork Shivy and power their own ecommerce site without copying Hashop internals

## Extraction Order

Use this order to reduce breakage:

1. pure helpers
2. API client
3. brand config
4. debug plugin
5. reusable UI shell
6. backend services
7. second brand
8. public template/docs

Avoid extracting CSS first. Hashop CSS is currently carrying many product decisions and should only be split after brand tokens and UI contracts are clear.

## Non-Goals For The First Pass

- no immediate full rewrite
- no forced framework migration
- no public UI language about Shivy
- no breaking live Hashop routes
- no billing lock work during architecture extraction
- no merging buyer and owner identity
- no making login required for buying

## Immediate Next Tasks

1. Create a module inventory from `tools/hashop_site/home.js` and `tools/hashop_hub.py`.
2. Create a tiny `commerce-core` helper module with tests for price, cart, and order status logic.
3. Wire Hashop to that helper module without changing UI.
4. Move the debug dock into a Shivy-compatible plugin shape.
5. Add a `brands/hashop` config draft.
6. Keep `docs/hashop-task-tracker.md` updated as extraction work starts.

## Decision Log

- Hashop remains live and stable during migration.
- Shivy is the open-source foundation.
- Shivy Commerce is the reusable ecommerce layer.
- Hashop becomes the reference brand implementation.
- Other brands reuse the same commerce engine through config and documented extension points.
