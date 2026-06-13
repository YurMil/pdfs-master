import {
  degrees,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
} from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import { ErrorCode, PdfMasterError } from '@/domain/errors';
import type {
  DeleteInput,
  ExportFileResult,
  ExportProfile,
  FillFormInput,
  FlattenFormInput,
  FormFieldValue,
  MergeInput,
  PdfWriter,
  ReorderInput,
  RotateInput,
} from '@/domain/types';
import { buildPdfFileName, sanitizeBaseName, stripPdfExtension } from '@/utils/file';

export class PdfLibWriter implements PdfWriter {
  async mergeDocuments(input: MergeInput & { exportProfile?: ExportProfile }): Promise<Uint8Array> {
    return this.buildMergedPdf(input.pages, input.documents, input.exportProfile);
  }

  async extractPages(input: MergeInput & { pageIds: string[]; exportProfile?: ExportProfile }): Promise<Uint8Array> {
    const selected = new Set(input.pageIds);
    return this.buildMergedPdf(
      input.pages.filter((page) => selected.has(page.pageId)),
      input.documents,
      input.exportProfile,
    );
  }

  async deletePages(input: DeleteInput): Promise<Uint8Array> {
    const removed = new Set(input.pageIds);
    return this.buildMergedPdf(
      input.pages.filter((page) => !removed.has(page.pageId)),
      input.documents,
    );
  }

  async rotatePages(input: RotateInput): Promise<Uint8Array> {
    return this.buildMergedPdf(input.pages, input.documents);
  }

  async reorderPages(input: ReorderInput): Promise<Uint8Array> {
    return this.buildMergedPdf(input.pages, input.documents);
  }

  async fillForm(input: FillFormInput): Promise<Uint8Array> {
    const prepared = await this.prepareSourceDocument(input.sourceFile, input.values, false);
    return this.saveWithProfile(prepared, 'lossless');
  }

  async flattenForm(input: FlattenFormInput): Promise<Uint8Array> {
    const prepared = await this.prepareSourceDocument(input.sourceFile, input.values, true);
    return this.saveWithProfile(prepared, 'lossless');
  }

  async splitDocument(input: {
    documentId: string;
    sourceFile: File;
    rangeGroups: number[][];
    formValues: Record<string, FormFieldValue>;
    flatten: boolean;
    baseFileName: string;
    exportProfile?: ExportProfile;
  }): Promise<ExportFileResult[]> {
    const preparedSource = await this.prepareSourceDocument(input.sourceFile, input.formValues, input.flatten);
    const cleanBaseName = sanitizeBaseName(stripPdfExtension(input.baseFileName || input.sourceFile.name));
    const profile = input.exportProfile ?? 'lossless';
    const outputs: ExportFileResult[] = [];

    for (const [index, rangeGroup] of input.rangeGroups.entries()) {
      const pdf = await PDFDocument.create();
      const copiedPages = await pdf.copyPages(preparedSource, rangeGroup);
      copiedPages.forEach((page) => pdf.addPage(page));
      outputs.push({
        name: buildPdfFileName(cleanBaseName, `part-${index + 1}`),
        bytes: await this.saveWithProfile(pdf, profile),
        mimeType: 'application/pdf',
      });
    }

    return outputs;
  }

  private async saveWithProfile(pdf: PDFDocument, profile: ExportProfile): Promise<Uint8Array> {
    if (profile === 'low-size') {
      return pdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });
    }
    return pdf.save();
  }

  private async buildMergedPdf(
    pages: MergeInput['pages'],
    documents: MergeInput['documents'],
    exportProfile?: ExportProfile,
  ): Promise<Uint8Array> {
    if (!pages.length) {
      throw new PdfMasterError(ErrorCode.ExportFailed, 'There are no pages available for export.');
    }

    const output = await PDFDocument.create();
    const preparedDocuments = await this.prepareDocuments(documents);
    const copiedPagesByDocument = new Map<string, Map<number, PDFPage>>();

    for (const document of documents) {
      const prepared = preparedDocuments.get(document.documentId);
      if (!prepared) {
        continue;
      }

      const requestedIndexes = [...new Set(pages.filter((page) => page.documentId === document.documentId).map((page) => page.sourcePageIndex))];
      const copiedPages = await output.copyPages(prepared, requestedIndexes);
      copiedPagesByDocument.set(
        document.documentId,
        new Map(requestedIndexes.map((pageIndex, index) => [pageIndex, copiedPages[index]])),
      );
    }

    for (const page of pages) {
      const copiedPage = copiedPagesByDocument.get(page.documentId)?.get(page.sourcePageIndex);
      if (!copiedPage) {
        continue;
      }
      copiedPage.setRotation(degrees(page.rotation));
      output.addPage(copiedPage);
    }

    const profile = exportProfile ?? 'lossless';
    return this.saveWithProfile(output, profile);
  }

  private async prepareDocuments(documents: MergeInput['documents']): Promise<Map<string, PDFDocument>> {
    const entries: Array<readonly [string, PDFDocument]> = [];
    for (const document of documents) {
      const prepared = await this.prepareSourceDocument(document.sourceFile, document.formValues, document.flatten);
      entries.push([document.documentId, prepared] as const);
    }

    return new Map(entries);
  }

  private async prepareSourceDocument(
    sourceFile: File,
    values: Record<string, FormFieldValue>,
    flatten: boolean,
  ): Promise<PDFDocument> {
    const pdf = await PDFDocument.load(await sourceFile.arrayBuffer());
    const form = pdf.getForm();
    const fields = form.getFields();

    if (fields.length) {
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      for (const field of fields) {
        const value = values[field.getName()];
        if (value === undefined || value === null) {
          continue;
        }

        if (field instanceof PDFCheckBox) {
          if (value) {
            field.check();
          } else {
            field.uncheck();
          }
          continue;
        }

        if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
          field.clear();
          field.select(Array.isArray(value) ? value : String(value));
          continue;
        }

        if (field instanceof PDFRadioGroup) {
          field.select(String(value));
          continue;
        }

        if (field instanceof PDFTextField && typeof value === 'string') {
          field.setText(value);
        }
      }

      form.updateFieldAppearances(font);
      if (flatten) {
        form.flatten();
      }
    }

    return pdf;
  }
}
