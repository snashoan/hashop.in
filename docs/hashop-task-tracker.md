# Hashop Task Tracker

Last updated: 2026-05-20

## Current direction

- Keep the public map, login, customer shop, and owner shop flow inside one pane on `/`.
- Use the same shop surface for customer view and owner view.
- Add features in dependency order so the live site stays stable.
- Buying must stay guest-first.
- Logging in must be optional for buyers and role-aware for owners.
- `My shop` is owner-only. Buyer identity must not be forced into the shop object.
- Hashop should become the reference commerce app on top of Shivy, while Shivy Commerce becomes the reusable open-source layer for other branded ecommerce sites.

## In progress

- Live catalog and account cleanup on `/`
  Current focus:
  - keep the site consistent like a normal commerce app
  - keep buyer states as `Shops`, `Items`, `Cart`, and `Account`
  - keep owner states as `My shops`, `Stock`, `Orders`, and `Account`
  - keep product pictures fitted inside cards without cropping
  - keep listing cards visually centered, with symmetrical image and text rhythm
  - keep profile and account forms consistent with the `/setup` details form
  - restore the transparent hash branding direction while keeping the current utility-first app frame
  - repair map, item-list centering, and account-location regressions before adding new product features
  - keep minimal public About and Privacy pages available from Account
  - keep open-source/framework concerns out of the public UI surface
- Shivy Commerce migration planning
  Current focus:
  - keep live Hashop stable while extracting reusable commerce pieces
  - document what belongs to Shivy runtime, Shivy Commerce, Hashop brand config, and host adapters
  - use `docs/shivy-commerce-plan.md` as the migration plan before starting code extraction

## Identity foundation

- `Guest buyer`
  - no login required
  - local cached profile on device
  - reuse name/contact/order refs on the same device
- `Account`
  - optional
  - can be buyer, owner, or both
- `Owner membership`
  - account has access to one or more shops
- `Shop`
  - public storefront and owner-managed data
- `Order`
  - stored server-side
  - must carry `buyer_key` plus buyer snapshot

## Completed

- `buyer_key` foundation for orders
  - every new checkout order now gets a device buyer key
  - orders are now persisted server-side before redirecting to payment
- Cart now supports payment mode choice
  - `Pay on receive` is the default
  - `Pay before` is optional buyer choice
- Orders are created first, then payment behavior follows
  - `Pay on receive` places the order without redirect
  - `Pay before` creates the order, then opens the payment method
- Owner `Orders` now supports inline status actions in `Manage`
  - `Accept`
  - `Ready`
  - `Paid` / `Confirm payment`
  - `Complete`
- `Manage` state replacing the old owner `Edit` entry
  - owner CTA now opens `Manage`
  - while in manage, the same CTA becomes `Logout`
  - owner controls stay inside the same shop pane
- `Manage` sections are now dropdown-based
  - `Shop`
  - `Items`
  - `Payments`
  - `Orders`
  - only the needed section has to open
- `Logout` in the owner CTA during `Manage`
  - no separate logout control inside the manage body
  - logout clears the saved session
  - current shop stays open, but falls back to customer view
- Owner `Orders` section inside the same pane
  - uses the same manage stack as shop, items, and payments
- Local cached buyer profile on device
  - keeps `buyer_key`
  - saves optional buyer name
  - saves optional buyer contact
  - keeps recent order refs
- Buyer `Recent orders` now works inside the same pane
  - recent orders are fetched server-side by `buyer_key`
  - buyers can reopen a shop from their order history
- Owner item editing is clearer and more obvious
  - item list says to tap an item before editing
  - selected item is marked clearly
  - edit actions now say `Save changes` and `Delete item`
- Owner `+ Add` action groups creation tasks
  - owner shop screen shows one labeled `+ Add` button
  - menu opens `Add item`, `Start order`, and `Add photo`
  - customer screens do not show the create menu
- UPI amount injection is fixed
  - UPI links now include the cart total as `am`
  - UPI links now include `cu=INR`
  - this works even when the shop currency label is blank
- Payment method selection is required before payment redirect
  - `Pay before` opens the payment selector first
  - if no method is selected, the buyer stays on the cart
  - the cart shows `Select a payment method first.`
- Local `account session` now stays separate from the guest buyer cache
  - owner shops are stored in a dedicated session object
  - one session can keep more than one owner shop on device
