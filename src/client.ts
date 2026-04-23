import { VERSION } from './version';
import {
  ChronaryError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  QuotaExceededError,
  TimeoutError,
  ConnectionError,
} from './error';
import { APIPromise } from './api-promise';
import type { RawResponse } from './api-promise';
import type { ChronaryConfig, LogLevel, RequestOptions, ApiErrorBody } from './types';

const DEFAULT_BASE_URL = 'https://api.chronary.ai';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MAX_RETRY_DELAY = 60_000;

function getEnvVar(name: string): string | undefined {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[name];
    }
  } catch {
    // process.env not available (browser, CF Workers, etc.)
  }
  return undefined;
}

function resolveLogLevel(config: ChronaryConfig): LogLevel {
  if (config.logLevel) return config.logLevel;
  const envLog = getEnvVar('CHRONARY_LOG');
  if (envLog && ['debug', 'info', 'warn', 'error', 'off'].includes(envLog)) {
    return envLog as LogLevel;
  }
  return 'off';
}

const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  off: 4,
};

export class CoreClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly logLevel: LogLevel;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly userAgent: string;

  constructor(config: ChronaryConfig = {}) {
    // apiKey is optional at construction — some endpoints (agentAuth.signUp,
    // plans.list) do not require auth. When a caller invokes an authed
    // endpoint without a key, the server returns 401 and the SDK surfaces it
    // as AuthenticationError — same error shape either way.
    this.apiKey = config.apiKey ?? getEnvVar('CHRONARY_API_KEY') ?? '';

    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.logLevel = resolveLogLevel(config);
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);

    let ua = `chronary-sdk/${VERSION}`;
    if (config.appInfo) {
      ua += ` ${config.appInfo.name}`;
      if (config.appInfo.version) ua += `/${config.appInfo.version}`;
    }
    try {
      if (typeof process !== 'undefined' && process.version) {
        ua += ` node/${process.version.replace('v', '')}`;
      }
    } catch {
      // Not in Node
    }
    this.userAgent = ua;
  }

  private log(level: LogLevel, message: string) {
    if (level === 'off' || LOG_PRIORITY[level] < LOG_PRIORITY[this.logLevel]) return;
    const prefix = `[chronary:${level}]`;
    switch (level) {
      case 'debug': console.debug(prefix, message); break;
      case 'info': console.info(prefix, message); break;
      case 'warn': console.warn(prefix, message); break;
      case 'error': console.error(prefix, message); break;
    }
  }

  request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions,
  ): APIPromise<T> {
    return new APIPromise<T>(this._request<T>(method, path, body, query, options));
  }

  private async _request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions,
  ): Promise<{ data: T; rawResponse: RawResponse }> {
    const url = this.buildUrl(path, query);
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      'X-Chronary-SDK-Version': VERSION,
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (MUTATING_METHODS.has(method)) {
      headers['Idempotency-Key'] = options?.idempotencyKey ?? crypto.randomUUID();
    }

    const requestTimeout = options?.timeout ?? this.timeout;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelay(attempt, lastError);
        this.log('info', `Retry #${attempt} after ${delay}ms`);
        await sleep(delay);
      }

      const controller = new AbortController();
      const signals = [controller.signal];
      if (options?.signal) signals.push(options.signal);

      const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

      try {
        this.log('debug', `${method} ${path}`);
        const startTime = Date.now();

        const response = await this.fetchFn(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const elapsed = Date.now() - startTime;
        const requestId = response.headers.get('x-request-id') ?? undefined;

        this.log('debug', `${method} ${path} → ${response.status} in ${elapsed}ms${requestId ? ` (${requestId})` : ''}`);

        if (response.ok) {
          const rawResponse: RawResponse = {
            status: response.status,
            headers: response.headers,
            url: response.url,
          };
          if (response.status === 204) {
            return { data: undefined as T, rawResponse };
          }
          const data = await response.json() as T;
          return { data, rawResponse };
        }

        // Retryable?
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
          lastError = await this.buildError(response, requestId);
          continue;
        }

        throw await this.buildError(response, requestId);
      } catch (err) {
        clearTimeout(timeoutId);

        if (err instanceof ChronaryError) throw err;

        if (err instanceof DOMException && err.name === 'AbortError') {
          if (options?.signal?.aborted) throw new ChronaryError('Request aborted', 0);
          throw new TimeoutError(`Request timed out after ${requestTimeout}ms`);
        }

        if (attempt < this.maxRetries) {
          lastError = err as Error;
          continue;
        }

        throw new ConnectionError(`Connection failed: ${(err as Error).message}`);
      }
    }

    throw lastError ?? new ConnectionError('Request failed after retries');
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const base = `${this.baseUrl}${path}`;
    if (!query) return base;

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  private async buildError(response: Response, requestId?: string): Promise<ChronaryError> {
    let errorBody: ApiErrorBody | undefined;
    try {
      errorBody = await response.json() as ApiErrorBody;
    } catch {
      // Non-JSON response
    }

    const message = errorBody?.error?.message ?? `HTTP ${response.status}`;
    const rid = requestId ?? errorBody?.error?.request_id;
    const errorType = errorBody?.error?.type;

    switch (response.status) {
      case 401:
        return new AuthenticationError(message, rid, response.headers);
      case 402:
        return new QuotaExceededError(message, rid, response.headers);
      case 404:
        return new NotFoundError(message, rid, response.headers);
      case 422:
        return new ValidationError(message, response.status, rid, response.headers);
      case 429: {
        if (errorType === 'quota_exceeded') {
          return new QuotaExceededError(message, rid, response.headers);
        }
        return new RateLimitError(message, rid, response.headers);
      }
      default:
        return new ChronaryError(message, response.status, rid, response.headers, errorType);
    }
  }

  private retryDelay(attempt: number, lastError?: Error): number {
    // Respect Retry-After header
    if (lastError instanceof RateLimitError && lastError.retryAfter) {
      return Math.min(lastError.retryAfter * 1000, MAX_RETRY_DELAY);
    }

    // Exponential backoff with jitter: base * 2^attempt + random jitter
    const base = 500;
    const exponential = base * Math.pow(2, attempt - 1);
    const jitter = Math.random() * base;
    return Math.min(exponential + jitter, MAX_RETRY_DELAY);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
