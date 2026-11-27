function str(body: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = body?.[key];
  return typeof v === 'string' ? v : undefined;
}

function num(body: Record<string, unknown> | undefined, key: string): number | undefined {
  const v = body?.[key];
  return typeof v === 'number' ? v : undefined;
}

export class ChronaryError extends Error {
  readonly status: number;
  readonly requestId: string | undefined;
  readonly headers: Headers | undefined;
  readonly errorType: string | undefined;
  /** Raw `error` object from the response body (all server-provided fields). */
  readonly body: Record<string, unknown> | undefined;
  /** Where a human can upgrade the plan (plan_required / quota_exceeded errors). */
  readonly upgradeUrl: string | undefined;
  readonly docsUrl: string | undefined;
  readonly requiredPlan: string | undefined;
  /** Self-serve plan `upgradeUrl` leads to: the next plan up (quota_exceeded and count-cap errors). */
  readonly upgradePlan: string | undefined;
  readonly feature: string | undefined;
  readonly contactUrl: string | undefined;
  /** Quota metric that was exhausted (quota_exceeded errors). */
  readonly metric: string | undefined;
  readonly limit: number | undefined;
  /** The specific reason on some errors, e.g. `event_conflict` on a 409 from a calendar that refuses overlapping events. */
  readonly code: string | undefined;
  /** The events in the way (409 `event_conflict`, `calendar_has_overlaps`, `calendar_has_recurring_series`); empty when the body has none. */
  readonly conflictingEventIds: string[];

  constructor(
    message: string,
    status: number,
    requestId?: string,
    headers?: Headers,
    errorType?: string,
    body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ChronaryError';
    this.status = status;
    this.requestId = requestId;
    this.headers = headers;
    this.errorType = errorType;
    this.body = body;
    this.upgradeUrl = str(body, 'upgrade_url');
    this.docsUrl = str(body, 'docs_url');
    this.requiredPlan = str(body, 'required_plan');
    this.upgradePlan = str(body, 'upgrade_plan');
    this.feature = str(body, 'feature');
    this.contactUrl = str(body, 'contact_url');
    this.metric = str(body, 'metric');
    this.limit = num(body, 'limit');
    this.code = str(body, 'code');
    const ids = body?.['conflicting_event_ids'];
    this.conflictingEventIds = Array.isArray(ids) ? ids.filter((i): i is string => typeof i === 'string') : [];
  }
}

export class AuthenticationError extends ChronaryError {
  constructor(message: string, requestId?: string, headers?: Headers, body?: Record<string, unknown>) {
    super(message, 401, requestId, headers, 'authentication_error', body);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends ChronaryError {
  readonly retryAfter: number | undefined;

  constructor(message: string, requestId?: string, headers?: Headers, body?: Record<string, unknown>) {
    super(message, 429, requestId, headers, 'rate_limit_error', body);
    this.name = 'RateLimitError';
    if (headers) {
      const ra = headers.get('retry-after');
      if (ra) this.retryAfter = parseInt(ra, 10);
    }
  }
}

export class NotFoundError extends ChronaryError {
  constructor(message: string, requestId?: string, headers?: Headers, body?: Record<string, unknown>) {
    super(message, 404, requestId, headers, 'not_found', body);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ChronaryError {
  constructor(message: string, status: number, requestId?: string, headers?: Headers, body?: Record<string, unknown>) {
    super(message, status, requestId, headers, 'validation_error', body);
    this.name = 'ValidationError';
  }
}

/** Quota exhausted (HTTP 429 `quota_exceeded`, or legacy 402). Carries `metric`, `limit`, `upgradeUrl`. */
export class QuotaExceededError extends ChronaryError {
  constructor(
    message: string,
    requestId?: string,
    headers?: Headers,
    body?: Record<string, unknown>,
    status: number = 429,
  ) {
    super(message, status, requestId, headers, 'quota_exceeded', body);
    this.name = 'QuotaExceededError';
  }
}

/** The plan does not include this feature (HTTP 403 `plan_required`). Carries `requiredPlan`, `feature`, `upgradeUrl`, `docsUrl`. */
export class PlanRequiredError extends ChronaryError {
  constructor(message: string, requestId?: string, headers?: Headers, body?: Record<string, unknown>) {
    super(message, 403, requestId, headers, 'plan_required', body);
    this.name = 'PlanRequiredError';
  }
}

export class TimeoutError extends ChronaryError {
  constructor(message: string) {
    super(message, 0);
    this.name = 'TimeoutError';
  }
}

export class ConnectionError extends ChronaryError {
  constructor(message: string) {
    super(message, 0);
    this.name = 'ConnectionError';
  }
}
