export type ProcessingStatus = 'idle' | 'queued' | 'running' | 'success' | 'error' | 'canceled';
export type ThumbnailStatus = 'idle' | 'queued' | 'loading' | 'ready' | 'error';
export type ViewMode = 'grid' | 'list';
export type ThumbnailDensity = 'small' | 'medium' | 'large';
export type DropTargetPosition = 'before' | 'after';
export type JobKind = 'ingest' | 'render' | 'export';
export type FormFieldKind = 'text' | 'checkbox' | 'dropdown' | 'radio' | 'option-list' | 'unsupported';
export type FormFieldValue = string | boolean | string[] | null;
export type ExportModeKind = 'workspace' | 'selection' | 'split';
export type PaperFormat = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
export type PaperOrientation = 'auto' | 'portrait' | 'landscape';
export type DocumentKind = 'pdf' | 'image';

export type ExportProfile = 'lossless' | 'low-size';

export interface ImageImportSettings {
  paperFormat: PaperFormat;
  orientation: PaperOrientation;
  /** Symmetric page margin in millimetres applied around the fitted image. */
  marginMm: number;
}

export interface ErrorModel {
  code: string;
  message: string;
  details?: string;
  recoverable?: boolean;
}

export interface NotificationModel {
  id: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description?: string;
}

export interface SourceFileModel {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  type: string;
  file: File;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  keywords?: string[];
}

export interface FormFieldModel {
  name: string;
  label: string;
  kind: FormFieldKind;
  value: FormFieldValue;
  options?: string[];
  readOnly: boolean;
  required: boolean;
}

export interface DocumentEntity {
  id: string;
  sourceFileId: string;
  name: string;
  sourceFile: SourceFileModel;
  pageCount: number;
  pageIds: string[];
  metadata: PdfMetadata;
  hasForms: boolean;
  formFields: FormFieldModel[];
  flattenForms: boolean;
  sourceUrl: string;
  status: ProcessingStatus;
  errors: ErrorModel[];
  /** Whether this document was created from an image file. */
  kind: DocumentKind;
  /** Original image file kept for re-conversion when format/orientation changes. */
  originalImageFile?: File;
  /** Active image fit settings for image-derived documents. */
  imageFitSettings?: ImageImportSettings;
}

export interface PageEntity {
  id: string;
  documentId: string;
  sourcePageIndex: number;
  width: number;
  height: number;
  rotation: number;
  label: string;
}

export interface SelectionState {
  selectedPageIds: string[];
  selectedDocumentIds: string[];
  anchorPageId?: string;
}

export interface JobState {
  status: ProcessingStatus;
  progress: number;
  message: string;
  error?: ErrorModel;
}

export interface ThumbnailState {
  status: ThumbnailStatus;
  url?: string;
  width?: number;
  height?: number;
  error?: ErrorModel;
}

export interface ExportPageDescriptor {
  pageId: string;
  documentId: string;
  sourcePageIndex: number;
  rotation: number;
  label: string;
}

export interface ExportFileResult {
  name: string;
  bytes: Uint8Array;
  mimeType: 'application/pdf';
}

export interface ExportSelectionMode {
  kind: 'selection';
  pageIds: string[];
}

export interface ExportWorkspaceMode {
  kind: 'workspace';
}

export interface ExportSplitMode {
  kind: 'split';
  documentId: string;
  rangeGroups: number[][];
}

export type ExportMode = ExportWorkspaceMode | ExportSelectionMode | ExportSplitMode;

export interface UiState {
  viewMode: ViewMode;
  activeDocumentId?: string;
  exportDialogOpen: boolean;
  exportMode: ExportMode;
  exportFileName: string;
  splitRangeInput: string;
  imageImportSettings: ImageImportSettings;
  exportProfile: ExportProfile;
}

export interface WorkspaceSnapshot {
  documents: Record<string, DocumentEntity>;
  pages: Record<string, PageEntity>;
  documentOrder: string[];
  pageOrder: string[];
  pageOrderByDocument: Record<string, string[]>;
}

export interface PdfAppState extends WorkspaceSnapshot {
  selectedPageIds: string[];
  selectedDocumentIds: string[];
  anchorPageId?: string;
  thumbnails: Record<string, ThumbnailState>;
  jobs: Record<JobKind, JobState>;
  ui: UiState;
  notifications: NotificationModel[];
}

export interface IngestPagePayload {
  id: string;
  sourcePageIndex: number;
  width: number;
  height: number;
  label: string;
}

export interface IngestDocumentPayload {
  id: string;
  name: string;
  pageCount: number;
  metadata: PdfMetadata;
  hasForms: boolean;
  formFields: FormFieldModel[];
  pages: IngestPagePayload[];
}

export interface PdfReaderCapabilities {
  supportsTextExtraction: boolean;
  supportsOffscreenRendering: boolean;
}

export interface PdfReader {
  loadDocument(documentId: string, sourceFile: File, sourceUrl?: string): Promise<{ documentId: string; pageCount: number }>;
  renderPageThumbnail(input: {
    documentId: string;
    sourceFile: File;
    sourceUrl?: string;
    pageIndex: number;
    maxWidth: number;
    signal?: AbortSignal;
  }): Promise<Blob>;
  getMetadata(documentId: string): Promise<PdfMetadata>;
  getCapabilities(): PdfReaderCapabilities;
  destroy(documentId: string): Promise<void>;
}

export interface MergeInput {
  documents: Array<{
    documentId: string;
    sourceFile: File;
    formValues: Record<string, FormFieldValue>;
    flatten: boolean;
  }>;
  pages: ExportPageDescriptor[];
}

export interface ExtractInput extends MergeInput {
  pageIds: string[];
}

export interface DeleteInput extends MergeInput {
  pageIds: string[];
}

export interface RotateInput extends MergeInput {
  pageIds: string[];
}

export type ReorderInput = MergeInput;

export interface FillFormInput {
  sourceFile: File;
  values: Record<string, FormFieldValue>;
}

export type FlattenFormInput = FillFormInput;

export interface PdfWriter {
  mergeDocuments(input: MergeInput & { exportProfile?: ExportProfile }): Promise<Uint8Array>;
  extractPages(input: ExtractInput & { exportProfile?: ExportProfile }): Promise<Uint8Array>;
  deletePages(input: DeleteInput): Promise<Uint8Array>;
  rotatePages(input: RotateInput): Promise<Uint8Array>;
  reorderPages(input: ReorderInput): Promise<Uint8Array>;
  fillForm(input: FillFormInput): Promise<Uint8Array>;
  flattenForm(input: FlattenFormInput): Promise<Uint8Array>;
  splitDocument(input: {
    documentId: string;
    sourceFile: File;
    rangeGroups: number[][];
    formValues: Record<string, FormFieldValue>;
    flatten: boolean;
    baseFileName: string;
    exportProfile?: ExportProfile;
  }): Promise<ExportFileResult[]>;
}
