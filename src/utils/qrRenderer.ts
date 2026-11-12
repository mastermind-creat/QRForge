import QRCode from 'qrcode';
import { QRStyleSettings } from '../types/qr';

export interface RenderOptions {
  text: string;
  style: QRStyleSettings;
  overrideSize?: number;
}

// Generate QR Code onto a canvas with center logo support
export async function renderQRCodeToCanvas(
  canvas: HTMLCanvasElement,
  { text, style, overrideSize }: RenderOptions
): Promise<void> {
  const size = overrideSize || style.size;
  canvas.width = size;
  canvas.height = size;

  // Render raw QR code to canvas
  await QRCode.toCanvas(canvas, text, {
    width: size,
    margin: style.margin,
    color: {
      dark: style.fgColor,
      light: style.bgColor === 'transparent' ? '#00000000' : style.bgColor,
    },
    errorCorrectionLevel: style.errorCorrectionLevel,
  });

  // If center logo is specified, draw it cleanly
  if (style.logo && style.logo.dataUrl) {
    await drawCenterLogo(canvas, style.logo, size);
  }
}

// Draw centered logo on canvas with backing shape for scannability
async function drawCenterLogo(
  canvas: HTMLCanvasElement,
  logoSettings: NonNullable<QRStyleSettings['logo']>,
  canvasSize: number
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Calculate logo box dimensions
      const percent = Math.min(Math.max(logoSettings.sizePercent || 22, 12), 32) / 100;
      const logoBoxSize = canvasSize * percent;
      const x = (canvasSize - logoBoxSize) / 2;
      const y = (canvasSize - logoBoxSize) / 2;
      const padding = Math.max(4, logoBoxSize * 0.12);
      const innerSize = logoBoxSize - padding * 2;
      const innerX = x + padding;
      const innerY = y + padding;

      ctx.save();

      // Draw backing shape so QR modules behind logo don't clash
      if (logoSettings.bgShape !== 'none') {
        const bgFill = logoSettings.bgColor || '#ffffff';
        ctx.fillStyle = bgFill;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = Math.max(4, canvasSize * 0.015);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = Math.max(2, canvasSize * 0.008);

        ctx.beginPath();
        if (logoSettings.bgShape === 'circle') {
          ctx.arc(canvasSize / 2, canvasSize / 2, logoBoxSize / 2, 0, Math.PI * 2);
        } else if (logoSettings.bgShape === 'rounded') {
          const r = logoBoxSize * 0.22;
          ctx.roundRect(x, y, logoBoxSize, logoBoxSize, r);
        } else {
          ctx.rect(x, y, logoBoxSize, logoBoxSize);
        }
        ctx.fill();

        // Reset shadow for logo
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // Clip and draw image
      ctx.beginPath();
      if (logoSettings.bgShape === 'circle') {
        ctx.arc(canvasSize / 2, canvasSize / 2, innerSize / 2, 0, Math.PI * 2);
      } else if (logoSettings.bgShape === 'rounded') {
        const r = innerSize * 0.18;
        ctx.roundRect(innerX, innerY, innerSize, innerSize, r);
      } else {
        ctx.rect(innerX, innerY, innerSize, innerSize);
      }
      ctx.clip();

      ctx.drawImage(img, innerX, innerY, innerSize, innerSize);
      ctx.restore();

      resolve();
    };
    img.onerror = () => {
      // If logo fails to load, gracefully continue with raw QR
      resolve();
    };
    img.src = logoSettings.dataUrl;
  });
}

// Generate data URL at specific resolution
export async function getQRCodeDataUrl(
  text: string,
  style: QRStyleSettings,
  overrideSize?: number
): Promise<string> {
  const offscreen = document.createElement('canvas');
  await renderQRCodeToCanvas(offscreen, { text, style, overrideSize });
  return offscreen.toDataURL('image/png');
}

// Generate SVG string
export async function getQRCodeSVG(text: string, style: QRStyleSettings): Promise<string> {
  const rawSvg = await QRCode.toString(text, {
    type: 'svg',
    width: style.size,
    margin: style.margin,
    color: {
      dark: style.fgColor,
      light: style.bgColor === 'transparent' ? '#00000000' : style.bgColor,
    },
    errorCorrectionLevel: style.errorCorrectionLevel,
  });

  // If logo present, embed image in SVG
  if (style.logo && style.logo.dataUrl) {
    const size = style.size;
    const percent = Math.min(Math.max(style.logo.sizePercent || 22, 12), 32) / 100;
    const logoBoxSize = size * percent;
    const x = (size - logoBoxSize) / 2;
    const y = (size - logoBoxSize) / 2;
    const padding = Math.max(4, logoBoxSize * 0.12);
    const innerSize = logoBoxSize - padding * 2;
    const innerX = x + padding;
    const innerY = y + padding;
    const bg = style.logo.bgColor || '#ffffff';

    let shapeElement = '';
    if (style.logo.bgShape === 'circle') {
      shapeElement = `<circle cx="${size / 2}" cy="${size / 2}" r="${logoBoxSize / 2}" fill="${bg}" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))" />`;
    } else if (style.logo.bgShape === 'rounded') {
      shapeElement = `<rect x="${x}" y="${y}" width="${logoBoxSize}" height="${logoBoxSize}" rx="${logoBoxSize * 0.22}" fill="${bg}" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))" />`;
    } else if (style.logo.bgShape === 'square') {
      shapeElement = `<rect x="${x}" y="${y}" width="${logoBoxSize}" height="${logoBoxSize}" fill="${bg}" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))" />`;
    }

    const imageElement = `<image href="${style.logo.dataUrl}" x="${innerX}" y="${innerY}" width="${innerSize}" height="${innerSize}" preserveAspectRatio="xMidYMid meet" />`;

    // Inject before closing </svg>
    return rawSvg.replace('</svg>', `${shapeElement}${imageElement}</svg>`);
  }

  return rawSvg;
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
