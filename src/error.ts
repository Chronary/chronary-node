export class ChronaryError extends Error {
  readonly status: number;
  readonly requestId: string | undefined;
  readonly headers: Headers | undefined;
  readonly errorType: string | undefined;

  constructor(
    message: string,
    status: number,
    requestId?: string,
    headers?: Headers,
    errorType?: string,
  ) {
    super(message);
    this.name = 'ChronaryError';
    this.status = status;
    this.requestId = requestId;
    this.headers = headers;
    this.errorType = errorType;
  }
}

export class AuthenticationError extends ChronaryError {
  constructor(message: string, requestId?: string, headers?: Headers) {
    super(message, 401, requestId, headers, 'authentication_error');
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends ChronaryError {
  readonly retryAfter: number | undefined;

  constructor(message: string, requestId?: string, headers?: Headers) {
    super(message, 429, requestId, headers, 'rate_limit_error');
    this.name = 'RateLimitError';
    if (headers) {
      const ra = headers.get('retry-after');
      if (ra) this.retryAfter = parseInt(ra, 10);
    }
  }
}

export class NotFoundError extends ChronaryError {
  constructor(message: string, requestId?: string, headers?: Headers) {
    super(message, 404, requestId, headers, 'not_found');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ChronaryError {
  constructor(message: string, status: number, requestId?: string, headers?: Headers) {
    super(message, status, requestId, headers, 'validation_error');
    this.name = 'ValidationError';
  }
}

export class QuotaExceededError extends ChronaryError {
  constructor(message: string, requestId?: string, headers?: Headers) {
    super(message, 402, requestId, headers, 'quota_exceeded');
    this.name = 'QuotaExceededError';
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
