import React from 'react';
import {
  Type as TextIcon,
  Link as LinkIcon,
  Mail,
  Phone,
  MessageSquare,
  Wifi,
  User,
  MapPin,
  Calendar,
  MessageCircle,
  Coins,
} from 'lucide-react';
import { QRType } from '../types/qr';

interface TypeSelectorProps {
  currentType: QRType;
  onSelectType: (type: QRType) => void;
}

export const QR_TYPE_CONFIG: Array<{
  id: QRType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  { id: 'url', label: 'URL', icon: LinkIcon, description: 'Website links & articles' },
  { id: 'text', label: 'Text', icon: TextIcon, description: 'Plain text & raw data' },
  { id: 'wifi', label: 'WiFi', icon: Wifi, description: 'One-tap network connection' },
  { id: 'vcard', label: 'Contact', icon: User, description: 'Digital vCard 3.0 profile' },
  { id: 'email', label: 'Email', icon: Mail, description: 'Pre-filled email message' },
  { id: 'phone', label: 'Phone', icon: Phone, description: 'Direct dial telephone call' },
  { id: 'sms', label: 'SMS', icon: MessageSquare, description: 'Direct SMS message' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, description: 'Direct WhatsApp chat' },
  { id: 'calendar', label: 'Event', icon: Calendar, description: 'iCalendar schedule invite' },
  { id: 'geo', label: 'Location', icon: MapPin, description: 'GPS coordinates & address' },
  { id: 'crypto', label: 'Crypto/Pay', icon: Coins, description: 'Crypto wallets & UPI payment' },
];

export const TypeSelector: React.FC<TypeSelectorProps> = ({
  currentType,
  onSelectType,
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
          QR Code Content Type
        </label>
        <span className="text-xs text-[#4da3ff] font-medium hidden sm:inline">
          {QR_TYPE_CONFIG.find((t) => t.id === currentType)?.description}
        </span>
      </div>

      {/* Horizontally scrollable chip row on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth -mx-4 px-4 sm:mx-0 sm:px-0">
        {QR_TYPE_CONFIG.map((item) => {
          const Icon = item.icon;
          const isActive = currentType === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectType(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap shrink-0 min-h-[44px] transition-all select-none ${
                isActive
                  ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-lg shadow-[#2f6bff]/35 ring-1 ring-white/30 scale-[1.02]'
                  : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10'
              }`}
              type="button"
              aria-pressed={isActive}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#4da3ff]'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
