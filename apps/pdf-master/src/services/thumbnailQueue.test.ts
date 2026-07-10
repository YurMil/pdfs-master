import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type * as thumbnailRendering from '@/utils/thumbnailRendering';
import { ThumbnailQueue } from './thumbnailQueue';
import { ErrorCode } from '@/domain/errors';
import type { PdfReader } from '@/domain/types';

class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  terminated = false;
  static lastInstance: MockWorker | null = null;

  constructor(public url: string, public options?: unknown) {
    MockWorker.lastInstance = this;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'message') this.onmessage = listener as unknown as (ev: MessageEvent) => void;
    if (type === 'error') this.onerror = listener as unknown as (ev: ErrorEvent) => void;
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === 'message' && this.onmessage === listener) this.onmessage = null;
    if (type === 'error' && this.onerror === listener) this.onerror = null;
  }

  postMessage(message: { type: string; requestId: string; pageId: string }) {
    if (message.type === 'render') {
      // Allow tests to intercept and respond
      setTimeout(() => {
        MockWorker.onPostMessage?.(message);
      }, 0);
    }
  }

  terminate() {
    this.terminated = true;
  }

  static onPostMessage?: (message: { type: string; requestId: string; pageId: string }) => void;
}

// Mock getThumbnailRenderEnvironment to enable workers
vi.mock('@/utils/thumbnailRendering', async () => {
  const actual = await vi.importActual<typeof thumbnailRendering>('@/utils/thumbnailRendering');
  return {
    ...actual,
    getThumbnailRenderEnvironment: () => ({
      supportsWorkers: true,
      supportsOffscreenCanvas: true,
      supportsBitmapRenderer: true,
      supportsWebGL: false,
      supportsWebGPU: false,
      supportsHardwareAcceleration: true,
      hardwareConcurrency: 4,
      workerPoolSize: 1,
      fallbackConcurrency: 1,
      maxParallelRenders: 1,
    }),
  };
});

describe('ThumbnailQueue fallback behavior', () => {
  let mockReader: PdfReader;
  let file: File;

  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker);
    MockWorker.lastInstance = null;
    MockWorker.onPostMessage = undefined;

    mockReader = {
      loadDocument: vi.fn(),
      renderPageThumbnail: vi.fn().mockResolvedValue(new Blob(['fallback-blob'], { type: 'image/png' })),
      getMetadata: vi.fn(),
      getCapabilities: vi.fn(),
      destroy: vi.fn(),
    };

    file = new File(['pdf-content'], 'test.pdf', { type: 'application/pdf' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders successfully using worker when no errors occur', async () => {
    const queue = new ThumbnailQueue(mockReader);

    // Mock worker successful response
    MockWorker.onPostMessage = (message) => {
      const response = {
        type: 'render:success',
        requestId: message.requestId,
        pageId: message.pageId,
        blob: new Blob(['worker-blob'], { type: 'image/png' }),
        width: 100,
        height: 150,
      };
      MockWorker.lastInstance?.onmessage?.({ data: response } as MessageEvent);
    };

    const url = await queue.requestThumbnail({
      pageId: 'page-1',
      documentId: 'doc-1',
      sourceFile: file,
      sourceUrl: 'blob:url',
      pageIndex: 0,
      maxWidth: 150,
    });

    expect(url).toBeDefined();
    expect(url.startsWith('blob:')).toBe(true);
    expect(mockReader.renderPageThumbnail).not.toHaveBeenCalled();
  });

  it('falls back to main-thread rendering if the worker returns a render error', async () => {
    const queue = new ThumbnailQueue(mockReader);

    // Mock worker error response
    MockWorker.onPostMessage = (message) => {
      const response = {
        type: 'render:error',
        requestId: message.requestId,
        pageId: message.pageId,
        error: {
          code: ErrorCode.ThumbnailRenderFailed,
          message: 'Worker failed to render page',
          recoverable: true,
        },
      };
      MockWorker.lastInstance?.onmessage?.({ data: response } as MessageEvent);
    };

    const url = await queue.requestThumbnail({
      pageId: 'page-1',
      documentId: 'doc-1',
      sourceFile: file,
      sourceUrl: 'blob:url',
      pageIndex: 0,
      maxWidth: 150,
    });

    expect(url).toBeDefined();
    expect(url.startsWith('blob:')).toBe(true);
    expect(mockReader.renderPageThumbnail).toHaveBeenCalledWith(expect.objectContaining({
      documentId: 'doc-1',
      pageIndex: 0,
      maxWidth: 150,
    }));
  });

  it('falls back to main-thread rendering if the worker times out', async () => {
    vi.useFakeTimers();
    const queue = new ThumbnailQueue(mockReader);

    // Trigger request
    const promise = queue.requestThumbnail({
      pageId: 'page-1',
      documentId: 'doc-1',
      sourceFile: file,
      sourceUrl: 'blob:url',
      pageIndex: 0,
      maxWidth: 150,
    });

    // Fast-forward time to trigger timeout in thumbnailQueue
    await vi.advanceTimersByTimeAsync(4500);

    const url = await promise;
    expect(url).toBeDefined();
    expect(url.startsWith('blob:')).toBe(true);
    expect(mockReader.renderPageThumbnail).toHaveBeenCalledWith(expect.objectContaining({
      documentId: 'doc-1',
      pageIndex: 0,
      maxWidth: 150,
    }));
  });
});