- Account entry is role-aware but stays inside `Account`
  - no account: shows buyer and shop owner choices
  - one owner shop: shows that shop under `Shop owner`
  - multiple owner shops: shows all saved shops under `Shop owner`
  - buyer roles stay in the buyer area instead of becoming shop state
- Home UI organization pass
  - every main view now has one clear screen label
  - map, search, shop, cart, owner, history, account, and login no longer fight the same layout rules
  - debug mode now shows the current screen and pane state
  - mobile keeps shop/owner work focused while history, account, and login stay in the normal home frame
- Map compass control
  - map now has a compact north/compass button
  - tapping it resets the map view
  - device heading is used when available
- Order pipeline stable states
  - orders now normalize to `created`, `payment_pending`, `accepted`, `ready`, `paid`, `completed`, or `cancelled`
  - buyer history and owner history use the same normalized status values
  - older flag-based orders are mapped into the same state names
- Button and field UI rinse
  - primary, secondary, active, and danger actions now have clearer visual hierarchy
  - fields have stronger borders, visible labels, and clearer focus state
  - mobile touch targets are more consistent across buyer, owner, cart, and login flows
- Owner manage shop context
  - owner manage, orders, items, and stats now keep a compact shop summary visible above the forms
  - summary shows shop identity, location context, item count, pending orders, and payment setup state
  - editable forms stay below the summary instead of replacing all shop context
- Top bar state and connected frame
  - top bar now shows the current place such as `Home`, `Shop`, `Cart`, `Manage`, and `History`
  - header, map, and shop pane now sit as one connected frame
  - desktop map and pane now meet cleanly without a loose gutter
  - outer frame border outlines are removed so the screen reads cleaner
- App state feedback foundation
  - empty, loading, and offline screens now use one clear message style
  - no-result screens now offer simple next actions like `Clear search` or `Add shop`
  - the top bar now shows `Offline` when the device loses connection
- Real buyer account auth
  - buyer accounts are now server-backed and separate from shop owner accounts
  - buyers can save or open an optional buyer account from `Account`
  - guest buying still works without login
  - new orders can carry buyer account identity when a buyer is signed in
- Buyer history account lookup
  - recent orders still load by local `buyer_key` for guests
  - signed-in buyers now send a verified account token for order history
  - history lookup matches either `buyer_key` or `buyerAccountId`
- Product-grade UI layout standard
  - UI guidelines are now written in `docs/hashop-ui-guidelines.md`
  - forms now use a standard vertical stack with visible labels
  - primary, secondary, and danger actions now sit in predictable action zones
  - account, owner, cart, and shop sections now use the same spacing and field rhythm
- Text readability correction
  - muted helper text, card subtitles, field labels, placeholders, and bottom nav labels now use stronger contrast
  - gold labels are brighter and easier to scan on dark surfaces
- Text color reset
  - main text now uses clean near-white instead of tinted low-contrast tones
  - secondary text now uses neutral light gray instead of muddy beige
  - gold is kept mainly for active state, labels, and focus
- Buyer history cleanup
  - recent history no longer repeats the same heading in the pane
  - order shop, date, payment, and amount now read as clean single lines
  - finished or cancelled orders no longer show repeated `Open shop` actions
- Shop page action cleanup
  - shop hero no longer repeats the cart action when the cart button already exists
  - shop contact actions now stay focused on direct call or WhatsApp links
- Account pane simplification
  - account page now shows two clear paths: buy from shops or manage a shop
  - buyer account fields no longer appear by default
  - shop owner sign-in stays behind the shop owner action
- Buyer items state
  - bottom nav now shows `Items` as its own buyer state
  - buyer item view now loads real listed items from the item library API
  - shops and items can now be browsed separately without a false empty item screen
- Map cleanup
  - discovery map now uses a brighter non-satellite base layer
  - map opens around the real local shop cluster when no user location is available
  - locate and compass controls now align as one top-right control group
  - item cards no longer show a call button
- Plain map reset
  - decorative map filters and grid overlays are removed
  - shop listing cards no longer show the round call button
  - call and WhatsApp stay inside the shop page
- Product catalog enrichment
  - current live items now have clean readable product names
  - current live items now have short buyer-facing descriptions
  - current live items now have product thumbnails
- Account history placement
  - buyer history now appears inside `Account`
  - the separate buyer history/cart bottom tab is removed
  - the top history shortcut is kept for owner shop history only
- Item database cleanup
  - bottom navigation now names the item state as `Items`
  - live item data is reset to basic cold drinks only
  - product cards keep short names, direct descriptions, prices, quantities, and thumbnails
