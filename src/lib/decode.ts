import jsQR from 'jsqr';

export type DecodeSource =
  | HTMLCanvasElement
  | HTMLVideoElement
  | HTMLImageElement
  | ImageBitmap;

export interface DecodeHit {
  data: string;
  method: string;
  durationMs: number;
}

interface BarcodeDetectorLike {
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

interface BarcodeDetectorConstructorLike {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

let detectorPromise: Promise<BarcodeDetectorLike | null> | null = null;

async function getBarcodeDetector(): Promise<BarcodeDetectorLike | null> {
  if (detectorPromise) return detectorPromise;

  detectorPromise = (async () => {
    try {
      const ctor = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorConstructorLike })
        .BarcodeDetector;
      if (!ctor) return null;

      if (typeof ctor.getSupportedFormats === 'function') {
        const formats = await ctor.getSupportedFormats();
        if (!formats.includes('qr_code')) return null;
      }
      return new ctor({ formats: ['qr_code'] });
    } catch {
      return null;
    }
  })();

  return detectorPromise;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function getSourceDimensions(source: DecodeSource): { width: number; height: number } {
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    };
  }
  return { width: source.width, height: source.height };
}

function runJsQR(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width <= 0 || canvas.height <= 0) return null;

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imgData.data, imgData.width, imgData.height, {
    inversionAttempts: 'attemptBoth',
  });
  return result?.data || null;
}

function drawResizedCanvas(
  source: DecodeSource,
  targetW: number,
  targetH: number,
  srcX = 0,
  srcY = 0,
  srcW?: number,
  srcH?: number,
  smooth = true,
  padRatio = 0
): HTMLCanvasElement {
  const { width: origW, height: origH } = getSourceDimensions(source);
  const sW = srcW ?? origW;
  const sH = srcH ?? origH;

  const padX = Math.round(targetW * padRatio);
  const padY = Math.round(targetH * padRatio);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, targetW + padX * 2);
  canvas.height = Math.max(1, targetH + padY * 2);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = smooth;
  if (smooth) {
    ctx.imageSmoothingQuality = 'high';
  }
  ctx.drawImage(source, srcX, srcY, sW, sH, padX, padY, targetW, targetH);
  return canvas;
}

async function tryBarcodeDetector(source: ImageBitmapSource): Promise<string | null> {
  const detector = await getBarcodeDetector();
  if (!detector) return null;
  try {
    const results = await detector.detect(source);
    for (const item of results) {
      if (item && typeof item.rawValue === 'string' && item.rawValue.length > 0) {
        return item.rawValue;
      }
    }
  } catch {
    // Ignore detector errors and fall back to jsQR
  }
  return null;
}

/**
 * Shared QR decode pipeline used by Camera, Single Image Upload, Batch Import, and Generator Test Scan.
 *
 * When `thorough === false` (fast plan):
 *   1. BarcodeDetector({ formats: ['qr_code'] })
 *   2. jsQR on as-is canvas (capped at 900px for 6fps speed)
 *
 * When `thorough === true` (every 4th camera frame, uploads, PDFs, test scan):
 *   1. BarcodeDetector({ formats: ['qr_code'] })
 *   2. jsQR as-is
 *   3. jsQR centre-square crop
 *   4. jsQR white-padded canvas (12% quiet zone)
 *   5. jsQR white-padded canvas (20% quiet zone)
 *   6. jsQR white-padded centre-square crop (12% quiet zone, targets framed CDACC badges)
 *   7. jsQR downscaled to 900px
 *   8. jsQR downscaled to 640px
 *   9. jsQR upscaled to 1600px
 */
