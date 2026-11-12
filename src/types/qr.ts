export type QRType =
  | 'text'
  | 'url'
  | 'email'
  | 'phone'
  | 'sms'
  | 'wifi'
  | 'vcard'
  | 'geo'
  | 'calendar'
  | 'whatsapp'
  | 'crypto';

export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QRLogoSettings {
  dataUrl: string;
  sizePercent: number; // 10 to 30
  bgShape: 'rounded' | 'circle' | 'square' | 'none';
  bgColor: string;
  name?: string;
}

export interface QRStyleSettings {
  fgColor: string;
  bgColor: string;
  size: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  margin: number;
  logo?: QRLogoSettings | null;
}

export interface SavedQRItem {
  id: string;
  name: string;
  type: QRType;
  encodedData: string;
  formValues: Record<string, any>;
  style: QRStyleSettings;
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  thumbnail?: string; // base64 preview
}

export interface WifiFormData {
  ssid: string;
  password: string;
  encryption: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}

export interface VCardFormData {
  firstName: string;
  lastName: string;
  organization: string;
  title: string;
  phone: string;
  cellPhone?: string;
  email: string;
  url: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  note?: string;
}

export interface EmailFormData {
  to: string;
  subject: string;
  body: string;
}

export interface SmsFormData {
  phone: string;
  message: string;
}

export interface GeoFormData {
  latitude: string;
  longitude: string;
  query: string;
}

export interface CalendarFormData {
  title: string;
  start: string; // ISO datetime
  end: string;
  location: string;
  description: string;
  allDay: boolean;
}

export interface WhatsAppFormData {
  phone: string;
  message: string;
}

export interface CryptoFormData {
  scheme: 'bitcoin' | 'ethereum' | 'solana' | 'upi' | 'custom';
  address: string;
  amount: string;
  label: string;
  message: string;
  customUri: string;
}

export type ActiveTab = 'create' | 'library' | 'settings';
