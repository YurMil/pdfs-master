import type {
  DocumentEntity,
  DropTargetPosition,
  FormFieldValue,
  ImageImportSettings,
  IngestDocumentPayload,
  PageEntity,
  SourceFileModel,
  WorkspaceSnapshot,
} from '@/domain/types';

interface AddDocumentExtras {
  originalImageFile?: File;
  imageFitSettings?: ImageImportSettings;
}

export function emptyWorkspace(): WorkspaceSnapshot {
  return {
    documents: {},
    pages: {},
    documentOrder: [],
    pageOrder: [],
    pageOrderByDocument: {},
  };
}

export function buildPageOrderByDocument(pageOrder: string[], pages: Record<string, PageEntity>): Record<string, string[]> {
  return pageOrder.reduce<Record<string, string[]>>((accumulator, pageId) => {
    const page = pages[pageId];
    if (!page) {
      return accumulator;
    }

    accumulator[page.documentId] ??= [];
    accumulator[page.documentId].push(pageId);
    return accumulator;
  }, {});
}

export function addDocumentToWorkspace(
  snapshot: WorkspaceSnapshot,
  sourceFile: SourceFileModel,
  payload: IngestDocumentPayload,
  sourceUrl: string,
  extras: AddDocumentExtras = {},
): WorkspaceSnapshot {
  const pages: Record<string, PageEntity> = { ...snapshot.pages };
  const pageIds: string[] = [];

  for (const page of payload.pages) {
    const pageEntity: PageEntity = {
      id: page.id,
      documentId: payload.id,
      sourcePageIndex: page.sourcePageIndex,
      width: page.width,
      height: page.height,
      rotation: 0,
      label: page.label,
    };
    pages[page.id] = pageEntity;
    pageIds.push(page.id);
  }

  const document: DocumentEntity = {
    id: payload.id,
    sourceFileId: sourceFile.id,
    name: payload.name,
    sourceFile,
    pageCount: payload.pageCount,
    pageIds,
    metadata: payload.metadata,
    hasForms: payload.hasForms,
    formFields: payload.formFields,
    flattenForms: false,
    sourceUrl,
    status: 'success',
    errors: [],
    kind: extras.originalImageFile ? 'image' : 'pdf',
    originalImageFile: extras.originalImageFile,
    imageFitSettings: extras.imageFitSettings,
  };

  const documents = { ...snapshot.documents, [document.id]: document };
  const documentOrder = [...snapshot.documentOrder, document.id];
  const pageOrder = [...snapshot.pageOrder, ...pageIds];

  return {
    documents,
    pages,
    documentOrder,
    pageOrder,
    pageOrderByDocument: buildPageOrderByDocument(pageOrder, pages),
  };
}

/**
 * Like addDocumentToWorkspace, but inserts the new document's pages
 * at a specific position relative to an existing page.
 */
export function addDocumentToWorkspaceAtPosition(
  snapshot: WorkspaceSnapshot,
  sourceFile: SourceFileModel,
  payload: IngestDocumentPayload,
  sourceUrl: string,
  targetPageId: string,
  position: DropTargetPosition,
  extras: AddDocumentExtras = {},
): WorkspaceSnapshot {
  const pages: Record<string, PageEntity> = { ...snapshot.pages };
  const pageIds: string[] = [];

  for (const page of payload.pages) {
    const pageEntity: PageEntity = {
      id: page.id,
      documentId: payload.id,
      sourcePageIndex: page.sourcePageIndex,
      width: page.width,
      height: page.height,
      rotation: 0,
      label: page.label,
    };
    pages[page.id] = pageEntity;
    pageIds.push(page.id);
  }

  const document: DocumentEntity = {
    id: payload.id,
    sourceFileId: sourceFile.id,
    name: payload.name,
    sourceFile,
    pageCount: payload.pageCount,
    pageIds,
    metadata: payload.metadata,
    hasForms: payload.hasForms,
    formFields: payload.formFields,
    flattenForms: false,
    sourceUrl,
    status: 'success',
    errors: [],
    kind: extras.originalImageFile ? 'image' : 'pdf',
    originalImageFile: extras.originalImageFile,
    imageFitSettings: extras.imageFitSettings,
  };

  const documents = { ...snapshot.documents, [document.id]: document };
  const documentOrder = [...snapshot.documentOrder, document.id];

  // Insert new pages at the target position
  const targetIndex = snapshot.pageOrder.indexOf(targetPageId);
  const insertAt = targetIndex === -1
    ? snapshot.pageOrder.length
    : position === 'after'
      ? targetIndex + 1
      : targetIndex;

  const pageOrder = [...snapshot.pageOrder];
  pageOrder.splice(insertAt, 0, ...pageIds);

  return {
    documents,
    pages,
    documentOrder,
    pageOrder,
    pageOrderByDocument: buildPageOrderByDocument(pageOrder, pages),
  };
}

export function removeDocumentFromWorkspace(snapshot: WorkspaceSnapshot, documentId: string): WorkspaceSnapshot {
  const documents = { ...snapshot.documents };
  const pages = { ...snapshot.pages };
  const removedPageIds = new Set(snapshot.pageOrder.filter((pageId) => pages[pageId]?.documentId === documentId));

  delete documents[documentId];
  for (const pageId of removedPageIds) {
    delete pages[pageId];
  }

  const pageOrder = snapshot.pageOrder.filter((pageId) => !removedPageIds.has(pageId));
  const documentOrder = snapshot.documentOrder.filter((id) => id !== documentId);

  return {
    documents,
    pages,
    documentOrder,
    pageOrder,
    pageOrderByDocument: buildPageOrderByDocument(pageOrder, pages),
  };
}

