// ── Client configuration ────────────────────────────────────────

export interface ChronaryConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  logLevel?: LogLevel;
  fetch?: typeof globalThis.fetch;
  appInfo?: AppInfo;
  /**
   * Extra headers to attach to every request. Used by wrapper packages
   * (e.g. `chronary-mcp`) to set `X-Chronary-Client` so the API can
   * attribute the wrapper's traffic separately from the bare TS SDK's.
   * Header keys here override the SDK defaults — choose wisely.
   */
  extraHeaders?: Record<string, string>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off';

export interface AppInfo {
  name: string;
  version?: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  idempotencyKey?: string;
}

// ── Pagination ──────────────────────────────────────────────────

export interface PageResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Page<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ── API Error body ──────────────────────────────────────────────

export interface ApiErrorBody {
  error: {
    type: string;
    message: string;
    request_id: string;
    [key: string]: unknown;
  };
}

// ── Agents ──────────────────────────────────────────────────────

export interface Agent {
  id: string;
  orgId: string;
  name: string;
  type: 'ai' | 'human' | 'resource';
  description: string | null;
  status: 'active' | 'paused' | 'decommissioned';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  /** Live calendars owned by the agent; only with `list({ include_counts: true })`. */
  calendar_count?: number;
  /** Live Agent keys for the agent; only with `list({ include_counts: true })`. */
  scoped_key_count?: number;
}

