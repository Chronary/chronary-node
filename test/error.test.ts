import { describe, it, expect } from 'vitest';
import {
  ChronaryError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  QuotaExceededError,
  TimeoutError,
  ConnectionError,
} from '../src/error';

describe('Error hierarchy', () => {
  it('ChronaryError has correct properties', () => {
    const err = new ChronaryError('fail', 500, 'req_abc', undefined, 'internal_error');
    expect(err.message).toBe('fail');
    expect(err.status).toBe(500);
    expect(err.requestId).toBe('req_abc');
    expect(err.errorType).toBe('internal_error');
    expect(err.name).toBe('ChronaryError');
    expect(err).toBeInstanceOf(Error);
  });

  it('AuthenticationError extends ChronaryError', () => {
    const err = new AuthenticationError('Invalid key', 'req_1');
    expect(err).toBeInstanceOf(ChronaryError);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.status).toBe(401);
    expect(err.name).toBe('AuthenticationError');
  });

  it('RateLimitError parses retry-after header', () => {
    const headers = new Headers({ 'retry-after': '5' });
    const err = new RateLimitError('Too fast', 'req_1', headers);
    expect(err).toBeInstanceOf(ChronaryError);
    expect(err.status).toBe(429);
    expect(err.retryAfter).toBe(5);
  });

  it('RateLimitError handles missing retry-after', () => {
    const err = new RateLimitError('Too fast');
    expect(err.retryAfter).toBeUndefined();
  });

  it('NotFoundError', () => {
    const err = new NotFoundError('Agent not found', 'req_2');
    expect(err.status).toBe(404);
    expect(err.requestId).toBe('req_2');
  });

  it('ValidationError takes custom status', () => {
    const err = new ValidationError('Bad field', 422, 'req_3');
    expect(err.status).toBe(422);
    expect(err.errorType).toBe('validation_error');
  });

  it('QuotaExceededError', () => {
    const err = new QuotaExceededError('Limit reached', 'req_4');
    expect(err.status).toBe(402);
  });

  it('TimeoutError has status 0', () => {
    const err = new TimeoutError('Timed out');
    expect(err.status).toBe(0);
    expect(err.name).toBe('TimeoutError');
  });

  it('ConnectionError has status 0', () => {
    const err = new ConnectionError('Network down');
    expect(err.status).toBe(0);
    expect(err.name).toBe('ConnectionError');
  });

  it('all errors are catchable as ChronaryError', () => {
    const errors = [
      new AuthenticationError('a'),
      new RateLimitError('b'),
      new NotFoundError('c'),
      new ValidationError('d', 422),
      new QuotaExceededError('e'),
      new TimeoutError('f'),
      new ConnectionError('g'),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(ChronaryError);
    }
  });
});
