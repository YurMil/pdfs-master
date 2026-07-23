import { beforeAll, describe, expect, it } from 'vitest';
import { assertPdfSignature, parseRangeGroups, validatePdfFile } from '@/domain/validation';

describe('validation helpers', () => {
  it('parses multiple split groups and preserves requested order', () => {
    expect(parseRangeGroups('1-3,5;6-4', 6)).toEqual([
      [0, 1, 2, 4],
      [5, 4, 3],
    ]);
  });

  it('rejects non-pdf files', () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    expect(() => validatePdfFile(file)).toThrow(/not a PDF/i);
  });

  describe('assertPdfSignature', () => {
    // The test DOM has no Blob.arrayBuffer; polyfill it so the real signature
    // logic is exercised rather than the feature-detection escape hatch.
    beforeAll(() => {
      if (typeof Blob.prototype.arrayBuffer !== 'function') {
        Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
          return new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(this);
          });
        };
      }
    });

    it('accepts a file whose contents start with the PDF signature', async () => {
      const file = new File(['%PDF-1.7\n...'], 'real.pdf', { type: 'application/pdf' });
      await expect(assertPdfSignature(file)).resolves.toBeUndefined();
    });

    it('rejects a non-PDF disguised by its extension and MIME type', async () => {
      // The exact case the synchronous checks let through: correct name and
      // MIME type, contents of something else entirely.
      const file = new File(['<!doctype html><h1>404</h1>'], 'invoice.pdf', {
        type: 'application/pdf',
      });
      await expect(assertPdfSignature(file)).rejects.toThrow(/not a PDF/i);
    });

    it('rejects an empty file', async () => {
      const file = new File([], 'empty.pdf', { type: 'application/pdf' });
      await expect(assertPdfSignature(file)).rejects.toThrow(/not a PDF/i);
    });
  });
});