export interface CreateAgentParams {
  name: string;
  type: 'ai' | 'human' | 'resource';
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentParams {
  name?: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  status?: 'active' | 'paused';
}

export interface ListAgentsParams {
  type?: 'ai' | 'human' | 'resource';
  /** Setting a status (including `decommissioned`) returns agents in that status only. */
  status?: 'active' | 'paused' | 'decommissioned';
  /** Case-insensitive substring of the agent name, or an exact agent id. */
  q?: string;
  /** `created_at` (default): newest first. `name`: A to Z. */
  sort?: 'created_at' | 'name';
  /** Decommissioned (deleted) agents are left out unless this is true. */
  include_decommissioned?: boolean;
  /** Add `calendar_count` and `scoped_key_count` to each agent. */
  include_counts?: boolean;
  limit?: number;
  offset?: number;
}

// ── Calendars ───────────────────────────────────────────────────

export interface Calendar {
  id: string;
  orgId: string;
  agentId: string | null;
  name: string;
  timezone: string;
  metadata: Record<string, unknown>;
  /** Live agent status surfaced on the calendar (snake_case wire key). */
  agent_status: AgentStatus;
  ical_url: string;
  externalId: string | null;
  provider: string | null;
  /** Default reminder offsets (minutes before start) inherited by events that don't set their own. null = system default (10 min); [] = no reminders. */
  default_reminders: number[] | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalendarParams {
  name: string;
  timezone: string;
  agent_status?: 'idle' | 'working' | 'waiting' | 'error';
  /** Default reminder offsets (minutes before start) for events on this calendar. null/omit = system default (10 min); [] = no reminders. */
  default_reminders?: number[] | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateCalendarParams {
  name?: string;
  timezone?: string;
  agent_status?: 'idle' | 'working' | 'waiting' | 'error';
  default_reminders?: number[] | null;
  metadata?: Record<string, unknown>;
}

export interface ListCalendarsParams {
  agentId?: string;
  include?: 'all';
  /** Case-insensitive substring of the calendar name, or an exact calendar id. Org-wide list only (not with `agentId`). */
  q?: string;
  limit?: number;
  offset?: number;
}

// ── Booking pages ───────────────────────────────────────────────

export interface BookingPage {
  id: string;
  org_id: string;
  calendar_id: string;
  agent_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  window_days: number;
  min_notice_minutes: number;
  timezone: string;
  /** Weekly working hours; null = any time inside the window (calendar events still block). */
  availability_constraints: WorkingHours | null;
  active: boolean;
  bookings_count: number;
  /** Public hosted URL to share with humans. */
  booking_url: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBookingPageParams {
  calendar_id: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  buffer_minutes?: number;
  window_days?: number;
  min_notice_minutes?: number;
  timezone?: string;
  availability_constraints?: WorkingHours | null;
  active?: boolean;
}

export interface UpdateBookingPageParams {
  title?: string;
  description?: string | null;
  duration_minutes?: number;
  buffer_minutes?: number;
  window_days?: number;
  min_notice_minutes?: number;
  timezone?: string;
  availability_constraints?: WorkingHours | null;
  active?: boolean;
}

export interface ListBookingPagesParams {
  limit?: number;
  offset?: number;
  /** Only pages bound to this calendar. */
  calendar_id?: string;
}

/** A booking made through a booking page: the event it created plus the invitee's details. */
export interface Booking {
  /** The event the booking created (`evt_…`). */
  id: string;
  booking_page_id: string;
  calendar_id: string;
  start_time: string;
  end_time: string;
  /** The event status, e.g. `confirmed`, or `cancelled` once cancelled. */
  status: string;
  invitee_name: string | null;
  invitee_email: string | null;
  invitee_notes: string | null;
  /** When the booking was made. */
  created_at: string;
}

export interface ListBookingsParams {
  /** Page size (1–100). Defaults to 50. */
  limit?: number;
  /** The `next_cursor` from the previous page. */
  cursor?: string;
}

export interface BookingList {
  data: Booking[];
  /** Pass as `cursor` for the next page; null on the last page. */
  next_cursor: string | null;
}

/** A single bookable slot returned by the public slots endpoint. */
export interface BookingSlot {
  start: string;
  end: string;
}

export interface BookingSlotsResponse {
  booking_page: {
    slug: string;
    title: string;
    description: string | null;
    duration_minutes: number;
    timezone: string;
  };
  slots: BookingSlot[];
}

export interface SubmitBookingParams {
  name: string;
  email: string;
  notes?: string;
  start: string;
}

/** Minimal event confirmation returned by the public booking endpoint. The
 *  full event (with tenant identifiers) is available to the owning agent via
 *  the authenticated events API and the `event.created` webhook. */
export interface BookingSubmissionEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
}

export interface BookingSubmissionResult {
  booking_page_id: string;
  event: BookingSubmissionEvent;
}

// ── Events ──────────────────────────────────────────────────────

export type EventStatus = 'confirmed' | 'tentative' | 'cancelled' | 'hold';

export interface CalendarEvent {
  id: string;
  calendarId: string;
  orgId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  status: EventStatus;
  source: 'internal' | 'external_ical';
  metadata: Record<string, unknown>;
  /** Reminder offsets (minutes before start). null = inherit calendar default (then system default of 10 min); [] = no reminders. */
  reminders: number[] | null;
  /** RFC 5545 RRULE subset (no "RRULE:" prefix) when this event is a recurring series master, e.g. "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=12". null = one-off event. */
  recurrenceRule: string | null;
  /** ISO 8601 starts of individually cancelled occurrences (EXDATE). */
  recurrenceExdates: string[];
  /** Present only on expanded instances (`expand: true` lists): id of the recurring series master this instance belongs to. */
  recurringEventId?: string;
  /** Present only on expanded instances: the occurrence start this instance was generated for. */
  originalStartTime?: string;
  holdExpiresAt: string | null;
  /** Hold conflict priority (0-100). Never null: 0 unless set on a hold. */
  holdPriority: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventParams {
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  all_day?: boolean;
  status?: EventStatus;
  metadata?: Record<string, unknown>;
  /** Reminder offsets in minutes before start (e.g. [10, 1440]). Each fires an event.reminder webhook + VALARM. null/omit = inherit calendar default (then 10 min); [] = no reminders. Max 5, each 1–40320. */
  reminders?: number[] | null;
  /** ISO 8601 timestamp. Required when status='hold'. Must be 30s-15min in the future. */
  hold_expires_at?: string;
  /** Priority for conflict resolution. Only valid with status='hold'. 0-100. */
  hold_priority?: number;
  /**
   * RFC 5545 RRULE subset (no "RRULE:" prefix), e.g. "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=12" —
   * makes the event a recurring series master. Not allowed with status='hold'.
   * Fails with 400 on an invalid rule; 429 when the plan's active
   * recurring-series cap is reached (free: 1, Pro: 250 — see
   * `usage.recurring_events`); 403 plan_required when the series is unbounded
   * or ends more than 90 days out on the free plan (Pro allows unbounded).
   */
  recurrence_rule?: string;
}

export interface UpdateEventParams {
  title?: string;
  description?: string | null;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  /** Holds cannot be updated via PATCH — use /confirm or /release instead. */
  status?: 'confirmed' | 'tentative' | 'cancelled';
  metadata?: Record<string, unknown>;
  /** Reminder offsets in minutes before start. null = inherit calendar default; [] = no reminders. */
  reminders?: number[] | null;
  /**
   * Full-series edit of the recurrence rule (RFC 5545 RRULE subset, no
   * "RRULE:" prefix). null clears the rule, turning the series back into a
   * one-off event. Fails with 400 on an invalid rule; 429 when converting a
   * one-off to recurring and the plan's active recurring-series cap is
   * reached (free: 1, Pro: 250); 403 plan_required when the series is
   * unbounded or ends more than 90 days out on the free plan (Pro allows
   * unbounded).
   */
  recurrence_rule?: string | null;
}

export interface ListEventsParams {
  calendarId?: string;
  agentId?: string;
  start_after?: string;
  start_before?: string;
  status?: EventStatus;
  source?: 'internal' | 'external_ical';
  limit?: number;
  offset?: number;
  /**
   * Expand recurring series into individual occurrence instances within the
   * window. When true, both `start_after` and `start_before` are required
   * (max 366 days apart) — the API returns 400 otherwise. Expanded instances
   * carry `recurringEventId` + `originalStartTime`.
   */
  expand?: boolean;
}

/** Filters for `events.listAll()` — events across the organization's calendars (`GET /v1/events`). */
export interface ListOrgEventsParams {
  /** Only these calendars (at most 50). Sent as repeated `calendar_id` parameters. */
  calendar_id?: string | string[];
  /** Only this agent's calendars. */
  agent_id?: string;
  start_after?: string;
  start_before?: string;
  status?: EventStatus;
  source?: 'internal' | 'external_ical';
  /**
   * Case-insensitive title search. Requires both `start_after` and
   * `start_before`, at most 31 days apart; a window with more than 2,000
   * events returns 400.
   */
  q?: string;
  /** Expand recurring series within the window (both bounds required, max 366 days). */
  expand?: boolean;
  /** Page size, at most 100. */
  limit?: number;
  offset?: number;
}

/** Options for event delete calls — `RequestOptions` plus recurrence controls. */
export interface DeleteEventOptions extends RequestOptions {
  /**
   * For recurring series only: ISO 8601 start of the single occurrence to
   * cancel (recorded as an EXDATE). The series lives on and the delete call
   * resolves to the updated series master event instead of void. Fails with
   * 400 if the timestamp is not an active occurrence of the series, or 409
   * if the event is not a recurring series. Omit to delete the whole
   * event/series (resolves to void).
   */
  occurrence_start?: string;
}

// ── Availability ────────────────────────────────────────────────

export type SlotDuration = '15m' | '30m' | '45m' | '1h' | '2h';

export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface BusyBlock {
  start: string;
  end: string;
  calendar_id?: string;
  event_id?: string;
}

export interface AvailabilityParams {
  start: string;
  end: string;
  /** Requested slot length. Preferred over `slot_duration`. */
  duration?: SlotDuration;
  /** @deprecated Use `duration` instead. */
  slot_duration?: SlotDuration;
  include_busy?: boolean;
  /** Return slots from usable stale human-calendar cache. Defaults false (fail closed). */
  allow_stale?: boolean;
}

export interface CrossAgentAvailabilityParams {
  agents: string[];
  start: string;
  end: string;
  /** Requested slot length. Preferred over `slot_duration`. */
  duration?: SlotDuration;
  /** @deprecated Use `duration` instead. */
  slot_duration?: SlotDuration;
  calendars?: string[];
  include_busy?: boolean;
  /** Return slots from usable stale human-calendar cache. Defaults false (fail closed). */
  allow_stale?: boolean;
}

export type AvailabilityState = 'complete' | 'stale' | 'partial' | 'unavailable';
export type AvailabilitySourceState = 'current' | 'stale' | 'partial' | 'unavailable';

export interface AvailabilitySources {
  chronary: 'current';
  external: AvailabilitySourceState;
  last_synced_at?: string | null;
}

export interface AvailabilityWarning {
  code: 'availability_incomplete';
  message: string;
}

interface AvailabilityHealth {
  availability_state: AvailabilityState;
  sources: AvailabilitySources;
  warnings: AvailabilityWarning[];
}

export interface AvailabilityResponse extends AvailabilityHealth {
  agents: string[];
  slots: AvailabilitySlot[];
  per_agent_busy?: Record<string, BusyBlock[]>;
}

export interface CalendarAvailabilityResponse extends AvailabilityHealth {
  calendar_id: string;
  slots: AvailabilitySlot[];
  busy?: AvailabilitySlot[];
}

// ── Calendar context ────────────────────────────────────────────

export type AgentStatus = 'idle' | 'working' | 'waiting' | 'error';

export interface CalendarContext {
  calendar_id: string;
  now: string;
  agent_status: AgentStatus;
  current_event: CalendarEvent | null;
  next_event: CalendarEvent | null;
  recent_events: CalendarEvent[];
  upcoming: CalendarEvent[];
}

// ── Availability rules ──────────────────────────────────────────

export interface WorkingHoursDay {
  start: string;
  end: string;
}

export interface WorkingHours {
  mon?: WorkingHoursDay;
  tue?: WorkingHoursDay;
  wed?: WorkingHoursDay;
  thu?: WorkingHoursDay;
  fri?: WorkingHoursDay;
  sat?: WorkingHoursDay;
  sun?: WorkingHoursDay;
}

export interface AvailabilityRules {
  id: string;
  calendar_id: string;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  working_hours: WorkingHours | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface SetAvailabilityRulesParams {
  buffer_before_minutes?: number;
  buffer_after_minutes?: number;
  working_hours?: WorkingHours | null;
  timezone?: string;
}

// ── Webhooks ────────────────────────────────────────────────────

export interface Webhook {
  id: string;
  orgId: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  consecutiveFailures: number;
  firstFailureAt: string | null;
  /** Set while a scheduled account deletion has paused this endpoint (`active` is then false). */
  deletionPausedAt?: string | null;
  /** When the endpoint last went inactive; null while it is active. Cleared on re-enable. */
  deactivatedAt?: string | null;
  /** Why the endpoint is inactive; null while it is active. */
  deactivatedReason?: WebhookDeactivatedReason | null;
  /**
   * While a secret rotation's grace window is open, when the replaced secret
   * stops working; deliveries until then also carry `X-Signature-Previous`.
   * Null when no window is open.
   */
  previousSecretExpiresAt?: string | null;
  createdAt: string;
}

/** Why a webhook endpoint is inactive. */
export type WebhookDeactivatedReason =
  | 'manual'
  | 'circuit_breaker'
  | 'unsafe_destination_url'
  | 'account_deletion';

export interface SendTestWebhookParams {
  /** Event type whose sample payload to send. The endpoint must subscribe to it. */
  event_type: string;
}

/** When the replaced secret stops working after `webhooks.rotateSecret`; `now` keeps none. */
export type WebhookSecretExpiry = 'now' | '1h' | '24h' | '7d';

export interface RotateWebhookSecretParams {
  /** When the old secret stops signing `X-Signature-Previous`. Default `24h`, at most `7d`. */
  expire_old_in?: WebhookSecretExpiry;
}

/** Returned by `webhooks.rotateSecret`: the new secret, shown once. */
export interface RotatedWebhookSecret {
  webhook_id: string;
  secret: string;
  /** When the replaced secret stops working; null when `expire_old_in` was `now`. */
  previous_secret_expires_at: string | null;
}

/** Returned by `webhooks.sendTest`: the queued test delivery. */
export interface WebhookTestSent {
  delivery_id: string;
  webhook_id: string;
  event_type: string;
  status: 'pending';
  is_test: true;
}

/** Returned by `webhooks.replayDelivery`: the new delivery the replay queued. */
export interface WebhookReplaySent {
  /** The new delivery; poll `getDelivery` with it. */
  delivery_id: string;
  webhook_id: string;
  event_type: string;
  status: 'pending';
  /** The first delivery of the chain, sent as `X-Chronary-Replay-Of`. */
  replay_of_delivery_id: string;
}

export interface CreateWebhookParams {
  url: string;
  events: string[];
}

export interface UpdateWebhookParams {
  url?: string;
  events?: string[];
  active?: boolean;
}

export interface ListWebhooksParams {
  limit?: number;
  offset?: number;
}

/**
 * A delivery's state. `dropped` is a delivery the Free plan monthly limit
 * stopped: never sent, counted or retried, with `last_error_code: 'quota_exceeded'`.
 */
export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'dropped';

export interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event_type: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  created_at: string;
  /** HTTP status of the most recent attempt; null when no response was received. */
  last_response_status: number | null;
  /** Why the most recent attempt failed; null on success or before the first attempt. */
  last_error_code: WebhookDeliveryErrorCode | null;
  /** Time to response headers of the most recent attempt, in milliseconds. */
  last_duration_ms: number | null;
  /** True for a test event sent with `webhooks.sendTest`. */
  is_test: boolean;
  /**
   * Set on a replay sent with `webhooks.replayDelivery`: the first delivery of
   * the chain (the original, even when a replay is replayed). Null otherwise.
   */
  replay_of_delivery_id: string | null;
  payload?: Record<string, unknown>;
}

/** Why one delivery attempt failed. */
export type WebhookAttemptErrorCode =
  | 'timeout'
  | 'connection_error'
  | 'tls_error'
  | 'redirect_not_followed'
  | 'unsafe_destination_url'
  | 'non_2xx';

/** Codes a delivery's `last_error_code` can hold. */
export type WebhookDeliveryErrorCode =
  | WebhookAttemptErrorCode
  | 'endpoint_disabled'
  | 'quota_exceeded';

/** One HTTP attempt of a webhook delivery. */
export interface WebhookDeliveryAttempt {
  id: string;
  /** 1-based. */
  attempt_number: number;
  started_at: string;
  /** Null when no request was made. */
  duration_ms: number | null;
  /** Null when no response was received. */
  response_status: number | null;
  /** Up to the first 2 KB of the response body; null when empty or redacted. */
  response_body: string | null;
  /** Null on success. */
  error_code: WebhookAttemptErrorCode | null;
}

/** One webhook delivery with its payload and attempt timeline. */
export interface WebhookDeliveryDetail extends Omit<WebhookDelivery, 'payload'> {
  /** Attempts allowed by the organization's current plan. */
  max_attempts: number;
  payload: unknown;
  /** True when the payload was redacted under the retention policy. */
  payload_redacted: boolean;
  /** Stable request headers; signature headers change per attempt and are not stored. */
  request_headers: {
    'content-type': 'application/json';
    'x-delivery-id': string;
    'x-chronary-event-type': string;
    /** Only on a replay: the delivery in `replay_of_delivery_id`. */
    'x-chronary-replay-of'?: string;
  };
  /** Every attempt, oldest first. */
  attempt_log: WebhookDeliveryAttempt[];
}

export interface WebhookDeliveryStats {
  pending: number;
  delivered: number;
  failed: number;
  /** Deliveries the Free plan monthly limit stopped. */
  dropped: number;
}

export interface WebhookDeliveryListResponse {
  data: WebhookDelivery[];
  /** Deliveries matching the filters, ignoring the cursor and offset. */
  total: number;
  limit: number;
  offset: number;
  /** Pass as `cursor` for the next page; null on the last page. */
  next_cursor: string | null;
  has_more: boolean;
  /** All-time counts per status. */
  stats: WebhookDeliveryStats;
}

export interface ListWebhookDeliveriesParams {
  limit?: number;
  /** Cannot be combined with `cursor`. */
  offset?: number;
  status?: WebhookDeliveryStatus;
  include_payload?: boolean;
  /** An exact event type (`event.created`), or a prefix ending in a dot (`event.`). */
  event_type?: string;
  /** ISO 8601 (UTC); inclusive. */
  created_after?: string;
  /** ISO 8601 (UTC); exclusive. */
  created_before?: string;
  delivery_id?: string;
  /** `true` for test events only, `false` to leave them out. */
  is_test?: boolean;
  /** The `next_cursor` from the previous page. */
  cursor?: string;
}

// ── iCal Subscriptions ──────────────────────────────────────────

export interface ICalSubscription {
  id: string;
  agent_id: string;
  calendar_id: string;
  url: string;
  label: string | null;
  status: 'active' | 'error' | 'paused';
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface CreateICalSubscriptionParams {
  calendar_id: string;
  url: string;
  label?: string;
}

export interface UpdateICalSubscriptionParams {
  label?: string;
  url?: string;
}

export interface ListICalSubscriptionsParams {
  agentId?: string;
  status?: 'active' | 'error' | 'paused';
  limit?: number;
  offset?: number;
}

// ── Scheduling Proposals ────────────────────────────────────────

/**
 * `resolving` is the brief state while a resolve creates the event; it returns
 * to `pending` if the resolve fails. `confirmed`, `expired` and `cancelled`
 * are terminal.
 */
export type ProposalStatus = 'pending' | 'resolving' | 'confirmed' | 'expired' | 'cancelled';

export interface ProposalSlot {
  id?: string;
  start_time: string;
  end_time: string;
  weight?: number;
  calendar_id?: string | null;
}

export type ProposalResponseAction = 'accept' | 'decline' | 'counter';

export interface ProposalResponse {
  id: string;
  agent_id: string;
  response: ProposalResponseAction;
  selected_slot_id: string | null;
  counter_slots: ProposalSlot[] | null;
  message: string | null;
  created_at: string;
}

export interface ProposalSummary {
  id: string;
  title: string;
  description: string | null;
  organizer_agent_id: string;
  participant_agent_ids: string[];
  calendar_id: string;
  status: ProposalStatus;
  expires_at: string | null;
  resolved_slot: ProposalSlot | null;
  created_event_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Proposal extends ProposalSummary {
  slots: ProposalSlot[];
  responses: ProposalResponse[];
}

export interface CreateProposalParams {
  title: string;
  description?: string;
  organizer_agent_id: string;
  participant_agent_ids: string[];
  calendar_id: string;
  slots: ProposalSlot[];
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

export interface RespondToProposalParams {
  agent_id: string;
  response: ProposalResponseAction;
  selected_slot_id?: string;
  counter_slots?: ProposalSlot[];
  message?: string;
}

export interface ListProposalsParams {
  status?: ProposalStatus;
  organizer_agent_id?: string;
  limit?: number;
  offset?: number;
}

export type ResolveProposalResponse =
  | { status: 'confirmed'; resolved_slot: ProposalSlot }
  | { status: 'cancelled'; reason: string };

export interface CancelProposalResponse {
  status: 'cancelled';
}

// ── Usage ───────────────────────────────────────────────────────

/** Which surface created an API key. `unknown` for keys created before this was recorded. */
export type KeyCreatedVia = 'signup' | 'console' | 'api' | 'mcp' | 'unknown';

export interface ScopedApiKey {
  id: string;
  key_prefix: string;
  agent_id: string;
  label: string | null;
  created_at: string;
  /** When the key last authenticated a request. Approximate; updated at most every 5 minutes. `null` if never used. */
  last_used_at: string | null;
  /** The `User-Agent` of the request recorded in `last_used_at` (first 256 characters). */
  last_used_user_agent: string | null;
  created_via: KeyCreatedVia;
  /** Prefix of the Organization key that created this key. Set for `api` and `mcp`, otherwise `null`. */
  created_by_key_prefix: string | null;
  /** Free-text note about the key, set in the console. */
  note: string | null;
  /** When the key stops working; after it, requests fail with 401 `key_expired`. `null` = never expires. */
  expires_at: string | null;
}

export interface CreatedScopedApiKey extends ScopedApiKey {
  key: string;
}

/** How long a new key works (#593). Omit for a key that never expires. */
export type KeyExpiresIn = '30d' | '60d' | '90d' | '180d' | '365d';

export interface CreateScopedApiKeyParams {
  agent_id: string;
  label?: string;
  /** When the key stops working, from now. Omit for a key that never expires. */
  expires_in?: KeyExpiresIn;
}

export interface AcceptTermsParams {
  /** The terms-of-service version to accept; must equal the current version. */
  tos_version: string;
}

export interface AcceptTermsResult {
  accepted_terms_version: string;
  accepted_terms_at: string;
}

export interface UsageMetric {
  used: number;
  limit: number | null;
}

/**
 * Temporal-hold lifecycle counters for the current period. Informational —
 * not gated by any plan limit. `created`, `confirmed` and `expired` are
 * monthly counters; `expired` covers all three end-of-hold paths: TTL expiry,
 * manual release, and priority-bump. `active` is a live count of unexpired
 * holds, not a monthly counter.
 */
export interface HoldsUsage {
  created: number;
  confirmed: number;
  expired: number;
  /** Live count of unexpired holds right now (not a monthly counter). */
  active: number;
}

/**
 * Availability requests that touched more than one calendar in the current
 * period. Informational — gated separately by the
 * `cross_calendar_availability` capability, not by this counter.
 */
export interface CrossCalendarQueriesUsage {
  used: number;
}

export interface Usage {
  period_start: string;
  period_end: string;
  /** First instant of the next UTC month, when monthly counters reset (ISO 8601). */
  resets_at: string;
  /** When this response was computed (ISO 8601). API calls can lag by up to 30 seconds. */
  generated_at: string;
  plan: string;
  agents: UsageMetric;
  calendars: UsageMetric;
  events: UsageMetric;
  api_calls: UsageMetric;
  webhooks: UsageMetric;
  availability_queries: UsageMetric;
  ical_subscriptions: UsageMetric;
  proposals: UsageMetric;
  /** Active recurring series masters vs. the plan cap (free: 1, Pro: 250; null = unlimited). */
  recurring_events: UsageMetric;
  /** Active booking pages vs. the plan cap (free: 1, Pro: 25; null = unlimited). */
  booking_pages: UsageMetric;
  holds: HoldsUsage;
  cross_calendar_queries: CrossCalendarQueriesUsage;
}

// ── Usage history (#1211) ──────────────────────────────────────

export interface UsageHistoryParams {
  /** Number of UTC calendar months to return, 1-12 (default 6). */
  months?: number;
}

export interface UsageHistoryMonth {
  /** UTC calendar month, `YYYY-MM`. */
  period: string;
  period_start: string;
  period_end: string;
  /** True only for the current, partial month (the last entry). */
  is_current: boolean;
  metrics: {
    api_calls: number;
    events: number;
    webhook_deliveries: number;
    availability_queries: number;
    proposals: number;
    holds_created: number;
    holds_confirmed: number;
    holds_expired: number;
    cross_calendar_queries: number;
  };
}

export interface UsageHistory {
  plan: string;
  months: number;
  /** The current plan's limits (history does not record past plans); `null` = unlimited. */
  limits: {
    api_calls: number | null;
    events: number | null;
    webhook_deliveries: number | null;
    availability_queries: number | null;
    proposals: number | null;
  };
  /** Oldest month first; the last entry is the current month. */
  data: UsageHistoryMonth[];
}

// ── Audit log (#509) ───────────────────────────────────────────

export type AuditActorType = 'session' | 'org_key' | 'agent_key' | 'system';

export type AuditStatusClass = '2xx' | '3xx' | '4xx' | '5xx';

export type AuditCategory =
  | 'account'
  | 'keys'
  | 'agents'
  | 'calendars'
  | 'events'
  | 'scheduling'
  | 'webhooks'
  | 'human_calendars'
  | 'billing'
  | 'security';

export interface AuditLogEntry {
  id: string;
  action: string;
  /** First 20 chars of the actor API key. Never the full key; null for console sessions. */
  actor_key_prefix: string | null;
  /**
   * Who acted: a console `session`, the Organization key (`org_key`), an
   * Agent key (`agent_key`), or Chronary itself (`system`). Null on older
   * entries that could not be attributed.
   */
  actor_type: AuditActorType | null;
  /** API key id for a key, the organization id for a console session, null for the system. */
  actor_id: string | null;
  /** Display name: key label (or key prefix), session email, or "Chronary". */
  actor_label: string | null;
  /** Scoped-key agent ID when the actor used a chr_ak_* key. */
  agent_id: string | null;
  /** Entity IDs extracted from the request path (e.g. "agt_1/cal_2"). */
  resource: string | null;
  ip: string | null;
  status: number;
  method: string;
  /** Route template with entity IDs replaced by :id placeholders. */
  path: string;
  duration_ms: number;
  request_id: string | null;
  created_at: string;
}

export interface ListAuditLogParams {
  /** Lower bound (inclusive, ISO-8601). Clamped to the retention window. */
  from?: string;
  /** Upper bound (inclusive, ISO-8601). Defaults to now. */
  to?: string;
  /**
   * Filter by exact action name, e.g. "agent.create". Legacy names
   * (key.create, key.delete, key.regenerate) are matched by their current names.
   */
  action?: string;
  /** Filter by the first 20 chars of the actor API key. */
  actor_key_prefix?: string;
  /** Filter by who acted. */
  actor_type?: AuditActorType;
  /** Filter by actor id (an API key id, or the organization id for console sessions). */
  actor_id?: string;
  /** Filter by the request id of the original call. */
  request_id?: string;
  /** Filter by an entity id the request touched, or a bare id prefix such as "cal_". */
  resource?: string;
  /** Filter by response status class. */
  status_class?: AuditStatusClass;
  /** Filter by action category (legacy action names included). */
  category?: AuditCategory;
  /** Opaque cursor from a previous response for keyset pagination. */
  cursor?: string;
  /** Page size (1–200). Defaults to 50. */
  limit?: number;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  pagination: {
    /** Opaque cursor for the next page. Null if no more results. */
    next_cursor: string | null;
  };
  /**
   * Audit-log retention window for the caller's plan (days).
   * Null = no fixed window (Custom plan: per contract).
   */
  retention_days: number | null;
  /**
   * True when the requested `from` was outside the retention window and
   * was clamped. Display an upgrade hint when this is true.
   */
  range_clamped: boolean;
}

// ── Plans (public catalog) ──────────────────────────────────────

export type PlanId = 'free' | 'developer' | 'pro' | 'custom';

export interface PlanLimits {
  agents: number | null;
  calendars: number | null;
  events: number | null;
  api_calls: number | null;
  webhook_deliveries: number | null;
  availability_queries: number | null;
  ical_subscriptions: number | null;
  proposals: number | null;
  /** Max active webhook subscription endpoints per org. */
  webhook_endpoints: number | null;
  /** Max live agent-scoped API keys (`chr_ak_*`) per org. */
  scoped_keys: number | null;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Recurring monthly amount in the smallest currency unit (USD cents). `null` for custom-priced tiers. */
  price: number | null;
  /** Lowercase ISO-4217 code. `null` for custom-priced tiers. */
  currency: string | null;
  /** Yearly amount in the smallest currency unit (10x monthly) when the plan can be billed annually. `null` for Free and custom-priced tiers. */
  annual_price?: number | null;
  /** Enforced caps. `null` for custom-priced tiers. */
  limits: PlanLimits | null;
  /** Marketing copy — not machine-readable. Use `limits` for capability checks. */
  display_features: string[];
  /** Hint for UIs to highlight one tier (currently `pro`). */
  recommended: boolean;
  /** Present and `true` for the enterprise tier. */
  custom_pricing?: boolean;
  /** Sales contact URL for custom-priced tiers. */
  contact_url?: string;
}

export interface PlansListResponse {
  plans: Plan[];
}

// ── Agent signup / verify ───────────────────────────────────────

export interface AgentSignUpParams {
  /** Email address to send the verification code to. */
  email: string;
  /** Display name of the signing-up agent (1–100 chars). */
  agent_name: string;
  /** Exact ToS version string the caller has accepted. */
  tos_version: string;
}

/**
 * Response when a new org was created. Includes credentials for the
 * restricted "unverified" stage — use `api_key` to construct a second
 * `Chronary` client and call `agentAuth.verify({ otp })`.
 */
export interface AgentSignUpNewOrgResponse {
  org_id: string;
  agent_id: string;
  /** API key. Limited to the verify endpoint until OTP succeeds. */
  api_key: string;
  /** Opaque confirmation — always `"Verification code sent to email"`. */
  message: string;
}

/**
 * Response when the email matched an existing org. To prevent enumeration,
 * only a generic confirmation message is returned; no credentials.
 */
export interface AgentSignUpExistingOrgResponse {
  message: string;
}

/**
 * HTTP 202 while sign-ups are paused (waitlist mode or early access full). No
 * key is issued, and the body is the same for every address: new, already
 * waitlisted, or with an existing account.
 */
export interface AgentSignUpWaitlistedResponse {
  waitlisted: true;
  message: string;
}

export type AgentSignUpResponse =
  | AgentSignUpNewOrgResponse
  | AgentSignUpExistingOrgResponse
  | AgentSignUpWaitlistedResponse;

export interface AgentVerifyParams {
  /** Six-digit numeric code from the verification email. */
  otp: string;
}

export interface AgentVerifyResponse {
  verified: true;
  /**
   * `promoted`: the org left the Sandbox tier. `capacity_full`: the email is
   * verified, but early access is full, so the org keeps Sandbox limits until
   * a spot opens (an `org.plan_changed` webhook announces the move).
   * `null`: the org was not on Sandbox.
   */
  sandbox_promotion: 'promoted' | 'capacity_full' | null;
  /** Human-readable confirmation; explains the Sandbox hold when `capacity_full`. */
  message: string;
}

// ── Waitlist (#442) ─────────────────────────────────────────────

export interface WaitlistJoinParams {
  /** Email address to join the waitlist with. */
  email: string;
  /** Optional display name. Derived from the email's local-part if omitted. */
  name?: string;
  /** Optional ToS version string the caller has accepted. */
  tos_version?: string;
  /** Optional "what are you building?" note, up to 200 characters. */
  intent?: string;
}

/**
 * @deprecated The waitlist join no longer returns the entry; see
 * {@link WaitlistJoinResponse}. Kept so existing imports still compile.
 */
export interface WaitlistedOrg {
  id: string;
  name: string;
  email: string;
  is_waitlisted: true;
  waitlisted_at: string;
  signup_source: string;
}

/**
 * `POST /v1/waitlist` → HTTP 202. The same body for a new email, one already on
 * the list and one with an active account; no entry fields are returned.
 */
export interface WaitlistJoinResponse {
  waitlisted: true;
  message: string;
}

// ── Feedback ────────────────────────────────────────────────────

export type FeedbackType = 'bug' | 'feature' | 'friction' | 'support';

export interface SubmitFeedbackParams {
  type: FeedbackType;
  /** Free-text description, 10–2000 characters. */
  message: string;
  /** Optional JSON metadata (SDK version, endpoint, error context, etc.). */
  context?: Record<string, unknown>;
}

export interface FeedbackAcceptedResponse {
  status: 'accepted';
}

// ── Webhook event types ─────────────────────────────────────────

export type WebhookEventType =
  | 'agent.created'
  | 'agent.updated'
  | 'event.created'
  | 'event.updated'
  | 'event.deleted'
  | 'event.started'
  | 'event.ended'
  | 'event.reminder'
  | 'event.hold_created'
  | 'event.hold_expired'
  | 'event.hold_released'
  | 'event.hold_confirmed'
  | 'proposal.created'
  | 'proposal.responded'
  | 'proposal.confirmed'
  | 'proposal.expired'
  | 'proposal.cancelled'
  | 'webhook.deactivated'
  | 'org.plan_changed'
  | 'calendar_connection.reauthorization_required'
  | 'usage.threshold_crossed';

export interface WebhookEvent {
  type: WebhookEventType;
  data: Record<string, unknown>;
}

export interface VerifyOptions {
  tolerance?: number;
}

// ── Data export (#17) ──────────────────────────────────────────

/**
 * Response shape for `GET /v1/auth/export` (GDPR Art. 15 + 20 portability).
 * Encrypted data fields (event titles/descriptions, Connection labels,
 * external calendar names) are returned in plaintext. Secrets (webhook
 * secrets, iCal URLs and feed tokens, Human calendar provider identifiers)
 * are `'[redacted]'` unless `include_secrets=true` is passed from a session
 * that signed in within the last 5 minutes. Sensitive fields (key hashes,
 * password hashes, OTP hashes, claim revocation tokens, internal scheduling
 * state) and Human calendar provider credentials are never exported. An
 * export over the synchronous size limit fails with 413 `export_too_large`.
 */
export interface DataExport {
  exported_at: string;
  format_version: '1';
  org: {
    id: string;
    name: string;
    email: string;
    plan: string;
    signup_source: string;
    status: string;
    oauth_provider: string | null;
    oauth_provider_id: string | null;
    email_verified: boolean;
    onboarding_completed_at: string | null;
    accepted_terms_version: string | null;
    accepted_terms_at: string | null;
    created_at: string;
    updated_at: string;
  };
  agents: unknown[];
  calendars: unknown[];
  events: unknown[];
  availability_rules: unknown[];
  ical_subscriptions: unknown[];
  webhook_subscriptions: unknown[];
  api_keys: unknown[];
  scheduling_proposals: unknown[];
  proposal_slots: unknown[];
  proposal_responses: unknown[];
  usage_records: unknown[];
  quota_counters: unknown[];
  tos_acceptances: unknown[];
  account_claims_initiated: unknown[];
  account_claims_targeting_this_org: unknown[];
  feedback_submissions: unknown[];
  upgrade_requests: unknown[];
  booking_pages: unknown[];
  audit_log: unknown[];
  provider_accounts: unknown[];
  external_calendars: unknown[];
  availability_grants: unknown[];
  publication_bindings: unknown[];
  connection_setup_links: unknown[];
  webhook_deliveries: unknown[];
}

// ── Billing ─────────────────────────────────────────────────────
// Read-only billing summary plus agent-initiated upgrade requests. Agents
// cannot pay, cancel, or change payment methods — only a human can, through
// the `approval_url` returned on an upgrade request.

export type BillingInterval = 'month' | 'year';

export type UpgradeRequestStatus = 'pending' | 'completed' | 'declined' | 'canceled' | 'expired';

export interface BillingPrice {
  /** Minor units (2900 = $29). */
  amount: number;
  currency: string;
  interval: BillingInterval;
  tax_exclusive: true;
}

export interface BillingUpgradeOption {
  plan: 'developer' | 'pro';
  interval: BillingInterval;
  amount: number;
  currency: string;
  savings_vs_monthly: number;
  /**
   * How the owner buys it: `checkout` (no live subscription yet) or
   * `switch_plan` (a live subscriber moves up from the console Billing page). Agents
   * cannot do either; they ask with `billing.upgradeRequests.create`.
   */
  via?: 'checkout' | 'switch_plan';
}

export interface UpgradeRequest {
  id: string;
  status: UpgradeRequestStatus;
  plan: 'developer' | 'pro';
  interval: BillingInterval;
  /** Agent free text. Render as escaped plain text only. */
  reason: string | null;
  feature: string | null;
  metric: string | null;
  requested_via: 'api' | 'mcp';
  /** First 20 characters of the requesting key — never the full key. */
  requested_by_key_prefix: string | null;
  /** Give this URL to your human. Null once the request is terminal. */
  approval_url: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  declined_at: string | null;
  canceled_at: string | null;
  /** Create responses only. */
  owner_notification?: 'queued' | 'not_configured' | 'skipped_internal' | 'already_notified' | 'muted';
  /** Create responses only: true when an already-pending request was returned. */
  reused?: boolean;
}

export interface BillingSummary {
  plan: string;
  plan_source: string | null;
  plan_expires_at: string | null;
  status: string | null;
  interval: BillingInterval | null;
  current_period_end: string | null;
  cancel_at: string | null;
  cancel_at_period_end: boolean;
  renews_at: string | null;
  /** A plan switch scheduled for the end of the period (Pro down to Developer): the plan it moves to. `plan` stays until then. */
  pending_plan?: string | null;
  /** Billing interval after the scheduled switch. */
  pending_plan_interval?: BillingInterval | null;
  /** When the scheduled switch takes effect. */
  pending_plan_at?: string | null;
  price: BillingPrice | null;
  has_billing_account: boolean;
  self_serve_upgrade: boolean;
  upgrade_options: BillingUpgradeOption[];
  upgrade_url: string | null;
  manage_url: string;
  contact_url: string | null;
  pending_upgrade_request: UpgradeRequest | null;
  /** Founding-member offer for early-access accounts; null otherwise. */
  offer: BillingOffer | null;
  /** While `status` is `past_due`: the failed payment. Null otherwise. */
  past_due: BillingPastDue | null;
  /** Account credit; applied automatically to the next invoices while the subscription renews. Null when there is none. */
  credit: BillingCredit | null;
}

/** Account credit, for example the unused part of a yearly period after a switch to monthly billing. */
export interface BillingCredit {
  /** Minor units (cents), always positive. */
  amount: number;
  currency: string;
}

/** The failed payment behind a `past_due` subscription. */
export interface BillingPastDue {
  /** Minor units (cents), tax included. */
  amount_due: number;
  currency: string;
  failed_at: string;
  /** Next automatic retry; null when no retries are left. */
  next_payment_attempt: string | null;
  /** Where a human can pay the open invoice. */
  hosted_invoice_url: string | null;
  attempt_count: number;
}

/**
 * Founding-member offer. `upcoming`: early-access account, the offer opens at
 * launch. `available`: free Pro until `ends_at`, subscribe before then at the
 * discount. `redeemed`: the subscription was created on founding terms.
 */
export interface BillingOffer {
  kind: 'founding';
  status: 'upcoming' | 'available' | 'redeemed';
  ends_at: string | null;
  trial_until: string | null;
  discount_percent: number | null;
  discount_months: number | null;
  /**
   * redeemed: `required` while a Washington DC trial waits for the human to
   * choose "Continue to paid Pro" in the console (else it ends at the trial
   * end, unbilled); `given` once they have. Null otherwise.
   */
  renewal_consent: 'required' | 'given' | null;
}

export interface CreateUpgradeRequestParams {
  /** Billing interval to request. Defaults to `month`. */
  interval?: BillingInterval;
  /** Why the upgrade is needed (max 500 chars). Shown to the human approver. */
  reason?: string;
  /** Plan-gated feature that was blocked, e.g. `scoped_keys`. */
  feature?: string;
  /** Quota metric that was exhausted, e.g. `api_calls`. */
  metric?: string;
}
