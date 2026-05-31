# Hashop UI Guidelines

Last updated: 2026-05-31

Hashop should feel like a fast local commerce tool. The interface must help a buyer find stock, place an order, and leave. It must also let a shop owner manage stock and orders without changing into a separate admin product.

## Core Standard

- Keep one persistent app frame.
- Keep buyer navigation stable: `Shops`, `Items`, `Cart`, `Account`.
- In owner mode, keep the same positions and use: `My shops`, `Stock`, `Orders`, `Account`.
- Do not duplicate state buttons inside the state body.
- Do not hide a state because it is empty.
- Keep forms short, labeled, and one-column on phones.
- Keep public pages visually related to the app.

## Layout

- Use one visible plane for the app frame.
- Center the pane on the viewport.
- Prevent horizontal overflow at every state.
- Keep the search and filter area connected with no scroll leak behind it.
- Keep bottom navigation clear of content and system safe areas.
- Use stable image boxes so products and shop images do not resize the layout.
- Avoid nested cards unless the inner object is a real repeated item.

## Touch

- Main controls must be at least 48px tall.
- Rows should be at least 56px tall.
- Icon-only controls still need a 48px touch target.
- Scrollable panes must support vertical finger drag.
- Buttons inside tappable cards must remain visually separate.
- Back controls must render as one line, for example `< Back`.

## Visual System

Use:

- white and black as the day/night base
- neutral text colors with clear contrast
- faint gold only for active state, focus, icons, and small accents
- contained product images
- simple rows and tiles
- consistent spacing and font sizes

Avoid:

- yellow-heavy surfaces
- generic outline stacks
- decorative panels that compete with the product
- grey drift between unrelated states
- hidden or transparent text
- repeated horizontal divider lines used as decoration

## State Requirements

### Shops

- Show shop-first listings.
- Keep search visible and aligned.
- Open shop details without shifting the whole page sideways.
- Use the map as context, not as a blocking dashboard.

### Items

- Make the product the main object.
- Show shop identity as supporting text.
- Keep product image, title, price, and quantity aligned.
- Allow direct add-to-cart behavior.

### Cart

- Use the same listing rhythm as item rows.
- Show quantity increase and decrease controls.
- Show payment mode clearly.
- Keep the empty state light, useful, and branded.

### Account

- Signed out: show sign in, create account, and shop-owner entry clearly.
- Buyer signed in: show profile, orders, saved place, support, theme, and sign out.
- Owner active: show owned shops, role controls, support, and sign out.
- Do not turn Account into a dashboard.

### Owner Mode

- Owner mode is a role switch, not a new app.
- `My shops` lists owned shops only.
- `Stock` manages inventory.
- `Orders` handles current and historical orders.
- Owner forms must match the normal Hashop form rhythm.

## Forms

- Labels stay visible above fields.
- Placeholder text is only an example.
- Main action sits at the end of the form.
- Error text appears near the related field or action.
- Do not show stale empty forms.
- Do not ask for optional details before they are needed.

## Motion

- Use short transitions for state changes.
- Animation must clarify that the pane changed.
- Do not animate layout into overflow.
- Respect touch responsiveness over decorative motion.

## Copy

- Use direct product words: `Shops`, `Items`, `Cart`, `Account`, `Stock`, `Orders`.
- Avoid internal architecture terms in buyer and owner UI.
- Empty states should name what is missing and provide one next action.
- Public pages can explain the model, but the app should mostly show the model.

## Production Check

Before shipping UI changes, inspect:

- default `Shops`
- `Items`
- empty and filled `Cart`
- signed-out `Account`
- signed-in buyer `Account`
- owner `My shops`
- owner `Stock`
- owner `Orders`
- `/about`
- `/privacy`

Each screen must have correct alignment, no text overflow, no hidden bottom content, and no horizontal scroll.
