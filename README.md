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

## Webhook Verification

```ts
import { Chronary } from '@chronary/sdk';

const event = Chronary.webhooks.constructEvent(payload, signature, secret);
```

## License

Apache-2.0
