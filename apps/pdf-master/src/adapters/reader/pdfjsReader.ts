import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { PdfMasterError, ErrorCode } from '@/domain/errors';
import type { PdfMetadata, PdfReader } from '@/domain/types';
import { getCanvas2dContextSettings, getThumbnailRenderEnvironment } from '@/utils/thumbnailRendering';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface CachedDocument {
  loadingTask: PDFDocumentLoadingTask;
  document: Promise<PDFDocumentProxy>;
}

interface ThumbnailCanvasHandle {
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  toBlob: () => Promise<Blob>;
  dispose: () => void;
}

export class PdfjsReader implements PdfReader {
  private readonly cache = new Map<string, CachedDocument>();
  private readonly renderEnvironment = getThumbnailRenderEnvironment();

  async loadDocument(documentId: string, sourceFile: File, sourceUrl?: string): Promise<{ documentId: string; pageCount: number }> {
    const document = await this.getDocument(documentId, sourceFile, sourceUrl);
    return { documentId, pageCount: document.numPages };
  }

  async renderPageThumbnail(input: {
    documentId: string;
    sourceFile: File;
    sourceUrl?: string;
    pageIndex: number;
    maxWidth: number;
    signal?: AbortSignal;
  }): Promise<Blob> {
    if (input.signal?.aborted) {
      throw new DOMException('Thumbnail rendering canceled.', 'AbortError');
    }

    const pdfDocument = await this.getDocument(input.documentId, input.sourceFile, input.sourceUrl);
    const page = await pdfDocument.getPage(input.pageIndex + 1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = input.maxWidth / baseViewport.width;
    const viewport = page.getViewport({ scale: Math.max(scale, 0.2) });
    const canvas = createThumbnailCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
      this.renderEnvironment.supportsHardwareAcceleration,
    );

    const renderTask = page.render({
      canvas: null,
      canvasContext: canvas.context as unknown as CanvasRenderingContext2D,
      viewport,
    });
    const abortHandler = () => renderTask.cancel();
    input.signal?.addEventListener('abort', abortHandler, { once: true });

    try {
      await renderTask.promise;
      return await canvas.toBlob();
    } catch (error) {
      if (input.signal?.aborted) {
        throw new DOMException('Thumbnail rendering canceled.', 'AbortError');
      }
      throw error;
    } finally {
      input.signal?.removeEventListener('abort', abortHandler);
      page.cleanup();
      canvas.dispose();
    }
  }

  async getMetadata(documentId: string): Promise<PdfMetadata> {
    const cached = this.cache.get(documentId);
    if (!cached) {
      return {};
    }

    const pdfDocument = await cached.document;
    const metadata = await pdfDocument.getMetadata();
    const info = metadata.info as Record<string, string | undefined>;

    return {
      title: info.Title ?? undefined,
      author: info.Author ?? undefined,
      subject: info.Subject ?? undefined,
      creator: info.Creator ?? undefined,
      producer: info.Producer ?? undefined,
      creationDate: info.CreationDate ?? undefined,
      modificationDate: info.ModDate ?? undefined,
    };
  }

  getCapabilities() {
    return {
      supportsTextExtraction: false,
      supportsOffscreenRendering: this.renderEnvironment.supportsOffscreenCanvas,
    };
  }

  async destroy(documentId: string): Promise<void> {
    const cached = this.cache.get(documentId);
    if (!cached) {
      return;
    }

    const document = await cached.document.catch(() => null);
    this.cache.delete(documentId);
    cached.loadingTask.destroy();
    await document?.destroy();
  }

  private async getDocument(documentId: string, sourceFile: File, sourceUrl?: string): Promise<PDFDocumentProxy> {
    const cached = this.cache.get(documentId);
    if (cached) {
      return cached.document;
    }

    const url = sourceUrl || URL.createObjectURL(sourceFile);
    const loadingTask = pdfjs.getDocument({
      url,
      useWorkerFetch: false,
      isOffscreenCanvasSupported: this.renderEnvironment.supportsOffscreenCanvas,
      enableHWA: this.renderEnvironment.supportsHardwareAcceleration,
      stopAtErrors: false,
    });
    const document = loadingTask.promise;
    this.cache.set(documentId, { loadingTask, document });
    return document;
  }
}

function createThumbnailCanvas(
  width: number,
  height: number,
  enableHardwareAcceleration: boolean,
): ThumbnailCanvasHandle {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', getCanvas2dContextSettings(enableHardwareAcceleration));

    if (!context) {
      throw new PdfMasterError(ErrorCode.ThumbnailRenderFailed, 'OffscreenCanvas rendering context is not available.');
    }

    return {
      context,
      toBlob: () => canvas.convertToBlob({ type: 'image/png' }),
      dispose: () => {
        canvas.width = 0;
        canvas.height = 0;
      },
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', getCanvas2dContextSettings(enableHardwareAcceleration));

  if (!context) {
    throw new PdfMasterError(ErrorCode.ThumbnailRenderFailed, 'Canvas rendering context is not available.');
  }

  return {
    context,
    toBlob: async () =>
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
            return;
          }
          reject(new PdfMasterError(ErrorCode.ThumbnailRenderFailed, 'Thumbnail rendering returned an empty blob.'));
        }, 'image/png');
      }),
    dispose: () => {
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}
