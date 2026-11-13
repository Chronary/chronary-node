/**
 * APIPromise wraps a request as a `Promise` so callers can `await` it for the
 * parsed data, or call `.withResponse()` to get both the parsed data and the
 * raw response (status, headers, quota). Every single-request resource method
 * returns one.
 *
 * ```ts
 * // Normal — just the data
 * const agent = await client.agents.get('agt_1');
 *
 * // With response access
 * const { data, response } = await client.agents.get('agt_1').withResponse();
 * console.log(response.status);
 * console.log(response.headers.get('x-request-id'));
 * console.log(response.quota?.remaining);
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
 * APIPromise is a `Promise<T>` that resolves to the parsed body when awaited,
 * and also exposes `.withResponse()` to get both the data and the raw HTTP
 * response. Every single-request resource method returns one; the
 * auto-paginating `list()` helpers return a `PageIterator` instead, since they
 * may make several requests.
 *
 * It is a real `Promise` subclass, so it can be awaited, passed to
 * `Promise.all()`, assigned to a `Promise<T>`, and chained with
 * `.then()` / `.catch()` / `.finally()`.
 */
export class APIPromise<T> extends Promise<T> {
  private readonly responsePromise: Promise<{ data: T; rawResponse: RawResponse }>;
  private parsedPromise: Promise<T> | undefined;

  constructor(
    responsePromise: Promise<{ data: T; rawResponse: RawResponse }>,
  ) {
    // The base promise is a placeholder: then/catch/finally are overridden
    // below to read from `responsePromise`.
    super((resolve) => resolve(null as T));
    this.responsePromise = responsePromise;
  }

  /**
   * Derived promises (the result of `.then()` and friends) are plain
   * `Promise`s, so the custom constructor above is never invoked with an
   * executor.
   */
  static override get [Symbol.species](): PromiseConstructor {
    return Promise;
  }

  /**
   * Returns both the parsed data and the raw HTTP response.
   */
  async withResponse(): Promise<WithResponse<T>> {
    const { data, rawResponse } = await this.responsePromise;
    return { data, response: rawResponse };
  }

  /**
   * Maps the parsed data while keeping the raw response, so a resource method
   * that post-processes the body still supports `.withResponse()`.
   *
   * @internal
   */
  _thenUnwrap<U>(transform: (data: T) => U): APIPromise<U> {
    return new APIPromise<U>(
      this.responsePromise.then(({ data, rawResponse }) => ({ data: transform(data), rawResponse })),
    );
  }

  private parse(): Promise<T> {
    if (!this.parsedPromise) {
      this.parsedPromise = this.responsePromise.then((result) => result.data);
    }
    return this.parsedPromise;
  }

  /**
   * When awaited, resolves to just the parsed data `T`.
   */
  override then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.parse().then(onfulfilled, onrejected);
  }

  /**
   * Attaches a rejection handler.
   */
  override catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult> {
    return this.parse().catch(onrejected);
  }

  /**
   * Attaches a handler that runs on both fulfillment and rejection.
   */
  override finally(onfinally?: (() => void) | null): Promise<T> {
    return this.parse().finally(onfinally);
  }
}
