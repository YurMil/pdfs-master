import { create } from 'zustand';
import {
  addDocumentToWorkspace,
  addDocumentToWorkspaceAtPosition,
  deletePagesFromWorkspace,
  emptyWorkspace,
  removeDocumentFromWorkspace,
  reorderDocumentsInWorkspace,
  reorderPagesInWorkspace,
  rotatePagesInWorkspace,
  toggleDocumentFlattening,
  updateDocumentFormValue,
} from '@/domain/commands';
import type {
  DropTargetPosition,
  ExportMode,
  ExportProfile,
  FormFieldValue,
  ImageImportSettings,
  JobKind,
  JobState,
  NotificationModel,
  PdfAppState,
  ThumbnailState,
  ViewMode,
} from '@/domain/types';
import type { ImportedDocument } from '@/services/importPdf';
import { clearSelection, computeSelection, selectAllInDocument, sortPageIdsByWorkspace } from '@/services/selectionService';
import { DEFAULT_IMAGE_IMPORT_SETTINGS } from '@/domain/paperFormat';
import { createId } from '@/utils/ids';
import { makeObjectUrl, revokeObjectUrl } from '@/utils/objectUrl';

interface PdfStoreActions {
  importDocuments: (documents: ImportedDocument[]) => void;
  importDocumentsAtPosition: (documents: ImportedDocument[], targetPageId: string, position: DropTargetPosition) => void;
  clearWorkspace: () => void;
  removeDocument: (documentId: string) => void;
  reorderDocuments: (draggedDocumentId: string, targetDocumentId: string, position: 'before' | 'after') => void;
  setViewMode: (viewMode: ViewMode) => void;
  setActiveDocument: (documentId?: string) => void;
  setJob: (kind: JobKind, job: Partial<JobState>) => void;
  selectPage: (pageId: string, gesture?: { additive?: boolean; range?: boolean }) => void;
  selectAllDocumentPages: (documentId: string) => void;
  clearSelection: () => void;
  reorderPages: (draggedPageId: string, targetPageId: string, position: 'before' | 'after') => void;
  rotateSelectedPages: (degrees?: number) => void;
  deleteSelectedPages: () => void;
  openExportDialog: (mode?: ExportMode) => void;
  closeExportDialog: () => void;
  setExportMode: (mode: ExportMode) => void;
  setExportFileName: (name: string) => void;
  setSplitRangeInput: (value: string) => void;
  setThumbnailState: (pageId: string, nextState: ThumbnailState) => void;
  clearThumbnail: (pageId: string) => void;
  updateFormField: (documentId: string, fieldName: string, value: FormFieldValue) => void;
  setDocumentFlattening: (documentId: string, flatten: boolean) => void;
  pushNotification: (notification: Omit<NotificationModel, 'id'>) => void;
  dismissNotification: (notificationId: string) => void;
  setImageImportSettings: (settings: Partial<ImageImportSettings>) => void;
  applyImageDocumentReimport: (documentId: string, replacement: ImportedDocument) => void;
}

export type PdfStore = PdfAppState & PdfStoreActions;

const idleJob: JobState = {
  status: 'idle',
  progress: 0,
  message: '',
};

function createInitialState(): PdfAppState {
  return {
    ...emptyWorkspace(),
    selectedPageIds: [],
    selectedDocumentIds: [],
    anchorPageId: undefined,
    thumbnails: {},
    jobs: {
      ingest: { ...idleJob },
      render: { ...idleJob },
      export: { ...idleJob },
    },
    ui: {
      viewMode: 'grid',
      activeDocumentId: undefined,
      exportDialogOpen: false,
      exportMode: { kind: 'workspace' },
      exportFileName: 'pdf-master-export',
      splitRangeInput: '1-2;3-4',
      imageImportSettings: { ...DEFAULT_IMAGE_IMPORT_SETTINGS },
      exportProfile: 'lossless',
    },
    notifications: [],
  };
}

