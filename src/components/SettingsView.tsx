import React, { useRef } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  Trash2,
  ShieldCheck,
  Smartphone,
  Info,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { useToast } from '../context/ToastContext';

interface SettingsViewProps {
  libraryCount: number;
  storageSizeKB: number;
  onExportJSON: () => void;
  onImportJSON: (jsonStr: string) => { success: boolean; importedCount: number; message: string };
  onClearLibrary: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  libraryCount,
  storageSizeKB,
  onExportJSON,
  onImportJSON,
  onClearLibrary,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = onImportJSON(content);
        if (res.success) {
          showToast(res.message, 'success');
        } else {
          showToast(res.message, 'error');
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      {/* 1. Storage & Backup */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-[#2f6bff]/20 text-[#4da3ff]">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Local Storage & Backup</h3>
            <p className="text-xs text-white/60">
              All saved QR codes live strictly inside your browser's localStorage.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-xs text-white/50 block">Saved Items</span>
            <span className="text-2xl font-bold text-white font-mono">{libraryCount}</span>
          </div>
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-xs text-white/50 block">Storage Used</span>
            <span className="text-2xl font-bold text-[#4da3ff] font-mono">
              {storageSizeKB} <span className="text-xs font-normal">KB</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileImport}
            className="hidden"
            id="settings-import-json"
          />
          <label
            htmlFor="settings-import-json"
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 cursor-pointer transition-all active:scale-95 min-h-[46px]"
          >
            <Upload className="w-4 h-4 text-[#4da3ff]" />
            <span>Import Backup JSON</span>
          </label>

          <button
            onClick={onExportJSON}
            disabled={libraryCount === 0}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition-all active:scale-95 disabled:opacity-40 min-h-[46px]"
          >
            <Download className="w-4 h-4 text-[#4da3ff]" />
            <span>Export Backup JSON</span>
          </button>

          {libraryCount > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete all saved QR codes?')) {
                  onClearLibrary();
                  showToast('Library cleared', 'info');
                }
              }}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#ff3b4e]/15 hover:bg-[#ff3b4e]/25 text-[#ff6b7a] font-semibold text-xs border border-[#ff3b4e]/30 transition-all active:scale-95 min-h-[46px]"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Library</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. PWA App Installation */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-[#2f6bff]/20 text-[#4da3ff]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">App & Android APK Hub</h3>
              <p className="text-xs text-white/60">
                Install as a native WebAPK or package standalone .apk/.aab binaries.
              </p>
            </div>
          </div>
          <PWAInstallButton />
        </div>

        <div className="space-y-2 text-xs text-white/70 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#4da3ff] shrink-0" />
            <span><strong>WebAPK:</strong> Android Chrome automatically mints and installs a native signed .apk</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#4da3ff] shrink-0" />
            <span><strong>PWABuilder & Bubblewrap:</strong> 1-click generation of standalone APK / Google Play AAB packages</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#4da3ff] shrink-0" />
            <span><strong>100% Offline:</strong> Precached application shell, local storage, zero telemetry</span>
          </div>
        </div>
      </div>

      {/* 3. QR Technology & Standards Guide */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-[#2f6bff]/20 text-[#4da3ff]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Error Correction & Printing Advice</h3>
            <p className="text-xs text-white/60">
              Tips for creating scannable codes in print and digital media.
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs text-white/70 leading-relaxed">
          <p>
            • <strong className="text-white">Level L (7%) & M (15%):</strong> Best for simple URLs and raw text without logos. Produces clean, spacious module matrices that scan rapidly even from a distance.
          </p>
          <p>
            • <strong className="text-white">Level H (30%):</strong> Essential when placing a company logo in the center. Reed-Solomon error correction restores occluded data reliably.
          </p>
          <p>
            • <strong className="text-white">Print Contrast:</strong> Maintain high contrast between modules and background. Dark modules on a white or light backing ensure universal smartphone camera detection.
          </p>
        </div>
      </div>

      {/* 4. About & Version */}
      <div className="text-center pt-4">
        <div className="flex items-center justify-center gap-1.5 text-xs text-white/50 mb-1">
          <span>QRForge PWA</span>
          <span>·</span>
          <span>Version 1.0.0</span>
          <span>·</span>
          <span>Client-Side Engine</span>
        </div>
        <p className="text-[11px] text-white/30">
          Crafted with React, Tailwind CSS, and the qrcode engine.
        </p>
      </div>
    </div>
  );
};
