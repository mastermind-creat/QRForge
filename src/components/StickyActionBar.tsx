import React from 'react';
import { Download, BookmarkPlus } from 'lucide-react';

interface StickyActionBarProps {
  isValid: boolean;
  onDownloadPNG: () => void;
  onSaveToLibrary: () => void;
}

export const StickyActionBar: React.FC<StickyActionBarProps> = ({
  isValid,
  onDownloadPNG,
  onSaveToLibrary,
}) => {
  return (
    <div className="md:hidden fixed bottom-16 left-0 right-0 z-30 p-3 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto p-1.5 rounded-2xl bg-[#0a1230]/90 backdrop-blur-2xl border border-white/15 shadow-2xl flex items-center gap-2">
        <button
          type="button"
          onClick={onSaveToLibrary}
          disabled={!isValid}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-white font-semibold text-xs border border-white/10 transition-all disabled:opacity-40 min-h-[44px]"
        >
          <BookmarkPlus className="w-4 h-4 text-[#4da3ff]" />
          <span>Save to Library</span>
        </button>

        <button
          type="button"
          onClick={onDownloadPNG}
          disabled={!isValid}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] active:scale-95 text-white font-semibold text-xs shadow-lg shadow-[#2f6bff]/30 transition-all disabled:opacity-40 min-h-[44px]"
        >
          <Download className="w-4 h-4" />
          <span>Download PNG</span>
        </button>
      </div>
    </div>
  );
};
