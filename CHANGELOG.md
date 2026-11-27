# Changelog

All notable changes to `@chronary/sdk` will be documented in this file starting with the soft-launch release.

## 0.14.1 — unreleased

- **`agentAuth.signUp()` takes an optional `heard_about` (#2651).** Plain text: how you or your user found Chronary. The SDK cuts it to 200 characters before sending, so a long answer never fails the sign-up. The API keeps it for a new organization only and never returns it. Leaving it out changes nothing.
- **Calendars that refuse double bookings (#595).** `Calendar` gains `prevent_overlaps` (`boolean`), and `CreateCalendarParams` and `UpdateCalendarParams` take an optional `prevent_overlaps`. With it on, the calendar refuses any event that would overlap an active event on it with a 409 `conflict`. `ChronaryError` gains `code` (`string | undefined`, e.g. `'event_conflict'`, `'recurring_on_protected_calendar'`, `'calendar_has_overlaps'`, `'calendar_has_recurring_series'`) and `conflictingEventIds` (`string[]`, empty when the body has none), and `ApiErrorBody.error` declares the optional `code` and `conflicting_event_ids`.

## 0.14.0 — 2026-11-24

- **Breaking: webhook verification requires the v2 signature (#2569).** Chronary now signs every delivery twice: `X-Signature` (v1, over `${X-Timestamp}.${body}`, unchanged and deprecated) and the new `X-Signature-V2`, which also covers `X-Delivery-Id`, `X-Chronary-Event-Type`, `X-Chronary-Test` and `X-Chronary-Replay-Of`. Under v1 those headers were unsigned, so anyone holding a captured delivery could re-send it within the 5-minute tolerance under another event type (for example `event.hold_released` as `event.deleted`), with a fresh delivery id that got past deduplication, or with the test flag removed. `verifySignature()` and `constructEvent()` now check `X-Signature-V2` (or, during a secret rotation, `X-Signature-V2-Previous`) and never fall back to `X-Signature`: a delivery without `X-Signature-V2` is rejected, as is one whose event type, delivery id, test flag or replay id differs from what was signed, an `X-Chronary-Test` other than `1`, or a header value containing CR or LF. Both also require `X-Delivery-Id` and `X-Chronary-Event-Type`. Every Chronary delivery carries the v2 headers, so a receiver needs no change beyond upgrading; test fixtures that sign deliveries by hand must add `X-Signature-V2` (see the webhooks API reference for the message format). Function signatures are unchanged.
- **`WebhookEvent` gains `deliveryId`, `test` and `replayOf`** (`string | null`), returned by `constructEvent()`. They are covered by the signature, so deduplicate on `event.deliveryId` instead of reading the header yourself. Code that builds a `WebhookEvent` object by hand must add the three fields.
- **API change, no SDK code change: names are normalised (#2500).** The API now stores calendar, agent and organization names, booking-page titles, the booker's name, and Agent-key and iCal-subscription labels in a normal form (invisible format characters such as zero-width spaces and bidi controls removed, with zero-width joiners and non-joiners kept for emoji, Persian and Indic scripts, then Unicode NFC, whitespace runs collapsed to one space, ends trimmed), so a name read back can differ from the bytes you sent (`"Work \n"` comes back as `"Work"`). A name with no visible character (whitespace only, or only blank characters such as the braille blank), or one with a control character, is rejected with a `ValidationError` (400). Names stored before the change are returned unchanged.
- **`events.list()` refuses `calendarId` and `agentId` together (#2721).** It sent the request to the agent and dropped the calendar without a word, so a caller could get the wrong calendar's events. It now throws `Pass either calendarId or agentId to events.list(), not both` before any request.
- **A refusal whose `Retry-After` is beyond 60 seconds is not retried (#2558).** The client clamped such a `Retry-After` to 60 s and retried, so an iCal manual-sync cooldown (429, up to 900 s on Free) or the anonymous sign-up daily cap (503, seconds to UTC midnight) blocked the call for about two minutes and then threw the same error. These now reject at once; a `Retry-After` of 60 s or less is still honoured and retried. A 503 with `Retry-After` now waits that long before its retry (it used to use the exponential backoff).
- **Auto-pagination follows `next_cursor` (#2691).** `agents.list()`, `calendars.list()` (org-wide and with `agentId`) and `events.listAll()` paged by offset only, so iterating past 10,000 rows will fail once the API enforces its `offset` cap. They now page by the returned `next_cursor` (other lists still page by offset). `ListAgentsParams`, `ListCalendarsParams` and `ListOrgEventsParams` gain `cursor`; `PageResponse` and `Page` gain `next_cursor` (absent on offset-only lists); `PageIterator.getPage(offset, limit, cursor?)` takes a cursor; a page fetcher passed to `new PageIterator()` receives it as an optional third argument.
- **`agentAuth.signUpAnonymous()` is no longer retried (#2690).** The server does not dedupe `POST /v1/agent/sign-up/anonymous`, so after a lost response (a 5xx or a connection reset once the org was created) the default two retries could create up to three claimable organizations, each holding a key nobody received and spending the network's sign-up budget. It is now sent once unless you pass `{ maxRetries }` as its request options. `RequestOptions` gains `maxRetries`, which overrides the client's value for one call on methods that take request options (paginated `list()` methods do not); a negative, fractional or non-finite value is normalised (negative or non-finite → 0, fractional → rounded down).
- `availability.check()` omits `calendars` when it is an empty array (#2557). It used to send `calendars=`, which the API rejects with 400 `validation_error` ("calendars must not include empty ids").

## 0.13.3 — 2026-11-22

- `AuditActorType` gains `oauth_app`: an app the organization connected to the hosted MCP server by signing in, such as Claude. Its audit entries have `actor_id` set to the connection id and `actor_label` to the app's name, and `auditLog.list({ actor_type: 'oauth_app' })` filters by it (#2254).

## 0.13.2 — 2026-11-22

- **Path parameters are encoded (#2519).** Every ID (and booking slug) a method puts into the URL path is now percent-encoded as one segment, so a value such as `../agents/agt_1`, `whk_1#` or `evt_1?expand=all` can no longer turn `events.deleteById()` or `events.getById()` into a call on another resource or add a query string. `""`, `"."` and `".."` are refused before any request is sent: the returned promise rejects with a `ValidationError` (status `0`). Real Chronary IDs are unaffected. New export `encodePathSegment()` for code that builds its own paths for `CoreClient.request()`. `request()` also accepts the internal `ApiPath` the resource methods use, exported as a type only; its `apiPath` builder stays internal and is not part of the public API.

## 0.13.1 — 2026-11-22

- `scheduling.respond()` returns `RespondToProposalResult`: the saved response plus `auto_resolved` (`confirmed` / `cancelled` / `null`) and `auto_resolve_error` (`null` or `{ code, message }`). When the last response's auto-resolve fails, the API now answers 200 with `auto_resolve_error` instead of an error status, because the response was saved; `message` says what to do next (usually `scheduling.resolve(id)`). Don't respond again. New types `RespondToProposalResult`, `AutoResolveError` and `AutoResolveErrorCode` (#2540).

## 0.13.0 — 2026-11-17

- `client.agentAuth.signUpAnonymous({ agent_name, tos_version, source? })` calls `POST /v1/agent/sign-up/anonymous`: a claimable organization with no email. Returns `api_key` (works at once, Sandbox limits), a one-time `claim_url` for the person who should own the calendar, and `expires_at` (72 hours; unclaimed, the org and its data are deleted). New types `AgentSignUpAnonymousParams` and `AgentSignUpAnonymousResponse` (#2335).

## 0.12.0 — 2026-11-17

- `client.usage.get()` types the new `calendar_connections` field (`{ used, limit }`): live Google / Microsoft calendar connections vs. the plan cap (#2397).
- Docstrings for `recurrence_rule` and the usage caps name the Developer plan: Free 1 / Developer 50 / Pro 250 recurring series, and Developer and Pro both allow series with no end date. They previously read "Pro allows unbounded", which was wrong about Developer and suggested there was no series cap (#2397).

## 0.11.1 — 2026-11-16

- README: the plans table gains the Developer plan. Developer now has every paid-plan feature, scheduling proposals (1,000 a month) and temporal holds included (#2331). No code change.

## 0.11.0 — 2026-11-16

- **Time-zone-aware recurrence (#2276).** `events.create()` takes `timezone` (IANA, e.g. `"America/Los_Angeles"`) and `events.update()` / `updateById()` take `timezone` (or `null` for UTC): a recurring series then repeats on local wall time across daylight-saving changes. Events gain `timezone`; expanded instances gain `startLocal`, `utcOffset` and `dstAdjusted` (`"gap"` when a DST gap moved the start forward).
- **Series edits keep cancelled occurrences (#2277).** An update that changes `start_time`, `recurrence_rule` or `timezone` on a recurring series now keeps each cancelled occurrence on its local date. Any with no match are dropped and listed in the response's `droppedExdates`.

## 0.10.0

- `client.usage.get()` types the two fields the API already returned: `webhook_endpoints` (`{ used, limit }`, registered webhook endpoints vs. the plan cap) and `scoped_keys` (`{ count, limit }`, active agent-scoped keys). Add the `ScopedKeysUsage` type and export `HoldsUsage` and `CrossCalendarQueriesUsage`. A new test fails when the API's `Usage` response gains a field the SDK type lacks (#1995).
- Every single-request resource method now returns an `APIPromise<T>`, so `.withResponse()` works on them as documented: `const { data, response } = await client.agents.get('agt_1').withResponse()` gives the status, headers and parsed `response.quota`. `APIPromise` is now a real `Promise` subclass, so `await`, `Promise.all` and `Promise<T>` annotations work as before. The auto-paginating `list()` helpers still return a `PageIterator` (#2002).

## 0.9.0

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
