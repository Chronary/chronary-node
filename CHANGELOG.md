# Changelog

All notable changes to `@chronary/sdk` will be documented in this file starting with the soft-launch release.

## 0.9.0 — Unreleased

- A 429 `quota_exceeded` (a monthly plan limit) is no longer retried: the request rejects with `QuotaExceededError` at once instead of sleeping on `Retry-After` and asking again. A rate-limit 429 still retries, waiting at most 60 seconds (#1936).
- Add the `developer` plan: `PlanId` includes it, `Plan.annual_price`, `BillingSummary.pending_plan` / `pending_plan_interval` / `pending_plan_at`, `BillingUpgradeOption.plan` (`developer` | `pro`) and `via`, `UpgradeRequest.plan`. Errors expose `upgradePlan` (the plan `upgradeUrl` leads to). Additive; `BillingSummary.plan` stays a plain string (#1911).

## 0.8.1 — 2026-11-09

- Internal hardening of `baseUrl` normalisation and `RateLimit` header parsing. No API change.
- `waitlist.join()` now resolves to `{ waitlisted: true, message }` (HTTP 202) for every email, whether new, already on the list or with an active account. It no longer returns the entry (`data`) and no longer throws 409 `email_taken`. `WaitlistJoinParams` gains `intent`; `WaitlistedOrg` is deprecated (#1655).
- `agentAuth.signUp()` types the 202 sent while sign-ups are paused: `AgentSignUpWaitlistedResponse` (`{ waitlisted: true, message }`, no `org_id`) (#1655).

## 0.8.0 — 2026-10-19

- Add the `billing` resource: `billing.get()` and `billing.upgradeRequests.create/get/cancel` so an agent can read plan status and ask its human to upgrade (#1129).
- Add `PlanRequiredError` (403 `plan_required`). Errors now expose `upgradeUrl`, `docsUrl`, `requiredPlan`, `feature`, `contactUrl`, `metric`, `limit` and the raw `body`.
- Fix `QuotaExceededError` reporting status 402 for HTTP 429 responses; it now keeps the real status.
- Add the `org.plan_changed` webhook event type: fires once when the account's plan changes, so agents don't have to poll billing (#1130).
- Type `BillingSummary.offer` as `BillingOffer | null` — the founding member offer for early-access accounts (`upcoming` / `available` / `redeemed`) (#1121).
- Add the `calendar_connection.reauthorization_required` webhook event type: fires once when a connected human calendar stops accepting access, so agents learn their availability now fails closed (#1196).
- Add `connectionLinks.list({ status, calendar_id, limit })` and the setup details on connection links (`requesting_agent_id`, `requested_capabilities`, `requested_publication_policy`, `created_at`) (#1196).
- Add `webhooks.getDelivery(webhookId, deliveryId)`: one delivery with its attempt timeline (`attempt_log`: HTTP status, duration, response body prefix, error code). Deliveries in `listDeliveries` gain `last_response_status`, `last_error_code` and `last_duration_ms` (#1200).
- Add `webhooks.sendTest(webhookId, { event_type })`: sends a signed sample payload once (`is_test`, `X-Chronary-Test: 1`, quota-exempt). Deliveries gain `is_test`, and `Webhook` gains `deactivatedAt` and `deactivatedReason` (`manual`, `circuit_breaker`, `unsafe_destination_url`, `account_deletion`) (#1200).
- `webhooks.listDeliveries` takes `event_type` (exact, or a prefix ending in a dot such as `event.`), `created_after`, `created_before`, `delivery_id`, `is_test` and `cursor`, and returns `next_cursor` and `has_more`. Delivery `status` gains `dropped` (a Free-plan delivery the monthly limit stopped, `last_error_code: 'quota_exceeded'`), and `stats` gains `dropped` (#1200).
- Add `events.listAll({ calendar_id, agent_id, start_after, start_before, status, source, q, expand })`: events across all of the organization's calendars (`GET /v1/events`), with title search inside a window of at most 31 days. Add `calendars.rotateIcalToken(id)` to regenerate a calendar's subscribe URL, and a `q` search on `calendars.list()`. Array query values are sent as repeated parameters (#1202).
- Add `bookingPages.listBookings(id, { limit, cursor })`: the bookings made through a page with the invitee's name, email and notes, newest first, paged by `next_cursor`. Add `bookingPages.rotateSlug(id)` to replace a page's public link, and a `calendar_id` filter on `bookingPages.list()` (#1202).
- Add `webhooks.replayDelivery(webhookId, deliveryId)` (Pro): sends a `failed` or `dropped` delivery again as a new delivery, with an `X-Chronary-Replay-Of` header naming the original. It counts toward the monthly delivery quota. Add the `WebhookReplaySent` type. Deliveries gain `replay_of_delivery_id`, and the delivery detail's `request_headers` gains `x-chronary-replay-of` on a replay (#588).
- **Webhook secret rotation (#594).** `verifySignature` and `constructEvent` now accept a delivery when the secret matches either `X-Signature` or `X-Signature-Previous`. During a rotation's grace window Chronary sends both headers, the second signed with the replaced secret, so a receiver can switch secrets without rejecting deliveries. Update before you rotate a secret. Add `webhooks.rotateSecret(webhookId, { expire_old_in })` (Pro): returns the new secret once, and the old one keeps working for `now`, `1h`, `24h` (default) or `7d`. `Webhook` gains `previousSecretExpiresAt`.
- Type `Event.holdPriority` as `number` (was `number | null`). The API has always sent a number: `0` unless a hold set a priority. Code that compares it to `null` now gets a TypeScript "no overlap" error and can drop the check; nothing changes at runtime (#1446).

## 0.7.1 — 2026-07-14

- Docs-only: neutral wording for the booking-page type (no competitor references). No API change.

## 0.7.0 — 2026-07-14

- Add the `bookingPages` resource — CRUD for agent-created public scheduling links plus public `listSlots`/`submit` helpers — and a `booking_pages` usage metric (#1036).

## 0.6.0 — 2026-07-12

- Add `allow_stale` serialization and typed `availability_state`, `sources`, and `warnings` for agent/cross-agent availability.
- Add a distinct calendar availability response shape and retain connection-link lifecycle support.

## 0.5.1 — 2026-07-12

- Add connection-link APIs so agents can request and monitor human calendar setup without receiving provider credentials or calendar details.

## 0.1.4 — 2026-05-19

- First OIDC + Sigstore-provenance release. Published via npm Trusted Publishing from `Chronary/chronary-node`; provenance badge visible on npmjs.com.

## 0.1.3 — 2026-05-19

- Bootstrap publish to npmjs.com as `@chronary/sdk` via a one-time classic-token path (npm has no Pending Publisher flow; see #688). Sigstore provenance is **not** attached to this version — see 0.1.4 for the first attested release.
- Add `"publishConfig": { "access": "public" }` so the scoped package ships unrestricted.
- Fix `repository.url` / `bugs.url` canonical casing (`Chronary/`).

## 0.1.2 — 2026-05-18

- Add `CONTRIBUTING.md` to the public mirror documenting that this repo is generated from a private monorepo; PRs are welcome as proof-of-concept but can't be merged directly. No behavioral change.
