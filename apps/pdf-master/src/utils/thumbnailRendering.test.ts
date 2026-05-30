import { describe, expect, it } from 'vitest';
import {
  clampRenderScaleToPixelBudget,
  DEFAULT_THUMBNAIL_FALLBACK_CONCURRENCY,
  resolveViewerDevicePixelRatio,
  resolveViewerRenderConcurrency,
  resolveHardwareConcurrency,
  resolveThumbnailRenderConcurrency,
  resolveThumbnailWorkerPoolSize,
} from '@/utils/thumbnailRendering';

describe('thumbnail rendering helpers', () => {
  it('normalizes hardware concurrency values', () => {
    expect(resolveHardwareConcurrency(12.8)).toBe(12);
    expect(resolveHardwareConcurrency(1)).toBe(1);
    expect(resolveHardwareConcurrency(0)).toBe(4);
    expect(resolveHardwareConcurrency(undefined)).toBe(4);
  });

  it('uses worker pool size only when workers and offscreen canvas are both available', () => {
    expect(
      resolveThumbnailWorkerPoolSize({
        supportsWorkers: true,
        supportsOffscreenCanvas: true,
        hardwareConcurrency: 16,
      }),
    ).toBe(3);

    expect(
      resolveThumbnailWorkerPoolSize({
        supportsWorkers: true,
        supportsOffscreenCanvas: false,
        hardwareConcurrency: 16,
      }),
    ).toBe(0);

    expect(
      resolveThumbnailWorkerPoolSize({
        supportsWorkers: false,
        supportsOffscreenCanvas: true,
        hardwareConcurrency: 16,
      }),
    ).toBe(0);
  });

  it('falls back to a conservative main-thread concurrency when workers are unavailable', () => {
    expect(
      resolveThumbnailRenderConcurrency({
        supportsWorkers: false,
        supportsOffscreenCanvas: false,
        hardwareConcurrency: 12,
      }),
    ).toBe(DEFAULT_THUMBNAIL_FALLBACK_CONCURRENCY);
  });

  it('limits viewer render concurrency and device pixel ratio for smoother scrolling', () => {
    expect(resolveViewerRenderConcurrency(2)).toBe(2);
    expect(resolveViewerRenderConcurrency(8)).toBe(4);
    expect(resolveViewerDevicePixelRatio(3)).toBe(1.5);
    expect(resolveViewerDevicePixelRatio(0.8)).toBe(1);
  });

  it('reduces render scale when a page would exceed the canvas memory budget', () => {
    const reduced = clampRenderScaleToPixelBudget(2000, 3000, 2);
    expect(reduced).toBeLessThan(2);
    expect(clampRenderScaleToPixelBudget(800, 1200, 1)).toBe(1);
  });
});