export function reorderPagesInWorkspace(
  snapshot: WorkspaceSnapshot,
  movingPageIds: string[],
  targetPageId: string,
  position: DropTargetPosition,
): WorkspaceSnapshot {
  const moving = new Set(movingPageIds);
  const retainedOrder = snapshot.pageOrder.filter((pageId) => !moving.has(pageId));
  const insertAt = retainedOrder.indexOf(targetPageId);

  if (insertAt === -1) {
    return snapshot;
  }

  const movingOrdered = snapshot.pageOrder.filter((pageId) => moving.has(pageId));
  const targetIndex = position === 'after' ? insertAt + 1 : insertAt;
  retainedOrder.splice(targetIndex, 0, ...movingOrdered);

  return {
    ...snapshot,
    pageOrder: retainedOrder,
    pageOrderByDocument: buildPageOrderByDocument(retainedOrder, snapshot.pages),
  };
}

export function reorderDocumentsInWorkspace(
  snapshot: WorkspaceSnapshot,
  movingDocumentId: string,
  targetDocumentId: string,
  position: DropTargetPosition,
): WorkspaceSnapshot {
  if (movingDocumentId === targetDocumentId) {
    return snapshot;
  }

  const nextDocumentOrder = snapshot.documentOrder.filter((documentId) => documentId !== movingDocumentId);
  const targetIndex = nextDocumentOrder.indexOf(targetDocumentId);

  if (targetIndex === -1) {
    return snapshot;
  }

  nextDocumentOrder.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, movingDocumentId);

  const pageOrder = nextDocumentOrder.flatMap((documentId) => snapshot.pageOrderByDocument[documentId] ?? []);

  return {
    ...snapshot,
    documentOrder: nextDocumentOrder,
    pageOrder,
    pageOrderByDocument: buildPageOrderByDocument(pageOrder, snapshot.pages),
  };
}

export function rotatePagesInWorkspace(
  snapshot: WorkspaceSnapshot,
  pageIds: string[],
  degrees: number,
): WorkspaceSnapshot {
  const pages = { ...snapshot.pages };
  for (const pageId of pageIds) {
    const page = pages[pageId];
    if (!page) {
      continue;
    }

    pages[pageId] = {
      ...page,
      rotation: normalizeRotation(page.rotation + degrees),
    };
  }

  return { ...snapshot, pages };
}

export function deletePagesFromWorkspace(snapshot: WorkspaceSnapshot, pageIds: string[]): WorkspaceSnapshot {
  const removable = new Set(pageIds);
  const pages = { ...snapshot.pages };
  const documents = { ...snapshot.documents };
  const pageOrder = snapshot.pageOrder.filter((pageId) => !removable.has(pageId));

  for (const pageId of removable) {
    delete pages[pageId];
  }

  for (const document of Object.values(documents)) {
    const nextPageIds = document.pageIds.filter((pageId) => !removable.has(pageId));
    if (!nextPageIds.length) {
      delete documents[document.id];
      continue;
    }

    documents[document.id] = {
      ...document,
      pageIds: nextPageIds,
      pageCount: nextPageIds.length,
    };
  }

  const documentOrder = snapshot.documentOrder.filter((documentId) => Boolean(documents[documentId]));

  return {
    documents,
    pages,
    documentOrder,
    pageOrder,
    pageOrderByDocument: buildPageOrderByDocument(pageOrder, pages),
  };
}

export function updateDocumentFormValue(
  snapshot: WorkspaceSnapshot,
  documentId: string,
  fieldName: string,
  value: FormFieldValue,
): WorkspaceSnapshot {
  const document = snapshot.documents[documentId];
  if (!document) {
    return snapshot;
  }

  return {
    ...snapshot,
    documents: {
      ...snapshot.documents,
      [documentId]: {
        ...document,
        formFields: document.formFields.map((field) =>
          field.name === fieldName ? { ...field, value } : field,
        ),
      },
    },
  };
}

export function toggleDocumentFlattening(
  snapshot: WorkspaceSnapshot,
  documentId: string,
  flattenForms: boolean,
): WorkspaceSnapshot {
  const document = snapshot.documents[documentId];
  if (!document) {
    return snapshot;
  }

  return {
    ...snapshot,
    documents: {
      ...snapshot.documents,
      [documentId]: {
        ...document,
        flattenForms,
      },
    },
  };
}

export function selectOrderedPageIds(snapshot: WorkspaceSnapshot, pageIds?: string[]): PageEntity[] {
  const filter = pageIds ? new Set(pageIds) : null;
  return snapshot.pageOrder
    .filter((pageId) => (filter ? filter.has(pageId) : true))
    .map((pageId) => snapshot.pages[pageId])
    .filter((page): page is PageEntity => Boolean(page));
}

export function splitDocumentPageIds(
  snapshot: WorkspaceSnapshot,
  documentId: string,
  rangeGroups: number[][],
): string[][] {
  const pageIds = snapshot.pageOrderByDocument[documentId] ?? [];
  return rangeGroups.map((group) => group.map((index) => pageIds[index]).filter(Boolean));
}

function normalizeRotation(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
