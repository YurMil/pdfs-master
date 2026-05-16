import type { PaperFormat, PaperOrientation } from '@/domain/types';

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;

const mmToPt = (mm: number): number => (mm / MM_PER_INCH) * PT_PER_INCH;

/** Allowed page margin values (millimetres) for image fitting. */
export const MARGIN_OPTIONS_MM = [0, 5, 10, 15, 20, 30] as const;
export const DEFAULT_MARGIN_MM = 10;
export const MARGIN_LABELS: Record<number, string> = {
  0: 'None',
  5: '5 mm',
  10: '10 mm',
  15: '15 mm',
  20: '20 mm',
  30: '30 mm',
};

export interface PaperDimensions {
  /** Short edge in millimetres. */
  shortMm: number;
  /** Long edge in millimetres. */
  longMm: number;
}

/** ISO 216 A-series dimensions (millimetres, short × long edge). */
export const PAPER_DIMENSIONS: Record<PaperFormat, PaperDimensions> = {
  A0: { shortMm: 841, longMm: 1189 },
  A1: { shortMm: 594, longMm: 841 },
  A2: { shortMm: 420, longMm: 594 },
  A3: { shortMm: 297, longMm: 420 },
  A4: { shortMm: 210, longMm: 297 },
};

export const PAPER_FORMATS: PaperFormat[] = ['A4', 'A3', 'A2', 'A1', 'A0'];
export const PAPER_ORIENTATIONS: PaperOrientation[] = ['auto', 'portrait', 'landscape'];

export const PAPER_FORMAT_LABELS: Record<PaperFormat, string> = {
  A0: 'A0',
  A1: 'A1',
  A2: 'A2',
  A3: 'A3',
  A4: 'A4',
};

export const PAPER_ORIENTATION_LABELS: Record<PaperOrientation, string> = {
  auto: 'Auto',
  portrait: 'Portrait',
  landscape: 'Landscape',
};

export const DEFAULT_IMAGE_IMPORT_SETTINGS = {
  paperFormat: 'A4' as PaperFormat,
  orientation: 'auto' as PaperOrientation,
  marginMm: DEFAULT_MARGIN_MM,
};

/** Resolve final orientation. In `auto`, picks landscape when the source is wider than tall. */
export function resolveOrientation(
  orientation: PaperOrientation,
  imageWidth: number,
  imageHeight: number,
): 'portrait' | 'landscape' {
  if (orientation === 'portrait' || orientation === 'landscape') {
    return orientation;
  }
  return imageWidth > imageHeight ? 'landscape' : 'portrait';
}

/** Returns the page size in PDF points for a given format and resolved orientation. */
export function getPageSizePt(
  format: PaperFormat,
  orientation: PaperOrientation,
  imageWidth: number,
  imageHeight: number,
): { width: number; height: number } {
  const { shortMm, longMm } = PAPER_DIMENSIONS[format];
  const resolved = resolveOrientation(orientation, imageWidth, imageHeight);
  const widthMm = resolved === 'portrait' ? shortMm : longMm;
  const heightMm = resolved === 'portrait' ? longMm : shortMm;
  return { width: mmToPt(widthMm), height: mmToPt(heightMm) };
}

/**
 * Compute the rectangle to draw the image at, fitted inside the page (minus
 * the symmetric margin) while preserving the source aspect ratio. The result
 * is centred on the page.
 */
export function fitImageRect(
  pageWidth: number,
  pageHeight: number,
  imageWidth: number,
  imageHeight: number,
  marginMm: number = 0,
): { x: number; y: number; width: number; height: number } {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { x: 0, y: 0, width: pageWidth, height: pageHeight };
  }

  const marginPt = Math.max(0, mmToPt(marginMm));
  const drawableWidth = Math.max(1, pageWidth - 2 * marginPt);
  const drawableHeight = Math.max(1, pageHeight - 2 * marginPt);

  const scale = Math.min(drawableWidth / imageWidth, drawableHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  return {
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  };
}
