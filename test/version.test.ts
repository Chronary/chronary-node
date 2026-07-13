import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/version';

describe('VERSION', () => {
  it('matches the published package version', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };

    expect(VERSION).toBe(packageJson.version);
  });
});
