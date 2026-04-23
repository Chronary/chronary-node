import type { CoreClient } from '../client';
import { PageIterator } from '../pagination';
import type {
  Proposal,
  ProposalSummary,
  ProposalResponse,
  CreateProposalParams,
  RespondToProposalParams,
  ListProposalsParams,
  ResolveProposalResponse,
  CancelProposalResponse,
  PageResponse,
  RequestOptions,
} from '../types';

export class SchedulingClient {
  constructor(private readonly client: CoreClient) {}

  async create(params: CreateProposalParams, options?: RequestOptions): Promise<ProposalSummary> {
    return this.client.request<ProposalSummary>(
      'POST', '/v1/scheduling/proposals', params, undefined, options,
    );
  }

  list(params: ListProposalsParams = {}): PageIterator<ProposalSummary> {
    const { limit = 50, ...filters } = params;
    return new PageIterator<ProposalSummary>(
      (offset, l) =>
        this.client.request<PageResponse<ProposalSummary>>(
          'GET', '/v1/scheduling/proposals', undefined,
          { ...filters, limit: l, offset },
        ),
      limit,
    );
  }

  async get(id: string, options?: RequestOptions): Promise<Proposal> {
    return this.client.request<Proposal>(
      'GET', `/v1/scheduling/proposals/${id}`, undefined, undefined, options,
    );
  }

  async respond(
    id: string,
    params: RespondToProposalParams,
    options?: RequestOptions,
  ): Promise<ProposalResponse> {
    return this.client.request<ProposalResponse>(
      'POST', `/v1/scheduling/proposals/${id}/respond`, params, undefined, options,
    );
  }

  async resolve(id: string, options?: RequestOptions): Promise<ResolveProposalResponse> {
    return this.client.request<ResolveProposalResponse>(
      'POST', `/v1/scheduling/proposals/${id}/resolve`, undefined, undefined, options,
    );
  }

  async cancel(id: string, options?: RequestOptions): Promise<CancelProposalResponse> {
    return this.client.request<CancelProposalResponse>(
      'POST', `/v1/scheduling/proposals/${id}/cancel`, undefined, undefined, options,
    );
  }
}
