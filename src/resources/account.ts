import type { CoreClient } from '../client';
import type { DataExport, RequestOptions } from '../types';

export class AccountClient {
  constructor(private readonly client: CoreClient) {}

  /**
   * Export every row this org owns as a single JSON payload (GDPR Art. 15 + 20
   * portability / CCPA right-to-know / EU Data Act interoperability).
   *
   * **Authentication:** This endpoint is JWT-only — it returns decrypted
   * webhook secrets and iCal subscription URLs that aren't normally accessible
   * via API-key endpoints. Configure the SDK with a console JWT (e.g. cookie
   * value or Bearer token from the console session) as the `apiKey` config to
   * call this. API keys (`chr_sk_*` / `chr_ak_*`) will return 401.
   *
   * In most cases, end users should download via the console UI at
   * `console.chronary.ai/settings`. The SDK method exists for programmatic
   * use cases (e.g. server-side compliance tooling holding a delegated JWT).
   *
   * **Rate limit:** 10 exports/hour/org.
   */
  async export(options?: RequestOptions): Promise<DataExport> {
    return this.client.request<DataExport>(
      'GET',
      '/v1/auth/export',
      undefined,
      undefined,
      options,
    );
  }
}
