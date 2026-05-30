const DEFAULT_HARDWARE_CONCURRENCY = 4;
export const DEFAULT_THUMBNAIL_FALLBACK_CONCURRENCY = 2;
export const MAX_VIEWER_CANVAS_PIXELS = 8_388_608;

export interface ThumbnailRenderCapabilityInput {
  supportsWorkers?: boolean;
  supportsOffscreenCanvas?: boolean;
  hardwareConcurrency?: number;
}

export interface ThumbnailRenderEnvironment {
  supportsWorkers: boolean;
  supportsOffscreenCanvas: boolean;
  supportsBitmapRenderer: boolean;
  supportsWebGL: boolean;
  supportsWebGPU: boolean;
  supportsHardwareAcceleration: boolean;
  hardwareConcurrency: number;
  workerPoolSize: number;
  fallbackConcurrency: number;
  maxParallelRenders: number;
}

export function resolveHardwareConcurrency(hardwareConcurrency?: number): number {
  if (Number.isFinite(hardwareConcurrency) && hardwareConcurrency && hardwareConcurrency > 0) {
    return Math.max(1, Math.floor(hardwareConcurrency));
  }
  return DEFAULT_HARDWARE_CONCURRENCY;
}

export function resolveThumbnailWorkerPoolSize(input: ThumbnailRenderCapabilityInput = {}): number {
  const hardwareConcurrency = resolveHardwareConcurrency(input.hardwareConcurrency);
  if (!input.supportsWorkers || !input.supportsOffscreenCanvas) {
    return 0;
  }
  return Math.min(3, Math.max(1, Math.floor(hardwareConcurrency / 2)));
}

export function resolveThumbnailRenderConcurrency(input: ThumbnailRenderCapabilityInput = {}): number {
  const workerPoolSize = resolveThumbnailWorkerPoolSize(input);
  return workerPoolSize > 0 ? workerPoolSize : DEFAULT_THUMBNAIL_FALLBACK_CONCURRENCY;
}

export function getThumbnailRenderEnvironment(): ThumbnailRenderEnvironment {
  const supportsWorkers = typeof Worker !== 'undefined';
  const supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  const supportsBitmapRenderer = supportsCanvasContext('bitmaprenderer');
  const supportsWebGL = supportsCanvasContext('webgl') || supportsCanvasContext('webgl2');
  const supportsWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const hardwareConcurrency = resolveHardwareConcurrency(
    typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined,
  );
  const workerPoolSize = resolveThumbnailWorkerPoolSize({
    supportsWorkers,
    supportsOffscreenCanvas,
    hardwareConcurrency,
  });
  const supportsHardwareAcceleration =
    supportsOffscreenCanvas || supportsBitmapRenderer || supportsWebGL || supportsWebGPU;

  return {
    supportsWorkers,
    supportsOffscreenCanvas,
    supportsBitmapRenderer,
    supportsWebGL,
    supportsWebGPU,
    supportsHardwareAcceleration,
    hardwareConcurrency,
    workerPoolSize,
    fallbackConcurrency: DEFAULT_THUMBNAIL_FALLBACK_CONCURRENCY,
    maxParallelRenders: resolveThumbnailRenderConcurrency({
      supportsWorkers,
      supportsOffscreenCanvas,
      hardwareConcurrency,
    }),
  };
}

export function getCanvas2dContextSettings(enableHardwareAcceleration: boolean): CanvasRenderingContext2DSettings {
  return enableHardwareAcceleration
    ? {
        alpha: false,
        desynchronized: true,
        willReadFrequently: false,
      }
    : {
        alpha: false,
      };
}

export function resolveViewerRenderConcurrency(hardwareConcurrency?: number): number {
  const normalized = resolveHardwareConcurrency(hardwareConcurrency);
  return Math.min(4, Math.max(2, Math.ceil(normalized / 2)));
}

export function resolveViewerDevicePixelRatio(devicePixelRatio?: number): number {
  if (!Number.isFinite(devicePixelRatio) || !devicePixelRatio || devicePixelRatio <= 0) {
    return 1;
  }

  return Math.min(1.5, Math.max(1, devicePixelRatio));
}

export function clampRenderScaleToPixelBudget(
  width: number,
  height: number,
  scale: number,
  maxPixels: number = MAX_VIEWER_CANVAS_PIXELS,
): number {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const targetPixels = safeWidth * safeHeight * scale * scale;

  if (targetPixels <= maxPixels) {
    return scale;
  }

  return scale * Math.sqrt(maxPixels / targetPixels);
}

function supportsCanvasContext(contextId: 'bitmaprenderer' | 'webgl' | 'webgl2'): boolean {
  try {
    if (contextId === 'bitmaprenderer') {
      if (typeof document === 'undefined') {
        return false;
      }
      const canvas = document.createElement('canvas');
      return Boolean(canvas.getContext(contextId));
    }

    if (typeof OffscreenCanvas !== 'undefined') {
      const offscreen = new OffscreenCanvas(1, 1);
      return Boolean(offscreen.getContext(contextId));
    }

    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      return Boolean(canvas.getContext(contextId));
    }
  } catch {
    return false;
  }

  return false;
}
