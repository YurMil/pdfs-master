import { ErrorCode, PdfMasterError } from '@/domain/errors';
import { SUPPORTED_IMAGE_TYPES } from '@/services/importImage';

const MAX_FILE_SIZE_BYTES = 128 * 1024 * 1024;
const pdfFilePattern = /\.pdf$/i;
const imageFilePattern = /\.(jpe?g|png|webp|bmp|gif|tiff?|svg)$/i;

/** Check whether a file is a supported image format. */
export function isImageFile(file: File): boolean {
  return SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase()) || imageFilePattern.test(file.name);
}

/** Check whether a file is a PDF. */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.type === '' || pdfFilePattern.test(file.name);
}

/**
 * Validate a file for import — accepts both PDF and supported image formats.
 */
export function validateImportFile(file: File): void {
  const isValid = isPdfFile(file) || isImageFile(file);

  if (!isValid) {
    throw new PdfMasterError(
      ErrorCode.InvalidFileType,
      `${file.name} is not a supported file. Import PDF or image files (JPEG, PNG, WebP, BMP, GIF, TIFF, SVG).`,
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new PdfMasterError(
      ErrorCode.FileTooLarge,
      `${file.name} exceeds the ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB local processing limit.`,
    );
  }
}

export function validatePdfFile(file: File): void {
  const isPdfMime = file.type === 'application/pdf' || file.type === '';
  const matchesExtension = pdfFilePattern.test(file.name);

  if (!isPdfMime && !matchesExtension) {
    throw new PdfMasterError(ErrorCode.InvalidFileType, `${file.name} is not a PDF file.`);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new PdfMasterError(
      ErrorCode.FileTooLarge,
      `${file.name} exceeds the ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB local processing limit.`,
    );
  }
}

const PDF_MAGIC = '%PDF-';

/**
 * Confirms the file really starts with the PDF signature.
 *
 * MIME type and extension are both trivially wrong: `isPdfFile` accepts an
 * empty `type`, so a renamed .docx or an HTML error page saved as .pdf passes
 * every synchronous check and only fails later inside the parser, with an
 * opaque message (cadautoscript.com#100). Reads 5 bytes, so it stays cheap
 * regardless of file size.
 */
export async function assertPdfSignature(file: File): Promise<void> {
  const head = file.slice(0, PDF_MAGIC.length);
  if (typeof head.arrayBuffer !== 'function') {
    // No Blob.arrayBuffer in this environment. This check is defence in depth,
    // not a security boundary, so skip it rather than reject every file.
    return;
  }

  let signature: string;
  try {
    signature = new TextDecoder('latin1').decode(new Uint8Array(await head.arrayBuffer()));
  } catch {
    throw new PdfMasterError(ErrorCode.InvalidPdf, `${file.name} could not be read.`);
  }

  if (signature !== PDF_MAGIC) {
    throw new PdfMasterError(
      ErrorCode.InvalidFileType,
      `${file.name} is not a PDF file — its contents do not start with the PDF signature.`,
    );
  }
}

export function parseRangeGroups(input: string, pageCount: number): number[][] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new PdfMasterError(ErrorCode.ValidationFailed, 'Enter at least one page range to split the document.');
  }

  return trimmed
    .split(';')
    .map((group) => group.trim())
    .filter(Boolean)
    .map((group) => expandRangeGroup(group, pageCount));
}

function expandRangeGroup(group: string, pageCount: number): number[] {
  const selected = new Set<number>();
  const ordered: number[] = [];

  for (const token of group.split(',').map((value) => value.trim()).filter(Boolean)) {
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) {
      throw new PdfMasterError(ErrorCode.ValidationFailed, `Invalid range token: "${token}".`);
    }

    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      throw new PdfMasterError(
        ErrorCode.ValidationFailed,
        `Range "${token}" is outside the active document page count (${pageCount}).`,
      );
    }

    const direction = start <= end ? 1 : -1;
    for (let page = start; direction === 1 ? page <= end : page >= end; page += direction) {
      const pageIndex = page - 1;
      if (!selected.has(pageIndex)) {
        selected.add(pageIndex);
        ordered.push(pageIndex);
      }
    }
  }

  if (!ordered.length) {
    throw new PdfMasterError(ErrorCode.ValidationFailed, 'Each split group must contain at least one page.');
  }

  return ordered;
}
