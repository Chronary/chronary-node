import { CoreClient } from './client';
import { AgentsClient } from './resources/agents';
import { CalendarsClient } from './resources/calendars';
import { EventsClient } from './resources/events';
import { AvailabilityClient } from './resources/availability';
import { WebhooksClient } from './resources/webhooks';
import { ICalSubscriptionsClient } from './resources/ical-subscriptions';
import { SchedulingClient } from './resources/scheduling';
import { UsageClient } from './resources/usage';
import { AuditLogClient } from './resources/audit-log';
import { KeysClient } from './resources/keys';
import { AgentAuthClient } from './resources/agent-auth';
import { WaitlistClient } from './resources/waitlist';
import { FeedbackClient } from './resources/feedback';
import { PlansClient } from './resources/plans';
import { AccountClient } from './resources/account';
import { TermsClient } from './resources/terms';
import { ConnectionLinksClient } from './resources/connection-links';
import { verifySignature, constructEvent } from './webhook-verify';
import type { ChronaryConfig } from './types';

export class Chronary {
  readonly agents: AgentsClient;
  readonly calendars: CalendarsClient;
  readonly events: EventsClient;
  readonly availability: AvailabilityClient;
  readonly webhooks: WebhooksClient;
  readonly icalSubscriptions: ICalSubscriptionsClient;
  readonly scheduling: SchedulingClient;
  readonly usage: UsageClient;
  readonly auditLog: AuditLogClient;
  readonly keys: KeysClient;
  readonly agentAuth: AgentAuthClient;
  readonly waitlist: WaitlistClient;
  readonly feedback: FeedbackClient;
  readonly plans: PlansClient;
  readonly account: AccountClient;
  readonly terms: TermsClient;
  readonly connectionLinks: ConnectionLinksClient;

  constructor(config?: ChronaryConfig) {
    const client = new CoreClient(config);
    this.agents = new AgentsClient(client);
    this.calendars = new CalendarsClient(client);
    this.events = new EventsClient(client);
    this.availability = new AvailabilityClient(client);
    this.webhooks = new WebhooksClient(client);
    this.icalSubscriptions = new ICalSubscriptionsClient(client);
    this.scheduling = new SchedulingClient(client);
    this.usage = new UsageClient(client);
    this.auditLog = new AuditLogClient(client);
    this.keys = new KeysClient(client);
    this.agentAuth = new AgentAuthClient(client);
    this.waitlist = new WaitlistClient(client);
    this.feedback = new FeedbackClient(client);
    this.plans = new PlansClient(client);
    this.account = new AccountClient(client);
    this.terms = new TermsClient(client);
    this.connectionLinks = new ConnectionLinksClient(client);
  }

  static webhooks = {
    verifySignature,
    constructEvent,
  };
}

// Re-export everything
export { CoreClient } from './client';
export { APIPromise } from './api-promise';
export type { QuotaSnapshot, RawResponse, WithResponse } from './api-promise';
export { PageIterator } from './pagination';
export { verifySignature, constructEvent } from './webhook-verify';
export { VERSION } from './version';
export { isAgentSignUpNewOrg } from './resources/agent-auth';
export { ConnectionLinksClient } from './resources/connection-links';
export type { ConnectionLink, CreateConnectionLinkParams } from './resources/connection-links';

export {
  ChronaryError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  QuotaExceededError,
  TimeoutError,
  ConnectionError,
} from './error';

export type {
  ChronaryConfig,
  LogLevel,
  AppInfo,
  RequestOptions,
  PageResponse,
  Page,
  Agent,
  CreateAgentParams,
  UpdateAgentParams,
  ListAgentsParams,
  Calendar,
  CreateCalendarParams,
  UpdateCalendarParams,
  ListCalendarsParams,
  CalendarContext,
  AgentStatus,
  AvailabilityRules,
  SetAvailabilityRulesParams,
  WorkingHours,
  WorkingHoursDay,
  CalendarEvent,
  CreateEventParams,
  UpdateEventParams,
  ListEventsParams,
  DeleteEventOptions,
  SlotDuration,
  AvailabilitySlot,
  BusyBlock,
  AvailabilityParams,
  CrossAgentAvailabilityParams,
  AvailabilityResponse,
  CalendarAvailabilityResponse,
  AvailabilityState,
  AvailabilitySourceState,
  AvailabilitySources,
  AvailabilityWarning,
  Webhook,
  CreateWebhookParams,
  UpdateWebhookParams,
  ListWebhooksParams,
  WebhookDelivery,
  WebhookDeliveryStats,
  WebhookDeliveryListResponse,
  ListWebhookDeliveriesParams,
  ICalSubscription,
  CreateICalSubscriptionParams,
  UpdateICalSubscriptionParams,
  ListICalSubscriptionsParams,
  Proposal,
  ProposalSummary,
  ProposalSlot,
  ProposalResponse,
  ProposalStatus,
  ProposalResponseAction,
  CreateProposalParams,
  RespondToProposalParams,
  ListProposalsParams,
  ResolveProposalResponse,
  CancelProposalResponse,
  Usage,
  UsageMetric,
  AuditLogEntry,
  ListAuditLogParams,
  AuditLogResponse,
  ScopedApiKey,
  CreatedScopedApiKey,
  CreateScopedApiKeyParams,
  AcceptTermsParams,
  AcceptTermsResult,
  AgentSignUpParams,
  AgentSignUpResponse,
  AgentSignUpNewOrgResponse,
  AgentSignUpExistingOrgResponse,
  AgentVerifyParams,
  AgentVerifyResponse,
  WaitlistJoinParams,
  WaitlistJoinResponse,
  WaitlistedOrg,
  FeedbackType,
  SubmitFeedbackParams,
  FeedbackAcceptedResponse,
  PlanId,
  PlanLimits,
  Plan,
  PlansListResponse,
  WebhookEventType,
  WebhookEvent,
  VerifyOptions,
  DataExport,
} from './types';

export default Chronary;
