import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Heart,
  QrCode,
  Download,
  Upload,
  Trash2,
  Plus,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { QRType, SavedQRItem } from '../types/qr';
import { QR_TYPE_CONFIG } from './TypeSelector';
import { downloadBlob } from '../utils/qrRenderer';
import { useToast } from '../context/ToastContext';

interface LibraryViewProps {
  items: SavedQRItem[];
  onSelectItem: (item: SavedQRItem) => void;
  onToggleFavorite: (id: string) => void;
  onCreateNew: () => void;
  onExportJSON: () => void;
  onImportJSON: (jsonStr: string) => { success: boolean; importedCount: number; message: string };
  onClearLibrary: () => void;
}

type SortOption = 'newest' | 'oldest' | 'name';

export const LibraryView: React.FC<LibraryViewProps> = ({
  items,
  onSelectItem,
  onToggleFavorite,
  onCreateNew,
  onExportJSON,
  onImportJSON,
  onClearLibrary,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'favorites' | QRType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // Filter & Sort Items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.name.toLowerCase().includes(q);
          const matchData = item.encodedData.toLowerCase().includes(q);
          const matchType = item.type.toLowerCase().includes(q);
          if (!matchName && !matchData && !matchType) return false;
        }

        // Category filter
        if (typeFilter === 'favorites') {
          return item.isFavorite;
        }
        if (typeFilter !== 'all') {
          return item.type === typeFilter;
        }
        return true;
      })
      .sort((a, b) => {
        // Favorites pinned first
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;

        if (sortBy === 'newest') {
          return b.createdAt - a.createdAt;
        }
        if (sortBy === 'oldest') {
          return a.createdAt - b.createdAt;
        }
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
  }, [items, searchQuery, typeFilter, sortBy]);

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
    <div className="space-y-6 pb-20">
      {/* Top Controls: Search & Management Actions */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, URL, phone, content..."
              className="w-full glass-input rounded-2xl pl-10 pr-4 py-2.5 text-base text-white placeholder-white/35 min-h-[44px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/50 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Actions (Export / Import / Clear) */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
              id="import-json-input"
            />
            <label
              htmlFor="import-json-input"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-semibold cursor-pointer transition-all active:scale-95 min-h-[44px]"
              title="Import library from JSON"
            >
              <Upload className="w-3.5 h-3.5 text-[#4da3ff]" />
              <span>Import</span>
            </label>

            <button
              onClick={onExportJSON}
              disabled={items.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 min-h-[44px]"
              title="Export library as JSON"
            >
              <Download className="w-3.5 h-3.5 text-[#4da3ff]" />
              <span>Export</span>
            </button>

            {items.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-2.5 rounded-xl bg-[#ff3b4e]/15 hover:bg-[#ff3b4e]/25 text-[#ff6b7a] border border-[#ff3b4e]/30 transition-all active:scale-95 min-h-[44px]"
                title="Clear library"
                aria-label="Clear all QR codes"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills & Sort Dropdown */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-white/10">
          {/* Scrollable Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full pb-1">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all min-h-[36px] ${
                typeFilter === 'all'
                  ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-sm'
                  : 'bg-white/5 text-white/70 hover:text-white border border-white/10'
              }`}
            >
              All ({items.length})
            </button>

            <button
              onClick={() => setTypeFilter('favorites')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all min-h-[36px] ${
                typeFilter === 'favorites'
                  ? 'bg-[#ff3b4e] text-white shadow-sm'
                  : 'bg-white/5 text-white/70 hover:text-white border border-white/10'
              }`}
            >
              <Heart className="w-3 h-3 fill-current text-[#ff7b89]" />
              <span>Favorites ({items.filter((i) => i.isFavorite).length})</span>
            </button>

            {QR_TYPE_CONFIG.map((conf) => {
              const count = items.filter((i) => i.type === conf.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={conf.id}
                  onClick={() => setTypeFilter(conf.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all min-h-[36px] ${
                    typeFilter === conf.id
                      ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-sm'
                      : 'bg-white/5 text-white/70 hover:text-white border border-white/10'
                  }`}
                >
                  {conf.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-white/50" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="glass-input rounded-xl px-2.5 py-1 text-xs text-white/80 bg-slate-900 focus:outline-none min-h-[36px]"
              aria-label="Sort library"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Saved QR Cards */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectItem(item)}
              className="glass-card hover:border-[#4da3ff]/50 rounded-3xl p-4 sm:p-5 flex items-start gap-4 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group relative"
            >
              {/* White Thumbnail Tile */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white p-2 shrink-0 flex items-center justify-center shadow-md">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <QrCode className="w-12 h-12 text-slate-800" />
                )}
              </div>

              {/* Card Meta */}
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#4da3ff] bg-[#2f6bff]/15 px-2 py-0.5 rounded-md">
                    {item.type}
                  </span>
                  <span className="text-[11px] text-white/40">
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white group-hover:text-[#4da3ff] transition-colors truncate">
                  {item.name}
                </h4>

                <p className="text-xs font-mono text-white/50 line-clamp-1 mt-1 break-all">
                  {item.encodedData}
                </p>

                <div className="mt-3 flex items-center gap-2 text-[11px] text-white/40">
                  <span>{item.style.size}px</span>
                  <span>·</span>
                  <span>EC {item.style.errorCorrectionLevel}</span>
                  {item.style.logo && <span>· Logo</span>}
                </div>
              </div>

              {/* Favorite Star / Heart Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(item.id);
                }}
                className={`absolute top-4 right-4 p-1.5 rounded-lg transition-colors ${
                  item.isFavorite
                    ? 'text-[#ff3b4e] hover:bg-[#ff3b4e]/10'
                    : 'text-white/30 hover:text-white/70 hover:bg-white/10'
                }`}
                aria-label={item.isFavorite ? 'Unfavorite' : 'Favorite'}
              >
                <Heart className={`w-4 h-4 ${item.isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="glass-card rounded-3xl p-10 text-center flex flex-col items-center justify-center max-w-md mx-auto my-8">
          <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-white/40">
            <QrCode className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            {items.length === 0 ? 'Your library is empty' : 'No matching QR codes found'}
          </h3>
          <p className="text-xs text-white/60 mb-6">
            {items.length === 0
              ? 'Generated QR codes you save will appear here for easy access, re-downloading, and editing anytime—even offline.'
              : 'Try clearing your search query or switching category filters.'}
          </p>

          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white font-semibold text-sm shadow-lg shadow-[#2f6bff]/30 active:scale-95 transition-all min-h-[46px]"
          >
            <Plus className="w-4 h-4" />
            <span>Create New QR Code</span>
          </button>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl bg-[#0a1026] border border-white/20 p-6 shadow-2xl text-left">
            <div className="flex items-center gap-3 text-[#ff3b4e] mb-3">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Clear entire library?</h3>
            </div>
            <p className="text-xs text-white/70 mb-5 leading-relaxed">
              This will permanently delete all {items.length} saved QR codes stored on this device. Make sure to export your backup JSON if you need them.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-sm font-semibold transition-all min-h-[44px]"
              >
                Keep Library
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearLibrary();
                  setShowClearConfirm(false);
                  showToast('Library cleared', 'info');
                }}
                className="flex-1 py-3 rounded-xl bg-[#ff3b4e] hover:bg-[#e02b3d] text-white text-sm font-semibold shadow-lg shadow-[#ff3b4e]/30 transition-all min-h-[44px]"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
