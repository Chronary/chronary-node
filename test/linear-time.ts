import { expect } from 'vitest';

const CEILING_MS = 500;
const MAX_RATIO = 8;
// Under this, a 4n/n ratio is mostly scheduler and GC noise, not a signal.
const NOISE_FLOOR_MS = 100;

async function timeMs<T>(input: T, parse: (input: T) => unknown): Promise<number> {
  const started = performance.now();
  await parse(input);
  return performance.now() - started;
}

const median = (samples: number[]) => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];

/**
 * Regression guard for super-linear parsing. Times `parse` on
 * inputs of size n and 4n (median of 3 interleaved runs each, so runner load
 * hits both alike) and fails when the 4n run grows like a quadratic (>= 8x the
 * n run; quadratic is ~16x) or exceeds a generous 500 ms ceiling. A scaling
 * check rather than a tight wall-clock budget, so a slow or busy CI runner
 * does not trip it.
 */
export async function expectLinearTime<T>(
  makeInput: (n: number) => T,
  parse: (input: T) => unknown,
  n: number,
): Promise<void> {
  const small = makeInput(n);
  const large = makeInput(4 * n);
  await parse(small); // warm-up: JIT and first-call setup
  const smallMs: number[] = [];
  const largeMs: number[] = [];
  for (let i = 0; i < 3; i++) {
    smallMs.push(await timeMs(small, parse));
    largeMs.push(await timeMs(large, parse));
    // Two 4n runs over the ceiling already fix the median; skip the third.
    if (largeMs.filter((ms) => ms >= CEILING_MS).length === 2) break;
  }
  const smallMedian = median(smallMs);
  const largeMedian = median(largeMs);
  const detail = `n: ${smallMedian.toFixed(1)} ms, 4n: ${largeMedian.toFixed(1)} ms`;
  expect(largeMedian, detail).toBeLessThan(CEILING_MS);
  expect(largeMedian, detail).toBeLessThan(Math.max(MAX_RATIO * smallMedian, NOISE_FLOOR_MS));
}
