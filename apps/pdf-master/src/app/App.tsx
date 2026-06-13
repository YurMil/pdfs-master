import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { PdfjsReader } from '@/adapters/reader/pdfjsReader';
import { ConfirmDialog } from '@/components/ConfirmDialog/ConfirmDialog';
import { DocumentList } from '@/components/DocumentList/DocumentList';
import { DropZone } from '@/components/DropZone/DropZone';
import { WorkspaceDropOverlay } from '@/components/WorkspaceDropOverlay/WorkspaceDropOverlay';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { ExportDialog } from '@/components/ExportDialog/ExportDialog';
import { Inspector } from '@/components/Inspector/Inspector';
import { Notifications } from '@/components/Notifications/Notifications';
import { PageGrid } from '@/components/PageGrid/PageGrid';
import { PdfViewerDialog } from '@/components/PdfViewerDialog/PdfViewerDialog';
import { StatusBar } from '@/components/StatusBar/StatusBar';
import { Toolbar } from '@/components/Toolbar/Toolbar';
import { toErrorModel } from '@/domain/errors';
import type {
  DocumentEntity,
  DropTargetPosition,
  ExportMode,
  ImageImportSettings,
  PageEntity,
  ThumbnailDensity,
} from '@/domain/types';
import { downloadExportFiles, resolveSplitMode, runExport } from '@/services/exportPdf';
import { importFiles, reconvertImageDocument } from '@/services/importPdf';
import { ACCEPT_IMPORT_TYPES } from '@/services/importImage';
import { DEFAULT_IMAGE_IMPORT_SETTINGS } from '@/domain/paperFormat';
import { ThumbnailQueue } from '@/services/thumbnailQueue';
import { usePdfStore } from '@/store/pdfStore';
import { makeObjectUrl, revokeObjectUrl } from '@/utils/objectUrl';

interface DeleteDialogState {
  title: string;
  description: string;
}

interface ViewerDialogState {
  open: boolean;
  expanded: boolean;
  loading: boolean;
  progress: number;
  pageNumber: number;
  title: string;
  pdfBlob?: Blob;
  revision?: string;
  error?: string;
  loadingMessage?: string;
}

const thumbnailMaxWidth: Record<ThumbnailDensity, number> = {
  small: 140,
  medium: 180,
  large: 260,
};

