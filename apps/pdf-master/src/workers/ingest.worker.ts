/// <reference lib="webworker" />
import { ErrorCode, toErrorModel } from '@/domain/errors';
import { inspectPdfFile } from '@/services/pdfInspection';
import type { IngestWorkerMessage, IngestWorkerRequest, IngestWorkerResponse } from '@/workers/protocols';

self.onmessage = async (event: MessageEvent<IngestWorkerMessage>) => {
  const message = event.data;
  if (message.type !== 'ingest') {
    return;
  }

  try {
    const payload = await inspectPdf(message);
    const response: IngestWorkerResponse = {
      type: 'ingest:success',
      requestId: message.requestId,
      payload,
    };
    self.postMessage(response);
  } catch (error) {
    // pdf.js reports its cases through `name`, and a password-protected file
    // throws PasswordException with the message "No password given" — which
    // does not contain "encrypted", so matching on the message alone
    // misreported every locked PDF as corrupt (cadautoscript.com#100).
    const name = (error as {name?: unknown} | null)?.name;
    const messageText = error instanceof Error ? error.message.toLowerCase() : '';
    const isEncrypted =
      name === 'PasswordException' || messageText.includes('encrypted') || messageText.includes('password');
    const fallbackCode = isEncrypted ? ErrorCode.EncryptedPdf : ErrorCode.InvalidPdf;
    const response: IngestWorkerResponse = {
      type: 'ingest:error',
      requestId: message.requestId,
      error: toErrorModel(error, fallbackCode),
    };
    self.postMessage(response);
  }
};

async function inspectPdf(message: IngestWorkerRequest) {
  return inspectPdfFile(message.file, message.documentId);
}
