import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import type { AuditLogResponse } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

const PAGE: AuditLogResponse = {
  data: [
    {
      id: 'aud_1',
      action: 'agent_key.create',
      actor_key_prefix: null,
      actor_type: 'session',
      actor_id: 'org_1',
      actor_label: 'owner@example.com',
      agent_id: null,
      resource: '',
      ip: '203.0.113.7',
      status: 201,
      method: 'POST',
      path: '/v1/auth/keys/scoped',
      duration_ms: 12,
      request_id: 'req_1',
      created_at: '2026-10-30T00:00:00.000Z',
    },
  ],
  pagination: { next_cursor: null },
  retention_days: 90,
  range_clamped: false,
};

describe('AuditLogClient', () => {
  it('list sends the actor, request, resource, status-class and category filters (#1176)', async () => {
    const fetch = mockFetch([{ status: 200, body: PAGE }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.auditLog.list({
      action: 'agent_key.create',
      actor_type: 'session',
      actor_id: 'org_1',
      request_id: 'req_1',
      resource: 'cal_',
      status_class: '2xx',
      category: 'keys',
      limit: 10,
    });

    expect(result.data[0].actor_type).toBe('session');
    expect(result.data[0].actor_label).toBe('owner@example.com');
    const url = new URL(String(fetch.mock.calls[0][0]));
    expect(url.pathname).toBe('/v1/audit-log');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: 'agent_key.create',
      actor_type: 'session',
      actor_id: 'org_1',
      request_id: 'req_1',
      resource: 'cal_',
      status_class: '2xx',
      category: 'keys',
      limit: '10',
    });
  });

  it('list without params sends no query', async () => {
    const fetch = mockFetch([{ status: 200, body: PAGE }]);
    const client = new Chronary(clientConfig(fetch));
    await client.auditLog.list();
    expect(new URL(String(fetch.mock.calls[0][0])).search).toBe('');
  });
});
