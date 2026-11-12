import React, { useState, useMemo } from 'react';
import {
  ActiveTab,
  QRStyleSettings,
  QRType,
  SavedQRItem,
} from './types/qr';
import { encodeByType, getDefaultFormValues } from './utils/encoders';
import { useLocalStorage } from './hooks/useLocalStorage';
import { ToastProvider, useToast } from './context/ToastContext';
import { AmbientBackground } from './components/AmbientBackground';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { TypeSelector } from './components/TypeSelector';
import {
  TextForm,
  UrlForm,
  EmailForm,
  PhoneForm,
  SmsForm,
  WifiForm,
  VCardForm,
  GeoForm,
  CalendarForm,
  WhatsAppForm,
  CryptoForm,
} from './components/forms/QRForms';
import { Customizer } from './components/Customizer';
import { QRPreview } from './components/QRPreview';
import { StickyActionBar } from './components/StickyActionBar';
import { LibraryView } from './components/LibraryView';
import { QRDetailsModal } from './components/QRDetailsModal';
import { SettingsView } from './components/SettingsView';
import { downloadBlob, renderQRCodeToCanvas } from './utils/qrRenderer';
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

const DEFAULT_STYLE: QRStyleSettings = {
  fgColor: '#000000',
  bgColor: '#ffffff',
  size: 512,
  errorCorrectionLevel: 'M',
  margin: 2,
  logo: null,
};

function MainApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('create');
  const [currentType, setCurrentType] = useState<QRType>('url');
  const [formValues, setFormValues] = useState<Record<string, any>>(() =>
    getDefaultFormValues('url')
  );
  const [style, setStyle] = useState<QRStyleSettings>(DEFAULT_STYLE);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<SavedQRItem | null>(null);

  const {
    items,
    addItem,
    updateItem,
    deleteItem,
    duplicateItem,
    toggleFavorite,
    clearLibrary,
    exportLibraryJSON,
    importLibraryJSON,
    getStorageSizeKB,
  } = useLocalStorage();

  const { showToast } = useToast();

  // Pure encoding pipeline
  const encodeResult = useMemo(() => {
    return encodeByType(currentType, formValues);
  }, [currentType, formValues]);

  // Handle switching QR type
  const handleSelectType = (newType: QRType) => {
    setCurrentType(newType);
    setFormValues(getDefaultFormValues(newType));
  };

  // Form value updater
  const handleFormChange = (updates: Record<string, any>) => {
    setFormValues((prev) => ({ ...prev, ...updates }));
  };

  // Style updater
  const handleStyleChange = (updates: Partial<QRStyleSettings>) => {
    setStyle((prev) => ({ ...prev, ...updates }));
  };

  // Save to Library Handler
  const handleSaveToLibrary = (
    itemData: Omit<SavedQRItem, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const saved = addItem(itemData);
    if (saved) {
      showToast('Saved to Library!', 'success');
    }
  };

  // Load from Library to Edit
  const handleEditFromLibrary = (item: SavedQRItem) => {
    setCurrentType(item.type);
    setFormValues(item.formValues || getDefaultFormValues(item.type));
    setStyle(item.style || DEFAULT_STYLE);
    setActiveTab('create');
    showToast(`Loaded "${item.name}" into editor`, 'info');
  };

  // Mobile Sticky Bar Quick Download
  const handleStickyDownloadPNG = async () => {
    if (!encodeResult.isValid || !encodeResult.encoded) return;
    try {
      const exportCanvas = document.createElement('canvas');
      await renderQRCodeToCanvas(exportCanvas, {
        text: encodeResult.encoded,
        style,
        overrideSize: style.size,
      });

      exportCanvas.toBlob((blob) => {
        if (blob) {
          const safeName = (encodeResult.suggestedName || 'qrforge')
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '-');
          downloadBlob(blob, `${safeName}-${style.size}px.png`);
          showToast(`PNG Downloaded (${style.size}x${style.size})!`, 'success');
        }
      }, 'image/png');
    } catch {
      showToast('Download failed', 'error');
    }
  };

  // Mobile Sticky Bar Quick Save
  const handleStickySave = () => {
    if (!encodeResult.isValid || !encodeResult.encoded) {
      showToast('Cannot save: incomplete QR data', 'error');
      return;
    }

    addItem({
      name: encodeResult.suggestedName || 'My QR Code',
      type: currentType,
      encodedData: encodeResult.encoded,
      formValues,
      style,
      isFavorite: false,
    });
    showToast('Saved to your Library!', 'success');
  };

  // Export JSON backup helper
  const handleExportJSON = () => {
    const jsonStr = exportLibraryJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadBlob(blob, `qrforge-backup-${new Date().toISOString().slice(0, 10)}.json`);
    showToast('Library backup exported as JSON', 'success');
  };

  // Render form for current type
  const renderCurrentForm = () => {
    switch (currentType) {
      case 'url':
        return <UrlForm values={formValues as any} onChange={handleFormChange} />;
      case 'text':
        return <TextForm values={formValues as any} onChange={handleFormChange} />;
      case 'email':
        return <EmailForm values={formValues as any} onChange={handleFormChange} />;
      case 'phone':
        return <PhoneForm values={formValues as any} onChange={handleFormChange} />;
      case 'sms':
        return <SmsForm values={formValues as any} onChange={handleFormChange} />;
      case 'wifi':
        return <WifiForm values={formValues as any} onChange={handleFormChange} />;
      case 'vcard':
        return <VCardForm values={formValues as any} onChange={handleFormChange} />;
      case 'geo':
        return <GeoForm values={formValues as any} onChange={handleFormChange} />;
      case 'calendar':
        return <CalendarForm values={formValues as any} onChange={handleFormChange} />;
      case 'whatsapp':
        return <WhatsAppForm values={formValues as any} onChange={handleFormChange} />;
      case 'crypto':
        return <CryptoForm values={formValues as any} onChange={handleFormChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative text-white selection:bg-[#2f6bff] selection:text-white">
      {/* Dark Animated Glassmorphic Ambient Background */}
      <AmbientBackground />

      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        libraryCount={items.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'create' && (
          <div className="space-y-6">
            {/* Horizontal Type Selector */}
            <div className="glass-card rounded-3xl p-4 sm:p-5">
              <TypeSelector
                currentType={currentType}
                onSelectType={handleSelectType}
              />
            </div>

            {/* Desktop 2-Column Split: Form + Customizer (Left) and Sticky Preview (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-20 lg:pb-8">
              {/* Left Column: Form & Styling */}
              <div className="lg:col-span-7 space-y-6">
                {/* Active Content Form */}
                <div className="glass-card rounded-3xl p-5 sm:p-6">
                  {renderCurrentForm()}
                </div>

                {/* Customizer Drawer / Card */}
                <div className="glass-card rounded-3xl p-5 sm:p-6 transition-all">
                  <div
                    onClick={() => setIsCustomizerOpen(!isCustomizerOpen)}
                    className="flex items-center justify-between cursor-pointer select-none"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setIsCustomizerOpen(!isCustomizerOpen)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-[#2f6bff]/20 text-[#4da3ff]">
                        <SlidersHorizontal className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Appearance & Style</h3>
                        <p className="text-xs text-white/60">
                          Colors, logo upload, quiet zone, and error correction
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="p-1 rounded-lg text-white/50 hover:text-white"
                      aria-label={isCustomizerOpen ? 'Collapse appearance options' : 'Expand appearance options'}
                    >
                      {isCustomizerOpen ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* Always open on desktop, toggleable or open by default on mobile */}
                  <div className={`mt-5 pt-5 border-t border-white/10 ${isCustomizerOpen ? 'block' : 'hidden lg:block'}`}>
                    <Customizer style={style} onChange={handleStyleChange} />
                  </div>
                </div>
              </div>

              {/* Right Column: Live Debounced Preview & Actions (Sticky on Desktop) */}
              <div className="lg:col-span-5 lg:sticky lg:top-24">
                <QRPreview
                  type={currentType}
                  encodedData={encodeResult.encoded}
                  formValues={formValues}
                  style={style}
                  suggestedName={encodeResult.suggestedName}
                  isValid={encodeResult.isValid}
                  validationError={encodeResult.error}
                  onSaveToLibrary={handleSaveToLibrary}
                />
              </div>
            </div>

            {/* Mobile Sticky Action Bar */}
            <StickyActionBar
              isValid={encodeResult.isValid}
              onDownloadPNG={handleStickyDownloadPNG}
              onSaveToLibrary={handleStickySave}
            />
          </div>
        )}

        {/* Library Tab */}
        {activeTab === 'library' && (
          <LibraryView
            items={items}
            onSelectItem={(item) => setSelectedLibraryItem(item)}
            onToggleFavorite={toggleFavorite}
            onCreateNew={() => setActiveTab('create')}
            onExportJSON={handleExportJSON}
            onImportJSON={importLibraryJSON}
            onClearLibrary={clearLibrary}
          />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <SettingsView
            libraryCount={items.length}
            storageSizeKB={getStorageSizeKB()}
            onExportJSON={handleExportJSON}
            onImportJSON={importLibraryJSON}
            onClearLibrary={clearLibrary}
          />
        )}
      </main>

      {/* QR Details Bottom Sheet / Modal */}
      <QRDetailsModal
        item={selectedLibraryItem}
        onClose={() => setSelectedLibraryItem(null)}
        onEdit={handleEditFromLibrary}
        onDuplicate={duplicateItem}
        onDelete={deleteItem}
        onToggleFavorite={toggleFavorite}
        onRename={(id, newName) => updateItem(id, { name: newName })}
      />

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        libraryCount={items.length}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
