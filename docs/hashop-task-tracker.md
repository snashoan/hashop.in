# Hashop Task Tracker

Last updated: 2026-04-05

## Current direction

- Keep the public map, login, customer shop, and owner shop flow inside one pane on `/`.
- Use the same shop surface for customer view and owner view.
- Add features in dependency order so the live site stays stable.
- Buying must stay guest-first.
- Logging in must be optional for buyers and role-aware for owners.
- `My shop` is owner-only. Buyer identity must not be forced into the shop object.

## In progress

- Pane-based owner flow cleanup on `/`
  Current focus:
  - keep owner mode inside the same shop pane
  - make the pane read like one inner screen
  - move owner actions to cleaner positions

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
- Local `account session` now stays separate from the guest buyer cache
  - owner shops are stored in a dedicated session object
  - one session can keep more than one owner shop on device
- Root pane now changes by account session role
  - no account: `Login`
  - one owner shop: `My shop`
  - multiple owner shops: `My shops`
  - buyer roles are prepared to use `My profile` / `Profile`
- Task tracker is now the running source of truth in the repo

## Pending tasks

### Identity follow-up

- Keep guest buying without login.
- Add real buyer account auth so `buyer account` and `buyer + owner account` are backed by server identity.

### Then

- Extend buyer history lookup to support `account_id` when account sessions land.
- Make existing owner item editing cleaner and more obvious.
- Keep shop info visible in owner manage mode while forms stay editable below it.

### Payment flow

- Fix UPI amount injection so amount is actually passed in the payment URI.
- Keep payment method selection required before payment redirect.

### Order pipeline

- Add stable order states:
  - `created`
  - `payment_pending`
  - `accepted`
  - `ready`
  - `paid`
  - `completed`
- Use those states for both buyer and owner history.

### Billing / monetization

- Add vendor dues calculator.
- Rule:
  - after INR 50,000 sales
  - vendor owes INR 5,000
  - equivalent to 10% on that threshold
- Add payment receive lock when dues are unpaid.
- Do this only after the order ledger is stable.

## Approved live behavior

- `/` uses map background with one pane.
- Login opens inside the same pane.
- Saved owner session becomes `My shop`.
- Owner shop opens inside the same pane.
- Customer cart and payment selection stay inside the pane.
- Buyers do not need login to buy.

## Notes

- Do not split this back into multiple apps unless there is a hard blocker.
- Do not add billing locks before order states and payment return flow are stable.
- Do not merge buyer profile and shop profile into one object.
