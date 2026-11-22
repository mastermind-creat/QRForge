import QRCode from 'qrcode';
import { QRStyleSettings } from '../types/qr';

export interface RenderOptions {
  text: string;
  style: QRStyleSettings;
  overrideSize?: number;
  enforceExportQuietZone?: boolean;
}

/**
 * Enforces >= 4 modules quiet zone on exports whenever background is not transparent.
 */
export function getEffectiveExportMargin(style: QRStyleSettings): number {
  if (style.bgColor === 'transparent') {
    return style.margin;
  }
  return Math.max(4, style.margin);
}

interface CenterCutoutGeometry {
  moduleCount: number;
  totalModules: number;
  moduleSize: number;
  cutStart: number;
  cutEnd: number;
  boxX: number;
  boxY: number;
  logoBoxSize: number;
  borderWidth: number;
  innerPadding: number;
  innerSize: number;
  innerX: number;
  innerY: number;
}

function computeCenterLogoGeometry(
  moduleCount: number,
  canvasSize: number,
  margin: number,
  style: QRStyleSettings
): CenterCutoutGeometry {
  const totalModules = moduleCount + margin * 2;
  const moduleSize = canvasSize / totalModules;

  const percent = Math.min(Math.max(style.logo?.sizePercent || 22, 12), 30) / 100;
  const desiredBoxPx = canvasSize * percent;
  // Add ~1.1 modules of clearance so the rounded border never touches surrounding QR modules
  const desiredCutoutPx = desiredBoxPx + moduleSize * 1.1;
  let rawCutModules = Math.round(desiredCutoutPx / moduleSize);

  const parity = moduleCount % 2;
  if (rawCutModules % 2 !== parity) {
    rawCutModules += 1;
  }

  // Keep finder patterns (7x7 + 1 separator) and timing patterns (row/col 6) completely intact
  const maxSafeFrame = Math.max(3, moduleCount - 16);
  const ec = style.errorCorrectionLevel;
  const ecMaxRatio =
    ec === 'H' ? 0.34 : ec === 'Q' ? 0.28 : ec === 'M' ? 0.24 : 0.18;
  const maxByEc = Math.max(3, Math.floor(moduleCount * ecMaxRatio));
  let maxCut = Math.min(maxSafeFrame, maxByEc);
  if (maxCut % 2 !== parity) {
    maxCut = Math.max(3, maxCut - 1);
  }

  let minCut = parity === 1 ? 5 : 4;
  if (minCut > maxCut) {
    minCut = maxCut;
  }

  let cutModules = Math.max(minCut, Math.min(maxCut, rawCutModules));
  if (cutModules % 2 !== parity) {
    cutModules = Math.max(minCut, cutModules - 1);
  }

  const cutStart = Math.floor((moduleCount - cutModules) / 2);
  const cutEnd = cutStart + cutModules;
  const cutoutPx = cutModules * moduleSize;

  // Leave a clean visual gap inside the carved-out blank center zone
  const outerGap = Math.max(2, moduleSize * 0.45);
  const maxAllowedBox = Math.max(12, cutoutPx - outerGap * 2);
  const logoBoxSize = Math.max(16, Math.min(desiredBoxPx, maxAllowedBox));
  const boxX = (canvasSize - logoBoxSize) / 2;
  const boxY = (canvasSize - logoBoxSize) / 2;

  const borderWidth = Math.max(1.5, Math.min(4, logoBoxSize * 0.032));
  const innerPadding = Math.max(4, logoBoxSize * 0.12);
  const innerSize = Math.max(8, logoBoxSize - innerPadding * 2);
  const innerX = boxX + innerPadding;
  const innerY = boxY + innerPadding;

  return {
    moduleCount,
    totalModules,
    moduleSize,
    cutStart,
    cutEnd,
    boxX,
    boxY,
    logoBoxSize,
    borderWidth,
    innerPadding,
    innerSize,
    innerX,
    innerY,
  };
}