export async function decodeAny(
  source: DecodeSource,
  thorough = false
): Promise<DecodeHit | null> {
  const start = performance.now();
  const { width, height } = getSourceDimensions(source);
  if (width <= 0 || height <= 0) return null;

  // 1. Native BarcodeDetector when available
  const nativeHit = await tryBarcodeDetector(source);
  if (nativeHit) {
    return {
      data: nativeHit,
      method: 'BarcodeDetector',
      durationMs: Math.round(performance.now() - start),
    };
  }

  const maxDim = Math.max(width, height);

  // Fast plan (used on non-4th camera frames)
  if (!thorough) {
    const fastMax = 900;
    const scale = maxDim > fastMax ? fastMax / maxDim : 1;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const fastCanvas =
      source instanceof HTMLCanvasElement && scale === 1
        ? source
        : drawResizedCanvas(source, w, h);

    const hit = runJsQR(fastCanvas);
    if (hit) {
      return {
        data: hit,
        method: 'jsQR (fast)',
        durationMs: Math.round(performance.now() - start),
      };
    }
    return null;
  }

  // --- Thorough Plan ---

  // 2. As-is (cap absurdly massive >2400px canvases to prevent browser OOM)
  const asIsCap = 2400;
  const asIsScale = maxDim > asIsCap ? asIsCap / maxDim : 1;
  const asIsW = Math.max(1, Math.round(width * asIsScale));
  const asIsH = Math.max(1, Math.round(height * asIsScale));
  const baseCanvas =
    source instanceof HTMLCanvasElement && asIsScale === 1
      ? source
      : drawResizedCanvas(source, asIsW, asIsH);

  const asIsHit = runJsQR(baseCanvas);
  if (asIsHit) {
    return {
      data: asIsHit,
      method: 'jsQR (as-is)',
      durationMs: Math.round(performance.now() - start),
    };
  }

  await yieldToMain();

  // 3. Centre-square crop (isolates centered QR inside rectangular badges or frames)
  const minDim = Math.min(width, height);
  const cropSide = width !== height ? minDim : Math.round(minDim * 0.85);
  const cropX = Math.max(0, Math.round((width - cropSide) / 2));
  const cropY = Math.max(0, Math.round((height - cropSide) / 2));
  const cropTarget = Math.min(1000, cropSide);
  const cropCanvas = drawResizedCanvas(
    source,
    cropTarget,
    cropTarget,
    cropX,
    cropY,
    cropSide,
    cropSide,
    true,
    0
  );
  const cropHit = runJsQR(cropCanvas);
  if (cropHit) {
    return {
      data: cropHit,
      method: 'jsQR (centre-crop)',
      durationMs: Math.round(performance.now() - start),
    };
  }

  await yieldToMain();

  // 4. White-padded canvas (12% quiet zone drawn in software)
  const padTargetMax = 1000;
  const padScale = maxDim > padTargetMax ? padTargetMax / maxDim : 1;
  const padBaseW = Math.max(1, Math.round(width * padScale));
  const padBaseH = Math.max(1, Math.round(height * padScale));

  const pad12Canvas = drawResizedCanvas(source, padBaseW, padBaseH, 0, 0, width, height, true, 0.12);
  const pad12Hit = runJsQR(pad12Canvas);
  if (pad12Hit) {
    return {
      data: pad12Hit,
      method: 'jsQR (white-pad 12%)',
      durationMs: Math.round(performance.now() - start),
    };
  }

  await yieldToMain();

  // 5. White-padded canvas (20% quiet zone drawn in software)
  const pad20Canvas = drawResizedCanvas(source, padBaseW, padBaseH, 0, 0, width, height, true, 0.20);
  const pad20Hit = runJsQR(pad20Canvas);
  if (pad20Hit) {
    return {
      data: pad20Hit,
      method: 'jsQR (white-pad 20%)',
      durationMs: Math.round(performance.now() - start),
    };
  }

  await yieldToMain();

  // 5b. White-padded centre-square crop (12% quiet zone around tight badge crop)
  const cropPadCanvas = drawResizedCanvas(
    source,
    Math.min(900, cropSide),
    Math.min(900, cropSide),
    cropX,
    cropY,
    cropSide,
    cropSide,
    true,
    0.12
  );
  const cropPadHit = runJsQR(cropPadCanvas);
  if (cropPadHit) {
    return {
      data: cropPadHit,
      method: 'jsQR (crop + white-pad 12%)',
      durationMs: Math.round(performance.now() - start),
    };
  }

  await yieldToMain();

  // 6. Downscaled to 900px
  if (maxDim > 900) {
    const s900 = 900 / maxDim;
    const c900 = drawResizedCanvas(
      source,
      Math.round(width * s900),
      Math.round(height * s900)
    );
    const hit900 = runJsQR(c900);
    if (hit900) {
      return {
        data: hit900,
        method: 'jsQR (900px)',
        durationMs: Math.round(performance.now() - start),
      };
    }
    await yieldToMain();
  }

  // 7. Downscaled to 640px
  if (maxDim > 640) {
    const s640 = 640 / maxDim;
    const c640 = drawResizedCanvas(
      source,
      Math.round(width * s640),
      Math.round(height * s640)
    );
    const hit640 = runJsQR(c640);
    if (hit640) {
      return {
        data: hit640,
        method: 'jsQR (640px)',
        durationMs: Math.round(performance.now() - start),
      };
    }
    await yieldToMain();
  }

  // 8. Upscaled to 1600px (with crisp module edges + 12% quiet zone safety)
  if (maxDim < 1600) {
    const s1600 = 1600 / maxDim;
    const c1600 = drawResizedCanvas(
      source,
      Math.round(width * s1600),
      Math.round(height * s1600),
      0,
      0,
      width,
      height,
      false
    );
    const hit1600 = runJsQR(c1600);
    if (hit1600) {
      return {
        data: hit1600,
        method: 'jsQR (upscaled 1600px)',
        durationMs: Math.round(performance.now() - start),
      };
    }
  }

  return null;
}

/**
 * Loads an image File/Blob safely and runs thorough decodeAny on it.
 */
export async function decodeImageFile(
  file: File | Blob,
  thorough = true
): Promise<{ hit: DecodeHit | null; previewUrl: string }> {
  const previewUrl = URL.createObjectURL(file);

  // Prefer createImageBitmap for speed and low memory overhead on raster images
  if (typeof createImageBitmap === 'function' && file.type !== 'image/svg+xml') {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        const hit = await decodeAny(bitmap, thorough);
        return { hit, previewUrl };
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall back to HTMLImageElement
    }
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not decode image file'));
    el.src = previewUrl;
  });

  const hit = await decodeAny(img, thorough);
  return { hit, previewUrl };
}
