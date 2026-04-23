import type { CoreClient } from '../client';
import type {
  AvailabilityParams,
  CrossAgentAvailabilityParams,
  AvailabilityResponse,
  RequestOptions,
} from '../types';

export class AvailabilityClient {
  constructor(private readonly client: CoreClient) {}

  async forAgent(agentId: string, params: AvailabilityParams, options?: RequestOptions): Promise<AvailabilityResponse> {
    return this.client.request<AvailabilityResponse>(
      'GET', `/v1/agents/${agentId}/availability`, undefined,
      {
        start: params.start,
        end: params.end,
        slot_duration: params.slot_duration,
        include_busy: params.include_busy,
      },
      options,
    );
  }

  async forCalendar(calendarId: string, params: AvailabilityParams, options?: RequestOptions): Promise<AvailabilityResponse> {
    return this.client.request<AvailabilityResponse>(
      'GET', `/v1/calendars/${calendarId}/availability`, undefined,
      {
        start: params.start,
        end: params.end,
        slot_duration: params.slot_duration,
        include_busy: params.include_busy,
      },
      options,
    );
  }

  async check(params: CrossAgentAvailabilityParams, options?: RequestOptions): Promise<AvailabilityResponse> {
    return this.client.request<AvailabilityResponse>(
      'GET', '/v1/availability', undefined,
      {
        agents: params.agents.join(','),
        start: params.start,
        end: params.end,
        slot_duration: params.slot_duration,
        calendars: params.calendars?.join(','),
        include_busy: params.include_busy,
      },
      options,
    );
  }
}
