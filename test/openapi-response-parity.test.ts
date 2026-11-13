/**
 * Response-field parity between the OpenAPI spec and the SDK's response types
 * (#1995). A field the API documents in a response schema must exist on the
 * matching SDK type, and the SDK must not declare a field the spec lacks.
 *
 * Each row maps an OpenAPI schema to a `Record<keyof T, true>` listing every
 * key of the SDK type (the annotation keeps the list and the interface in step
 * under a type-checking editor or `tsc`). A spec field missing from the list
 * fails here at runtime, so a new API response field cannot ship without its
 * SDK field. Add a row to cover another response schema.
 *
 * The spec lives in the monorepo (`apps/api/openapi.json`); the public SDK
 * mirror has no `apps/api`, so the suite is skipped there.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import type {
  CrossCalendarQueriesUsage,
  HoldsUsage,
  ScopedKeysUsage,
  Usage,
  UsageMetric,
} from '../src/types';

interface SchemaObject {
  properties?: Record<string, SchemaObject>;
  required?: string[];
}

type KeySet<T> = Record<keyof T, true>;

interface ParityRow {
  /** Name under `components.schemas`. */
  schema: string;
  /** Every top-level key of the SDK type. */
  keys: Record<string, true>;
  /** Every key of the SDK type of each nested object property. */
  nested: Record<string, Record<string, true>>;
}

const USAGE_METRIC: KeySet<UsageMetric> = { used: true, limit: true };

const USAGE_KEYS: KeySet<Usage> = {
  period_start: true,
  period_end: true,
  resets_at: true,
  generated_at: true,
  plan: true,
  agents: true,
  calendars: true,
  events: true,
  api_calls: true,
  webhooks: true,
  webhook_endpoints: true,
  availability_queries: true,
  ical_subscriptions: true,
  proposals: true,
  recurring_events: true,
  booking_pages: true,
  scoped_keys: true,
  holds: true,
  cross_calendar_queries: true,
};

const USAGE_NESTED: Partial<Record<keyof Usage, Record<string, true>>> = {
  agents: USAGE_METRIC,
  calendars: USAGE_METRIC,
  events: USAGE_METRIC,
  api_calls: USAGE_METRIC,
  webhooks: USAGE_METRIC,
  webhook_endpoints: USAGE_METRIC,
  availability_queries: USAGE_METRIC,
  ical_subscriptions: USAGE_METRIC,
  proposals: USAGE_METRIC,
  recurring_events: USAGE_METRIC,
  booking_pages: USAGE_METRIC,
  scoped_keys: { count: true, limit: true } satisfies KeySet<ScopedKeysUsage>,
  holds: { created: true, confirmed: true, expired: true, active: true } satisfies KeySet<HoldsUsage>,
  cross_calendar_queries: { used: true } satisfies KeySet<CrossCalendarQueriesUsage>,
};

const ROWS: ParityRow[] = [
  { schema: 'Usage', keys: USAGE_KEYS, nested: USAGE_NESTED as Record<string, Record<string, true>> },
];

const SPEC_PATH = fileURLToPath(new URL('../../../apps/api/openapi.json', import.meta.url));
const hasSpec = existsSync(SPEC_PATH);

function sorted(keys: Iterable<string>): string[] {
  return [...keys].sort();
}

describe.skipIf(!hasSpec)('OpenAPI response-field parity (apps/api/openapi.json)', () => {
  const schemas = hasSpec
    ? (JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as { components: { schemas: Record<string, SchemaObject> } })
      .components.schemas
    : {};

  describe.each(ROWS)('$schema', (row) => {
    const schema = schemas[row.schema];

    it('exists in the spec', () => {
      expect(schema?.properties).toBeDefined();
    });

    it('has the same top-level fields as the SDK type', () => {
      expect(sorted(Object.keys(schema?.properties ?? {}))).toEqual(sorted(Object.keys(row.keys)));
    });

    it('has the same fields as the SDK type on every nested object', () => {
      for (const [name, property] of Object.entries(schema?.properties ?? {})) {
        if (!property.properties) continue;
        expect({ name, keys: sorted(Object.keys(row.nested[name] ?? {})) })
          .toEqual({ name, keys: sorted(Object.keys(property.properties)) });
      }
    });
  });
});
