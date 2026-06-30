import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from 'pdf-lib';
import type { PDFField } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { FormFieldModel, IngestDocumentPayload } from '@/domain/types';

/** Hard caps so a single large/scanned PDF cannot freeze or OOM the ingest worker. */
const MAX_TEXT_EXTRACTION_PAGES = 500;
const MAX_TEXT_CHARS_PER_PAGE = 20_000;
const TEXT_EXTRACTION_TIMEOUT_MS = 15_000;

export async function inspectPdfFile(file: File, documentId: string): Promise<IngestDocumentPayload> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Parse structure/metadata first — this is the essential part of an import.
  // pdf-lib fully parses on load(), so `bytes` is free to hand to pdf.js afterwards.
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });

  // Text extraction only powers the optional full-text search. It must never be
  // able to block or fail the import, so it runs after load with a timeout and
  // falls back to no text on any error.
  const pageTextContent = await extractPageTextContent(bytes, pdf.getPageCount());

  const pages = pdf.getPages().map((page, index) => {
    const size = page.getSize();
    return {
      id: `${documentId}-page-${index + 1}`,
      sourcePageIndex: index,
      width: size.width,
      height: size.height,
      label: `Page ${index + 1}`,
      textContent: pageTextContent[index],
    };
  });

  const metadata = {
    title: pdf.getTitle() ?? undefined,
    author: pdf.getAuthor() ?? undefined,
    subject: pdf.getSubject() ?? undefined,
    creator: pdf.getCreator() ?? undefined,
    producer: pdf.getProducer() ?? undefined,
    creationDate: pdf.getCreationDate()?.toISOString(),
    modificationDate: pdf.getModificationDate()?.toISOString(),
    keywords: pdf.getKeywords()?.split(',').map((item) => item.trim()).filter(Boolean),
  };

  const form = pdf.getForm();
  const fields = form.getFields().map(readFormField);

  return {
    id: documentId,
    name: file.name,
    pageCount: pdf.getPageCount(),
    metadata,
    hasForms: fields.length > 0,
    formFields: fields,
    pages,
  };
}

/**
 * Extracts per-page text for full-text search. Always resolves: any failure or
 * timeout yields an empty array so the document still imports (just without
 * searchable text). Bounded by page count, per-page length, and a wall-clock
 * timeout to keep large/scanned PDFs from hanging the worker.
 */
async function extractPageTextContent(bytes: Uint8Array, pageCount: number): Promise<string[]> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      runTextExtraction(bytes.slice(), pageCount),
      new Promise<string[]>((_resolve, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Text extraction timed out.')),
          TEXT_EXTRACTION_TIMEOUT_MS,
        );
      }),
    ]);
  } catch {
    // Non-fatal: the import succeeds without searchable text.
    return [];
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

async function runTextExtraction(bytes: Uint8Array, pageCount: number): Promise<string[]> {
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableWorker: true,
    stopAtErrors: false,
  } as Parameters<typeof pdfjs.getDocument>[0] & { disableWorker: boolean });

  const pdf = await loadingTask.promise;

  try {
    const textContent: string[] = [];
    const limit = Math.min(pdf.numPages, pageCount, MAX_TEXT_EXTRACTION_PAGES);

    for (let index = 1; index <= limit; index += 1) {
      const page = await pdf.getPage(index);
      try {
        const content = await page.getTextContent();
        textContent.push(
          content.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ')
            .trim()
            .slice(0, MAX_TEXT_CHARS_PER_PAGE),
        );
      } catch {
        // Skip pages whose text cannot be read; search just won't match them.
        textContent.push('');
      } finally {
        page.cleanup();
      }
    }

    return textContent;
  } finally {
    await pdf.destroy();
    loadingTask.destroy();
  }
}

function readFormField(field: PDFField): FormFieldModel {
  if (field instanceof PDFTextField) {
    return buildField(field.getName(), 'text', field.getText() ?? '', undefined, field.isReadOnly(), field.isRequired());
  }

  if (field instanceof PDFCheckBox) {
    return buildField(field.getName(), 'checkbox', field.isChecked(), undefined, field.isReadOnly(), field.isRequired());
  }

  if (field instanceof PDFDropdown) {
    return buildField(field.getName(), 'dropdown', field.getSelected().at(0) ?? '', field.getOptions(), field.isReadOnly(), field.isRequired());
  }

  if (field instanceof PDFRadioGroup) {
    return buildField(field.getName(), 'radio', field.getSelected() ?? '', field.getOptions(), field.isReadOnly(), field.isRequired());
  }

  if (field instanceof PDFOptionList) {
    return buildField(field.getName(), 'option-list', field.getSelected(), field.getOptions(), field.isReadOnly(), field.isRequired());
  }

  return buildField(field.getName(), 'unsupported', null, undefined, field.isReadOnly(), field.isRequired());
}

function buildField(
  name: string,
  kind: FormFieldModel['kind'],
  value: FormFieldModel['value'],
  options: string[] | undefined,
  readOnly: boolean,
  required: boolean,
): FormFieldModel {
  return {
    name,
    label: name,
    kind,
    value,
    options,
    readOnly,
    required,
  };
}
