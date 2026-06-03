# Chronary TypeScript SDK

The official TypeScript client for the [Chronary](https://chronary.ai) calendar-as-a-service API.

## Installation

```bash
npm install @chronary/sdk
```

Requires Node.js 18 or newer.

## Quickstart

```ts
import { Chronary } from '@chronary/sdk';

const client = new Chronary({
  apiKey: process.env.CHRONARY_API_KEY,
});

const calendar = await client.calendars.create({
  name: 'Sales Team',
  timezone: 'America/New_York',
});

const event = await client.events.create(calendar.id, {
  title: 'Strategy Sync',
  start_time: '2026-03-28T14:00:00Z',
  end_time: '2026-03-28T14:30:00Z',
});
```

## Configuration

```ts
const client = new Chronary({
  apiKey: process.env.CHRONARY_API_KEY,
  baseUrl: 'https://api.chronary.ai',
  timeout: 30_000,
  maxRetries: 2,
});
```

If `apiKey` is omitted, the SDK will also check `process.env.CHRONARY_API_KEY`.

## Resources

- `client.agents`
- `client.calendars`
- `client.events`
- `client.availability`
- `client.webhooks`
- `client.icalSubscriptions`
- `client.scheduling`
- `client.usage`
- `client.keys`
- `client.agentAuth`

## Plans & limits

Chronary enforces a per-key rate limit and per-org monthly quotas that vary by plan:

| | Free | Pro |
|---|---|---|
| Rate limit | 10 req/s | 50 req/s |
| Webhook delivery retries | 4 | 8 |
| Agents | 3 | 50 |
| Calendars | 10 | 250 |
| Events / mo | 2,500 | 125,000 |
| API calls / mo | 50,000 | 1,000,000 |
| Pro-only features | — | Scheduling proposals, temporal holds, cross-calendar availability, per-agent API keys (`chr_ak_*`) |

Pro-only feature calls return `403` with an upgrade hint on Free. See the full matrix and rate-limit handling guidance at <https://docs.chronary.ai/resources/rate-limits/>.

## Webhook Verification

```ts
import { Chronary } from '@chronary/sdk';

const event = await Chronary.webhooks.constructEvent(rawBody, headers, secret);
// event.type comes from X-Chronary-Event-Type; event.data is the parsed payload body.
```

## License

Apache-2.0
