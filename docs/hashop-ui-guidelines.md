# Hashop UI Specs

Last updated: 2026-05-10

## Goal

Hashop should feel like a fast local commerce tool.

The user should be able to:

- open the app
- find a shop or item
- add to cart
- place or manage an order
- open account settings

without needing to understand how the system works.

The code structure can be modular underneath, but the screen surface must feel like one steady product.

## Research Base

These specs are based on common mobile commerce patterns and current usability guidance:

- Bottom navigation should be stable and limited to a few top-level places.
- Touch targets must be large enough for thumbs.
- Account areas should prioritize core self-service tasks.
- Checkout and buying should not force account creation.
- Forms should be short, labeled, and one-column on phones.

References checked:

- Apple Human Interface Guidelines: Tab bars
- Material Design: Bottom navigation
- Google Android Accessibility: touch target size
- W3C WCAG target-size guidance
- Baymard ecommerce account, checkout, and mobile commerce research

## App Frame

Hashop has one persistent app frame.

Top level states:

- Shops
- Items
- Cart
- Account

Rules:

- Bottom nav always shows the same four places.
- Bottom nav is for navigation only, not actions.
- Do not duplicate state buttons above the pane.
- Do not hide a bottom tab because its content is empty.
- Empty states should explain the state with one action.
- Owner mode may rename Cart to Orders, but the position stays the same.

## Touch Layer

Every interactive element must have a reliable touch area.

Rules:

- Important controls are at least 48px tall.
- Icon-only controls still get a 48px touch box.
- Rows are at least 56px tall.
- Primary bottom actions are 48-56px tall.
- Adjacent controls have at least 8px breathing room.
- Nothing important sits behind the bottom nav.
- Scrollable panes must allow vertical finger drag.
- Cards can be tappable, but buttons inside cards must still be clearly separate.

## Visual Layer

The visual system should be neutral, structured, and consistent.

Use:

- dark neutral background
- off-white text
- muted secondary text
- thin neutral borders
- one clear primary button style
- simple row cards
- contained images
- consistent spacing

Avoid:

- gold as the default accent
- glow as structure
- decorative panels
- many button shapes
- mixed border radii
- overlapping sticky controls
- labels that look like buttons

## State Rules

Each state gets one job.

Shops:

- show shops
- search shops
- open shop page
- show useful shop facts only

Items:

- show items
- search items
- show shop source as supporting information
- add item to cart

Cart:

- show selected items
- edit quantity
- choose payment
- place order
- cancel if allowed

Account:

- identify the person
- sign in or create account
- show buyer settings after sign-in
- show shop-owner settings after shop ownership is active
- never become a dashboard

## Account State

Account is currently the weakest state and should be rebuilt around direct task rows.

Signed out:

1. Profile placeholder
2. Phone/email field
3. Password field
4. Sign in button
5. Create account
6. Forgot password
7. Add shop as a secondary path

Rules:

- Do not show orders, settings, addresses, payments, and help before sign-in unless guest orders exist.
- Do not show a large menu before the login form.
- Keep create account and forgot password as quiet text buttons.
- Keep Add shop secondary, because buyer account is the default.

Signed-in buyer:

1. Profile summary
2. Orders
3. Saved place or last used place
4. Payment
5. Shops
6. Sign out

Rules:

- Orders appears only if there are orders or the user is signed in.
- Saved place means current or last-used delivery area, not permanent address storage by default.
- Shops means saved or owned shop access, not a marketplace shortcut.

Shop owner:

1. Profile summary
2. Saved shops
3. Orders access through bottom nav position 3
4. Payment methods
5. Sign out

Rules:

- Owner account does not show buyer address rows as primary content.
- Shop management belongs inside the shop owner flow.
- Account only lists identity, shops, payment, and sign out.

## Row Spec

Account rows, cart rows, and owner rows should share one row model.

Row anatomy:

- left icon or avatar
- title
- short subtitle
- optional small status
- right chevron or action

Sizing:

- row min height: 56px
- row padding: 12px
- icon cell: 36-40px
- title: 15-17px
- subtitle: 13-14px
- chevron/action area: 44-48px touch target

Rules:

- Rows should align on the same grid.
- Titles should not wrap unless unavoidable.
- Subtitles can wrap to two lines only when useful.
- Status text should be short: Open, Closed, Paid, Pending, Cancelled.

## Button Spec

Primary button:

- full width in forms
- neutral light fill
- dark text
- one per form block

Secondary button:

- dark fill
- neutral border
- light text

Danger button:

- red text or red outline
- never placed before safe actions

Text button:

- only for low-risk links like Forgot password
- not used as the main action

## Form Spec

Forms must be short and direct.

Rules:

- Labels stay visible above fields.
- Placeholder is only an example.
- One column on phones.
- Main action at the bottom of the form.
- Error/status appears under the related field or above the action.
- Do not ask for optional details before the user needs them.

Account login form:

- Phone/email
- Password
- Sign in
- Create account
- Forgot password

Create account form:

- Phone/email first
- Password second
- Name optional later

Password reset:

- Step 1: Phone/email
- Step 2: Reset code
- Step 3: New password

## Desktop Spec

Desktop should not become a different product.

Rules:

- Keep the same states.
- Use wider panes, not more controls.
- Account can center as a single column.
- Shops/items can use map plus pane.
- Cart and Account should prioritize readability over split panels.

## Implementation Standard

Shared states should use the same UI primitives:

- app frame
- bottom nav
- full-width form card
- row card
- item card
- shop card
- empty state card
- primary action
- secondary action
- danger action

Do not create a new button/card shape for one state unless the existing model cannot work.

## Next UI Cleanup Order

1. Rebuild Account signed-out state as a direct login form.
2. Standardize Account rows to the shared row model.
3. Remove decorative account panels and glow-like styling.
4. Enforce touch target sizes across Account.
5. Re-check buyer Account.
6. Re-check owner Account.
7. Apply the same professional polish to Shops, Items, and Cart after Account is stable.
