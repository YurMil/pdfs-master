import { PDFDocument } from 'pdf-lib';
import type { ImageImportSettings } from '@/domain/types';
import {
  DEFAULT_IMAGE_IMPORT_SETTINGS,
  fitImageRect,
  getPageSizePt,
} from '@/domain/paperFormat';

/** MIME types that pdf-lib can embed natively. */
const NATIVE_JPEG = new Set(['image/jpeg', 'image/jpg']);
const NATIVE_PNG = new Set(['image/png']);

/** All image MIME types we accept for import. */
export const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/gif',
  'image/tiff',
  'image/svg+xml',
]);

/**
 * Accept string for file inputs that includes both PDF and image types.
 */
export const ACCEPT_IMPORT_TYPES =
  'application/pdf,image/jpeg,image/png,image/webp,image/bmp,image/gif,image/tiff,image/svg+xml';

export interface ImageToPdfResult {
  pdfFile: File;
  /** Final PDF page width in PDF points. */
  pageWidth: number;
  /** Final PDF page height in PDF points. */
  pageHeight: number;
}

/**
 * Convert an image File into a single-page PDF File using pdf-lib.
 *
 * The image is fitted into a paper-sized page (A0–A4) defined by `settings`,
 * preserving its aspect ratio and centering it on the page. The original
 * resolution is left untouched; only the surrounding page changes.
 */
export async function convertImageToPdf(
  imageFile: File,
  settings: ImageImportSettings = DEFAULT_IMAGE_IMPORT_SETTINGS,
): Promise<ImageToPdfResult> {
  let imageBytes: Uint8Array;
  let mimeType = imageFile.type.toLowerCase();

  // For non-native formats, convert through canvas → PNG
  if (!NATIVE_JPEG.has(mimeType) && !NATIVE_PNG.has(mimeType)) {
    const converted = await convertToCanvasPng(imageFile);
    imageBytes = converted.bytes;
    mimeType = 'image/png';
  } else {
    imageBytes = new Uint8Array(await imageFile.arrayBuffer());
  }

  const pdfDoc = await PDFDocument.create();

  let image;
  if (NATIVE_JPEG.has(mimeType)) {
    image = await pdfDoc.embedJpg(imageBytes);
  } else {
    image = await pdfDoc.embedPng(imageBytes);
  }

  const { width: imageWidth, height: imageHeight } = image.scale(1);
  const pageSize = getPageSizePt(
    settings.paperFormat,
    settings.orientation,
    imageWidth,
    imageHeight,
  );
  const rect = fitImageRect(
    pageSize.width,
    pageSize.height,
    imageWidth,
    imageHeight,
    settings.marginMm,
  );

  const page = pdfDoc.addPage([pageSize.width, pageSize.height]);
  page.drawImage(image, rect);

  const pdfBytes = await pdfDoc.save();
  const baseName = imageFile.name.replace(/\.[^.]+$/, '');
  const pdfFile = new File([Uint8Array.from(pdfBytes)], `${baseName}.pdf`, {
    type: 'application/pdf',
    lastModified: imageFile.lastModified,
  });

  return { pdfFile, pageWidth: pageSize.width, pageHeight: pageSize.height };
}

/**
 * Converts any image to PNG bytes by drawing it on an offscreen canvas.
 */
async function convertToCanvasPng(file: File): Promise<{ bytes: Uint8Array }> {
  const blobUrl = URL.createObjectURL(file);

  try {
    const img = await loadImage(blobUrl);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas 2D context for image conversion.');
    }

    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Canvas toBlob returned null.'))),
        'image/png',
      );
    });

    const buffer = await blob.arrayBuffer();
    return { bytes: new Uint8Array(buffer) };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (_event, _source, _lineno, _colno, error) =>
      reject(error ?? new Error('Failed to load image for conversion.'));
    img.src = src;
  });
}
