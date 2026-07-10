import type {
  ErrorModel,
  ExportFileResult,
  ExportMode,
  ExportPageDescriptor,
  ExportProfile,
  FormFieldValue,
  IngestDocumentPayload,
} from '@/domain/types';

export interface IngestWorkerRequest {
  type: 'ingest';
  requestId: string;
  documentId: string;
  file: File;
}

export interface IngestWorkerSuccess {
  type: 'ingest:success';
  requestId: string;
  payload: IngestDocumentPayload;
}

export interface IngestWorkerError {
  type: 'ingest:error';
  requestId: string;
  error: ErrorModel;
}

export type IngestWorkerMessage = IngestWorkerRequest;
export type IngestWorkerResponse = IngestWorkerSuccess | IngestWorkerError;

export interface ExportWorkerDocument {
  documentId: string;
  sourceFile: File;
  formValues: Record<string, FormFieldValue>;
  flatten: boolean;
  name: string;
}

export interface ExportWorkerRequest {
  type: 'export';
  requestId: string;
  mode: ExportMode;
  baseFileName: string;
  documents: ExportWorkerDocument[];
  pages: ExportPageDescriptor[];
  exportProfile: ExportProfile;
}

export interface ExportWorkerProgress {
  type: 'export:progress';
  requestId: string;
  progress: number;
  message: string;
}

export interface ExportWorkerSuccess {
  type: 'export:success';
  requestId: string;
  files: ExportFileResult[];
}

export interface ExportWorkerError {
  type: 'export:error';
  requestId: string;
  error: ErrorModel;
}

export type ExportWorkerMessage = ExportWorkerRequest;
export type ExportWorkerResponse = ExportWorkerProgress | ExportWorkerSuccess | ExportWorkerError;

export interface RenderWorkerRequest {
  type: 'render';
  requestId: string;
  documentId: string;
  pageId: string;
  url: string;
  pageIndex: number;
  maxWidth: number;
}

export interface RenderWorkerCancelRequest {
  type: 'render:cancel';
  requestId: string;
}

export interface RenderWorkerReleaseDocumentRequest {
  type: 'render:release-document';
  documentId: string;
}

export interface RenderWorkerResetRequest {
  type: 'render:reset';
}

export interface RenderWorkerSuccess {
  type: 'render:success';
  requestId: string;
  pageId: string;
  blob: Blob;
  width: number;
  height: number;
}

export interface RenderWorkerError {
  type: 'render:error';
  requestId: string;
  pageId: string;
  error: ErrorModel;
}

export interface RenderWorkerUnsupported {
  type: 'render:unsupported';
  requestId: string;
  error: ErrorModel;
}

export type RenderWorkerMessage =
  | RenderWorkerRequest
  | RenderWorkerCancelRequest
  | RenderWorkerReleaseDocumentRequest
  | RenderWorkerResetRequest;

export type RenderWorkerResponse =
  | RenderWorkerSuccess
  | RenderWorkerError
  | RenderWorkerUnsupported;
