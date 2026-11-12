import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Download,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Terminal,
  Layers,
  ArrowRight,
  Package,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useToast } from '../context/ToastContext';
import { downloadBlob } from '../utils/qrRenderer';

interface APKInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const APKInstallModal: React.FC<APKInstallModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, isInstalled, isAndroid, install } = usePWAInstall();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [activeTab, setActiveTab] = useState<'webapk' | 'pwabuilder' | 'cli'>('webapk');
  const { showToast } = useToast();

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const pwabuilderUrl = `https://www.pwabuilder.com/app?url=${encodeURIComponent(currentUrl)}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedUrl(true);
    showToast('App URL copied to clipboard!', 'success');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyCmd = () => {
    const cmd = `npx @bubblewrap/cli init --manifest=${currentUrl}/manifest.json && npx @bubblewrap/cli build`;
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(true);
    showToast('CLI command copied!', 'success');
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleDownloadTWAManifest = () => {
    const twaConfig = {
      packageId: 'app.qrforge.twa',
      host: typeof window !== 'undefined' ? window.location.hostname : 'qrforge.app',
      name: 'QRForge',
      launcherName: 'QRForge',
      themeColor: '#05060f',
      navigationColor: '#05060f',
      backgroundColor: '#05060f',
      startUrl: '/',
      iconUrl: `${currentUrl}/pwa-512x512.png`,
      maskableIconUrl: `${currentUrl}/pwa-maskable-512x512.png`,
      appVersionName: '1.0.0',
      appVersionCode: 1,
      shortcuts: [
        {
          name: 'Create QR Code',
          shortName: 'Create',
          url: '/?tab=create',
          icon: `${currentUrl}/pwa-192x192.png`,
        },
      ],
      enableNotifications: false,
      generatorApp: 'QRForge Android Tool',
    };

    const blob = new Blob([JSON.stringify(twaConfig, null, 2)], {
      type: 'application/json',
    });
    downloadBlob(blob, 'twa-manifest.json');
    showToast('twa-manifest.json downloaded!', 'success');
  };

  const handleDirectInstall = async () => {
    const success = await install();
    if (success) {
      showToast('APK installation started on your device!', 'success');
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apk-modal-title"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#0a1026] border border-white/20 p-5 sm:p-6 shadow-2xl text-white z-10">
        {/* Grab Handle on Mobile */}
        <div className="sm:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto -mt-1 mb-4" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#2f6bff] to-[#4da3ff] text-white shadow-lg shadow-[#2f6bff]/30">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 id="apk-modal-title" className="text-lg font-bold">
                Install as Android APK
              </h3>
              <p className="text-xs text-white/60">
                WebAPK, PWABuilder, and Trusted Web Activity (TWA)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Option Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 my-4">
          <button
            onClick={() => setActiveTab('webapk')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'webapk'
                ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            1. WebAPK (1-Tap)
          </button>
          <button
            onClick={() => setActiveTab('pwabuilder')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'pwabuilder'
                ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            2. PWABuilder
          </button>
          <button
            onClick={() => setActiveTab('cli')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'cli'
                ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
          >
            3. Bubblewrap CLI
          </button>
        </div>

        {/* Tab 1: Direct WebAPK */}
        {activeTab === 'webapk' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#2f6bff]/10 border border-[#2f6bff]/30 space-y-2">
              <div className="flex items-center gap-2 text-[#4da3ff]">
                <Smartphone className="w-5 h-5 shrink-0" />
                <h4 className="text-sm font-bold">Android Native WebAPK</h4>
              </div>
              <p className="text-xs text-white/80 leading-relaxed">
                When installed from Chrome on Android, Google Chrome automatically uses its official <strong>WebAPK minting service</strong> to generate, sign, and install an authentic <strong>.apk</strong> package into your Android system without manual sideloading.
              </p>
            </div>

            <div className="space-y-2 text-xs text-white/70">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                <span>Installs with genuine Android package signature (e.g. <code>org.chromium.webapk.*</code>)</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                <span>Appears directly in Android App Drawer, Homescreen, and Settings &gt; Apps</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/10 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                <span>Runs full-screen with offline caching, high performance, and standalone identity</span>
              </div>
            </div>

            {isInstalled ? (
              <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-center gap-2 font-medium">
                <Check className="w-4 h-4" />
                <span>QRForge is already installed as an app on this device!</span>
              </div>
            ) : isInstallable ? (
              <button
                onClick={handleDirectInstall}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] hover:shadow-[0_0_24px_rgba(47,107,255,0.45)] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all min-h-[48px]"
              >
                <Download className="w-4 h-4" />
                <span>Install WebAPK on this Device Now</span>
              </button>
            ) : (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-xs text-white/90 font-semibold block">
                  How to trigger WebAPK on your Android phone:
                </span>
                <ol className="text-xs text-white/70 space-y-1.5 list-decimal list-inside">
                  <li>Open this app in <strong>Google Chrome for Android</strong>.</li>
                  <li>Tap the <strong>three dots menu (⋮)</strong> in Chrome toolbar.</li>
                  <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                  <li>Chrome creates and installs the native WebAPK package!</li>
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: PWABuilder (No Code APK Generator) */}
        {activeTab === 'pwabuilder' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#4da3ff]" />
                <span>Generate APK via PWABuilder</span>
              </h4>
              <p className="text-xs text-white/70 leading-relaxed">
                PWABuilder (maintained by Microsoft & Google) inspects the QRForge manifest and packages a signed standalone <strong>.apk</strong> (for sideloading) and <strong>.aab</strong> (for Google Play Store) in 1 click.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/80 block">
                QRForge Web App URL:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={currentUrl}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-white/90"
                />
                <button
                  onClick={handleCopyUrl}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold shrink-0 flex items-center gap-1.5 min-h-[38px]"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <a
              href={pwabuilderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#2f6bff]/30 active:scale-95 transition-all min-h-[48px]"
            >
              <span>Build APK on PWABuilder.com</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Tab 3: Bubblewrap CLI */}
        {activeTab === 'cli' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#4da3ff]" />
                <span>Bubblewrap CLI (Official Google Tool)</span>
              </h4>
              <p className="text-xs text-white/70 leading-relaxed">
                Google's Bubblewrap command-line tool takes the pre-configured Web App Manifest and builds a production-ready Android APK in seconds using Android SDK / TWA.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-white/70 mb-1.5">
                <span>Run command in your terminal:</span>
                <button
                  onClick={handleCopyCmd}
                  className="text-[#4da3ff] hover:underline flex items-center gap-1"
                >
                  {copiedCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd ? 'Copied' : 'Copy command'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-black/60 border border-white/15 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap select-all">
{`npx @bubblewrap/cli init --manifest=${currentUrl}/manifest.json
npx @bubblewrap/cli build`}
              </pre>
            </div>

            <button
              onClick={handleDownloadTWAManifest}
              className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all min-h-[44px]"
            >
              <Download className="w-4 h-4 text-[#4da3ff]" />
              <span>Download twa-manifest.json Config</span>
            </button>
          </div>
        )}

        {/* Bottom Security / Privacy Note */}
        <div className="mt-5 pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/50">
          <ShieldCheck className="w-4 h-4 text-[#4da3ff] shrink-0" />
          <span>Complies with Google Play TWA and Android WebAPK security standards.</span>
        </div>
      </div>
    </div>
  );
};