- Cart state bar placement
  - bottom state bar now shows `Cart` in third position
  - cart tab opens open carts, while past history stays in `Account`
- Product image fit cleanup
  - item thumbnails now fit inside cards instead of cropping or overfilling
  - duplicate live drink objects were removed from the item database
- Real product image pass
  - current cold drink items now use real product packshot images
  - generated placeholder drink art was cleared from active item records
- Duplicate state cleanup
  - top header state label was removed
  - duplicate pane-bar cart, history, and locate controls were removed
  - bottom state bar remains the single buyer navigation surface
- Map visibility cleanup
  - map container now has loading and visibility guards
  - Google Maps can be used when `HASHOP_GOOGLE_MAPS_API_KEY` is configured
  - street-map fallback remains available when no Google key is present
- Account flow tidy-up
  - Account tab now always opens the Account pane instead of jumping straight into a saved shop
  - open carts stay in Cart, while past buyer orders stay in Account history
  - account and owner-side preview images are contained so they do not overflow their cards
- Account login and image de-zoom
  - shop owner login now uses shorter copy and one clear `Open shop` action
  - Account buyer area no longer shows extra unset name/contact rows
  - shop, product, account, and owner preview images now use contained framing instead of cropped zoom
- Show-first UI copy
  - Account and shop login no longer explain the feature flow
  - empty states now prefer the visible state plus direct actions
  - carts, history, buyer, and owner areas show records/counts/actions instead of descriptive paragraphs
- Duplicate label cleanup
  - Cart tab no longer renders a second Cart hero above the empty cart card
  - Account tab no longer repeats Account inside the pane body
  - shop cart no longer repeats Cart in the kicker and card header
  - empty Cart now shows one state only: `Cart empty`
- Account click-first cleanup
  - default Account now shows only large `Buy` and `Shop owner` actions
  - `Orders` appears only when a buyer is signed in or guest order history exists
  - account actions are larger tap cards instead of stacked explanatory sections
- Buyer/owner state split
  - buyer/default state keeps public `Shops`, `Items`, `Cart`, and `Account`
  - saved shop-owner state changes the bottom bar to `My shops`, `Stock`, `Orders`, and `Account`
  - owner `My shops` lists only registered shops for that owner
  - owner `Stock` lists only items from that owner’s registered shops
- Permanent image fit correction
  - remaining crop rules were replaced so previews use `object-fit: contain`
  - shop, product, owner, and account image boxes now share contained framing instead of zoomed crops
- Buyer item-first flow
  - `Items` cards now make the product the main object and keep shop identity visible as source information
  - buyers can add from item cards without first opening the shop
  - shop page contact actions stay at the bottom, while navigation belongs to the map/pin flow
- Buyer account state
  - default no-login state stays buyer mode with public `Shops`, `Items`, `Cart`, and `Account`
  - guest `Account` shows `Sign in as buyer` and `Shop owner`
  - buyer sign-in keeps the app in buyer mode and shows `Buyer account`, `Orders`, and `Logout`
  - buyer orders open as an account sub-state instead of crowding the default account screen
- Button appearance cleanup
  - buyer, owner, cart, account, map, and bottom-nav buttons now share one visual system
  - primary actions use one restrained gold style, secondary actions use one charcoal style, and danger actions use one red style
  - account buttons were visually cleaned without changing the account state logic
- Account as identity module
  - Account now represents identity, active role, role switching, and session control
  - owner mode is controlled by an explicit active role instead of automatically taking over when a shop exists
  - buyer + owner users can switch roles without losing the buyer account or owner shops
- Sleek button finish
  - the button system was flattened into simpler charcoal/gold states with lighter borders and less visual weight
- Owner password reset
  - shop login now has a `Forgot password?` path
  - shop-specific reset codes can be requested with the saved shop contact
  - reset codes are short-lived, attempt-limited, and valid only for that shop
  - the server owner reset code remains as an operator fallback
- Hashop shop catalog update
  - `hashop` shop now includes `Hand Sanitizer 100 ml` in its live listings
- Account settings home
  - signed-out Account now starts with one simple sign in / create account form
  - signed-in Account now lists Profile, Role, Orders, Shops, Add shop, and Logout as account settings
  - buyer order history stays behind the Orders row instead of loading into the default account view
- Permanent image containment
  - final CSS cascade now forces product, shop, owner, account, and gallery images to use contained framing
  - image wrappers clip safely but images themselves never use cropped or zoomed fit
