import React, { useRef } from 'react';
import {
  Palette,
  Sliders,
  ShieldCheck,
  Image as ImageIcon,
  Trash2,
  Upload,
  Info,
} from 'lucide-react';
import { ErrorCorrectionLevel, QRStyleSettings } from '../types/qr';

interface CustomizerProps {
  style: QRStyleSettings;
  onChange: (updates: Partial<QRStyleSettings>) => void;
}

const FG_PRESETS = [
  { label: 'Obsidian', color: '#000000' },
  { label: 'Electric Blue', color: '#2f6bff' },
  { label: 'Deep Indigo', color: '#1e1b4b' },
  { label: 'Crimson', color: '#dc2626' },
  { label: 'Emerald', color: '#059669' },
  { label: 'Royal Violet', color: '#7c3aed' },
];

const BG_PRESETS = [
  { label: 'Crisp White', color: '#ffffff' },
  { label: 'Light Slate', color: '#f8fafc' },
  { label: 'Soft Azure', color: '#f0f7ff' },
  { label: 'Transparent', color: 'transparent' },
];

export const Customizer: React.FC<CustomizerProps> = ({ style, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, SVG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onChange({
          logo: {
            dataUrl: result,
            sizePercent: 22,
            bgShape: 'rounded',
            bgColor: '#ffffff',
            name: file.name,
          },
          // Center logo requires high error correction to remain scannable
          errorCorrectionLevel: 'H',
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    onChange({ logo: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Color Palette */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4 text-[#4da3ff]" />
          <h3 className="text-sm font-semibold tracking-tight text-white">Colors & Theme</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Foreground Color */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/80">Foreground (Modules)</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={style.fgColor.startsWith('#') ? style.fgColor : '#000000'}
                  onChange={(e) => onChange({ fgColor: e.target.value })}
                  className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                  aria-label="Pick custom foreground color"
                />
                <span className="text-xs font-mono text-white/60 uppercase">
                  {style.fgColor}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {FG_PRESETS.map((p) => (
                <button
                  key={p.color}
                  type="button"
                  onClick={() => onChange({ fgColor: p.color })}
                  className={`w-6 h-6 rounded-full border transition-transform active:scale-95 ${
                    style.fgColor.toLowerCase() === p.color.toLowerCase()
                      ? 'ring-2 ring-[#4da3ff] scale-110 border-white'
                      : 'border-white/20 hover:scale-105'
                  }`}
                  style={{ backgroundColor: p.color }}
                  title={p.label}
                  aria-label={p.label}
                />
              ))}
            </div>
          </div>

          {/* Background Color */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/80">Background</span>
              <div className="flex items-center gap-2">
                {style.bgColor !== 'transparent' ? (
                  <input
                    type="color"
                    value={style.bgColor.startsWith('#') ? style.bgColor : '#ffffff'}
                    onChange={(e) => onChange({ bgColor: e.target.value })}
                    className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    aria-label="Pick custom background color"
                  />
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/70">None</span>
                )}
                <span className="text-xs font-mono text-white/60 uppercase">
                  {style.bgColor === 'transparent' ? 'Transp' : style.bgColor}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {BG_PRESETS.map((p) => (
                <button
                  key={p.color}
                  type="button"
                  onClick={() => onChange({ bgColor: p.color })}
                  className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all ${
                    style.bgColor.toLowerCase() === p.color.toLowerCase()
                      ? 'bg-white/20 text-white border-[#4da3ff] ring-1 ring-[#4da3ff]'
                      : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Error Correction & Density */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#4da3ff]" />
            <h3 className="text-sm font-semibold tracking-tight text-white">
              Error Correction Level
            </h3>
          </div>
          {style.logo && (
            <span className="text-[11px] font-semibold text-[#4da3ff] bg-[#2f6bff]/15 px-2 py-0.5 rounded-md">
              Level H recommended for Logo
            </span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {(
            [
              { level: 'L', label: 'Low', pct: '7%' },
              { level: 'M', label: 'Medium', pct: '15%' },
              { level: 'Q', label: 'Quartile', pct: '25%' },
              { level: 'H', label: 'High', pct: '30%' },
            ] as const
          ).map((item) => {
            const isSelected = style.errorCorrectionLevel === item.level;
            return (
              <button
                key={item.level}
                type="button"
                onClick={() => onChange({ errorCorrectionLevel: item.level })}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-2xl border transition-all min-h-[52px] ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white border-transparent shadow-lg shadow-[#2f6bff]/30 ring-1 ring-white/30'
                    : 'bg-white/5 text-white/70 hover:text-white border-white/10 hover:bg-white/10'
                }`}
              >
                <span className="text-xs font-bold">{item.level}</span>
                <span className="text-[10px] opacity-75">{item.pct}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Export Dimensions & Margins */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Resolution */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/80">Resolution (PNG)</span>
            <span className="text-xs font-mono text-[#4da3ff] font-semibold">
              {style.size}px
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[256, 512, 1024, 2048].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ size: s })}
                className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  style.size === s
                    ? 'bg-[#2f6bff] text-white border-transparent shadow-sm'
                    : 'bg-white/5 text-white/60 hover:text-white border-white/10'
                }`}
              >
                {s >= 1024 ? `${s / 1024}K` : s}
              </button>
            ))}
          </div>
        </div>

        {/* Quiet Zone Margin */}
        <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/80">Quiet Margin</span>
            <span className="text-xs font-mono text-[#4da3ff] font-semibold">
              {style.margin} {style.margin === 1 ? 'module' : 'modules'}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[0, 1, 2, 4].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ margin: m })}
                className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  style.margin === m
                    ? 'bg-[#2f6bff] text-white border-transparent shadow-sm'
                    : 'bg-white/5 text-white/60 hover:text-white border-white/10'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Center Logo Upload */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#4da3ff]" />
            <h3 className="text-sm font-semibold tracking-tight text-white">Center Logo (Optional)</h3>
          </div>
          {style.logo && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="flex items-center gap-1 text-xs text-[#ff3b4e] hover:text-[#ff7b89] font-medium p-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          className="hidden"
          id="qr-logo-input"
        />

        {style.logo ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
              <img
                src={style.logo.dataUrl}
                alt="Logo Preview"
                className="w-12 h-12 object-contain rounded-lg bg-white p-1 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-white block truncate">
                  {style.logo.name || 'Uploaded Logo'}
                </span>
                <span className="text-[11px] text-white/50">
                  Size: {style.logo.sizePercent}% · Shape: {style.logo.bgShape}
                </span>
              </div>
              <label
                htmlFor="qr-logo-input"
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/15 text-white cursor-pointer transition-colors shrink-0"
              >
                Change
              </label>
            </div>

            {/* Shape selection for logo backing */}
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { id: 'rounded', label: 'Rounded' },
                  { id: 'circle', label: 'Circle' },
                  { id: 'square', label: 'Square' },
                  { id: 'none', label: 'No Pad' },
                ] as const
              ).map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      logo: {
                        ...style.logo!,
                        bgShape: shape.id,
                      },
                    })
                  }
                  className={`py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    style.logo?.bgShape === shape.id
                      ? 'bg-[#2f6bff] text-white border-transparent'
                      : 'bg-white/5 text-white/60 hover:text-white border-white/10'
                  }`}
                >
                  {shape.label}
                </button>
              ))}
            </div>

            {/* Size Slider */}
            <div>
              <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                <span>Logo Relative Size</span>
                <span className="font-mono text-[#4da3ff]">{style.logo.sizePercent}%</span>
              </div>
              <input
                type="range"
                min="12"
                max="30"
                step="1"
                value={style.logo.sizePercent}
                onChange={(e) =>
                  onChange({
                    logo: {
                      ...style.logo!,
                      sizePercent: Number(e.target.value),
                    },
                  })
                }
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#2f6bff]"
              />
            </div>
          </div>
        ) : (
          <label
            htmlFor="qr-logo-input"
            className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-white/15 hover:border-[#4da3ff]/50 bg-white/5 hover:bg-white/10 cursor-pointer transition-all group min-h-[90px]"
          >
            <Upload className="w-5 h-5 text-white/40 group-hover:text-[#4da3ff] mb-1.5 transition-colors" />
            <span className="text-xs font-semibold text-white/80 group-hover:text-white">
              Upload Center Brand Logo or Icon
            </span>
            <span className="text-[11px] text-white/40 mt-0.5">
              PNG, SVG, or JPG (auto-sets Level H scannability)
            </span>
          </label>
        )}
      </div>
    </div>
  );
};
