import { validatePdfFile, validateImportFile, isImageFile } from '@/domain/validation';
import { toErrorModel } from '@/domain/errors';
import type {
  ErrorModel,
  ImageImportSettings,
  IngestDocumentPayload,
  SourceFileModel,
} from '@/domain/types';
import type { IngestWorkerResponse } from '@/workers/protocols';
import { createId } from '@/utils/ids';
import { makeObjectUrl } from '@/utils/objectUrl';
import { convertImageToPdf } from '@/services/importImage';
import { DEFAULT_IMAGE_IMPORT_SETTINGS } from '@/domain/paperFormat';

export interface ImportedDocument {
  sourceFile: SourceFileModel;
  payload: IngestDocumentPayload;
  sourceUrl: string;
  /** Set when the document was generated from an image file. */
  originalImageFile?: File;
  imageFitSettings?: ImageImportSettings;
}

export interface ImportResult {
  imported: ImportedDocument[];
  errors: Array<{ fileName: string; error: ErrorModel }>;
}

/**
 * Unified import function that accepts both PDF and image files.
 * Images are first converted to single-page PDFs, then all PDFs are ingested.
 */
export async function importFiles(
  files: File[],
  onProgress?: (completed: number, total: number) => void,
  imageSettings: ImageImportSettings = DEFAULT_IMAGE_IMPORT_SETTINGS,
): Promise<ImportResult> {
  const errors: Array<{ fileName: string; error: ErrorModel }> = [];
  const pdfFiles: File[] = [];
  // Map converted PDF File → original image File (for documents generated from images).
  const originalImages = new Map<File, File>();
  let completed = 0;

  // Phase 1: Validate and convert images to PDFs
  for (const file of files) {
    try {
      validateImportFile(file);

      if (isImageFile(file)) {
        const result = await convertImageToPdf(file, imageSettings);
        pdfFiles.push(result.pdfFile);
        originalImages.set(result.pdfFile, file);
      } else {
        pdfFiles.push(file);
      }
    } catch (error) {
      errors.push({ fileName: file.name, error: toErrorModel(error) });
      completed += 1;
      onProgress?.(completed, files.length);
    }
  }

  // Phase 2: Import all PDF files (original PDFs + converted images)
  if (!pdfFiles.length) {
    return { imported: [], errors };
  }

  const pdfResult = await importPdfFilesInternal(
    pdfFiles,
    (pdfCompleted, _pdfTotal) => {
      onProgress?.(completed + pdfCompleted, files.length);
    },
    (file) => {
      const original = originalImages.get(file);
      if (!original) {
        return undefined;
      }
      return { originalImageFile: original, imageFitSettings: imageSettings };
    },
  );

  return {
    imported: pdfResult.imported,
    errors: [...errors, ...pdfResult.errors],
  };
}

export async function importPdfFiles(
  files: File[],
  onProgress?: (completed: number, total: number) => void,
): Promise<ImportResult> {
  return importPdfFilesInternal(files, onProgress);
}

async function importPdfFilesInternal(
  files: File[],
  onProgress?: (completed: number, total: number) => void,
  metaForFile?: (file: File) => Pick<ImportedDocument, 'originalImageFile' | 'imageFitSettings'> | undefined,
): Promise<ImportResult> {
  const worker = new Worker(new URL('../workers/ingest.worker.ts', import.meta.url), { type: 'module' });
  const imported: ImportedDocument[] = [];
  const errors: Array<{ fileName: string; error: ErrorModel }> = [];
  let completed = 0;

  try {
    await Promise.all(
      files.map(async (file) => {
        try {
          validatePdfFile(file);
          const sourceFile: SourceFileModel = {
            id: createId('source'),
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            type: file.type,
            file,
          };
          const documentId = createId('document');
          const payload = await inspectWithWorker(worker, { documentId, file });
          const extra = metaForFile?.(file) ?? {};
          imported.push({
            sourceFile,
            payload,
            sourceUrl: makeObjectUrl(file),
            ...extra,
          });
        } catch (error) {
          errors.push({ fileName: file.name, error: toErrorModel(error) });
        } finally {
          completed += 1;
          onProgress?.(completed, files.length);
        }
      }),
    );
  } finally {
    worker.terminate();
  }

  return { imported, errors };
}

/**
 * Re-converts an image with new format/orientation settings and ingests the
 * resulting PDF, returning a single ImportedDocument. Caller is responsible
 * for swapping it into the workspace and revoking the old object URL.
 */
export async function reconvertImageDocument(
  originalImage: File,
  imageSettings: ImageImportSettings,
): Promise<ImportedDocument> {
  const result = await convertImageToPdf(originalImage, imageSettings);
  const ingest = await importPdfFilesInternal(
    [result.pdfFile],
    undefined,
    () => ({ originalImageFile: originalImage, imageFitSettings: imageSettings }),
  );
  const first = ingest.imported[0];
  if (!first) {
    const issue = ingest.errors[0];
    throw issue ? new Error(issue.error.message) : new Error('Failed to re-convert image.');
  }
  return first;
}

function inspectWithWorker(
  worker: Worker,
  input: { documentId: string; file: File },
): Promise<IngestDocumentPayload> {
  return new Promise((resolve, reject) => {
    const requestId = createId('ingest');

    const handleMessage = (event: MessageEvent<IngestWorkerResponse>) => {
      if (event.data.requestId !== requestId) {
        return;
      }

      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      if (event.data.type === 'ingest:success') {
        resolve(event.data.payload);
        return;
      }
      reject(event.data.error);
    };

    const handleError = (event: ErrorEvent) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      reject(event.error ?? new Error(event.message));
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage({
      type: 'ingest',
      requestId,
      documentId: input.documentId,
      file: input.file,
    });
  });
}

