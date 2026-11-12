import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Copy,
  Share2,
  BookmarkPlus,
  Check,
  FileCode,
  Sparkles,
  AlertTriangle,
  ZoomIn,
} from 'lucide-react';
import { QRStyleSettings, QRType, SavedQRItem } from '../types/qr';
import {
  renderQRCodeToCanvas,
  getQRCodeSVG,
  downloadBlob,
  copyCanvasToClipboard,
  shareQRCodeImage,
} from '../utils/qrRenderer';
import { useToast } from '../context/ToastContext';

interface QRPreviewProps {
  type: QRType;
  encodedData: string;
  formValues: Record<string, any>;
  style: QRStyleSettings;
  suggestedName: string;
  isValid: boolean;
  validationError?: string;
  onSaveToLibrary: (item: Omit<SavedQRItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const QRPreview: React.FC<QRPreviewProps> = ({
  type,
  encodedData,
  formValues,
  style,
  suggestedName,
  isValid,
  validationError,
  onSaveToLibrary,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [customName, setCustomName] = useState(suggestedName);
  const [isEnlarged, setIsEnlarged] = useState(false);

  const { showToast } = useToast();

  // Keep customName synced when suggestedName changes (if user hasn't typed custom)
  useEffect(() => {
    setCustomName(suggestedName);
  }, [suggestedName]);

  // Debounced QR code canvas rendering
  useEffect(() => {
    if (!canvasRef.current || !isValid || !encodedData) return;

    let isMounted = true;
    setIsRendering(true);

    const timer = setTimeout(async () => {
      try {
        if (canvasRef.current) {
          await renderQRCodeToCanvas(canvasRef.current, {
            text: encodedData,
            style,
            overrideSize: Math.min(style.size, 1024), // preview limit for fast DOM render
          });
        }
      } catch (err) {
        console.error('QR rendering error:', err);
      } finally {
        if (isMounted) setIsRendering(false);
      }
    }, 180);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [encodedData, style, isValid]);

  // 1. Download PNG
  const handleDownloadPNG = async () => {
    if (!encodedData || !isValid) {
      showToast('Cannot download: Invalid or empty QR data', 'error');
      return;
    }

    try {
      showToast('Rendering high-resolution PNG...', 'info', 1500);
      const exportCanvas = document.createElement('canvas');
      await renderQRCodeToCanvas(exportCanvas, {
        text: encodedData,
        style,
        overrideSize: style.size, // Exact user chosen resolution
      });

      exportCanvas.toBlob((blob) => {
        if (blob) {
          const safeName = (customName || suggestedName || 'qrforge')
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '-');
          downloadBlob(blob, `${safeName}-${style.size}px.png`);
          showToast(`PNG downloaded (${style.size}x${style.size})!`, 'success');
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
      showToast('Failed to download PNG', 'error');
    }
  };

  // 2. Download SVG
  const handleDownloadSVG = async () => {
    if (!encodedData || !isValid) {
      showToast('Cannot download: Invalid or empty QR data', 'error');
      return;
    }

    try {
      const svgString = await getQRCodeSVG(encodedData, style);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const safeName = (customName || suggestedName || 'qrforge')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-');
      downloadBlob(blob, `${safeName}.svg`);
      showToast('Vector SVG downloaded!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate SVG', 'error');
    }
  };

  // 3. Copy Image to Clipboard
  const handleCopyImage = async () => {
    if (!canvasRef.current || !isValid) {
      showToast('No valid QR code to copy', 'error');
      return;
    }

    const success = await copyCanvasToClipboard(canvasRef.current);
    if (success) {
      setCopied(true);
      showToast('QR Code copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } else {
      showToast('Clipboard write not supported by this browser.', 'error');
    }
  };

  // 4. Share QR Code
  const handleShare = async () => {
    if (!canvasRef.current || !isValid) return;

    const res = await shareQRCodeImage(
      canvasRef.current,
      customName || suggestedName,
      `QR Code for ${type.toUpperCase()}`
    );

    if (res.shared) {
      if (res.method === 'web-share') {
        showToast('Shared successfully!', 'success');
      } else if (res.method === 'clipboard') {
        showToast('Image copied to clipboard for sharing!', 'success');
      } else {
        showToast('Saved image for sharing!', 'info');
      }
    }
  };

  // 5. Save to Library
  const handleSave = () => {
    if (!isValid || !encodedData) {
      showToast('Please fill required fields before saving', 'error');
      return;
    }

    let thumbnail: string | undefined = undefined;
    if (canvasRef.current) {
      try {
        thumbnail = canvasRef.current.toDataURL('image/png');
      } catch {
        // Continue without thumbnail if canvas tainted
      }
    }

    onSaveToLibrary({
      name: customName.trim() || suggestedName || 'My QR Code',
      type,
      encodedData,
      formValues,
      style,
      isFavorite: false,
      thumbnail,
    });

    setSaved(true);
    setShowSaveModal(false);
    showToast('Saved to your Library!', 'success');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col items-center text-center relative overflow-hidden">
      {/* Top Banner & Status */}
      <div className="w-full flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
          Live Preview
        </span>
        <div className="flex items-center gap-2">
          {isValid ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#4da3ff]">
              <span className="w-2 h-2 rounded-full bg-[#4da3ff]" />
              Scannable
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-[#ff3b4e]">
              <AlertTriangle className="w-3.5 h-3.5" />
              Incomplete
            </span>
          )}
        </div>
      </div>

      {/* The Scannable Tile */}
      <div className="relative group my-2">
        <div
          onClick={() => isValid && setIsEnlarged(true)}
          className={`relative p-5 sm:p-6 rounded-3xl bg-white shadow-2xl transition-all duration-300 flex items-center justify-center cursor-pointer ${
            isValid
              ? 'hover:scale-[1.02] shadow-[#2f6bff]/20 ring-4 ring-white/10'
              : 'opacity-40 grayscale'
          }`}
          style={{ maxWidth: 300, maxHeight: 300, minWidth: 240, minHeight: 240 }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain rounded-xl max-w-[240px] max-h-[240px]"
          />

          {isRendering && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs rounded-3xl flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-3 border-[#2f6bff]/20 border-t-[#2f6bff] animate-spin" />
            </div>
          )}

          {/* Enlarge click hint on hover */}
          {isValid && (
            <div className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="w-4 h-4" />
            </div>
          )}
        </div>

        {!isValid && (
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <span className="text-xs font-medium text-slate-800 bg-white/90 px-3 py-1.5 rounded-xl shadow-lg border border-slate-200">
              {validationError || 'Enter valid data to generate'}
            </span>
          </div>
        )}
      </div>

      {/* Data payload info & capacity notice */}
      <div className="w-full mt-3 mb-5 px-2">
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>Payload: {encodedData.length} bytes</span>
          <span>Level {style.errorCorrectionLevel}</span>
        </div>
        {encodedData.length > 500 && (
          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>High data density: Higher error correction (Q/H) recommended.</span>
          </div>
        )}
      </div>

      {/* Primary Action Buttons */}
      <div className="w-full grid grid-cols-2 gap-2.5">
        <button
          onClick={handleDownloadPNG}
          disabled={!isValid}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] hover:shadow-[0_0_24px_rgba(47,107,255,0.45)] text-white font-semibold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed min-h-[46px]"
        >
          <Download className="w-4 h-4" />
          <span>Save PNG</span>
        </button>

        <button
          onClick={handleDownloadSVG}
          disabled={!isValid}
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed min-h-[46px]"
        >
          <FileCode className="w-4 h-4 text-[#4da3ff]" />
          <span>Save SVG</span>
        </button>
      </div>

      {/* Secondary Actions Row: Copy, Share, Save to Library */}
      <div className="w-full grid grid-cols-3 gap-2 mt-2.5">
        <button
          onClick={handleCopyImage}
          disabled={!isValid}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 min-h-[44px]"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>

        <button
          onClick={handleShare}
          disabled={!isValid}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 min-h-[44px]"
        >
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>

        <button
          onClick={() => setShowSaveModal(true)}
          disabled={!isValid}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 min-h-[44px] ${
            saved
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
              : 'bg-[#2f6bff]/20 hover:bg-[#2f6bff]/30 text-[#4da3ff] border-[#2f6bff]/40'
          }`}
        >
          {saved ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <BookmarkPlus className="w-4 h-4" />
          )}
          <span>{saved ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      {/* Save Name Modal / Prompt */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#0a1026] border border-white/20 p-6 shadow-2xl text-left">
            <h3 className="text-lg font-bold text-white mb-1.5">Save to Library</h3>
            <p className="text-xs text-white/60 mb-4">
              Give your QR code a recognizable name to easily locate it in your library.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/80 block mb-1">
                  QR Code Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Office WiFi or Portfolio Link"
                  className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-sm font-semibold transition-all min-h-[46px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white text-sm font-semibold shadow-lg shadow-[#2f6bff]/30 transition-all min-h-[46px]"
                >
                  Save QR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Zoom Modal */}
      {isEnlarged && (
        <div
          onClick={() => setIsEnlarged(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-lg p-6 cursor-pointer animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="p-8 bg-white rounded-3xl shadow-2xl max-w-sm w-full flex flex-col items-center text-center cursor-default"
          >
            <h4 className="text-slate-900 font-bold text-lg mb-4">
              {customName || suggestedName}
            </h4>
            <div className="w-64 h-64 flex items-center justify-center">
              <canvas
                ref={(node) => {
                  if (node && encodedData) {
                    renderQRCodeToCanvas(node, {
                      text: encodedData,
                      style,
                      overrideSize: 512,
                    });
                  }
                }}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Tap anywhere outside to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
