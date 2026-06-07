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
  status?: 'active' | 'paused' | 'decommissioned';
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
  limit?: number;
  offset?: number;
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
  holdExpiresAt: string | null;
  holdPriority: number | null;
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
  slot_duration?: SlotDuration;
  include_busy?: boolean;
}

export interface CrossAgentAvailabilityParams {
  agents: string[];
  start: string;
  end: string;
  slot_duration?: SlotDuration;
  calendars?: string[];
  include_busy?: boolean;
}

export interface AvailabilityResponse {
  agents: string[];
  slots: AvailabilitySlot[];
  per_agent_busy?: Record<string, BusyBlock[]>;
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
  createdAt: string;
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

export interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event_type: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  created_at: string;
  payload?: Record<string, unknown>;
}

export interface WebhookDeliveryStats {
  pending: number;
  delivered: number;
  failed: number;
}

export interface WebhookDeliveryListResponse {
  data: WebhookDelivery[];
  total: number;
  limit: number;
  offset: number;
  stats: WebhookDeliveryStats;
}

export interface ListWebhookDeliveriesParams {
  limit?: number;
  offset?: number;
  status?: 'pending' | 'delivered' | 'failed';
  include_payload?: boolean;
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

export type ProposalStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled';

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

export interface ScopedApiKey {
  id: string;
  key_prefix: string;
  agent_id: string;
  label: string | null;
  created_at: string;
}

export interface CreatedScopedApiKey extends ScopedApiKey {
  key: string;
}

export interface CreateScopedApiKeyParams {
  agent_id: string;
  label?: string;
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
 * not gated by any plan limit. The funnel identity
 * `created = confirmed + expired + active` holds, where `active` is derived
 * (not stored). Counts cover all three end-of-hold paths: TTL expiry,
 * manual release, and priority-bump.
 */
export interface HoldsUsage {
  created: number;
  confirmed: number;
  expired: number;
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
  plan: string;
  agents: UsageMetric;
  calendars: UsageMetric;
  events: UsageMetric;
  api_calls: UsageMetric;
  webhooks: UsageMetric;
  availability_queries: UsageMetric;
  ical_subscriptions: UsageMetric;
  proposals: UsageMetric;
  holds: HoldsUsage;
  cross_calendar_queries: CrossCalendarQueriesUsage;
}

// ── Audit log (#509) ───────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  action: string;
  /** First 20 chars of the actor API key. Never the full key. */
  actor_key_prefix: string | null;
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
  /** Filter by exact action name, e.g. "agent.create". */
  action?: string;
  /** Filter by the first 20 chars of the actor API key. */
  actor_key_prefix?: string;
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
   * Null = unlimited (Custom tier, per-contract).
   */
  retention_days: number | null;
  /**
   * True when the requested `from` was outside the retention window and
   * was clamped. Display an upgrade hint when this is true.
   */
  range_clamped: boolean;
}

// ── Plans (public catalog) ──────────────────────────────────────

export type PlanId = 'free' | 'pro' | 'custom';

export interface PlanLimits {
  agents: number | null;
  calendars: number | null;
  events: number | null;
  api_calls: number | null;
  webhook_deliveries: number | null;
  availability_queries: number | null;
  ical_subscriptions: number | null;
  proposals: number | null;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Recurring monthly amount in the smallest currency unit (USD cents). `null` for custom-priced tiers. */
  price: number | null;
  /** Lowercase ISO-4217 code. `null` for custom-priced tiers. */
  currency: string | null;
  /** Enforced caps. `null` for custom-priced tiers. */
  limits: PlanLimits | null;
  /** Marketing copy — not machine-readable. Use `limits` for capability checks. */
  display_features: string[];
  /** Hint for UIs to highlight a tier (currently `pro`). */
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

export type AgentSignUpResponse =
  | AgentSignUpNewOrgResponse
  | AgentSignUpExistingOrgResponse;

export interface AgentVerifyParams {
  /** Six-digit numeric code from the verification email. */
  otp: string;
}

export interface AgentVerifyResponse {
  verified: true;
  /** Opaque confirmation — always `"Full access unlocked"`. */
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
}

export interface WaitlistedOrg {
  id: string;
  name: string;
  email: string;
  is_waitlisted: true;
  waitlisted_at: string;
  signup_source: string;
}

export interface WaitlistJoinResponse {
  data: WaitlistedOrg;
  message: string;
}

// ── Feedback ────────────────────────────────────────────────────

export type FeedbackType = 'bug' | 'feature' | 'friction';

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
  | 'webhook.deactivated';

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
 * Encrypted fields (event titles/descriptions, iCal URLs, webhook secrets)
 * are returned in plaintext. Sensitive fields (key hashes, password hashes,
 * OTP hashes, claim revocation tokens, internal scheduling state) are omitted.
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
}
