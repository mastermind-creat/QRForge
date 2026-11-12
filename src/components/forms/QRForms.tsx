import React, { useState } from 'react';
import {
  MapPin,
  Compass,
  Eye,
  EyeOff,
  Sparkles,
  Lock,
  Globe,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import {
  CalendarFormData,
  CryptoFormData,
  EmailFormData,
  GeoFormData,
  QRType,
  SmsFormData,
  VCardFormData,
  WifiFormData,
  WhatsAppFormData,
} from '../../types/qr';

interface FormProps<T> {
  values: T;
  onChange: (updates: Partial<T>) => void;
}

// 1. Text Form
export const TextForm: React.FC<FormProps<{ text: string }>> = ({ values, onChange }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
          Raw Text / Content
        </label>
        <span className="text-xs font-mono text-white/50 tabular-nums">
          {(values.text || '').length} characters
        </span>
      </div>
      <textarea
        value={values.text || ''}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={4}
        placeholder="Enter plain text, notes, serial keys, or raw data..."
        className="w-full glass-input rounded-2xl p-3.5 text-base text-white placeholder-white/35 resize-y min-h-[110px]"
      />
    </div>
  );
};

// 2. URL Form
export const UrlForm: React.FC<FormProps<{ url: string }>> = ({ values, onChange }) => {
  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
        Website URL
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
          <Globe className="w-5 h-5 text-[#4da3ff]" />
        </div>
        <input
          type="url"
          value={values.url || ''}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://example.com"
          className="w-full glass-input rounded-2xl pl-11 pr-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
        />
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {['https://', 'https://www.', 'https://github.com/'].map((prefix) => (
          <button
            key={prefix}
            type="button"
            onClick={() => {
              const current = values.url || '';
              if (!current.startsWith('http')) {
                onChange({ url: `${prefix}${current}` });
              }
            }}
            className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-colors"
          >
            +{prefix}
          </button>
        ))}
      </div>
    </div>
  );
};

// 3. Email Form
export const EmailForm: React.FC<FormProps<EmailFormData>> = ({ values, onChange }) => {
  return (
    <div className="space-y-3.5">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Recipient Email
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
            <Mail className="w-4 h-4 text-[#4da3ff]" />
          </div>
          <input
            type="email"
            value={values.to || ''}
            onChange={(e) => onChange({ to: e.target.value })}
            placeholder="recipient@company.com"
            className="w-full glass-input rounded-2xl pl-10 pr-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Subject Line (Optional)
        </label>
        <input
          type="text"
          value={values.subject || ''}
          onChange={(e) => onChange({ subject: e.target.value })}
          placeholder="Inquiry / Meeting Request"
          className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Pre-filled Message Body (Optional)
        </label>
        <textarea
          value={values.body || ''}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={3}
          placeholder="Type the message that will open in user's mail client..."
          className="w-full glass-input rounded-2xl p-3.5 text-base text-white placeholder-white/35 resize-y"
        />
      </div>
    </div>
  );
};

// 4. Phone Form
export const PhoneForm: React.FC<FormProps<{ phone: string }>> = ({ values, onChange }) => {
  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
        Phone Number
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
          <Phone className="w-5 h-5 text-[#4da3ff]" />
        </div>
        <input
          type="tel"
          value={values.phone || ''}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="+1 (555) 000-0000"
          className="w-full glass-input rounded-2xl pl-11 pr-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
        />
      </div>
      <p className="text-xs text-white/50">
        Include international country code (e.g. +1 for US/CA, +44 for UK) for best compatibility.
      </p>
    </div>
  );
};

// 5. SMS Form
export const SmsForm: React.FC<FormProps<SmsFormData>> = ({ values, onChange }) => {
  return (
    <div className="space-y-3.5">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Phone Number
        </label>
        <input
          type="tel"
          value={values.phone || ''}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="+1 (555) 234-5678"
          className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
            SMS Message Body
          </label>
          <span className="text-xs font-mono text-white/50 tabular-nums">
            {(values.message || '').length}/160
          </span>
        </div>
        <textarea
          value={values.message || ''}
          onChange={(e) => onChange({ message: e.target.value })}
          rows={3}
          placeholder="Pre-populate SMS text..."
          className="w-full glass-input rounded-2xl p-3.5 text-base text-white placeholder-white/35 resize-y"
        />
      </div>
    </div>
  );
};

