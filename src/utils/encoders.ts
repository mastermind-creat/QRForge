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
} from '../types/qr';

export interface EncodeResult {
  encoded: string;
  isValid: boolean;
  error?: string;
  suggestedName: string;
}

// Helper to escape special characters in WiFi strings
function escapeWifiString(str: string): string {
  return str.replace(/([\\;,:"])/g, '\\$1');
}

// Helper to format ISO datetime to iCalendar format (YYYYMMDDTHHMMSSZ or YYYYMMDD)
function formatICalDate(dateStr: string, allDay = false): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  if (allDay) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${hh}${mm}${ss}Z`;
}

// 1. Raw Text
export function encodeText(text: string): EncodeResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      encoded: '',
      isValid: false,
      error: 'Please enter text content',
      suggestedName: 'Untitled Note',
    };
  }
  const preview = trimmed.slice(0, 24).replace(/\n/g, ' ');
  return {
    encoded: text,
    isValid: true,
    suggestedName: preview ? `Text: ${preview}...` : 'Text Note',
  };
}

// 2. URL
export function encodeUrl(inputUrl: string): EncodeResult {
  const trimmed = inputUrl.trim();
  if (!trimmed) {
    return {
      encoded: '',
      isValid: false,
      error: 'Please enter a website URL',
      suggestedName: 'Website Link',
    };
  }

  // Auto-prepend https:// if no protocol provided
  let formatted = trimmed;
  if (!/^https?:\/\//i.test(formatted) && !/^ftp:\/\//i.test(formatted)) {
    formatted = `https://${formatted}`;
  }

  try {
    const parsed = new URL(formatted);
    return {
      encoded: formatted,
      isValid: true,
      suggestedName: parsed.hostname || 'Website Link',
    };
  } catch {
    return {
      encoded: formatted,
      isValid: false,
      error: 'Invalid URL format (e.g. example.com or https://example.com)',
      suggestedName: 'Website Link',
    };
  }
}

// 3. Email
export function encodeEmail(data: EmailFormData): EncodeResult {
  const to = data.to.trim();
  if (!to) {
    return {
      encoded: '',
      isValid: false,
      error: 'Recipient email address is required',
      suggestedName: 'Email Draft',
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return {
      encoded: '',
      isValid: false,
      error: 'Please enter a valid email address (e.g. user@domain.com)',
      suggestedName: 'Email Draft',
    };
  }

  const params = new URLSearchParams();
  if (data.subject.trim()) params.append('subject', data.subject.trim());
  if (data.body.trim()) params.append('body', data.body.trim());

  const queryString = params.toString();
  const encoded = queryString ? `mailto:${to}?${queryString}` : `mailto:${to}`;

  return {
    encoded,
    isValid: true,
    suggestedName: data.subject.trim() ? `Email: ${data.subject.trim()}` : `Email: ${to}`,
  };
}

// 4. Phone
export function encodePhone(phone: string): EncodeResult {
  const cleaned = phone.replace(/[^\d+*#]/g, '');
  if (!cleaned) {
    return {
      encoded: '',
      isValid: false,
      error: 'Phone number is required',
      suggestedName: 'Phone Contact',
    };
  }

  if (cleaned.length < 3) {
    return {
      encoded: '',
      isValid: false,
      error: 'Phone number is too short',
      suggestedName: 'Phone Contact',
    };
  }

  return {
    encoded: `tel:${cleaned}`,
    isValid: true,
    suggestedName: `Call: ${cleaned}`,
  };
}

// 5. SMS
export function encodeSms(data: SmsFormData): EncodeResult {
  const phone = data.phone.replace(/[^\d+*#]/g, '');
  if (!phone) {
    return {
      encoded: '',
      isValid: false,
      error: 'Recipient phone number is required',
      suggestedName: 'SMS Message',
    };
  }

  const message = data.message.trim();
  // Standard format SMSTO:number:body
  const encoded = message ? `SMSTO:${phone}:${message}` : `SMSTO:${phone}:`;

  return {
    encoded,
    isValid: true,
    suggestedName: `SMS: ${phone}`,
  };
}

// 6. WiFi
export function encodeWifi(data: WifiFormData): EncodeResult {
  const ssid = data.ssid.trim();
  if (!ssid) {
    return {
      encoded: '',
      isValid: false,
      error: 'Network Name (SSID) is required',
      suggestedName: 'WiFi Network',
    };
  }

  if (data.encryption !== 'nopass' && !data.password) {
    return {
      encoded: '',
      isValid: false,
      error: 'Password is required for encrypted networks',
      suggestedName: `WiFi: ${ssid}`,
    };
  }

  const escapedSsid = escapeWifiString(ssid);
  const escapedPassword = escapeWifiString(data.password || '');
  const encType = data.encryption;
  const isHidden = data.hidden ? 'true' : 'false';

  // Format: WIFI:T:WPA;S:mynetwork;P:mypass;H:false;;
  const encoded = `WIFI:T:${encType};S:${escapedSsid};P:${escapedPassword};H:${isHidden};;`;

  return {
    encoded,
    isValid: true,
    suggestedName: `WiFi: ${ssid}`,
  };
}

// 7. vCard Contact
export function encodeVCard(data: VCardFormData): EncodeResult {
  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();

  if (!firstName && !lastName && !data.organization.trim()) {
    return {
      encoded: '',
      isValid: false,
      error: 'Contact name or organization is required',
      suggestedName: 'Contact Card',
    };
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || data.organization.trim();

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${lastName};${firstName};;;`,
    `FN:${fullName}`,
  ];

  if (data.organization.trim()) lines.push(`ORG:${data.organization.trim()}`);
  if (data.title.trim()) lines.push(`TITLE:${data.title.trim()}`);
  if (data.phone.trim()) lines.push(`TEL;TYPE=CELL,VOICE:${data.phone.trim()}`);
  if (data.cellPhone && data.cellPhone.trim()) lines.push(`TEL;TYPE=WORK,VOICE:${data.cellPhone.trim()}`);
  if (data.email.trim()) lines.push(`EMAIL;TYPE=INTERNET:${data.email.trim()}`);
  if (data.url.trim()) lines.push(`URL:${data.url.trim()}`);

  const hasAddress =
    data.street.trim() ||
    data.city.trim() ||
    data.state.trim() ||
    data.zip.trim() ||
    data.country.trim();

  if (hasAddress) {
    lines.push(
      `ADR;TYPE=WORK:;;${data.street.trim()};${data.city.trim()};${data.state.trim()};${data.zip.trim()};${data.country.trim()}`
    );
  }

  if (data.note && data.note.trim()) {
    lines.push(`NOTE:${data.note.trim()}`);
  }

  lines.push('END:VCARD');

  return {
    encoded: lines.join('\n'),
    isValid: true,
    suggestedName: `Contact: ${fullName}`,
  };
}

// 8. Geo Location
export function encodeGeo(data: GeoFormData): EncodeResult {
  const lat = parseFloat(data.latitude);
  const lng = parseFloat(data.longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return {
      encoded: '',
      isValid: false,
      error: 'Valid numeric latitude and longitude are required',
      suggestedName: 'Location',
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      encoded: '',
      isValid: false,
      error: 'Latitude must be between -90 and 90',
      suggestedName: 'Location',
    };
  }

  if (lng < -180 || lng > 180) {
    return {
      encoded: '',
      isValid: false,
      error: 'Longitude must be between -180 and 180',
      suggestedName: 'Location',
    };
  }

  const query = data.query.trim();
  // geo:lat,lng?q=query or geo:lat,lng
  const encoded = query
    ? `geo:${lat},${lng}?q=${encodeURIComponent(query)}`
    : `geo:${lat},${lng}`;

  return {
    encoded,
    isValid: true,
    suggestedName: query ? `Place: ${query}` : `Geo: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  };
}

// 9. Calendar Event
export function encodeCalendar(data: CalendarFormData): EncodeResult {
  const title = data.title.trim();
  if (!title) {
    return {
      encoded: '',
      isValid: false,
      error: 'Event title is required',
      suggestedName: 'Calendar Event',
    };
  }

  if (!data.start) {
    return {
      encoded: '',
      isValid: false,
      error: 'Event start date/time is required',
      suggestedName: `Event: ${title}`,
    };
  }

  const startFormatted = formatICalDate(data.start, data.allDay);
  let endFormatted = formatICalDate(data.end, data.allDay);

  if (!endFormatted && startFormatted) {
    // Default to +1 hour if end not given
    const sDate = new Date(data.start);
    if (!isNaN(sDate.getTime())) {
      sDate.setHours(sDate.getHours() + 1);
      endFormatted = formatICalDate(sDate.toISOString(), data.allDay);
    }
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QRForge//EN',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    data.allDay ? `DTSTART;VALUE=DATE:${startFormatted}` : `DTSTART:${startFormatted}`,
  ];

  if (endFormatted) {
    lines.push(
      data.allDay ? `DTEND;VALUE=DATE:${endFormatted}` : `DTEND:${endFormatted}`
    );
  }

  if (data.location.trim()) lines.push(`LOCATION:${data.location.trim()}`);
  if (data.description.trim()) lines.push(`DESCRIPTION:${data.description.trim()}`);

  lines.push('END:VEVENT', 'END:VCALENDAR');

  return {
    encoded: lines.join('\n'),
    isValid: true,
    suggestedName: `Event: ${title}`,
  };
}

// 10. WhatsApp
export function encodeWhatsApp(data: WhatsAppFormData): EncodeResult {
  const cleaned = data.phone.replace(/[^\d]/g, '');
  if (!cleaned) {
    return {
      encoded: '',
      isValid: false,
      error: 'WhatsApp phone number with country code is required',
      suggestedName: 'WhatsApp Chat',
    };
  }

  const msg = data.message.trim();
  const encoded = msg
    ? `https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/${cleaned}`;

  return {
    encoded,
    isValid: true,
    suggestedName: `WhatsApp: +${cleaned}`,
  };
}

// 11. Crypto / Payment URI
export function encodeCrypto(data: CryptoFormData): EncodeResult {
  if (data.scheme === 'custom') {
    const raw = data.customUri.trim();
    if (!raw) {
      return {
        encoded: '',
        isValid: false,
        error: 'Custom payment or URI is required',
        suggestedName: 'Payment URI',
      };
    }
    return {
      encoded: raw,
      isValid: true,
      suggestedName: 'Custom Payment URI',
    };
  }

  const address = data.address.trim();
  if (!address) {
    return {
      encoded: '',
      isValid: false,
      error: 'Wallet address or payment ID is required',
      suggestedName: `${data.scheme.toUpperCase()} Payment`,
    };
  }

  let encoded = '';
  switch (data.scheme) {
    case 'bitcoin': {
      const params = new URLSearchParams();
      if (data.amount.trim()) params.append('amount', data.amount.trim());
      if (data.label.trim()) params.append('label', data.label.trim());
      if (data.message.trim()) params.append('message', data.message.trim());
      const query = params.toString();
      encoded = query ? `bitcoin:${address}?${query}` : `bitcoin:${address}`;
      break;
    }
    case 'ethereum': {
      const params = new URLSearchParams();
      if (data.amount.trim()) params.append('value', data.amount.trim());
      const query = params.toString();
      encoded = query ? `ethereum:${address}?${query}` : `ethereum:${address}`;
      break;
    }
    case 'solana': {
      const params = new URLSearchParams();
      if (data.amount.trim()) params.append('amount', data.amount.trim());
      if (data.label.trim()) params.append('label', data.label.trim());
      if (data.message.trim()) params.append('message', data.message.trim());
      const query = params.toString();
      encoded = query ? `solana:${address}?${query}` : `solana:${address}`;
      break;
    }
    case 'upi': {
      const params = new URLSearchParams();
      params.append('pa', address); // Payee address
      if (data.label.trim()) params.append('pn', data.label.trim()); // Payee name
      if (data.amount.trim()) params.append('am', data.amount.trim()); // Amount
      if (data.message.trim()) params.append('tn', data.message.trim()); // Note
      params.append('cu', 'INR');
      encoded = `upi://pay?${params.toString()}`;
      break;
    }
    default:
      encoded = address;
  }

  return {
    encoded,
    isValid: true,
    suggestedName: `${data.scheme.toUpperCase()}: ${address.slice(0, 8)}...`,
  };
}

// Master Encoder Dispatcher
export function encodeByType(type: QRType, formValues: Record<string, any>): EncodeResult {
  switch (type) {
    case 'text':
      return encodeText(formValues.text || '');
    case 'url':
      return encodeUrl(formValues.url || '');
    case 'email':
      return encodeEmail({
        to: formValues.to || '',
        subject: formValues.subject || '',
        body: formValues.body || '',
      });
    case 'phone':
      return encodePhone(formValues.phone || '');
    case 'sms':
      return encodeSms({
        phone: formValues.phone || '',
        message: formValues.message || '',
      });
    case 'wifi':
      return encodeWifi({
        ssid: formValues.ssid || '',
        password: formValues.password || '',
        encryption: formValues.encryption || 'WPA',
        hidden: Boolean(formValues.hidden),
      });
    case 'vcard':
      return encodeVCard({
        firstName: formValues.firstName || '',
        lastName: formValues.lastName || '',
        organization: formValues.organization || '',
        title: formValues.title || '',
        phone: formValues.phone || '',
        cellPhone: formValues.cellPhone || '',
        email: formValues.email || '',
        url: formValues.url || '',
        street: formValues.street || '',
        city: formValues.city || '',
        state: formValues.state || '',
        zip: formValues.zip || '',
        country: formValues.country || '',
        note: formValues.note || '',
      });
    case 'geo':
      return encodeGeo({
        latitude: String(formValues.latitude ?? ''),
        longitude: String(formValues.longitude ?? ''),
        query: formValues.query || '',
      });
    case 'calendar':
      return encodeCalendar({
        title: formValues.title || '',
        start: formValues.start || '',
        end: formValues.end || '',
        location: formValues.location || '',
        description: formValues.description || '',
        allDay: Boolean(formValues.allDay),
      });
    case 'whatsapp':
      return encodeWhatsApp({
        phone: formValues.phone || '',
        message: formValues.message || '',
      });
    case 'crypto':
      return encodeCrypto({
        scheme: formValues.scheme || 'bitcoin',
        address: formValues.address || '',
        amount: formValues.amount || '',
        label: formValues.label || '',
        message: formValues.message || '',
        customUri: formValues.customUri || '',
      });
    default:
      return {
        encoded: '',
        isValid: false,
        error: 'Unsupported QR type',
        suggestedName: 'QR Code',
      };
  }
}

// Initial default form values for great instant experience
export function getDefaultFormValues(type: QRType): Record<string, any> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(15, 30, 0, 0);

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatDatetimeLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  switch (type) {
    case 'text':
      return { text: 'Welcome to QRForge! Instant, high-resolution QR codes.' };
    case 'url':
      return { url: 'https://github.com' };
    case 'email':
      return {
        to: 'hello@example.com',
        subject: 'Inquiry from QRForge',
        body: 'Hello! I scanned your QR code.',
      };
    case 'phone':
      return { phone: '+1234567890' };
    case 'sms':
      return { phone: '+1234567890', message: 'Hello! Here is the info you requested.' };
    case 'wifi':
      return { ssid: 'Guest_WiFi_5G', password: '', encryption: 'WPA', hidden: false };
    case 'vcard':
      return {
        firstName: 'Alex',
        lastName: 'Morgan',
        organization: 'Apex Studio',
        title: 'Creative Director',
        phone: '+1 555-0199',
        email: 'alex@apexstudio.design',
        url: 'https://apexstudio.design',
        street: '100 Market St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        country: 'USA',
        note: 'Scanned via QRForge',
      };
    case 'geo':
      return {
        latitude: '37.7749',
        longitude: '-122.4194',
        query: 'San Francisco, CA',
      };
    case 'calendar':
      return {
        title: 'Product Launch & Demo',
        start: formatDatetimeLocal(tomorrow),
        end: formatDatetimeLocal(tomorrowEnd),
        location: 'Design Lab, Level 4',
        description: 'Live presentation of the new features.',
        allDay: false,
      };
    case 'whatsapp':
      return {
        phone: '15550199222',
        message: 'Hi! I found your contact on QRForge.',
      };
    case 'crypto':
      return {
        scheme: 'ethereum',
        address: '0x71C...397',
        amount: '0.05',
        label: 'Coffee Donation',
        message: 'Thanks for building QRForge!',
        customUri: '',
      };
  }
}