export function App() {
  const store = usePdfStore();
  const reader = useMemo(() => new PdfjsReader(), []);
  const thumbnailQueue = useMemo(() => new ThumbnailQueue(reader), [reader]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [thumbnailDensity, setThumbnailDensity] = useState<ThumbnailDensity>('medium');
  const [searchQuery, setSearchQuery] = useState('');
  const [documentsPaneCollapsed, setDocumentsPaneCollapsed] = useState(false);
  const [documentsSheetOpen, setDocumentsSheetOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [imageFormatBusyDocs, setImageFormatBusyDocs] = useState<Set<string>>(() => new Set());
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [viewerDialog, setViewerDialog] = useState<ViewerDialogState>({
    open: false,
    expanded: false,
    loading: false,
    progress: 0,
    pageNumber: 1,
    title: 'Workspace PDF preview',
  });
  const viewerUrlRef = useRef<string | undefined>(undefined);
  const viewerRequestRef = useRef(0);

  const clearViewerCache = useCallback(() => {
    if (viewerUrlRef.current) {
      revokeObjectUrl(viewerUrlRef.current);
      viewerUrlRef.current = undefined;
    }
  }, []);

  const ensureViewerUrl = useCallback((blob?: Blob) => {
    if (!blob) {
      return undefined;
    }

    if (!viewerUrlRef.current) {
      viewerUrlRef.current = makeObjectUrl(blob);
    }

    return viewerUrlRef.current;
  }, []);

  const activeDocument = store.ui.activeDocumentId
    ? store.documents[store.ui.activeDocumentId]
    : store.documents[store.documentOrder[0]];
  const orderedDocuments = useMemo(
    () =>
      store.documentOrder
        .map((documentId) => store.documents[documentId])
        .filter((document): document is DocumentEntity => Boolean(document)),
    [store.documentOrder, store.documents],
  );
  const groupedPages = useMemo(
    () =>
      orderedDocuments.map((document) => {
        const pages = (store.pageOrderByDocument[document.id] ?? [])
            .map((pageId) => store.pages[pageId])
            .filter(Boolean) as PageEntity[];
        return { document, pages };
      }),
    [orderedDocuments, store.pageOrderByDocument, store.pages],
  );

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return groupedPages;
    }

    return groupedPages
      .map(({ document, pages }) => {
        const documentMatch = document.name.toLowerCase().includes(query);
        const matchingPages = documentMatch
          ? pages
          : pages.filter(
              (page) =>
                page.label.toLowerCase().includes(query) ||
                String(page.sourcePageIndex + 1).includes(query),
            );

        if (!matchingPages.length) {
          return null;
        }

        return { document, pages: matchingPages };
      })
      .filter(Boolean) as typeof groupedPages;
  }, [groupedPages, searchQuery]);

  const workspaceRevision = useMemo(
    () =>
      JSON.stringify({
        documentOrder: store.documentOrder,
        pageOrder: store.pageOrder.map((pageId) => {
          const page = store.pages[pageId];
          return page ? [page.id, page.documentId, page.rotation, page.sourcePageIndex] : pageId;
        }),
        forms: orderedDocuments.map((document) => ({
          id: document.id,
          flatten: document.flattenForms,
          fields: document.formFields.map((field) => [field.name, field.value]),
        })),
      }),
    [orderedDocuments, store.documentOrder, store.pageOrder, store.pages],
  );

  useEffect(() => {
    return () => {
      thumbnailQueue.dispose();
      const currentState = usePdfStore.getState();
      void Promise.all(currentState.documentOrder.map((documentId) => reader.destroy(documentId)));
      clearViewerCache();
    };
  }, [clearViewerCache, reader, thumbnailQueue]);

  const importBusy = store.jobs.ingest.status === 'running';
  const hasWorkspace = store.pageOrder.length > 0;
  const selectedCount = store.selectedPageIds.length;

  const handleImport = async (files: File[]) => {
    if (!files.length) {
      return;
    }

    setDocumentsSheetOpen(false);
    setSearchQuery('');
    viewerRequestRef.current += 1;
    clearViewerCache();
    setViewerDialog((current) => ({
      ...current,
      open: false,
      loading: false,
      pdfBlob: undefined,
      revision: undefined,
      error: undefined,
      progress: 0,
    }));
    store.setJob('ingest', { status: 'running', progress: 0, message: 'Importing files...' });
    const result = await importFiles(
      files,
      (completed, total) => {
        usePdfStore.getState().setJob('ingest', {
          status: 'running',
          progress: Math.round((completed / total) * 100),
          message: `Imported ${completed} of ${total} files...`,
        });
      },
      usePdfStore.getState().ui.imageImportSettings,
    );

    if (result.imported.length) {
      usePdfStore.getState().importDocuments(result.imported);
      usePdfStore.getState().pushNotification({
        tone: 'success',
        title: 'Import complete',
        description: `${result.imported.length} file(s) added to the workspace.`,
      });
    }

    for (const issue of result.errors) {
      usePdfStore.getState().pushNotification({
        tone: 'error',
        title: `Could not import ${issue.fileName}`,
        description: issue.error.message,
      });
    }

    usePdfStore.getState().setJob('ingest', {
      status: result.imported.length ? 'success' : 'error',
      progress: 100,
      message: result.imported.length ? 'Import finished.' : 'Import failed.',
    });
  };

  const handleImportAtPosition = async (files: File[], targetPageId: string, position: DropTargetPosition) => {
    if (!files.length) {
      return;
    }

    store.setJob('ingest', { status: 'running', progress: 0, message: 'Importing files at position...' });
    const result = await importFiles(
      files,
      (completed, total) => {
        usePdfStore.getState().setJob('ingest', {
          status: 'running',
          progress: Math.round((completed / total) * 100),
          message: `Imported ${completed} of ${total} files...`,
        });
      },
      usePdfStore.getState().ui.imageImportSettings,
    );

    if (result.imported.length) {
      usePdfStore.getState().importDocumentsAtPosition(result.imported, targetPageId, position);
      usePdfStore.getState().pushNotification({
        tone: 'success',
        title: 'Import complete',
        description: `${result.imported.length} file(s) inserted into the workspace.`,
      });
    }

    for (const issue of result.errors) {
      usePdfStore.getState().pushNotification({
        tone: 'error',
        title: `Could not import ${issue.fileName}`,
        description: issue.error.message,
      });
    }

    usePdfStore.getState().setJob('ingest', {
      status: result.imported.length ? 'success' : 'error',
      progress: 100,
      message: result.imported.length ? 'Import finished.' : 'Import failed.',
    });
  };

  const handleRequestThumbnail = async (page: PageEntity, document: NonNullable<typeof activeDocument>) => {
    const current = usePdfStore.getState().thumbnails[page.id];
    if (current?.status === 'ready' || current?.status === 'loading') {
      return;
    }

    usePdfStore.getState().setThumbnailState(page.id, { status: 'loading' });
    try {
      const url = await thumbnailQueue.requestThumbnail({
        pageId: page.id,
        documentId: document.id,
        sourceFile: document.sourceFile.file,
        sourceUrl: document.sourceUrl,
        pageIndex: page.sourcePageIndex,
        maxWidth: thumbnailMaxWidth[thumbnailDensity],
      });
      usePdfStore.getState().setThumbnailState(page.id, { status: 'ready', url });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      usePdfStore.getState().setThumbnailState(page.id, { status: 'error', error: toErrorModel(error) });
    }
  };

  const handleCancelThumbnail = useCallback((pageId: string) => {
    const current = usePdfStore.getState().thumbnails[pageId];
    if (current?.status === 'loading' || current?.status === 'queued') {
      thumbnailQueue.cancelPage(pageId);
      usePdfStore.getState().setThumbnailState(pageId, { status: 'idle' });
    }
  }, [thumbnailQueue]);

  const handleExport = async () => {
    const snapshot = usePdfStore.getState();
    let mode: ExportMode = snapshot.ui.exportMode;

    if (mode.kind === 'selection') {
      mode = { kind: 'selection', pageIds: snapshot.selectedPageIds };
      if (!mode.pageIds.length) {
        snapshot.pushNotification({ tone: 'warning', title: 'Nothing selected', description: 'Select pages before using extract selection.' });
        return;
      }
    }

    if (mode.kind === 'split') {
      const splitDocument = snapshot.documents[mode.documentId] ?? activeDocument;
      if (!splitDocument) {
        snapshot.pushNotification({ tone: 'warning', title: 'No active document', description: 'Choose a document before splitting by ranges.' });
        return;
      }
      mode = resolveSplitMode(splitDocument.id, snapshot.ui.splitRangeInput, splitDocument.pageCount);
    }

    snapshot.setJob('export', { status: 'running', progress: 5, message: 'Preparing export...' });
    try {
      const files = await runExport(snapshot, mode, snapshot.ui.exportFileName, snapshot.ui.exportProfile, (progress, message) => {
        usePdfStore.getState().setJob('export', { status: 'running', progress, message });
      });
      downloadExportFiles(files);
      usePdfStore.getState().setJob('export', { status: 'success', progress: 100, message: 'Download ready.' });
      usePdfStore.getState().pushNotification({
        tone: 'success',
        title: 'Export complete',
        description: `${files.length} download${files.length > 1 ? 's' : ''} generated.`,
      });
      usePdfStore.getState().closeExportDialog();
    } catch (error) {
      const issue = toErrorModel(error);
      usePdfStore.getState().setJob('export', { status: 'error', progress: 100, message: issue.message, error: issue });
      usePdfStore.getState().pushNotification({ tone: 'error', title: 'Export failed', description: issue.message });
    }
  };

  const handleToggleDocumentsPane = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches) {
      setDocumentsPaneCollapsed((current) => !current);
      return;
    }
    setDocumentsSheetOpen((current) => !current);
  };

  const handleOpenSplit = (documentId?: string) => {
    const targetDocument = documentId ? store.documents[documentId] : activeDocument;
    if (!targetDocument) {
      return;
    }
    store.setActiveDocument(targetDocument.id);
    store.openExportDialog({ kind: 'split', documentId: targetDocument.id, rangeGroups: [[0]] });
    setDocumentsSheetOpen(false);
  };

  const handleOpenDeleteDialog = (title: string, description: string) => {
    setDeleteDialog({ title, description });
  };

  const handleOpenViewer = async (pageId: string) => {
    const snapshot = usePdfStore.getState();
    const pageNumber = snapshot.pageOrder.indexOf(pageId) + 1;
    const page = snapshot.pages[pageId];
    const document = page ? snapshot.documents[page.documentId] : undefined;
    if (!pageNumber || !page || !document) {
      return;
    }

    const title = `${document.name} · Page ${page.sourcePageIndex + 1}`;

    if (viewerDialog.pdfBlob && viewerDialog.revision === workspaceRevision) {
      setViewerDialog((current) => ({
        ...current,
        open: true,
        error: undefined,
        loading: false,
        pageNumber,
        title,
      }));
      return;
    }

    const requestId = viewerRequestRef.current + 1;
    viewerRequestRef.current = requestId;

    setViewerDialog((current) => ({
      ...current,
      open: true,
      loading: true,
      error: undefined,
      progress: 8,
      pageNumber,
      title,
      loadingMessage: 'Generating the current assembled workspace PDF for the embedded viewer.',
    }));

    try {
      const files = await runExport(snapshot, { kind: 'workspace' }, snapshot.ui.exportFileName || 'pdf-master-viewer', snapshot.ui.exportProfile, (progress, message) => {
        if (viewerRequestRef.current !== requestId) {
          return;
        }
        setViewerDialog((current) => ({
          ...current,
          open: true,
          loading: true,
          progress,
          pageNumber,
          title,
          loadingMessage: message,
        }));
      });

      if (viewerRequestRef.current !== requestId) {
        return;
      }

      const file = files[0];
      if (!file) {
        throw new Error('Viewer PDF was not generated.');
      }

      clearViewerCache();

      setViewerDialog((current) => ({
        ...current,
        open: true,
        loading: false,
        progress: 100,
        pageNumber,
        title,
        pdfBlob: file.blob,
        revision: workspaceRevision,
        error: undefined,
        loadingMessage: undefined,
      }));
    } catch (error) {
      if (viewerRequestRef.current !== requestId) {
        return;
      }
      const issue = toErrorModel(error);
      setViewerDialog((current) => ({
        ...current,
        open: true,
        loading: false,
        progress: 0,
        pageNumber,
        title,
        pdfBlob: undefined,
        error: issue.message,
        loadingMessage: undefined,
      }));
      usePdfStore.getState().pushNotification({
        tone: 'error',
        title: 'Viewer failed to open',
        description: issue.message,
      });
    }
  };

  const handleImageFormatChange = async (
    documentId: string,
    partial: Partial<ImageImportSettings>,
  ) => {
    const snapshot = usePdfStore.getState();
    const target = snapshot.documents[documentId];
    if (!target || target.kind !== 'image' || !target.originalImageFile || !target.imageFitSettings) {
      return;
    }

    const nextSettings: ImageImportSettings = {
      ...DEFAULT_IMAGE_IMPORT_SETTINGS,
      ...target.imageFitSettings,
      ...partial,
    };

    setImageFormatBusyDocs((current) => {
      const next = new Set(current);
      next.add(documentId);
      return next;
    });

    try {
      thumbnailQueue.cancelDocument(documentId);
      const replacement = await reconvertImageDocument(target.originalImageFile, nextSettings);
      usePdfStore.getState().applyImageDocumentReimport(documentId, replacement);

      // The cached workspace PDF inside the viewer dialog is now stale.
      // Drop it so the next open (or a still-open viewer) regenerates fresh.
      viewerRequestRef.current += 1;
      clearViewerCache();
      setViewerDialog((current) => ({
        ...current,
        open: false,
        loading: false,
        pdfBlob: undefined,
        revision: undefined,
        error: undefined,
        progress: 0,
      }));
    } catch (error) {
      const issue = toErrorModel(error);
      usePdfStore.getState().pushNotification({
        tone: 'error',
        title: 'Failed to update image format',
        description: issue.message,
      });
    } finally {
      setImageFormatBusyDocs((current) => {
        const next = new Set(current);
        next.delete(documentId);
        return next;
      });
    }
  };

  const desktopColumns = inspectorOpen
    ? documentsPaneCollapsed
      ? 'xl:grid-cols-[72px_minmax(0,1fr)_344px]'
      : 'xl:grid-cols-[264px_minmax(0,1fr)_344px]'
    : documentsPaneCollapsed
      ? 'xl:grid-cols-[72px_minmax(0,1fr)]'
      : 'xl:grid-cols-[264px_minmax(0,1fr)]';

  return (
    <>
      <Notifications notifications={store.notifications} onDismiss={store.dismissNotification} />

      <input
        ref={importInputRef}
        type="file"
        accept={ACCEPT_IMPORT_TYPES}
        multiple
        className="sr-only"
        onChange={(event) => {
          void handleImport(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />

      <WorkspaceDropOverlay disabled={importBusy} onFiles={(files) => void handleImport(files)}>
      <motion.main
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="flex min-h-screen flex-col"
      >
        <Toolbar
          hasWorkspace={hasWorkspace}
          importBusy={importBusy}
          pageCount={store.pageOrder.length}
          documentCount={orderedDocuments.length}
          selectedCount={selectedCount}
          activeDocumentName={activeDocument?.name}
          viewMode={store.ui.viewMode}
          thumbnailDensity={thumbnailDensity}
          searchQuery={searchQuery}
          documentsPaneCollapsed={documentsPaneCollapsed}
          inspectorOpen={inspectorOpen}
          canSplit={Boolean(activeDocument)}
          onImport={() => importInputRef.current?.click()}
          onExport={() =>
            store.openExportDialog(
              selectedCount ? { kind: 'selection', pageIds: store.selectedPageIds } : { kind: 'workspace' },
            )
          }
          onMerge={() => store.openExportDialog({ kind: 'workspace' })}
          onSplit={() => handleOpenSplit()}
          onExtract={() => store.openExportDialog({ kind: 'selection', pageIds: store.selectedPageIds })}
          onRotate={() => store.rotateSelectedPages()}
          onDelete={() => {
            if (!selectedCount) {
              return;
            }
            handleOpenDeleteDialog(
              selectedCount === 1 ? 'Delete selected page?' : 'Delete selected pages?',
              selectedCount === 1
                ? 'The selected page will be removed from the workspace immediately.'
                : `${selectedCount} selected pages will be removed from the workspace immediately.`,
            );
          }}
          onClearSelection={store.clearSelection}
          onViewModeChange={store.setViewMode}
          onThumbnailDensityChange={setThumbnailDensity}
          onToggleDocumentsPane={handleToggleDocumentsPane}
          onToggleInspector={() => {
            if (!activeDocument) {
              return;
            }
            setInspectorOpen((current) => !current);
          }}
          onSearchChange={setSearchQuery}
          imageImportSettings={store.ui.imageImportSettings}
          onImageImportSettingsChange={store.setImageImportSettings}
        />

        <div className={clsx('min-h-0 flex-1 xl:grid', desktopColumns)}>
          <aside className="hidden min-h-0 border-r border-[var(--pm-border)] bg-[color:var(--pm-panel)] xl:flex">
            <DocumentList
              documents={orderedDocuments}
              activeDocumentId={store.ui.activeDocumentId}
              collapsed={documentsPaneCollapsed}
              onToggleCollapse={() => setDocumentsPaneCollapsed((current) => !current)}
              onActivate={(documentId) => {
                store.setActiveDocument(documentId);
                setDocumentsSheetOpen(false);
              }}
              onSelectAll={(documentId) => {
                store.selectAllDocumentPages(documentId);
                setDocumentsSheetOpen(false);
              }}
              onSplit={handleOpenSplit}
              onRemove={(documentId) => {
                thumbnailQueue.cancelDocument(documentId);
                store.removeDocument(documentId);
              }}
              onReorder={store.reorderDocuments}
              onExternalFileDrop={(files) => void handleImport(files)}
            />
          </aside>

          <section className="min-h-0 bg-[color:var(--pm-workspace)]">
            {hasWorkspace ? (
              filteredGroups.length ? (
                <PageGrid
                  groups={filteredGroups}
                  activeDocumentId={store.ui.activeDocumentId}
                  selectedPageIds={store.selectedPageIds}
                  thumbnails={store.thumbnails}
                  viewMode={store.ui.viewMode}
                  thumbnailDensity={thumbnailDensity}
                  onActivateDocument={store.setActiveDocument}
                  onSelectAllInDocument={store.selectAllDocumentPages}
                  onPageClick={(pageId, gesture) => store.selectPage(pageId, gesture)}
                  onTogglePageSelection={(pageId, gesture) =>
                    store.selectPage(pageId, {
                      additive: !gesture?.range,
                      range: Boolean(gesture?.range),
                    })
                  }
                  onOpenViewer={handleOpenViewer}
                  onRequestThumbnail={handleRequestThumbnail}
                  onInvisible={handleCancelThumbnail}
                  onRotatePage={(pageId) => {
                    usePdfStore.getState().selectPage(pageId);
                    usePdfStore.getState().rotateSelectedPages();
                  }}
                  onDeletePage={(pageId) => {
                    const page = usePdfStore.getState().pages[pageId];
                    usePdfStore.getState().selectPage(pageId);
                    handleOpenDeleteDialog(
                      'Delete this page?',
                      page ? `${page.label} will be removed from the workspace.` : 'The selected page will be removed from the workspace.',
                    );
                  }}
                  onReorder={store.reorderPages}
                  onExternalFileDrop={(files, targetPageId, position) =>
                    void handleImportAtPosition(files, targetPageId, position)
                  }
                />
              ) : (
                <div className="p-4">
                  <EmptyState
                    title="No pages match this search"
                    description="Try a page number, page label, or clear the search field to return to the full workspace."
                  />
                </div>
              )
            ) : (
              <div className="p-4">
                <EmptyState
                  title="Start with the working canvas"
                  description="Import one or more PDFs to open the desktop editor layout with document structure on the left, page workspace in the center, and the inspector on demand."
                  align="center"
                >
                  <DropZone compact disabled={importBusy} onFiles={(files) => void handleImport(files)} />
                </EmptyState>
              </div>
            )}
          </section>

          {inspectorOpen && activeDocument ? (
            <aside className="hidden min-h-0 border-l border-[var(--pm-border)] bg-[color:var(--pm-panel)] xl:block">
              <Inspector
                document={activeDocument}
                onFieldChange={(fieldName, value) => activeDocument && store.updateFormField(activeDocument.id, fieldName, value)}
                onFlattenToggle={(flatten) => activeDocument && store.setDocumentFlattening(activeDocument.id, flatten)}
                onImageFormatChange={(documentId, partial) => void handleImageFormatChange(documentId, partial)}
                imageFormatBusy={activeDocument ? imageFormatBusyDocs.has(activeDocument.id) : false}
              />
            </aside>
          ) : null}
        </div>

        <StatusBar
          documentCount={orderedDocuments.length}
          pageCount={store.pageOrder.length}
          selectedCount={selectedCount}
          activeDocumentName={activeDocument?.name}
          jobs={store.jobs}
        />
      </motion.main>
      </WorkspaceDropOverlay>

      {documentsSheetOpen ? (
        <div className="fixed inset-0 z-40 bg-[color:var(--pm-overlay)] backdrop-blur-[1px] xl:hidden" onClick={() => setDocumentsSheetOpen(false)}>
          <div className="h-full w-[280px] max-w-[85vw] border-r border-[var(--pm-border)] bg-[color:var(--pm-panel)] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <DocumentList
              documents={orderedDocuments}
              activeDocumentId={store.ui.activeDocumentId}
              collapsed={false}
              onToggleCollapse={() => setDocumentsSheetOpen(false)}
              onActivate={(documentId) => {
                store.setActiveDocument(documentId);
                setDocumentsSheetOpen(false);
              }}
              onSelectAll={(documentId) => {
                store.selectAllDocumentPages(documentId);
                setDocumentsSheetOpen(false);
              }}
              onSplit={handleOpenSplit}
              onRemove={(documentId) => {
                thumbnailQueue.cancelDocument(documentId);
                store.removeDocument(documentId);
              }}
              onReorder={store.reorderDocuments}
              onExternalFileDrop={(files) => void handleImport(files)}
            />
          </div>
        </div>
      ) : null}

      {inspectorOpen && activeDocument ? (
        <div className="fixed inset-0 z-40 bg-[color:var(--pm-overlay)] backdrop-blur-[1px] xl:hidden" onClick={() => setInspectorOpen(false)}>
          <div className="ml-auto h-full w-[340px] max-w-[92vw] border-l border-[var(--pm-border)] bg-[color:var(--pm-panel)] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <Inspector
              document={activeDocument}
              onFieldChange={(fieldName, value) => activeDocument && store.updateFormField(activeDocument.id, fieldName, value)}
              onFlattenToggle={(flatten) => activeDocument && store.setDocumentFlattening(activeDocument.id, flatten)}
            />
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteDialog)}
        title={deleteDialog?.title ?? 'Delete selected pages?'}
        description={deleteDialog?.description ?? 'The selected pages will be removed from the workspace.'}
        confirmLabel="Delete"
        onCancel={() => setDeleteDialog(null)}
        onConfirm={() => {
          store.deleteSelectedPages();
          setDeleteDialog(null);
        }}
      />

      <PdfViewerDialog
        open={viewerDialog.open}
        title={viewerDialog.title}
        pageNumber={viewerDialog.pageNumber}
        pdfBlob={viewerDialog.pdfBlob}
        loading={viewerDialog.loading}
        loadingMessage={viewerDialog.loadingMessage}
        progress={viewerDialog.progress}
        error={viewerDialog.error}
        expanded={viewerDialog.expanded}
        onClose={() => {
          viewerRequestRef.current += 1;
          setViewerDialog((current) => ({ ...current, open: false, expanded: false, loading: false }));
        }}
        onToggleExpanded={() => setViewerDialog((current) => ({ ...current, expanded: !current.expanded }))}
        onOpenInBrowser={() => {
          const viewerUrl = ensureViewerUrl(viewerDialog.pdfBlob);
          if (!viewerUrl) {
            return;
          }
          window.open(`${viewerUrl}#page=${viewerDialog.pageNumber}&zoom=page-fit`, '_blank', 'noopener,noreferrer');
        }}
        onDownload={() => {
          const viewerUrl = ensureViewerUrl(viewerDialog.pdfBlob);
          if (!viewerUrl) {
            return;
          }
          const link = document.createElement('a');
          link.href = viewerUrl;
          link.download = `${(store.ui.exportFileName || 'pdf-master-viewer').replace(/\.pdf$/i, '')}.pdf`;
          link.click();
        }}
      />

      <ExportDialog
        open={store.ui.exportDialogOpen}
        exportMode={store.ui.exportMode}
        exportProfile={store.ui.exportProfile}
        fileName={store.ui.exportFileName}
        splitRangeInput={store.ui.splitRangeInput}
        activeDocument={activeDocument}
        selectedCount={selectedCount}
        pageCount={store.pageOrder.length}
        onClose={store.closeExportDialog}
        onFileNameChange={store.setExportFileName}
        onModeChange={(mode) => {
          if (mode.kind === 'selection') {
            store.setExportMode({ kind: 'selection', pageIds: store.selectedPageIds });
            return;
          }
          store.setExportMode(mode);
        }}
        onSplitRangeChange={store.setSplitRangeInput}
        onProfileChange={store.setExportProfile}
        onSubmit={handleExport}
      />
    </>
  );
}
