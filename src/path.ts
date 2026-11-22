import { ValidationError } from './error';

/**
 * Encode one caller-supplied value (an ID or a booking slug) as a single URL
 * path segment (#2519).
 *
 * `encodeURIComponent` keeps `/`, `?`, `#` and `%` inside the segment, so an
 * ID like `../agents/agt_1` or `evt_1?expand=all` can't reach another
 * resource or add a query string. Encoding leaves dots alone, and fetch
 * resolves a `.` / `..` segment (and `%2e%2e`) before sending, so those and
 * the empty string are refused outright.
 *
 * @throws ValidationError (status 0, no request sent) for `""`, `"."` or `".."`.
 */
export function encodePathSegment(value: string): string {
  const segment = String(value);
  if (segment === '' || segment === '.' || segment === '..') {
    throw new ValidationError(
      `Invalid ID ${JSON.stringify(segment)}: a path parameter must not be empty, "." or "..". No request was sent.`,
      0,
    );
  }
  return encodeURIComponent(segment);
}

/**
 * A request path whose interpolated values are encoded when the request runs,
 * so a refused value rejects the returned promise instead of throwing
 * synchronously from the resource method. Exported from the package as a type
 * only (`CoreClient.request()` accepts one); build paths with
 * `encodePathSegment`.
 *
 * @internal
 */
export class ApiPath {
  constructor(
    private readonly strings: readonly string[],
    private readonly values: readonly string[],
  ) {}

  /** The encoded path. @throws ValidationError for a refused segment. */
  resolve(): string {
    let out = this.strings[0];
    for (let i = 0; i < this.values.length; i++) {
      out += encodePathSegment(this.values[i]) + this.strings[i + 1];
    }
    return out;
  }
}

/**
 * Tagged template for request paths: `` apiPath`/v1/events/${eventId}` ``.
 *
 * @internal Not exported from the package.
 */
export function apiPath(strings: TemplateStringsArray, ...values: string[]): ApiPath {
  return new ApiPath(strings, values);
}
