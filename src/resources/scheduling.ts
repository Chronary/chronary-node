import type { APIPromise } from '../api-promise';
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

  create(params: CreateProposalParams, options?: RequestOptions): APIPromise<ProposalSummary> {
    return this.client.request<ProposalSummary>(
      'POST', '/v1/scheduling/proposals', params, undefined, options,
    );
  }

  list(params: ListProposalsParams = {}): PageIterator<ProposalSummary> {
    const { limit = 50, offset = 0, ...filters } = params;
    return new PageIterator<ProposalSummary>(
      (offset, l) =>
        this.client.request<PageResponse<ProposalSummary>>(
          'GET', '/v1/scheduling/proposals', undefined,
          { ...filters, limit: l, offset },
        ),
      limit,
      offset,
    );
  }

  get(id: string, options?: RequestOptions): APIPromise<Proposal> {
    return this.client.request<Proposal>(
      'GET', `/v1/scheduling/proposals/${id}`, undefined, undefined, options,
    );
  }

  respond(
    id: string,
    params: RespondToProposalParams,
    options?: RequestOptions,
  ): APIPromise<ProposalResponse> {
    return this.client.request<ProposalResponse>(
      'POST', `/v1/scheduling/proposals/${id}/respond`, params, undefined, options,
    );
  }

  resolve(id: string, options?: RequestOptions): APIPromise<ResolveProposalResponse> {
    return this.client.request<ResolveProposalResponse>(
      'POST', `/v1/scheduling/proposals/${id}/resolve`, undefined, undefined, options,
    );
  }

  cancel(id: string, options?: RequestOptions): APIPromise<CancelProposalResponse> {
    return this.client.request<CancelProposalResponse>(
      'POST', `/v1/scheduling/proposals/${id}/cancel`, undefined, undefined, options,
    );
  }
}
