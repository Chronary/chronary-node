import { describe, it, expect } from 'vitest';
import { encodePathSegment, ValidationError } from '../src/index';
import * as pkg from '../src/index';
import { apiPath, ApiPath } from '../src/path';

describe('encodePathSegment (#2519)', () => {
  it.each([
    ['evt_abc-123_XYZ', 'evt_abc-123_XYZ'],
    ['11111111-2222-3333-4444-555555555555', '11111111-2222-3333-4444-555555555555'],
    ['../x', '..%2Fx'],
    ['%2e%2e', '%252e%252e'],
    ['.%2e', '.%252e'],
    ['a#b', 'a%23b'],
    ['a?b=c', 'a%3Fb%3Dc'],
    ['a/b', 'a%2Fb'],
    ['...', '...'],
    ['a b', 'a%20b'],
  ])('encodes %j as %j', (input, expected) => {
    expect(encodePathSegment(input)).toBe(expected);
  });

  it.each(['', '.', '..'])('refuses %j with a ValidationError (status 0)', (input) => {
    let err: unknown;
    try {
      encodePathSegment(input);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).status).toBe(0);
    expect((err as ValidationError).message).toContain('No request was sent');
  });
});

describe('package surface', () => {
  it('exports encodePathSegment but not the internal apiPath / ApiPath values', () => {
    expect(typeof pkg.encodePathSegment).toBe('function');
    expect('apiPath' in pkg).toBe(false);
    expect('ApiPath' in pkg).toBe(false);
  });
});

describe('apiPath (internal)', () => {
  it('encodes each interpolated value and keeps the literal parts', () => {
    const p = apiPath`/v1/calendars/${'cal/1'}/events/${'evt?1'}`;
    expect(p).toBeInstanceOf(ApiPath);
    expect(p.resolve()).toBe('/v1/calendars/cal%2F1/events/evt%3F1');
  });

  it('defers a refused value to resolve()', () => {
    const p = apiPath`/v1/events/${'..'}`;
    expect(() => p.resolve()).toThrow(ValidationError);
  });

  it('handles a path with no values', () => {
    expect(apiPath`/v1/agents`.resolve()).toBe('/v1/agents');
  });
});
