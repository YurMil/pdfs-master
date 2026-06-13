import { buildPdfFileName } from '@/utils/file';
import { createId } from '@/utils/ids';
import { makeObjectUrl, revokeObjectUrl } from '@/utils/objectUrl';
import type { ExportFileResult, ExportMode, ExportPageDescriptor, ExportProfile, WorkspaceSnapshot } from '@/domain/types';
import { getFormFieldMap } from '@/services/formService';
import { parseRangeGroups } from '@/domain/validation';
import type { ExportWorkerRequest, ExportWorkerResponse } from '@/workers/protocols';

export function buildExportSelection(snapshot: WorkspaceSnapshot, mode: ExportMode): ExportPageDescriptor[] {
  const selected = mode.kind === 'selection' ? new Set(mode.pageIds) : null;

  return snapshot.pageOrder
    .filter((pageId) => (selected ? selected.has(pageId) : true))
    .map((pageId) => snapshot.pages[pageId])
    .filter(Boolean)
    .map((page) => ({
      pageId: page.id,
      documentId: page.documentId,
      sourcePageIndex: page.sourcePageIndex,
      rotation: page.rotation,
      label: page.label,
    }));
}

export async function runExport(
  snapshot: WorkspaceSnapshot,
  mode: ExportMode,
  baseFileName: string,
  exportProfile: ExportProfile,
  onProgress: (progress: number, message: string) => void,
): Promise<Array<{ name: string; blob: Blob }>> {
  const worker = new Worker(new URL('../workers/export.worker.ts', import.meta.url), { type: 'module' });

  try {
    const request: ExportWorkerRequest = {
      type: 'export',
      requestId: createId('export'),
      mode,
      baseFileName: buildPdfFileName(baseFileName).replace(/\.pdf$/i, ''),
      exportProfile,
      documents: snapshot.documentOrder.map((documentId) => {
        const document = snapshot.documents[documentId];
        return {
          documentId: document.id,
          sourceFile: document.sourceFile.file,
          formValues: getFormFieldMap(document.formFields),
          flatten: document.flattenForms,
          name: document.name,
        };
      }),
      pages: buildExportSelection(snapshot, mode),
    };

    const files = await executeWorker(worker, request, onProgress);
    return files.map((file) => ({
      name: file.name,
      blob: new Blob([file.bytes as BlobPart], { type: file.mimeType }),
    }));
  } finally {
    worker.terminate();
  }
}

export function downloadExportFiles(files: Array<{ name: string; blob: Blob }>): void {
  for (const file of files) {
    const url = makeObjectUrl(file.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => revokeObjectUrl(url), 1_000);
  }
}

export function resolveSplitMode(documentId: string, rangeInput: string, pageCount: number): ExportMode {
  return {
    kind: 'split',
    documentId,
    rangeGroups: parseRangeGroups(rangeInput, pageCount),
  };
}

function executeWorker(
  worker: Worker,
  request: ExportWorkerRequest,
  onProgress: (progress: number, message: string) => void,
): Promise<ExportFileResult[]> {
  return new Promise<ExportFileResult[]>((resolve, reject) => {
    const handleMessage = (event: MessageEvent<ExportWorkerResponse>) => {
      if (event.data.requestId !== request.requestId) {
        return;
      }

      if (event.data.type === 'export:progress') {
        onProgress(event.data.progress, event.data.message);
        return;
      }

      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      if (event.data.type === 'export:success') {
        resolve(event.data.files);
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
    worker.postMessage(request);
  });
}
