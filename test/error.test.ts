import { describe, it, expect } from 'vitest';
import {
  ChronaryError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  QuotaExceededError,
  PlanRequiredError,
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
    expect(err.status).toBe(429);
    expect(new QuotaExceededError('Legacy', 'req_4', undefined, undefined, 402).status).toBe(402);
  });

  it('QuotaExceededError exposes metric, limit and upgradeUrl from the body', () => {
    const err = new QuotaExceededError('Limit reached', 'req_4', undefined, {
      metric: 'api_calls', limit: 50000, upgrade_url: 'https://console.test/settings/billing',
    });
    expect(err.metric).toBe('api_calls');
    expect(err.limit).toBe(50000);
    expect(err.upgradeUrl).toBe('https://console.test/settings/billing');
  });

  it('QuotaExceededError exposes upgradePlan from the body', () => {
    const err = new QuotaExceededError('Limit reached', 'req_4', undefined, {
      metric: 'api_calls', limit: 50000, upgrade_url: 'https://console.test/settings/billing', upgrade_plan: 'developer',
    });
    expect(err.upgradePlan).toBe('developer');
  });

  it('PlanRequiredError exposes upgradeUrl and plan fields', () => {
    const body = {
      type: 'plan_required', required_plan: 'pro', feature: 'scoped_keys',
      upgrade_url: 'https://console.test/settings/billing', docs_url: 'https://docs.test/plans', contact_url: 'https://x.test/c',
    };
    const err = new PlanRequiredError('Pro required', 'req_5', undefined, body);
    expect(err).toBeInstanceOf(ChronaryError);
    expect(err.status).toBe(403);
    expect(err.errorType).toBe('plan_required');
    expect(err.upgradeUrl).toBe('https://console.test/settings/billing');
    expect(err.docsUrl).toBe('https://docs.test/plans');
    expect(err.requiredPlan).toBe('pro');
    expect(err.feature).toBe('scoped_keys');
    expect(err.contactUrl).toBe('https://x.test/c');
    expect(err.body).toBe(body);
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
