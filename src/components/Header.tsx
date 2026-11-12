import React from 'react';
import { QrCode, Library, Settings, Sparkles } from 'lucide-react';
import { ActiveTab } from '../types/qr';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  libraryCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  libraryCount,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 bg-[#05060f]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Lockup */}
        <div
          onClick={() => setActiveTab('create')}
          className="flex items-center gap-2.5 cursor-pointer group select-none min-h-[44px]"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveTab('create')}
          aria-label="QRForge Home"
        >
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#2f6bff] via-[#1d4ed8] to-[#0a1230] p-0.5 flex items-center justify-center shadow-lg shadow-[#2f6bff]/30 border border-white/20 group-hover:scale-105 transition-transform">
            <QrCode className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#ff3b4e] ring-2 ring-[#05060f]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
                QR<span className="text-[#4da3ff]">Forge</span>
              </span>
            </div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all min-h-[40px] ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-md shadow-[#2f6bff]/30'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Create</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all min-h-[40px] ${
              activeTab === 'library'
                ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-md shadow-[#2f6bff]/30'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Library className="w-4 h-4" />
            <span>Library</span>
            {libraryCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-white/20 text-white">
                {libraryCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all min-h-[40px] ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-md shadow-[#2f6bff]/30'
                : 'text-white/70 hover:text-white hover:bg-white/5'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Right Action: Offline status + PWA Install */}
        <div className="flex items-center gap-2.5">
          <OfflineIndicator />
          <PWAInstallButton compact />
        </div>
      </div>
    </header>
  );
};
