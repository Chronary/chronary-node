import { describe, it, expect } from 'vitest';
import { Chronary } from '../../src/index';
import { mockFetch, clientConfig } from '../helpers';

const PROPOSAL_SUMMARY = {
  id: 'spr_abc123',
  title: 'Project sync',
  description: null,
  organizer_agent_id: 'agt_org',
  participant_agent_ids: ['agt_a', 'agt_b'],
  calendar_id: 'cal_team',
  status: 'pending',
  expires_at: null,
  resolved_slot: null,
  created_event_id: null,
  metadata: {},
  created_at: '2026-04-16T12:00:00Z',
  updated_at: '2026-04-16T12:00:00Z',
};

const PROPOSAL_FULL = {
  ...PROPOSAL_SUMMARY,
  slots: [{ id: 'slt_1', start_time: '2026-04-20T14:00:00Z', end_time: '2026-04-20T15:00:00Z', weight: 1, calendar_id: null }],
  responses: [],
};

describe('SchedulingClient', () => {
  it('create returns proposal summary', async () => {
    const fetch = mockFetch([{ status: 201, body: PROPOSAL_SUMMARY }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.scheduling.create({
      title: 'Project sync',
      organizer_agent_id: 'agt_org',
      participant_agent_ids: ['agt_a', 'agt_b'],
      calendar_id: 'cal_team',
      slots: [{ start_time: '2026-04-20T14:00:00Z', end_time: '2026-04-20T15:00:00Z' }],
    });
    expect(result.id).toBe('spr_abc123');
    expect(result.status).toBe('pending');
    expect(fetch.mock.calls[0][1]?.method).toBe('POST');
  });

  it('list iterates pages', async () => {
    const fetch = mockFetch([
      { status: 200, body: { data: [PROPOSAL_SUMMARY], total: 1, limit: 50, offset: 0 } },
    ]);
    const client = new Chronary(clientConfig(fetch));

    const items = [];
    for await (const p of client.scheduling.list()) {
      items.push(p);
    }
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('spr_abc123');
  });

  it('get returns full proposal with slots and responses', async () => {
    const fetch = mockFetch([{ status: 200, body: PROPOSAL_FULL }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.scheduling.get('spr_abc123');
    expect(result.slots).toHaveLength(1);
    expect(result.responses).toEqual([]);
  });

  it('respond posts agent response', async () => {
    const fetch = mockFetch([
      {
        status: 200,
        body: {
          id: 'rsp_1',
          agent_id: 'agt_a',
          response: 'accept',
          selected_slot_id: 'slt_1',
          counter_slots: null,
          message: null,
          created_at: '2026-04-16T13:00:00Z',
        },
      },
    ]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.scheduling.respond('spr_abc123', {
      agent_id: 'agt_a',
      response: 'accept',
      selected_slot_id: 'slt_1',
    });
    expect(result.response).toBe('accept');
    expect(fetch.mock.calls[0][0]).toContain('/v1/scheduling/proposals/spr_abc123/respond');
  });

  it('resolve returns confirmed slot', async () => {
    const fetch = mockFetch([
      {
        status: 200,
        body: { status: 'confirmed', resolved_slot: { id: 'slt_1', start_time: 'x', end_time: 'y', weight: 1, calendar_id: null } },
      },
    ]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.scheduling.resolve('spr_abc123');
    expect(result.status).toBe('confirmed');
  });

  it('cancel returns cancelled status', async () => {
    const fetch = mockFetch([{ status: 200, body: { status: 'cancelled' } }]);
    const client = new Chronary(clientConfig(fetch));

    const result = await client.scheduling.cancel('spr_abc123');
    expect(result.status).toBe('cancelled');
  });
});
