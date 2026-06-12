import { describe, expect, it } from 'vitest';
import { inspectPdfFile } from '@/services/pdfInspection';
import { createFormPdfFile, createPdfFile } from '@/test/pdfFixtures';

describe('pdf inspection integration', () => {
  it('extracts page inventory and AcroForm metadata from a real PDF', async () => {
    const file = await createFormPdfFile();

    const payload = await inspectPdfFile(file, 'doc-form');

    expect(payload.pageCount).toBe(1);
    expect(payload.pages[0]?.id).toBe('doc-form-page-1');
    expect(payload.hasForms).toBe(true);
    expect(payload.formFields.map((field) => field.name)).toEqual(['name', 'approved', 'status']);
  });

  it('extracts text content from PDF pages', async () => {
    const file = await createPdfFile('text-test.pdf', [
      [400, 600], // Page 1 with text "Fixture 1"
      [400, 600], // Page 2 with text "Fixture 2"
    ]);

    const payload = await inspectPdfFile(file, 'doc-text');

    expect(payload.pageCount).toBe(2);
    // Text extraction may vary depending on PDF library, but we should get some text
    expect(payload.pages[0]?.textContent).toBeDefined();
    expect(payload.pages[1]?.textContent).toBeDefined();
    // The fixture draws "Fixture 1" and "Fixture 2" on pages
    expect(payload.pages[0]?.textContent?.toLowerCase()).toContain('fixture');
    expect(payload.pages[1]?.textContent?.toLowerCase()).toContain('fixture');
  });
});
