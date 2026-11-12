import React from 'react';
import { Sparkles, Library, Settings } from 'lucide-react';
import { ActiveTab } from '../types/qr';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  libraryCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  libraryCount,
}) => {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#05060f]/90 backdrop-blur-2xl border-t border-white/10 pb-safe shadow-2xl"
      aria-label="Mobile Navigation"
    >
      <div className="grid grid-cols-3 items-center h-16 max-w-lg mx-auto px-3">
        {/* Create Tab */}
        <button
          onClick={() => setActiveTab('create')}
          className={`flex flex-col items-center justify-center min-h-[48px] relative transition-colors ${
            activeTab === 'create' ? 'text-[#4da3ff]' : 'text-white/50 hover:text-white/80'
          }`}
          aria-label="Create QR Code"
          aria-current={activeTab === 'create' ? 'page' : undefined}
        >
          <div className="relative">
            <Sparkles className="w-5 h-5" />
            {activeTab === 'create' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-[#2f6bff]" />
            )}
          </div>
          <span className="text-[11px] font-semibold mt-1 tracking-tight">Create</span>
        </button>

        {/* Library Tab */}
        <button
          onClick={() => setActiveTab('library')}
          className={`flex flex-col items-center justify-center min-h-[48px] relative transition-colors ${
            activeTab === 'library' ? 'text-[#4da3ff]' : 'text-white/50 hover:text-white/80'
          }`}
          aria-label="QR Code Library"
          aria-current={activeTab === 'library' ? 'page' : undefined}
        >
          <div className="relative">
            <Library className="w-5 h-5" />
            {libraryCount > 0 && (
              <span className="absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff3b4e] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#05060f]">
                {libraryCount > 99 ? '99+' : libraryCount}
              </span>
            )}
            {activeTab === 'library' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-[#2f6bff]" />
            )}
          </div>
          <span className="text-[11px] font-semibold mt-1 tracking-tight">Library</span>
        </button>

        {/* Settings Tab */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center min-h-[48px] relative transition-colors ${
            activeTab === 'settings' ? 'text-[#4da3ff]' : 'text-white/50 hover:text-white/80'
          }`}
          aria-label="Settings"
          aria-current={activeTab === 'settings' ? 'page' : undefined}
        >
          <div className="relative">
            <Settings className="w-5 h-5" />
            {activeTab === 'settings' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full bg-[#2f6bff]" />
            )}
          </div>
          <span className="text-[11px] font-semibold mt-1 tracking-tight">Settings</span>
        </button>
      </div>
    </nav>
  );
};