// 6. WiFi Form
export const WifiForm: React.FC<FormProps<WifiFormData>> = ({ values, onChange }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-3.5">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Network Name (SSID) *
        </label>
        <input
          type="text"
          value={values.ssid || ''}
          onChange={(e) => onChange({ ssid: e.target.value })}
          placeholder="e.g. Office_Guest_5G"
          className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          required
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Security / Encryption
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['WPA', 'WEP', 'nopass'] as const).map((enc) => (
            <button
              key={enc}
              type="button"
              onClick={() => onChange({ encryption: enc })}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all min-h-[44px] ${
                values.encryption === enc
                  ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white border-transparent shadow-md'
                  : 'bg-white/5 text-white/70 hover:text-white border-white/10 hover:bg-white/10'
              }`}
            >
              {enc === 'nopass' ? 'Open / None' : enc}
            </button>
          ))}
        </div>
      </div>

      {values.encryption !== 'nopass' && (
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
            WiFi Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={values.password || ''}
              onChange={(e) => onChange({ password: e.target.value })}
              placeholder="WiFi Network Password"
              className="w-full glass-input rounded-2xl pl-4 pr-11 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/50 hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      <label className="flex items-center gap-3 pt-1 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={Boolean(values.hidden)}
          onChange={(e) => onChange({ hidden: e.target.checked })}
          className="w-5 h-5 rounded-md bg-white/10 border-white/20 text-[#2f6bff] focus:ring-0 focus:outline-none"
        />
        <span className="text-sm text-white/80 font-medium">Hidden Network (SSID is not broadcast)</span>
      </label>
    </div>
  );
};

// 7. vCard Form
export const VCardForm: React.FC<FormProps<VCardFormData>> = ({ values, onChange }) => {
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
            First Name
          </label>
          <input
            type="text"
            value={values.firstName || ''}
            onChange={(e) => onChange({ firstName: e.target.value })}
            placeholder="John"
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
            Last Name
          </label>
          <input
            type="text"
            value={values.lastName || ''}
            onChange={(e) => onChange({ lastName: e.target.value })}
            placeholder="Doe"
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
            Organization / Company
          </label>
          <input
            type="text"
            value={values.organization || ''}
            onChange={(e) => onChange({ organization: e.target.value })}
            placeholder="Acme Corp"
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
            Job Title
          </label>
          <input
            type="text"
            value={values.title || ''}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="Lead Engineer"
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
            Mobile Phone
          </label>
          <input
            type="tel"
            value={values.phone || ''}
            onChange={(e) => onChange({ phone: e.target.value })}
            placeholder="+1 555-0100"
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
            Work / Cell Phone
          </label>
          <input
            type="tel"
            value={values.cellPhone || ''}
            onChange={(e) => onChange({ cellPhone: e.target.value })}
            placeholder="+1 555-0199"
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
            Email Address
          </label>
          <input
            type="email"
            value={values.email || ''}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="john@example.com"
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
            Website URL
          </label>
          <input
            type="url"
            value={values.url || ''}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://example.com"
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Street Address
        </label>
        <input
          type="text"
          value={values.street || ''}
          onChange={(e) => onChange({ street: e.target.value })}
          placeholder="123 Innovation Blvd"
          className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <input
          type="text"
          value={values.city || ''}
          onChange={(e) => onChange({ city: e.target.value })}
          placeholder="City"
          className="w-full glass-input rounded-2xl px-3 py-2.5 text-base text-white placeholder-white/35 min-h-[48px]"
        />
        <input
          type="text"
          value={values.state || ''}
          onChange={(e) => onChange({ state: e.target.value })}
          placeholder="State"
          className="w-full glass-input rounded-2xl px-3 py-2.5 text-base text-white placeholder-white/35 min-h-[48px]"
        />
        <input
          type="text"
          value={values.zip || ''}
          onChange={(e) => onChange({ zip: e.target.value })}
          placeholder="ZIP / Postal"
          className="w-full glass-input rounded-2xl px-3 py-2.5 text-base text-white placeholder-white/35 min-h-[48px]"
        />
        <input
          type="text"
          value={values.country || ''}
          onChange={(e) => onChange({ country: e.target.value })}
          placeholder="Country"
          className="w-full glass-input rounded-2xl px-3 py-2.5 text-base text-white placeholder-white/35 min-h-[48px]"
        />
      </div>
    </div>
  );
};

// 8. Geo Form
export const GeoForm: React.FC<FormProps<GeoFormData>> = ({ values, onChange }) => {
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGeoLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocating(false);
        onChange({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
          query: values.query || 'Current Location',
        });
      },
      (err) => {
        setGeoLocating(false);
        setGeoError(err.message || 'Unable to retrieve location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70">
          Geographic Coordinates
        </label>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={geoLocating}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2f6bff]/20 hover:bg-[#2f6bff]/30 text-[#4da3ff] border border-[#2f6bff]/40 text-xs font-semibold min-h-[36px] transition-all active:scale-95 disabled:opacity-50"
        >
          <Compass className={`w-3.5 h-3.5 ${geoLocating ? 'animate-spin' : ''}`} />
          <span>{geoLocating ? 'Detecting...' : 'Use My Location'}</span>
        </button>
      </div>

      {geoError && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{geoError}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-white/60 block mb-1">Latitude</label>
          <input
            type="text"
            value={values.latitude ?? ''}
            onChange={(e) => onChange({ latitude: e.target.value })}
            placeholder="e.g. 37.7749"
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-white/60 block mb-1">Longitude</label>
          <input
            type="text"
            value={values.longitude ?? ''}
            onChange={(e) => onChange({ longitude: e.target.value })}
            placeholder="e.g. -122.4194"
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Location Label or Address (Optional)
        </label>
        <input
          type="text"
          value={values.query || ''}
          onChange={(e) => onChange({ query: e.target.value })}
          placeholder="e.g. Eiffel Tower, Paris"
          className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
        />
      </div>
    </div>
  );
};

// 9. Calendar Form
export const CalendarForm: React.FC<FormProps<CalendarFormData>> = ({ values, onChange }) => {
  return (
    <div className="space-y-3.5">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Event Title *
        </label>
        <input
          type="text"
          value={values.title || ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Annual Product Launch"
          className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
            Start Time
          </label>
          <input
            type="datetime-local"
            value={values.start || ''}
            onChange={(e) => onChange({ start: e.target.value })}
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px] [color-scheme:dark]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
            End Time
          </label>
          <input
            type="datetime-local"
            value={values.end || ''}
            onChange={(e) => onChange({ end: e.target.value })}
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px] [color-scheme:dark]"
          />
        </div>
      </div>

      <label className="flex items-center gap-3 pt-0.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={Boolean(values.allDay)}
          onChange={(e) => onChange({ allDay: e.target.checked })}
          className="w-5 h-5 rounded-md bg-white/10 border-white/20 text-[#2f6bff] focus:ring-0 focus:outline-none"
        />
        <span className="text-sm text-white/80 font-medium">All-Day Event</span>
      </label>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Location
        </label>
        <input
          type="text"
          value={values.location || ''}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="Grand Ballroom / Zoom Link"
          className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Description / Agenda
        </label>
        <textarea
          value={values.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          placeholder="Add conference details, meeting notes..."
          className="w-full glass-input rounded-2xl p-3 text-base text-white placeholder-white/35 resize-y"
        />
      </div>
    </div>
  );
};

// 10. WhatsApp Form
export const WhatsAppForm: React.FC<FormProps<WhatsAppFormData>> = ({ values, onChange }) => {
  return (
    <div className="space-y-3.5">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          WhatsApp Phone Number *
        </label>
        <input
          type="tel"
          value={values.phone || ''}
          onChange={(e) => onChange({ phone: e.target.value })}
          placeholder="15551234567 (with country code, no + or spaces)"
          className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          required
        />
        <span className="text-xs text-white/50 mt-1 block">
          Enter numbers only with country code (e.g. 1 for US, 44 for UK, 91 for India).
        </span>
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Pre-filled Message
        </label>
        <textarea
          value={values.message || ''}
          onChange={(e) => onChange({ message: e.target.value })}
          rows={3}
          placeholder="Hello! I would like to chat about..."
          className="w-full glass-input rounded-2xl p-3.5 text-base text-white placeholder-white/35 resize-y"
        />
      </div>
    </div>
  );
};

// 11. Crypto / Payment Form
export const CryptoForm: React.FC<FormProps<CryptoFormData>> = ({ values, onChange }) => {
  const schemes = [
    { id: 'bitcoin', label: 'Bitcoin (BTC)' },
    { id: 'ethereum', label: 'Ethereum (ETH)' },
    { id: 'solana', label: 'Solana (SOL)' },
    { id: 'upi', label: 'UPI Pay (India)' },
    { id: 'custom', label: 'Custom URI' },
  ] as const;

  return (
    <div className="space-y-3.5">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
          Payment Protocol / Chain
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {schemes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange({ scheme: s.id })}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all min-h-[44px] ${
                values.scheme === s.id
                  ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white border-transparent shadow-md'
                  : 'bg-white/5 text-white/70 hover:text-white border-white/10 hover:bg-white/10'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {values.scheme === 'custom' ? (
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
            Raw Payment / Custom URI
          </label>
          <input
            type="text"
            value={values.customUri || ''}
            onChange={(e) => onChange({ customUri: e.target.value })}
            placeholder="e.g. monero:48... or lightning:LNURL..."
            className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
          />
        </div>
      ) : (
        <>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
              {values.scheme === 'upi' ? 'UPI Virtual Payment Address (VPA)' : 'Wallet Address'} *
            </label>
            <input
              type="text"
              value={values.address || ''}
              onChange={(e) => onChange({ address: e.target.value })}
              placeholder={
                values.scheme === 'ethereum'
                  ? '0x...'
                  : values.scheme === 'bitcoin'
                  ? 'bc1... or 1...'
                  : values.scheme === 'solana'
                  ? 'Solana public address'
                  : 'username@bank'
              }
              className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px] font-mono text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
                Requested Amount
              </label>
              <input
                type="text"
                value={values.amount || ''}
                onChange={(e) => onChange({ amount: e.target.value })}
                placeholder="0.05"
                className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
                Payee / Label
              </label>
              <input
                type="text"
                value={values.label || ''}
                onChange={(e) => onChange({ label: e.target.value })}
                placeholder="Store / Recipient"
                className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-white/70 block mb-1.5">
              Memo / Note (Optional)
            </label>
            <input
              type="text"
              value={values.message || ''}
              onChange={(e) => onChange({ message: e.target.value })}
              placeholder="Payment reference"
              className="w-full glass-input rounded-2xl px-4 py-3 text-base text-white placeholder-white/35 min-h-[48px]"
            />
          </div>
        </>
      )}
    </div>
  );
};