export const usePdfStore = create<PdfStore>((set, get) => ({
  ...createInitialState(),

  importDocuments: (documents) => {
    set((state) => {
      let workspace = {
        documents: state.documents,
        pages: state.pages,
        documentOrder: state.documentOrder,
        pageOrder: state.pageOrder,
        pageOrderByDocument: state.pageOrderByDocument,
      };

      for (const entry of documents) {
        workspace = addDocumentToWorkspace(workspace, entry.sourceFile, entry.payload, entry.sourceUrl, {
          originalImageFile: entry.originalImageFile,
          imageFitSettings: entry.imageFitSettings,
        });
      }

      const nextActiveDocument = state.ui.activeDocumentId ?? documents[0]?.payload.id;
      return {
        ...state,
        ...workspace,
        ui: {
          ...state.ui,
          activeDocumentId: nextActiveDocument,
          exportFileName:
            documents.length === 1
              ? documents[0].sourceFile.name.replace(/\.pdf$/i, '')
              : state.ui.exportFileName,
        },
      };
    });
  },

  importDocumentsAtPosition: (documents, targetPageId, position) => {
    set((state) => {
      let workspace = {
        documents: state.documents,
        pages: state.pages,
        documentOrder: state.documentOrder,
        pageOrder: state.pageOrder,
        pageOrderByDocument: state.pageOrderByDocument,
      };

      for (const entry of documents) {
        workspace = addDocumentToWorkspaceAtPosition(
          workspace,
          entry.sourceFile,
          entry.payload,
          entry.sourceUrl,
          targetPageId,
          position,
          {
            originalImageFile: entry.originalImageFile,
            imageFitSettings: entry.imageFitSettings,
          },
        );
      }

      const nextActiveDocument = state.ui.activeDocumentId ?? documents[0]?.payload.id;
      return {
        ...state,
        ...workspace,
        ui: {
          ...state.ui,
          activeDocumentId: nextActiveDocument,
        },
      };
    });
  },

  clearWorkspace: () => {
    const state = get();
    for (const document of Object.values(state.documents)) {
      revokeObjectUrl(document.sourceUrl);
    }
    for (const thumbnail of Object.values(state.thumbnails)) {
      revokeObjectUrl(thumbnail.url);
    }
    set(() => createInitialState());
  },

  removeDocument: (documentId) => {
    set((state) => {
      const document = state.documents[documentId];
      if (!document) {
        return state;
      }

      revokeObjectUrl(document.sourceUrl);
      for (const pageId of state.pageOrderByDocument[documentId] ?? []) {
        revokeObjectUrl(state.thumbnails[pageId]?.url);
      }

      const workspace = removeDocumentFromWorkspace(state, documentId);
      const remainingSelection = state.selectedPageIds.filter((pageId) => workspace.pages[pageId]);
      return {
        ...state,
        ...workspace,
        selectedPageIds: remainingSelection,
        selectedDocumentIds: deriveSelectedDocumentIds(remainingSelection, workspace.pages),
        anchorPageId: remainingSelection[0],
        ui: {
          ...state.ui,
          activeDocumentId:
            state.ui.activeDocumentId === documentId ? workspace.documentOrder[0] : state.ui.activeDocumentId,
        },
      };
    });
  },

  reorderDocuments: (draggedDocumentId, targetDocumentId, position) => {
    set((state) => {
      const workspace = reorderDocumentsInWorkspace(state, draggedDocumentId, targetDocumentId, position);
      return {
        ...state,
        ...workspace,
      };
    });
  },

  setViewMode: (viewMode) => {
    set((state) => ({
      ui: { ...state.ui, viewMode },
    }));
  },

  setActiveDocument: (documentId) => {
    set((state) => ({
      ui: { ...state.ui, activeDocumentId: documentId },
    }));
  },

  setJob: (kind, job) => {
    set((state) => ({
      jobs: {
        ...state.jobs,
        [kind]: {
          ...state.jobs[kind],
          ...job,
        },
      },
    }));
  },

  selectPage: (pageId, gesture) => {
    set((state) => {
      const nextSelection = computeSelection({
        pageOrder: state.pageOrder,
        currentSelection: {
          selectedPageIds: state.selectedPageIds,
          selectedDocumentIds: state.selectedDocumentIds,
          anchorPageId: state.anchorPageId,
        },
        targetPageId: pageId,
        additive: Boolean(gesture?.additive),
        range: Boolean(gesture?.range),
      });

      return {
        selectedPageIds: nextSelection.selectedPageIds,
        selectedDocumentIds: deriveSelectedDocumentIds(nextSelection.selectedPageIds, state.pages),
        anchorPageId: nextSelection.anchorPageId,
        ui: {
          ...state.ui,
          activeDocumentId: state.pages[pageId]?.documentId ?? state.ui.activeDocumentId,
        },
      };
    });
  },

  selectAllDocumentPages: (documentId) => {
    set((state) => {
      const pageIds = state.pageOrderByDocument[documentId] ?? [];
      const selection = selectAllInDocument(pageIds);
      return {
        selectedPageIds: selection.selectedPageIds,
        selectedDocumentIds: [documentId],
        anchorPageId: selection.anchorPageId,
        ui: {
          ...state.ui,
          activeDocumentId: documentId,
        },
      };
    });
  },

  clearSelection: () => {
    const selection = clearSelection();
    set({
      selectedPageIds: selection.selectedPageIds,
      selectedDocumentIds: selection.selectedDocumentIds,
      anchorPageId: selection.anchorPageId,
    });
  },

  reorderPages: (draggedPageId, targetPageId, position) => {
    set((state) => {
      const movingPageIds = state.selectedPageIds.includes(draggedPageId)
        ? sortPageIdsByWorkspace(state.selectedPageIds, state.pageOrder)
        : [draggedPageId];
      const workspace = reorderPagesInWorkspace(state, movingPageIds, targetPageId, position);
      return {
        ...state,
        ...workspace,
      };
    });
  },

  rotateSelectedPages: (degrees = 90) => {
    set((state) => {
      if (!state.selectedPageIds.length) {
        return state;
      }
      const workspace = rotatePagesInWorkspace(state, state.selectedPageIds, degrees);
      return {
        ...state,
        ...workspace,
      };
    });
  },

  deleteSelectedPages: () => {
    set((state) => {
      if (!state.selectedPageIds.length) {
        return state;
      }

      for (const pageId of state.selectedPageIds) {
        revokeObjectUrl(state.thumbnails[pageId]?.url);
      }

      const workspace = deletePagesFromWorkspace(state, state.selectedPageIds);
      return {
        ...state,
        ...workspace,
        selectedPageIds: [],
        selectedDocumentIds: [],
        anchorPageId: undefined,
        ui: {
          ...state.ui,
          activeDocumentId:
            state.ui.activeDocumentId && workspace.documents[state.ui.activeDocumentId]
              ? state.ui.activeDocumentId
              : workspace.documentOrder[0],
        },
      };
    });
  },

  openExportDialog: (mode) => {
    set((state) => ({
      ui: {
        ...state.ui,
        exportDialogOpen: true,
        exportMode: mode ?? state.ui.exportMode,
      },
    }));
  },

  closeExportDialog: () => {
    set((state) => ({
      ui: {
        ...state.ui,
        exportDialogOpen: false,
      },
    }));
  },

  setExportMode: (mode) => {
    set((state) => ({
      ui: { ...state.ui, exportMode: mode },
    }));
  },

  setExportFileName: (name) => {
    set((state) => ({
      ui: { ...state.ui, exportFileName: name },
    }));
  },

  setSplitRangeInput: (value) => {
    set((state) => ({
      ui: { ...state.ui, splitRangeInput: value },
    }));
  },

  setExportProfile: (profile: ExportProfile) => {
    set((state) => ({
      ui: { ...state.ui, exportProfile: profile },
    }));
  },

  setThumbnailState: (pageId, nextState) => {
    set((state) => ({
      thumbnails: {
        ...state.thumbnails,
        [pageId]: {
          ...state.thumbnails[pageId],
          ...nextState,
        },
      },
    }));
  },

  clearThumbnail: (pageId) => {
    const thumbnail = get().thumbnails[pageId];
    revokeObjectUrl(thumbnail?.url);
    set((state) => {
      const next = { ...state.thumbnails };
      delete next[pageId];
      return { thumbnails: next };
    });
  },

  updateFormField: (documentId, fieldName, value) => {
    set((state) => {
      const workspace = updateDocumentFormValue(state, documentId, fieldName, value);
      return { ...state, ...workspace };
    });
  },

  setDocumentFlattening: (documentId, flatten) => {
    set((state) => {
      const workspace = toggleDocumentFlattening(state, documentId, flatten);
      return { ...state, ...workspace };
    });
  },

  pushNotification: (notification) => {
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          id: createId('note'),
          ...notification,
        },
      ],
    }));
  },

  dismissNotification: (notificationId) => {
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== notificationId),
    }));
  },

  setImageImportSettings: (settings) => {
    set((state) => ({
      ui: {
        ...state.ui,
        imageImportSettings: { ...state.ui.imageImportSettings, ...settings },
      },
    }));
  },

  applyImageDocumentReimport: (documentId, replacement) => {
    set((state) => {
      const existing = state.documents[documentId];
      if (!existing) {
        return state;
      }

      // Revoke the previous source URL and any old thumbnails for this doc.
      revokeObjectUrl(existing.sourceUrl);
      const oldPageIds = state.pageOrderByDocument[documentId] ?? [];
      const thumbnails = { ...state.thumbnails };
      for (const pageId of oldPageIds) {
        revokeObjectUrl(thumbnails[pageId]?.url);
        delete thumbnails[pageId];
      }

      // Drop the old pages while preserving the document's slot in pageOrder.
      const oldPageIdSet = new Set(oldPageIds);
      const firstOldIndex = state.pageOrder.findIndex((id) => oldPageIdSet.has(id));
      const remainingPages = { ...state.pages };
      for (const pageId of oldPageIdSet) {
        delete remainingPages[pageId];
      }
      const remainingOrder = state.pageOrder.filter((id) => !oldPageIdSet.has(id));

      // Build the replacement document/page records (re-using the existing document id).
      const newPages: Record<string, typeof state.pages[string]> = {};
      const newPageIds: string[] = [];
      for (const page of replacement.payload.pages) {
        newPages[page.id] = {
          id: page.id,
          documentId,
          sourcePageIndex: page.sourcePageIndex,
          width: page.width,
          height: page.height,
          rotation: 0,
          label: page.label,
        };
        newPageIds.push(page.id);
      }

      const newSourceUrl = makeObjectUrl(replacement.sourceFile.file);
      const updatedDocument = {
        ...existing,
        sourceFile: replacement.sourceFile,
        sourceFileId: replacement.sourceFile.id,
        sourceUrl: newSourceUrl,
        pageIds: newPageIds,
        pageCount: replacement.payload.pageCount,
        metadata: replacement.payload.metadata,
        hasForms: replacement.payload.hasForms,
        formFields: replacement.payload.formFields,
        kind: 'image' as const,
        originalImageFile: replacement.originalImageFile ?? existing.originalImageFile,
        imageFitSettings: replacement.imageFitSettings ?? existing.imageFitSettings,
      };

      const insertAt = firstOldIndex === -1 ? remainingOrder.length : firstOldIndex;
      const nextPageOrder = [...remainingOrder];
      nextPageOrder.splice(insertAt, 0, ...newPageIds);

      const documents = { ...state.documents, [documentId]: updatedDocument };
      const pages = { ...remainingPages, ...newPages };

      const remainingSelected = state.selectedPageIds.filter((id) => !oldPageIdSet.has(id));
      return {
        ...state,
        documents,
        pages,
        pageOrder: nextPageOrder,
        pageOrderByDocument: {
          ...state.pageOrderByDocument,
          [documentId]: newPageIds,
        },
        thumbnails,
        selectedPageIds: remainingSelected,
        selectedDocumentIds: deriveSelectedDocumentIds(remainingSelected, pages),
        anchorPageId: oldPageIdSet.has(state.anchorPageId ?? '') ? undefined : state.anchorPageId,
      };
    });
  },
}));

function deriveSelectedDocumentIds(selectedPageIds: string[], pages: PdfAppState['pages']): string[] {
  return [...new Set(selectedPageIds.map((pageId) => pages[pageId]?.documentId).filter(Boolean))] as string[];
}
