import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Download,
  FileCode,
  Copy,
  Share2,
  Edit3,
  CopyPlus,
  Trash2,
  Heart,
  Check,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { SavedQRItem } from '../types/qr';
import {
  renderQRCodeToCanvas,
  getQRCodeSVG,
  downloadBlob,
  copyCanvasToClipboard,
  shareQRCodeImage,
} from '../utils/qrRenderer';
import { useToast } from '../context/ToastContext';

interface QRDetailsModalProps {
  item: SavedQRItem | null;
  onClose: () => void;
  onEdit: (item: SavedQRItem) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onRename: (id: string, newName: string) => void;
}

export const QRDetailsModal: React.FC<QRDetailsModalProps> = ({
  item,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
  onRename,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    if (item) {
      setNameInput(item.name);
      setIsEditingName(false);
      setShowDeleteConfirm(false);
    }
  }, [item]);

  useEffect(() => {
    if (!item || !canvasRef.current) return;
    renderQRCodeToCanvas(canvasRef.current, {
      text: item.encodedData,
      style: item.style,
      overrideSize: 512,
    });
  }, [item]);

  if (!item) return null;

  const handleDownloadPNG = async () => {
    const exportCanvas = document.createElement('canvas');
    await renderQRCodeToCanvas(exportCanvas, {
      text: item.encodedData,
      style: item.style,
      overrideSize: item.style.size || 1024,
    });

    exportCanvas.toBlob((blob) => {
      if (blob) {
        const safeName = item.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        downloadBlob(blob, `${safeName}.png`);
        showToast('PNG Downloaded!', 'success');
      }
    }, 'image/png');
  };

  const handleDownloadSVG = async () => {
    try {
      const svg = await getQRCodeSVG(item.encodedData, item.style);
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const safeName = item.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      downloadBlob(blob, `${safeName}.svg`);
      showToast('Vector SVG Downloaded!', 'success');
    } catch {
      showToast('Failed to generate SVG', 'error');
    }
  };

  const handleCopy = async () => {
    if (!canvasRef.current) return;
    const ok = await copyCanvasToClipboard(canvasRef.current);
    if (ok) {
      setCopied(true);
      showToast('QR Code copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } else {
      showToast('Clipboard write failed', 'error');
    }
  };

  const handleShare = async () => {
    if (!canvasRef.current) return;
    const res = await shareQRCodeImage(canvasRef.current, item.name, 'Scan this QR code');
    if (res.shared) {
      showToast('Shared successfully!', 'success');
    }
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      onRename(item.id, nameInput.trim());
      setIsEditingName(false);
      showToast('Name updated', 'success');
    }
  };

  const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/75 backdrop-blur-md p-0 md:p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      {/* Background click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal / Bottom Sheet Container */}
      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-[#0a1026] border border-white/20 p-5 sm:p-6 shadow-2xl text-white z-10">
        {/* Mobile Grab Handle */}
        <div className="md:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto -mt-1 mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
            {isEditingName ? (
              <div className="flex items-center gap-1.5 w-full">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="glass-input rounded-xl px-3 py-1.5 text-base text-white w-full"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="p-2 rounded-xl bg-[#2f6bff] text-white shrink-0"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-lg font-bold truncate">{item.name}</h3>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded-lg text-white/40 hover:text-white"
                  title="Rename"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onToggleFavorite(item.id)}
              className={`p-2 rounded-xl border transition-all ${
                item.isFavorite
                  ? 'bg-[#ff3b4e]/20 border-[#ff3b4e]/50 text-[#ff3b4e]'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
              title={item.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
            >
              <Heart className={`w-4 h-4 ${item.isFavorite ? 'fill-current' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              aria-label="Close details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scannable White Tile */}
        <div className="flex flex-col items-center my-5">
          <div className="p-4 sm:p-5 rounded-2xl bg-white shadow-2xl flex items-center justify-center max-w-[220px] max-h-[220px]">
            <canvas ref={canvasRef} className="w-full h-full object-contain" />
          </div>

          <div className="flex items-center gap-2 mt-3 text-xs text-white/60">
            <span className="uppercase font-semibold tracking-wider text-[#4da3ff] bg-[#2f6bff]/15 px-2.5 py-0.5 rounded-full">
              {item.type}
            </span>
            <span>·</span>
            <span>Created {formattedDate}</span>
          </div>
        </div>

        {/* Encoded Data Display */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 mb-5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50 block mb-1">
            Raw Encoded Content
          </span>
          <p className="text-xs font-mono text-white/80 break-all line-clamp-3 select-all">
            {item.encodedData}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <button
            onClick={handleDownloadPNG}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white text-sm font-semibold shadow-md active:scale-95 transition-all min-h-[46px]"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>

          <button
            onClick={handleDownloadSVG}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-semibold active:scale-95 transition-all min-h-[46px]"
          >
            <FileCode className="w-4 h-4 text-[#4da3ff]" />
            <span>Download SVG</span>
          </button>
        </div>

        {/* Secondary Actions */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <button
            onClick={handleCopy}
            className="flex flex-col items-center justify-center py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 transition-all active:scale-95 min-h-[50px]"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400 mb-1" />
            ) : (
              <Copy className="w-4 h-4 mb-1" />
            )}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleShare}
            className="flex flex-col items-center justify-center py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 transition-all active:scale-95 min-h-[50px]"
          >
            <Share2 className="w-4 h-4 mb-1" />
            <span>Share</span>
          </button>

          <button
            onClick={() => {
              onEdit(item);
              onClose();
            }}
            className="flex flex-col items-center justify-center py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 transition-all active:scale-95 min-h-[50px]"
          >
            <Edit3 className="w-4 h-4 mb-1 text-[#4da3ff]" />
            <span>Edit</span>
          </button>

          <button
            onClick={() => {
              onDuplicate(item.id);
              onClose();
            }}
            className="flex flex-col items-center justify-center py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 transition-all active:scale-95 min-h-[50px]"
          >
            <CopyPlus className="w-4 h-4 mb-1 text-[#4da3ff]" />
            <span>Clone</span>
          </button>
        </div>

        {/* Delete Row with confirmation */}
        <div className="pt-2 border-t border-white/10">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70 flex-1">
                Delete permanently?
              </span>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-2 text-xs font-semibold rounded-xl bg-white/10 text-white/80"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(item.id);
                  onClose();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#ff3b4e] hover:bg-[#e02b3d] text-white shadow-lg shadow-[#ff3b4e]/30"
              >
                Yes, Delete
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold text-[#ff3b4e] hover:bg-[#ff3b4e]/10 rounded-xl transition-colors min-h-[44px]"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete from Library</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
