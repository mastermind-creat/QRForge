import React, { useState } from 'react';
import { Download, Share2, PlusSquare, X, Package } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { APKInstallModal } from './APKInstallModal';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showAPKModal, setShowAPKModal] = useState(false);

  // If already installed, don't show the generic install CTA
  if (isInstalled) {
    return (
      <>
        <button
          onClick={() => setShowAPKModal(true)}
          className={`flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all min-h-[44px] ${
            compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs'
          }`}
          title="APK & TWA Options"
        >
          <Package className="w-3.5 h-3.5 text-[#4da3ff]" />
          <span>APK Hub</span>
        </button>
        <APKInstallModal isOpen={showAPKModal} onClose={() => setShowAPKModal(false)} />
      </>
    );
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <>
        <div className="flex items-center gap-1">
          <button
            onClick={install}
            className={`flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] font-medium text-white shadow-lg shadow-[#2f6bff]/25 hover:shadow-[#2f6bff]/40 active:scale-95 transition-all min-h-[44px] ${
              compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
            }`}
            aria-label="Install QRForge App / APK"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{isAndroid ? 'Install APK' : 'Install App'}</span>
          </button>

          <button
            onClick={() => setShowAPKModal(true)}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors min-h-[44px]"
            title="Android APK Packaging & Options"
            aria-label="APK packaging options"
          >
            <Package className="w-4 h-4 text-[#4da3ff]" />
          </button>
        </div>
        <APKInstallModal isOpen={showAPKModal} onClose={() => setShowAPKModal(false)} />
      </>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/15 text-white/90 hover:bg-white/15 active:scale-95 transition-all min-h-[44px] ${
            compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'
          }`}
          aria-label="Install on iPhone / iPad"
        >
          <Download className="w-4 h-4 text-[#4da3ff] shrink-0" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fadeIn"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-sm rounded-3xl bg-[#0a1026] border border-white/15 p-6 shadow-2xl text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 id="ios-install-title" className="text-lg font-bold">
                  Install QRForge on iOS
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-sm text-white/80">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="p-2 rounded-xl bg-[#2f6bff]/20 text-[#4da3ff] shrink-0">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block">Step 1</span>
                    Tap the <strong className="text-white">Share</strong> button in the Safari bottom toolbar.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                  <div className="p-2 rounded-xl bg-[#2f6bff]/20 text-[#4da3ff] shrink-0">
                    <PlusSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-white block">Step 2</span>
                    Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] font-medium text-white shadow-lg shadow-[#2f6bff]/30"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback button to open APK Hub modal even when beforeinstallprompt has not fired yet or on other browsers
  return (
    <>
      <button
        onClick={() => setShowAPKModal(true)}
        className={`flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] font-medium text-white shadow-md active:scale-95 transition-all min-h-[44px] ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'
        }`}
        aria-label="Get Android APK"
      >
        <Package className="w-4 h-4 shrink-0" />
        <span>Install APK</span>
      </button>
      <APKInstallModal isOpen={showAPKModal} onClose={() => setShowAPKModal(false)} />
    </>
  );
};
