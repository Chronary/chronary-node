/**
 * APIPromise wraps a fetch call as a thenable so callers can `await` it
 * for parsed data, or call `.withResponse()` to get both parsed data and the raw
 * Response (headers, status, etc.).
 *
 * ```ts
 * // Normal — just the data
 * const agent = await client.agents.get('agt_1');
 *
 * // With response access
 * const { data, response } = await client.agents.get('agt_1').withResponse();
 * console.log(response.status);
 * console.log(response.headers.get('x-request-id'));
 * ```
 */
/**
 * Parsed quota snapshot from the IETF `RateLimit` / `RateLimit-Policy` headers
 * (draft-ietf-httpapi-ratelimit-headers). Present on responses from endpoints
 * that enforce quotas (most authenticated routes); absent on unauthenticated
 * or unlimited-plan responses.
 */
export interface QuotaSnapshot {
  /** Configured ceiling (e.g. `1_000_000` API calls/month). Parsed from `RateLimit-Policy`. */
  limit: number;
  /** Remaining quota in the current window. Parsed from `RateLimit`. */
  remaining: number;
  /** Wall-clock time when the window resets. Computed from the `t=` delta-seconds in `RateLimit`. */
  resetAt: Date;
}

export interface RawResponse {
  status: number;
  headers: Headers;
  url: string;
  /**
   * Typed view of the IETF RateLimit headers when present. Use this instead of
   * parsing `headers.get('ratelimit')` yourself. `undefined` for responses
   * that don't emit quota headers (public endpoints, unlimited plans).
   */
  quota?: QuotaSnapshot;
}

export interface WithResponse<T> {
  data: T;
  response: RawResponse;
}

/**
 * APIPromise is a thenable that resolves to `T` when awaited, but also
 * exposes `.withResponse()` to get both the data and raw HTTP response.
 *
 * Because it implements `.then()`, it can be awaited, used with `Promise.all()`,
 * and chained with `.then()` / `.catch()` / `.finally()`.
 */
export class APIPromise<T> implements PromiseLike<T> {
  private innerPromise: Promise<{ data: T; rawResponse: RawResponse }>;

  constructor(
    responsePromise: Promise<{ data: T; rawResponse: RawResponse }>,
  ) {
    this.innerPromise = responsePromise;
  }

  /**
   * Returns both the parsed data and the raw HTTP response.
   */
  async withResponse(): Promise<WithResponse<T>> {
    const { data, rawResponse } = await this.innerPromise;
    return { data, response: rawResponse };
  }

  /**
   * Implements the thenable interface. When awaited, resolves to just the parsed data `T`.
   */
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.innerPromise.then(
      (result) => (onfulfilled ? onfulfilled(result.data) : result.data as unknown as TResult1),
      onrejected,
    );
  }

  /**
   * Attaches a rejection handler.
   */
  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult> {
    return this.then(undefined, onrejected);
  }

  /**
   * Attaches a handler that runs on both fulfillment and rejection.
   */
  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.then(
      (value) => { onfinally?.(); return value; },
      (reason) => { onfinally?.(); throw reason; },
    );
  }
}
