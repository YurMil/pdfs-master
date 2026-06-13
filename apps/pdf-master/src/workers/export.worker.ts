/// <reference lib="webworker" />
import { PdfLibWriter } from '@/adapters/writer/pdfLibWriter';
import { ErrorCode, toErrorModel } from '@/domain/errors';
import type { ExportWorkerMessage, ExportWorkerResponse } from '@/workers/protocols';

const writer = new PdfLibWriter();

self.onmessage = async (event: MessageEvent<ExportWorkerMessage>) => {
  const message = event.data;
  if (message.type !== 'export') {
    return;
  }

  try {
    self.postMessage({
      type: 'export:progress',
      requestId: message.requestId,
      progress: 10,
      message: 'Preparing source documents...',
    } satisfies ExportWorkerResponse);

    let files;
    if (message.mode.kind === 'split') {
      const splitMode = message.mode;
      const source = message.documents.find((document) => document.documentId === splitMode.documentId);
      if (!source) {
        throw new Error('Split export document was not found.');
      }

      self.postMessage({
        type: 'export:progress',
        requestId: message.requestId,
        progress: 45,
        message: 'Generating split outputs...',
      } satisfies ExportWorkerResponse);

      files = await writer.splitDocument({
        documentId: source.documentId,
        sourceFile: source.sourceFile,
        rangeGroups: message.mode.rangeGroups,
        formValues: source.formValues,
        flatten: source.flatten,
        baseFileName: message.baseFileName || source.name,
        exportProfile: message.exportProfile,
      });
    } else {
      const bytes =
        message.mode.kind === 'selection'
          ? await writer.extractPages({
              documents: message.documents,
              pages: message.pages,
              pageIds: message.mode.pageIds,
              exportProfile: message.exportProfile,
            })
          : await writer.mergeDocuments({
              documents: message.documents,
              pages: message.pages,
              exportProfile: message.exportProfile,
            });

      self.postMessage({
        type: 'export:progress',
        requestId: message.requestId,
        progress: 85,
        message: 'Finalizing download package...',
      } satisfies ExportWorkerResponse);

      files = [
        {
          name: `${message.baseFileName.replace(/\.pdf$/i, '') || 'pdf-master-export'}.pdf`,
          bytes,
          mimeType: 'application/pdf' as const,
        },
      ];
    }

    const response: ExportWorkerResponse = {
      type: 'export:success',
      requestId: message.requestId,
      files,
    };
    const transferables = files.map((file) => file.bytes.buffer);
    self.postMessage(response, transferables);
  } catch (error) {
    const response: ExportWorkerResponse = {
      type: 'export:error',
      requestId: message.requestId,
      error: toErrorModel(error, ErrorCode.ExportFailed),
    };
    self.postMessage(response);
  }
};