function escapeXmlAttr(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Generate QR Code onto a canvas with non-overlapping center cutout & rounded-border logo
export async function renderQRCodeToCanvas(
  canvas: HTMLCanvasElement,
  { text, style, overrideSize, enforceExportQuietZone = false }: RenderOptions
): Promise<void> {
  const size = overrideSize || style.size;
  const margin = enforceExportQuietZone ? getEffectiveExportMargin(style) : style.margin;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const qr = QRCode.create(text, {
    errorCorrectionLevel: style.errorCorrectionLevel,
  });

  const moduleCount = qr.modules.size;
  const hasLogo = Boolean(style.logo && style.logo.dataUrl);
  const geom = computeCenterLogoGeometry(moduleCount, size, margin, style);

  // Paint canvas background
  if (style.bgColor === 'transparent') {
    ctx.clearRect(0, 0, size, size);
  } else {
    ctx.fillStyle = style.bgColor;
    ctx.fillRect(0, 0, size, size);
  }

  // Draw QR modules, skipping the center cutout zone so modules never overlap the logo
  ctx.fillStyle = style.fgColor;
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (
        hasLogo &&
        row >= geom.cutStart &&
        row < geom.cutEnd &&
        col >= geom.cutStart &&
        col < geom.cutEnd
      ) {
        continue;
      }

      if (qr.modules.get(row, col)) {
        const x0 = (col + margin) * geom.moduleSize;
        const y0 = (row + margin) * geom.moduleSize;
        const rx = Math.floor(x0);
        const ry = Math.floor(y0);
        const rw = Math.ceil(x0 + geom.moduleSize) - rx;
        const rh = Math.ceil(y0 + geom.moduleSize) - ry;
        ctx.fillRect(rx, ry, rw, rh);
      }
    }
  }

  // Draw centered logo inside its rounded border frame in the carved-out center
  if (style.logo && style.logo.dataUrl) {
    await drawCenterLogo(canvas, style.logo, style.fgColor, style.bgColor, size, geom);
  }
}

// Draw centered logo on canvas with rounded border inside the cleared center zone
async function drawCenterLogo(
  canvas: HTMLCanvasElement,
  logoSettings: NonNullable<QRStyleSettings['logo']>,
  fgColor: string,
  qrBgColor: string,
  canvasSize: number,
  geom: CenterCutoutGeometry
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const {
        boxX,
        boxY,
        logoBoxSize,
        borderWidth,
        innerPadding,
        innerSize,
        innerX,
        innerY,
      } = geom;

      const shape = logoSettings.bgShape || 'rounded';
      const outerRadius = logoBoxSize * 0.22;
      const innerRadius = Math.max(4, outerRadius - innerPadding * 0.65);
      const borderColor =
        fgColor && fgColor !== 'transparent' ? fgColor : '#0f172a';
      const fallbackBg = qrBgColor === 'transparent' ? '#ffffff' : qrBgColor;
      const bgFill = logoSettings.bgColor || fallbackBg;

      ctx.save();

      // Backing fill (skipped only if bgShape === 'none', while still framing with a rounded border)
      ctx.beginPath();
      if (shape === 'circle') {
        ctx.arc(canvasSize / 2, canvasSize / 2, logoBoxSize / 2, 0, Math.PI * 2);
      } else if (shape === 'square') {
        ctx.rect(boxX, boxY, logoBoxSize, logoBoxSize);
      } else {
        ctx.roundRect(boxX, boxY, logoBoxSize, logoBoxSize, outerRadius);
      }

      if (shape !== 'none') {
        ctx.fillStyle = bgFill;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.14)';
        ctx.shadowBlur = Math.max(3, canvasSize * 0.012);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.max(1, canvasSize * 0.004);
        ctx.fill();
      }

      // Reset shadow and draw crisp border around the centered frame
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.lineWidth = borderWidth;
      ctx.strokeStyle = borderColor;
      ctx.stroke();

      // Clip inner logo region
      ctx.beginPath();
      if (shape === 'circle') {
        ctx.arc(canvasSize / 2, canvasSize / 2, innerSize / 2, 0, Math.PI * 2);
      } else if (shape === 'square') {
        ctx.rect(innerX, innerY, innerSize, innerSize);
      } else {
        ctx.roundRect(innerX, innerY, innerSize, innerSize, innerRadius);
      }
      ctx.clip();

      // Preserve logo aspect ratio inside the centered box
      const naturalW = img.naturalWidth || img.width || innerSize;
      const naturalH = img.naturalHeight || img.height || innerSize;
      const fitScale = Math.min(innerSize / naturalW, innerSize / naturalH);
      const drawW = naturalW * fitScale;
      const drawH = naturalH * fitScale;
      const drawX = innerX + (innerSize - drawW) / 2;
      const drawY = innerY + (innerSize - drawH) / 2;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();

      resolve();
    };
    img.onerror = () => {
      resolve();
    };
    img.src = logoSettings.dataUrl;
  });
}