- UI consistency contract
  - the final loaded UI layer now defines one normal app frame
  - discovery states keep the map visible, while account, cart, shop, and owner work use the full phone pane
  - cards no longer reserve empty space for removed call buttons
  - buttons, fields, cards, account rows, item rows, and bottom nav now share one flat product visual system
  - future UI work must use `docs/hashop-ui-guidelines.md` instead of adding another visual style layer
- Current chat UI correction pass
  - `hashop-home-i046` restores normal rounded buttons instead of listing-like line buttons
  - transparent Hashop hash branding is back and the logo is slightly larger
  - map controls keep a visible `Locate me` outline and compass alignment
  - default listings and Items use centered item-like rows with contained thumbnails
  - Items has compact sorting for nearby/shop, price, quantity, and name
  - empty Cart uses a small mascot-style memo without duplicate inner framing
  - Account home no longer shows profile or location cards; Profile and Addresses stay as menu sections
  - Account and item/card containers were flattened toward row-based mode surfaces
  - saved default addresses with coordinates can drive the `Locate me` app location context
- Shivy Commerce first extraction slice
  - `docs/shivy-commerce-inventory.md` maps current Hashop frontend/backend modules to the future Shivy Commerce layers
  - `tools/hashop_site/commerce-core.js` now holds reusable price, cart, and order-status helpers
  - `tools/hashop_tests/commerce-core.test.js` covers the first pure helper contract
  - `home.js` delegates those helper calls through the new commerce core without changing visible behavior
- Task tracker is now the running source of truth in the repo

## Pending tasks

### Shivy Commerce migration

- Treat `docs/shivy-commerce-plan.md` as the planning document for making Hashop a reference brand on top of Shivy.
- Keep Shivy and open-source framework concepts out of normal buyer/owner routes.
- Extract in this order:
  - pure commerce helpers
  - API client
  - brand config
  - debug plugin
  - reusable UI shell
  - backend services
  - second brand proof
  - public template/docs
- First implementation slice is started:
  - small commerce helper module is in place
  - price/cart/order-status logic has a Node test
  - next work should broaden the module only after live behavior stays stable

### Identity follow-up

- Keep guest buying without login.
- Buyer account auth is live; keep testing session wording and account cleanup.

### Consumer UX / recommendations

- Improve buyer-side recommendations and synced history.
- Use buyer order history to surface better repeat-buy suggestions.
- Start with simple signals:
  - items bought frequently
  - shops ordered from frequently
  - recent repeats that are likely to be bought again
- Keep guest-first behavior:
  - local `buyer_key` history should still work without login
  - signed-in buyer accounts should sync history across devices
- Show recommendations in a practical buyer place, such as `Account` or `Items`, without forcing another required step before checkout.

### Payment flow

- Complete.

### Order pipeline

- Complete.

### Billing / monetization

- Keep monetization in discussion until the account/order experience is stable.
- Candidate directions to compare:
  - hosted support or managed instance fee
  - optional automated verification services
  - vendor dues after clear sales thresholds
  - paid setup/support for forks without changing the buyer checkout model
- Avoid platform cuts on basic payment flow unless the product model changes.
- Add vendor dues calculator.
- Rule:
  - after INR 50,000 sales
  - vendor owes INR 5,000
  - equivalent to 10% on that threshold
- Add payment receive lock when dues are unpaid.
- Do this only after the order ledger is stable.

### Public pages and policies

- Keep `/about` and `/privacy` minimal.
- Keep policy wording specific to Hashop:
  - guest-first buying
  - saved account permanence
  - shop-managed listings
  - direct or pay-on-receive payment options
  - fork/self-host rules can vary by operator

### Codebase hygiene

- Consolidate repeated late CSS override layers after the current UI stabilizes.
- Keep pure commerce logic moving toward `commerce-core.js`.
- Keep backend route handlers thin for static pages and product shell routes.
- Prefer small helpers over repeated HTML string blocks when account rows or forms repeat.

## Approved live behavior

- `/` uses map background with one pane.
- Login opens inside the same pane.
- Saved owner session appears inside `Account` under `Shop owner`.
- Owner shop opens inside the same pane.
- Customer cart and payment selection stay inside the pane.
- Buyers do not need login to buy.

## Notes

- Do not split this back into multiple apps unless there is a hard blocker.
- Do not add billing locks before order states and payment return flow are stable.
- Do not merge buyer profile and shop profile into one object.
