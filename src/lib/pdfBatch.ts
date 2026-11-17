import { BatchItemResult } from '../types/qr';
import { decodeAny, decodeImageFile, DecodeHit } from './decode';

type PdfJsModule = typeof import('pdfjs-dist');

let pdfjsInstancePromise: Promise<PdfJsModule> | null = null;

async function getPdfJs(): Promise<PdfJsModule> {
  if (pdfjsInstancePromise) return pdfjsInstancePromise;

  pdfjsInstancePromise = (async () => {
    const [pdfjs, workerMod] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
    return pdfjs;
  })();

  return pdfjsInstancePromise;
}

const PDF_300_DPI_SCALE = 300 / 72; // 4.166667x standard 72 DPI PDF user space

export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Renders a single 1-indexed PDF page at 300 DPI onto an HTMLCanvasElement.
 */
export async function renderPdfPageAt300Dpi(
  file: File,
  pageNumber: number
): Promise<HTMLCanvasElement> {
  const pdfjs = await getPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdfDoc = await loadingTask.promise;

  try {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: PDF_300_DPI_SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({
      canvas,
      viewport,
      intent: 'print',
    }).promise;

    page.cleanup();
    return canvas;
  } finally {
    await pdfDoc.cleanup().catch(() => {});
    await pdfDoc.loadingTask.destroy().catch(() => {});
  }
}

/**
 * Decodes a single image or single PDF page using the shared thorough decodeAny pipeline.
 */
export async function decodeBatchEntry(
  file: File,
  pageNumber?: number
): Promise<DecodeHit | null> {
  if (isPdfFile(file)) {
    const canvas = await renderPdfPageAt300Dpi(file, pageNumber || 1);
    return decodeAny(canvas, true);
  }
  const { hit, previewUrl } = await decodeImageFile(file, true);
  URL.revokeObjectURL(previewUrl);
  return hit;
}

export interface BatchCallbacks {
  onItemsInitialized: (items: BatchItemResult[]) => void;
  onItemUpdate: (id: string, patch: Partial<BatchItemResult>) => void;
  onDecodedItem?: (item: BatchItemResult, rawPayload: string, decodeMethod: string) => Promise<Partial<BatchItemResult> | void>;
}

/**
 * Processes a list of multi-selected Image and PDF files cleanly without blocking the UI thread.
 * Expands multi-page PDFs so every page is rendered at 300 DPI and decoded individually.
 */
export async function processBatchFiles(
  files: File[],
  callbacks: BatchCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const queue: BatchItemResult[] = [];
  const pdfDocs = new Map<File, Awaited<ReturnType<PdfJsModule['getDocument']>['promise']>>();

  try {
    for (const file of files) {
      if (signal?.aborted) return;
      if (isPdfFile(file)) {
        try {
          const pdfjs = await getPdfJs();
          const data = new Uint8Array(await file.arrayBuffer());
          const doc = await pdfjs.getDocument({ data }).promise;
          pdfDocs.set(file, doc);
          const numPages = doc.numPages;

          for (let p = 1; p <= numPages; p++) {
            queue.push({
              id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              fileName: numPages > 1 ? `${file.name} (Page ${p}/${numPages})` : file.name,
              pageNumber: p,
              file,
              status: 'pending',
            });
          }
        } catch (err: any) {
          queue.push({
            id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            fileName: file.name,
            file,
            status: 'failed',
            error: err?.message || 'Could not read PDF file',
          });
        }
      } else {
        queue.push({
          id: `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          file,
          status: 'pending',
        });
      }
    }

    callbacks.onItemsInitialized(queue);

    for (const entry of queue) {
      if (signal?.aborted) return;
      if (entry.status === 'failed') continue;

      callbacks.onItemUpdate(entry.id, { status: 'processing', error: undefined });

      try {
        let hit: DecodeHit | null = null;

        if (isPdfFile(entry.file)) {
          const doc = pdfDocs.get(entry.file);
          if (doc) {
            const page = await doc.getPage(entry.pageNumber || 1);
            const viewport = page.getViewport({ scale: PDF_300_DPI_SCALE });
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(viewport.width));
            canvas.height = Math.max(1, Math.round(viewport.height));
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            await page.render({ canvas, viewport, intent: 'print' }).promise;
            page.cleanup();
            hit = await decodeAny(canvas, true);
          } else {
            const canvas = await renderPdfPageAt300Dpi(entry.file, entry.pageNumber || 1);
            hit = await decodeAny(canvas, true);
          }
        } else {
          const { hit: imgHit, previewUrl } = await decodeImageFile(entry.file, true);
          URL.revokeObjectURL(previewUrl);
          hit = imgHit;
        }

        if (hit && hit.data) {
          let extraPatch: Partial<BatchItemResult> = {};
          if (callbacks.onDecodedItem) {
            const maybePatch = await callbacks.onDecodedItem(entry, hit.data, hit.method);
            if (maybePatch) extraPatch = maybePatch;
          }
          callbacks.onItemUpdate(entry.id, {
            status: 'decoded',
            rawPayload: hit.data,
            decodeMethod: hit.method,
            ...extraPatch,
          });
        } else {
          callbacks.onItemUpdate(entry.id, {
            status: 'failed',
            error: 'No readable QR code found',
          });
        }
      } catch (err: any) {
        callbacks.onItemUpdate(entry.id, {
          status: 'failed',
          error: err?.message || 'Decode error',
        });
      }

      // Yield briefly to keep UI responsive across 90+ item batches
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    for (const doc of pdfDocs.values()) {
      try {
        await doc.cleanup();
        await doc.loadingTask.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    pdfDocs.clear();
  }
}