// Generate data URL at specific resolution
export async function getQRCodeDataUrl(
  text: string,
  style: QRStyleSettings,
  overrideSize?: number,
  enforceExportQuietZone = false
): Promise<string> {
  const offscreen = document.createElement('canvas');
  await renderQRCodeToCanvas(offscreen, {
    text,
    style,
    overrideSize,
    enforceExportQuietZone,
  });
  return offscreen.toDataURL('image/png');
}

// Generate SVG string with matching non-overlapping cutout and rounded border
export async function getQRCodeSVG(
  text: string,
  style: QRStyleSettings,
  enforceExportQuietZone = false
): Promise<string> {
  const size = style.size;
  const margin = enforceExportQuietZone ? getEffectiveExportMargin(style) : style.margin;
  const qr = QRCode.create(text, {
    errorCorrectionLevel: style.errorCorrectionLevel,
  });

  const moduleCount = qr.modules.size;
  const hasLogo = Boolean(style.logo && style.logo.dataUrl);
  const geom = computeCenterLogoGeometry(moduleCount, size, margin, style);

  const pathCommands: string[] = [];
  const modStr = geom.moduleSize.toFixed(3);

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (
        hasLogo &&
        row >= geom.cutStart &&
        row < geom.cutEnd &&
        col >= geom.cutStart &&
        col < geom.cutEnd
      ) {
        continue;
      }
      if (qr.modules.get(row, col)) {
        const x = ((col + margin) * geom.moduleSize).toFixed(3);
        const y = ((row + margin) * geom.moduleSize).toFixed(3);
        pathCommands.push(`M${x} ${y}h${modStr}v${modStr}H${x}z`);
      }
    }
  }

  const bgElement =
    style.bgColor === 'transparent'
      ? ''
      : `<rect width="${size}" height="${size}" fill="${escapeXmlAttr(style.bgColor)}" />`;

  const modulesPath = `<path d="${pathCommands.join('')}" fill="${escapeXmlAttr(
    style.fgColor
  )}" shape-rendering="crispEdges" />`;

  let logoElements = '';
  let defsElement = '';

  if (style.logo && style.logo.dataUrl) {
    const {
      boxX,
      boxY,
      logoBoxSize,
      borderWidth,
      innerPadding,
      innerSize,
      innerX,
      innerY,
    } = geom;
    const shape = style.logo.bgShape || 'rounded';
    const outerRadius = logoBoxSize * 0.22;
    const innerRadius = Math.max(4, outerRadius - innerPadding * 0.65);
    const borderColor =
      style.fgColor && style.fgColor !== 'transparent' ? style.fgColor : '#0f172a';
    const fallbackBg = style.bgColor === 'transparent' ? '#ffffff' : style.bgColor;
    const bgFill = style.logo.bgColor || fallbackBg;
    const fillAttr = shape === 'none' ? 'none' : escapeXmlAttr(bgFill);
    const clipId = `qrforge-clip-${Math.random().toString(36).slice(2, 9)}`;

    if (shape === 'circle') {
      defsElement = `<defs><clipPath id="${clipId}"><circle cx="${size / 2}" cy="${size / 2}" r="${innerSize / 2}" /></clipPath></defs>`;
      logoElements = `<circle cx="${size / 2}" cy="${size / 2}" r="${logoBoxSize / 2}" fill="${fillAttr}" stroke="${escapeXmlAttr(borderColor)}" stroke-width="${borderWidth.toFixed(2)}" />`;
    } else if (shape === 'square') {
      defsElement = `<defs><clipPath id="${clipId}"><rect x="${innerX.toFixed(2)}" y="${innerY.toFixed(2)}" width="${innerSize.toFixed(2)}" height="${innerSize.toFixed(2)}" /></clipPath></defs>`;
      logoElements = `<rect x="${boxX.toFixed(2)}" y="${boxY.toFixed(2)}" width="${logoBoxSize.toFixed(2)}" height="${logoBoxSize.toFixed(2)}" fill="${fillAttr}" stroke="${escapeXmlAttr(borderColor)}" stroke-width="${borderWidth.toFixed(2)}" />`;
    } else {
      defsElement = `<defs><clipPath id="${clipId}"><rect x="${innerX.toFixed(2)}" y="${innerY.toFixed(2)}" width="${innerSize.toFixed(2)}" height="${innerSize.toFixed(2)}" rx="${innerRadius.toFixed(2)}" /></clipPath></defs>`;
      logoElements = `<rect x="${boxX.toFixed(2)}" y="${boxY.toFixed(2)}" width="${logoBoxSize.toFixed(2)}" height="${logoBoxSize.toFixed(2)}" rx="${outerRadius.toFixed(2)}" fill="${fillAttr}" stroke="${escapeXmlAttr(borderColor)}" stroke-width="${borderWidth.toFixed(2)}" />`;
    }

    logoElements += `<image href="${escapeXmlAttr(
      style.logo.dataUrl
    )}" x="${innerX.toFixed(2)}" y="${innerY.toFixed(2)}" width="${innerSize.toFixed(
      2
    )}" height="${innerSize.toFixed(
      2
    )}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${defsElement}${bgElement}${modulesPath}${logoElements}</svg>`;
}

// Download Helper
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Copy Image to Clipboard
export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      try {
        if (navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob,
            }),
          ]);
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (err) {
        console.warn('Clipboard write error:', err);
        resolve(false);
      }
    }, 'image/png');
  });
}

// Web Share API with Fallback
export async function shareQRCodeImage(
  canvas: HTMLCanvasElement,
  title: string,
  text: string
): Promise<{ shared: boolean; method: 'web-share' | 'clipboard' | 'fallback' }> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve({ shared: false, method: 'fallback' });
        return;
      }

      const file = new File([blob], `qrforge-${Date.now()}.png`, { type: 'image/png' });

      // Check if Web Share API with files is supported
      if (
        navigator.canShare &&
        navigator.canShare({ files: [file] }) &&
        navigator.share
      ) {
        try {
          await navigator.share({
            title: title || 'QRForge Code',
            text: text || 'Scan with your camera',
            files: [file],
          });
          resolve({ shared: true, method: 'web-share' });
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') {
            resolve({ shared: false, method: 'web-share' });
            return;
          }
        }
      }

      // Fallback: Copy to clipboard
      const copied = await copyCanvasToClipboard(canvas);
      if (copied) {
        resolve({ shared: true, method: 'clipboard' });
      } else {
        // Fallback: trigger download
        downloadBlob(blob, `qrforge-${Date.now()}.png`);
        resolve({ shared: true, method: 'fallback' });
      }
    }, 'image/png');
  });
}
