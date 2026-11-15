import { ParsedQRAction, ParsedQRField, ParsedQRResult } from '../types/qr';

function unescapeWifiValue(val: string): string {
  return val.replace(/\\([\\;,:"])/g, '$1');
}

function unescapeVCardValue(val: string): string {
  return val
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseICalTimestamp(raw: string): { display: string; inputLocal: string; allDay: boolean } {
  const cleaned = raw.trim();
  // Format: YYYYMMDD
  const dateOnlyMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    return {
      display: dateObj.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      inputLocal: `${y}-${m}-${d}T00:00`,
      allDay: true,
    };
  }

  // Format: YYYYMMDDTHHMMSS(Z)
  const dtMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (dtMatch) {
    const [, y, m, d, hh, mm, ss, isUtc] = dtMatch;
    const dateObj = isUtc
      ? new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)))
      : new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));

    const pad = (n: number) => String(n).padStart(2, '0');
    const localInput = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(
      dateObj.getDate()
    )}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;

    return {
      display: dateObj.toLocaleString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      inputLocal: localInput,
      allDay: false,
    };
  }

  return { display: cleaned, inputLocal: '', allDay: false };
}

function parseWifi(raw: string): ParsedQRResult | null {
  if (!/^WIFI:/i.test(raw)) return null;

  const body = raw.slice(5);
  // Split on unescaped semicolons
  const tokens: string[] = [];
  let current = '';
  let escaped = false;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (escaped) {
      current += '\\' + ch;
      escaped = false;
    } else if (ch === '\\') {
      escaped = true;
    } else if (ch === ';') {
      if (current) tokens.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  let ssid = '';
  let password = '';
  let encryption: 'WPA' | 'WEP' | 'nopass' = 'WPA';
  let hidden = false;

  for (const token of tokens) {
    const idx = token.indexOf(':');
    if (idx === -1) continue;
    const key = token.slice(0, idx).toUpperCase();
    const value = unescapeWifiValue(token.slice(idx + 1));

    if (key === 'S') ssid = value;
    else if (key === 'P') password = value;
    else if (key === 'T') {
      const upper = value.toUpperCase();
      if (upper === 'WEP') encryption = 'WEP';
      else if (upper === 'NOPASS' || upper === 'NONE' || upper === '') encryption = 'nopass';
      else encryption = 'WPA';
    } else if (key === 'H') {
      hidden = value.toLowerCase() === 'true';
    }
  }

  const fields: ParsedQRField[] = [
    { key: 'ssid', label: 'Network Name (SSID)', value: ssid || 'Unknown Network', copyable: true },
    {
      key: 'encryption',
      label: 'Security',
      value: encryption === 'nopass' ? 'Open (No Password)' : encryption,
    },
  ];

  if (password) {
    fields.push({
      key: 'password',
      label: 'Password',
      value: password,
      sensitive: true,
      copyable: true,
      mono: true,
    });
  }

  if (hidden) {
    fields.push({ key: 'hidden', label: 'Visibility', value: 'Hidden Network' });
  }

  const actions: ParsedQRAction[] = [];
  if (password) {
    actions.push({
      id: 'copy-pass',
      label: 'Copy Password',
      kind: 'copy',
      copyValue: password,
      primary: true,
    });
  }
  if (ssid) {
    actions.push({
      id: 'copy-ssid',
      label: 'Copy Network Name',
      kind: 'copy',
      copyValue: ssid,
      primary: !password,
    });
  }

  return {
    type: 'wifi',
    typeLabel: 'WiFi Network',
    raw,
    title: ssid || 'WiFi Network',
    subtitle: `${encryption === 'nopass' ? 'Open' : encryption} Wireless Credentials`,
    fields,
    actions,
    formValues: {
      ssid,
      password,
      encryption,
      hidden,
    },
  };
}

function parseVCard(raw: string): ParsedQRResult | null {
  if (!/^BEGIN:VCARD/i.test(raw.trim())) return null;

  // Unfold lines per RFC 6350
  const unfolded = raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  let firstName = '';
  let lastName = '';
  let fullName = '';
  let organization = '';
  let title = '';
  let phone = '';
  let cellPhone = '';
  let email = '';
  let url = '';
  let street = '';
  let city = '';
  let state = '';
  let zip = '';
  let country = '';
  let note = '';

  const extraPhones: Array<{ label: string; value: string }> = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const rawProp = line.slice(0, colonIdx);
    const rawVal = line.slice(colonIdx + 1).trim();
    const [propName, ...params] = rawProp.split(';');
    const key = propName.toUpperCase();
    const paramStr = params.join(';').toUpperCase();

    if (key === 'FN') {
      fullName = unescapeVCardValue(rawVal);
    } else if (key === 'N') {
      const parts = rawVal.split(';').map(unescapeVCardValue);
      lastName = parts[0] || '';
      firstName = parts[1] || '';
    } else if (key === 'ORG') {
      organization = unescapeVCardValue(rawVal.split(';')[0] || rawVal);
    } else if (key === 'TITLE') {
      title = unescapeVCardValue(rawVal);
    } else if (key === 'TEL') {
      const val = unescapeVCardValue(rawVal);
      if (!phone) {
        phone = val;
      } else if (!cellPhone && paramStr.includes('WORK')) {
        cellPhone = val;
      } else if (!cellPhone) {
        cellPhone = val;
      } else {
        extraPhones.push({ label: 'Phone', value: val });
      }
    } else if (key === 'EMAIL' && !email) {
      email = unescapeVCardValue(rawVal);
    } else if (key === 'URL' && !url) {
      url = unescapeVCardValue(rawVal);
    } else if (key === 'ADR') {
      const parts = rawVal.split(';').map(unescapeVCardValue);
      // ADR format: PO Box;Extended;Street;City;Region;Postal;Country
      street = parts[2] || parts[1] || '';
      city = parts[3] || '';
      state = parts[4] || '';
      zip = parts[5] || '';
      country = parts[6] || '';
    } else if (key === 'NOTE') {
      note = unescapeVCardValue(rawVal);
    }
  }

  if (!firstName && !lastName && fullName) {
    const nameParts = fullName.trim().split(/\s+/);
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ');
  }

  const displayName =
    fullName || [firstName, lastName].filter(Boolean).join(' ') || organization || 'Contact Card';

  const formattedAddress = [street, city, state, zip, country].filter(Boolean).join(', ');

  const fields: ParsedQRField[] = [
    { key: 'name', label: 'Full Name', value: displayName, copyable: true },
  ];
  if (organization) fields.push({ key: 'org', label: 'Organization', value: organization, copyable: true });
  if (title) fields.push({ key: 'title', label: 'Role / Title', value: title });
  if (phone) fields.push({ key: 'phone', label: 'Primary Phone', value: phone, copyable: true, mono: true });
  if (cellPhone) fields.push({ key: 'cellPhone', label: 'Secondary Phone', value: cellPhone, copyable: true, mono: true });
  extraPhones.forEach((p, idx) =>
    fields.push({ key: `extraPhone_${idx}`, label: p.label, value: p.value, copyable: true, mono: true })
  );
  if (email) fields.push({ key: 'email', label: 'Email', value: email, copyable: true });
  if (url) fields.push({ key: 'url', label: 'Website', value: url, copyable: true });
  if (formattedAddress) fields.push({ key: 'address', label: 'Address', value: formattedAddress, copyable: true });
  if (note) fields.push({ key: 'note', label: 'Note', value: note });

  const safeFile = displayName.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || 'contact';

  const actions: ParsedQRAction[] = [
    {
      id: 'download-vcf',
      label: 'Save Contact (.vcf)',
      kind: 'download-vcf',
      filename: `${safeFile}.vcf`,
      fileContent: raw,
      primary: true,
    },
  ];
  if (phone) {
    actions.push({
      id: 'call-contact',
      label: 'Call',
      kind: 'link',
      href: `tel:${phone.replace(/[^\d+*#]/g, '')}`,
    });
  }
  if (email) {
    actions.push({
      id: 'email-contact',
      label: 'Email',
      kind: 'link',
      href: `mailto:${email}`,
    });
  }

  return {
    type: 'vcard',
    typeLabel: 'vCard Contact',
    raw,
    title: displayName,
    subtitle: [title, organization].filter(Boolean).join(' · ') || 'Digital Business Card',
    fields,
    actions,
    formValues: {
      firstName,
      lastName,
      organization,
      title,
      phone,
      cellPhone,
      email,
      url,
      street,
      city,
      state,
      zip,
      country,
      note,
    },
  };
}

function parseMeCard(raw: string): ParsedQRResult | null {
  if (!/^MECARD:/i.test(raw)) return null;
  const body = raw.slice(7);
  const parts = body.split(';');
  let name = '';
  let phone = '';
  let email = '';
  let org = '';
  let url = '';
  let note = '';
  let address = '';

  for (const part of parts) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const k = part.slice(0, idx).toUpperCase();
    const v = part.slice(idx + 1);
    if (k === 'N') name = v.split(',').reverse().map((s) => s.trim()).filter(Boolean).join(' ');
    else if (k === 'TEL') phone = v;
    else if (k === 'EMAIL') email = v;
    else if (k === 'ORG') org = v;
    else if (k === 'URL') url = v;
    else if (k === 'NOTE') note = v;
    else if (k === 'ADR') address = v.split(',').filter(Boolean).join(', ');
  }

  const nameTokens = name.split(' ');
  const firstName = nameTokens[0] || '';
  const lastName = nameTokens.slice(1).join(' ');

  const fields: ParsedQRField[] = [{ key: 'name', label: 'Name', value: name || 'Contact', copyable: true }];
  if (org) fields.push({ key: 'org', label: 'Organization', value: org });
  if (phone) fields.push({ key: 'phone', label: 'Phone', value: phone, copyable: true, mono: true });
  if (email) fields.push({ key: 'email', label: 'Email', value: email, copyable: true });
  if (url) fields.push({ key: 'url', label: 'Website', value: url, copyable: true });
  if (address) fields.push({ key: 'address', label: 'Address', value: address, copyable: true });
  if (note) fields.push({ key: 'note', label: 'Note', value: note });

  const vcfContent = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${lastName};${firstName};;;`,
    `FN:${name || 'Contact'}`,
    org ? `ORG:${org}` : '',
    phone ? `TEL:${phone}` : '',
    email ? `EMAIL:${email}` : '',
    url ? `URL:${url}` : '',
    note ? `NOTE:${note}` : '',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\n');

  const actions: ParsedQRAction[] = [
    {
      id: 'download-vcf',
      label: 'Save Contact (.vcf)',
      kind: 'download-vcf',
      filename: `${(name || 'contact').toLowerCase().replace(/[^a-z0-9_-]/g, '-')}.vcf`,
      fileContent: vcfContent,
      primary: true,
    },
  ];
  if (phone) {
    actions.push({ id: 'call', label: 'Call', kind: 'link', href: `tel:${phone}` });
  }

  return {
    type: 'vcard',
    typeLabel: 'Contact (MECARD)',
    raw,
    title: name || 'Contact Card',
    subtitle: org || 'MECARD Contact',
    fields,
    actions,
    formValues: {
      firstName,
      lastName,
      organization: org,
      title: '',
      phone,
      email,
      url,
      street: address,
      city: '',
      state: '',
      zip: '',
      country: '',
      note,
    },
  };
}

function parseCalendar(raw: string): ParsedQRResult | null {
  const trimmed = raw.trim();
  if (!/^BEGIN:(VCALENDAR|VEVENT)/i.test(trimmed)) return null;

  const unfolded = trimmed.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  let title = '';
  let startRaw = '';
  let endRaw = '';
  let location = '';
  let description = '';

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const propName = line.slice(0, colonIdx).split(';')[0].toUpperCase();
    const val = unescapeVCardValue(line.slice(colonIdx + 1).trim());

    if (propName === 'SUMMARY') title = val;
    else if (propName === 'DTSTART') startRaw = val;
    else if (propName === 'DTEND') endRaw = val;
    else if (propName === 'LOCATION') location = val;
    else if (propName === 'DESCRIPTION') description = val;
  }

  const startParsed = startRaw ? parseICalTimestamp(startRaw) : { display: '', inputLocal: '', allDay: false };
  const endParsed = endRaw ? parseICalTimestamp(endRaw) : { display: '', inputLocal: '', allDay: false };

  const fields: ParsedQRField[] = [
    { key: 'title', label: 'Event Title', value: title || 'Calendar Event', copyable: true },
  ];
  if (startParsed.display) fields.push({ key: 'start', label: 'Starts', value: startParsed.display });
  if (endParsed.display) fields.push({ key: 'end', label: 'Ends', value: endParsed.display });
  if (location) fields.push({ key: 'location', label: 'Location', value: location, copyable: true });
  if (description) fields.push({ key: 'description', label: 'Description', value: description });

  const icsBody = /^BEGIN:VCALENDAR/i.test(trimmed)
    ? trimmed
    : `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//QRForge//EN\n${trimmed}\nEND:VCALENDAR`;

  const safeTitle = (title || 'event').toLowerCase().replace(/[^a-z0-9_-]/g, '-');

  return {
    type: 'calendar',
    typeLabel: 'Calendar Event',
    raw,
    title: title || 'Calendar Event',
    subtitle: startParsed.display || 'iCalendar Schedule Invite',
    fields,
    actions: [
      {
        id: 'download-ics',
        label: 'Add to Calendar (.ics)',
        kind: 'download-ics',
        filename: `${safeTitle}.ics`,
        fileContent: icsBody,
        primary: true,
      },
      ...(location
        ? [
            {
              id: 'open-location',
              label: 'Search Location',
              kind: 'maps' as const,
              href: `https://maps.google.com/?q=${encodeURIComponent(location)}`,
            },
          ]
        : []),
    ],
    formValues: {
      title,
      start: startParsed.inputLocal,
      end: endParsed.inputLocal,
      location,
      description,
      allDay: startParsed.allDay,
    },
  };
}

function parseEmail(raw: string): ParsedQRResult | null {
  if (/^mailto:/i.test(raw)) {
    const withoutScheme = raw.slice(7);
    const qIdx = withoutScheme.indexOf('?');
    const to = decodeURIComponent(qIdx === -1 ? withoutScheme : withoutScheme.slice(0, qIdx));
    const params = new URLSearchParams(qIdx === -1 ? '' : withoutScheme.slice(qIdx + 1));
    const subject = params.get('subject') || '';
    const body = params.get('body') || '';

    const fields: ParsedQRField[] = [{ key: 'to', label: 'Recipient', value: to, copyable: true }];
    if (subject) fields.push({ key: 'subject', label: 'Subject', value: subject, copyable: true });
    if (body) fields.push({ key: 'body', label: 'Message Body', value: body, copyable: true });

    return {
      type: 'email',
      typeLabel: 'Email',
      raw,
      title: to || 'Email Draft',
      subtitle: subject || 'Pre-filled Email Message',
      fields,
      actions: [
        {
          id: 'open-mail',
          label: 'Compose Email',
          kind: 'link',
          href: raw,
          primary: true,
        },
        {
          id: 'copy-email',
          label: 'Copy Address',
          kind: 'copy',
          copyValue: to,
        },
      ],
      formValues: { to, subject, body },
    };
  }

  if (/^MATMSG:/i.test(raw)) {
    const toMatch = raw.match(/TO:([^;]*)/i);
    const subMatch = raw.match(/SUB:([^;]*)/i);
    const bodyMatch = raw.match(/BODY:([^;]*)/i);
    const to = toMatch?.[1] || '';
    const subject = subMatch?.[1] || '';
    const body = bodyMatch?.[1] || '';

    const fields: ParsedQRField[] = [{ key: 'to', label: 'Recipient', value: to, copyable: true }];
    if (subject) fields.push({ key: 'subject', label: 'Subject', value: subject, copyable: true });
    if (body) fields.push({ key: 'body', label: 'Message Body', value: body, copyable: true });

    const mailtoHref = `mailto:${to}?${new URLSearchParams({
      ...(subject ? { subject } : {}),
      ...(body ? { body } : {}),
    }).toString()}`;

    return {
      type: 'email',
      typeLabel: 'Email',
      raw,
      title: to || 'Email Draft',
      subtitle: subject || 'Pre-filled Email Message',
      fields,
      actions: [
        { id: 'open-mail', label: 'Compose Email', kind: 'link', href: mailtoHref, primary: true },
        { id: 'copy-email', label: 'Copy Address', kind: 'copy', copyValue: to },
      ],
      formValues: { to, subject, body },
    };
  }

  return null;
}

function parsePhone(raw: string): ParsedQRResult | null {
  if (!/^tel:/i.test(raw)) return null;
  const phone = decodeURIComponent(raw.slice(4)).trim();

  return {
    type: 'phone',
    typeLabel: 'Phone Number',
    raw,
    title: phone,
    subtitle: 'Direct Telephone Dial',
    fields: [{ key: 'phone', label: 'Phone Number', value: phone, copyable: true, mono: true }],
    actions: [
      { id: 'call', label: 'Call Number', kind: 'link', href: raw, primary: true },
      { id: 'copy-phone', label: 'Copy Number', kind: 'copy', copyValue: phone },
    ],
    formValues: { phone },
  };
}

function parseSms(raw: string): ParsedQRResult | null {
  if (/^SMSTO:/i.test(raw)) {
    const rest = raw.slice(6);
    const colonIdx = rest.indexOf(':');
    const phone = colonIdx === -1 ? rest : rest.slice(0, colonIdx);
    const message = colonIdx === -1 ? '' : rest.slice(colonIdx + 1);

    const fields: ParsedQRField[] = [
      { key: 'phone', label: 'Recipient Number', value: phone, copyable: true, mono: true },
    ];
    if (message) fields.push({ key: 'message', label: 'Message', value: message, copyable: true });

    const smsHref = message
      ? `sms:${phone}?body=${encodeURIComponent(message)}`
      : `sms:${phone}`;

    return {
      type: 'sms',
      typeLabel: 'SMS Message',
      raw,
      title: phone || 'SMS Draft',
      subtitle: message ? `"${message.slice(0, 48)}${message.length > 48 ? '…' : ''}"` : 'Direct Text Message',
      fields,
      actions: [
        { id: 'send-sms', label: 'Open Messages', kind: 'link', href: smsHref, primary: true },
        { id: 'copy-phone', label: 'Copy Number', kind: 'copy', copyValue: phone },
      ],
      formValues: { phone, message },
    };
  }

  if (/^sms:/i.test(raw)) {
    const rest = raw.slice(4);
    const qIdx = rest.indexOf('?');
    const phone = qIdx === -1 ? rest : rest.slice(0, qIdx);
    const params = new URLSearchParams(qIdx === -1 ? '' : rest.slice(qIdx + 1));
    const message = params.get('body') || '';

    const fields: ParsedQRField[] = [
      { key: 'phone', label: 'Recipient Number', value: phone, copyable: true, mono: true },
    ];
    if (message) fields.push({ key: 'message', label: 'Message', value: message, copyable: true });

    return {
      type: 'sms',
      typeLabel: 'SMS Message',
      raw,
      title: phone || 'SMS Draft',
      subtitle: message ? `"${message.slice(0, 48)}${message.length > 48 ? '…' : ''}"` : 'Direct Text Message',
      fields,
      actions: [
        { id: 'send-sms', label: 'Open Messages', kind: 'link', href: raw, primary: true },
        { id: 'copy-phone', label: 'Copy Number', kind: 'copy', copyValue: phone },
      ],
      formValues: { phone, message },
    };
  }

  return null;
}

function parseWhatsApp(raw: string): ParsedQRResult | null {
  const waMeMatch = raw.match(/^https?:\/\/(?:www\.)?wa\.me\/(\d+)(?:\?(.*))?$/i);
  const waApiMatch = raw.match(/^https?:\/\/api\.whatsapp\.com\/send\?(.*)$/i);
  const waSchemeMatch = raw.match(/^whatsapp:\/\/send\?(.*)$/i);

  if (!waMeMatch && !waApiMatch && !waSchemeMatch) return null;

  let phone = '';
  let message = '';

  if (waMeMatch) {
    phone = waMeMatch[1] || '';
    const params = new URLSearchParams(waMeMatch[2] || '');
    message = params.get('text') || '';
  } else {
    const queryStr = (waApiMatch?.[1] || waSchemeMatch?.[1]) ?? '';
    const params = new URLSearchParams(queryStr);
    phone = (params.get('phone') || '').replace(/[^\d]/g, '');
    message = params.get('text') || '';
  }

  const fields: ParsedQRField[] = [
    { key: 'phone', label: 'WhatsApp Number', value: phone ? `+${phone}` : 'Unspecified', copyable: !!phone, mono: true },
  ];
  if (message) fields.push({ key: 'message', label: 'Pre-filled Message', value: message, copyable: true });

  const waLink = phone
    ? `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`
    : raw;

  return {
    type: 'whatsapp',
    typeLabel: 'WhatsApp Chat',
    raw,
    title: phone ? `+${phone}` : 'WhatsApp Link',
    subtitle: message ? `"${message.slice(0, 48)}${message.length > 48 ? '…' : ''}"` : 'Direct WhatsApp Conversation',
    fields,
    actions: [
      { id: 'open-wa', label: 'Open in WhatsApp', kind: 'link', href: waLink, primary: true },
      ...(phone ? [{ id: 'copy-wa', label: 'Copy Number', kind: 'copy' as const, copyValue: `+${phone}` }] : []),
    ],
    formValues: { phone, message },
  };
}

function parseGeo(raw: string): ParsedQRResult | null {
  if (!/^geo:/i.test(raw)) return null;

  const rest = raw.slice(4);
  const qIdx = rest.indexOf('?');
  const coordsPart = qIdx === -1 ? rest : rest.slice(0, qIdx);
  const params = new URLSearchParams(qIdx === -1 ? '' : rest.slice(qIdx + 1));

  const [latStr = '', lngStr = ''] = coordsPart.split(',');
  const latitude = latStr.trim();
  const longitude = lngStr.split(';')[0]?.trim() || '';
  const query = params.get('q') || '';

  const fields: ParsedQRField[] = [
    { key: 'lat', label: 'Latitude', value: latitude, copyable: true, mono: true },
    { key: 'lng', label: 'Longitude', value: longitude, copyable: true, mono: true },
  ];
  if (query) fields.push({ key: 'query', label: 'Label / Query', value: query, copyable: true });

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(
    latitude && longitude ? `${latitude},${longitude}` : query
  )}`;

  return {
    type: 'geo',
    typeLabel: 'Geo Location',
    raw,
    title: query || `${latitude}, ${longitude}`,
    subtitle: 'GPS Map Coordinates',
    fields,
    actions: [
      { id: 'open-maps', label: 'Open in Maps', kind: 'maps', href: mapsUrl, primary: true },
      {
        id: 'copy-coords',
        label: 'Copy Coordinates',
        kind: 'copy',
        copyValue: `${latitude}, ${longitude}`,
      },
    ],
    formValues: { latitude, longitude, query },
  };
}

function parseCrypto(raw: string): ParsedQRResult | null {
  const btcMatch = raw.match(/^bitcoin:([^?]+)(?:\?(.*))?$/i);
  const ethMatch = raw.match(/^ethereum:([^?@/]+)(?:[@/][^?]*)?(?:\?(.*))?$/i);
  const solMatch = raw.match(/^solana:([^?]+)(?:\?(.*))?$/i);
  const upiMatch = raw.match(/^upi:\/\/pay\?(.*)$/i);

  if (!btcMatch && !ethMatch && !solMatch && !upiMatch) return null;

  let scheme: 'bitcoin' | 'ethereum' | 'solana' | 'upi' = 'bitcoin';
  let address = '';
  let amount = '';
  let label = '';
  let message = '';

  if (btcMatch) {
    scheme = 'bitcoin';
    address = btcMatch[1];
    const params = new URLSearchParams(btcMatch[2] || '');
    amount = params.get('amount') || '';
    label = params.get('label') || '';
    message = params.get('message') || '';
  } else if (ethMatch) {
    scheme = 'ethereum';
    address = ethMatch[1];
    const params = new URLSearchParams(ethMatch[2] || '');
    amount = params.get('value') || params.get('amount') || '';
  } else if (solMatch) {
    scheme = 'solana';
    address = solMatch[1];
    const params = new URLSearchParams(solMatch[2] || '');
    amount = params.get('amount') || '';
    label = params.get('label') || '';
    message = params.get('message') || '';
  } else if (upiMatch) {
    scheme = 'upi';
    const params = new URLSearchParams(upiMatch[1] || '');
    address = params.get('pa') || '';
    label = params.get('pn') || '';
    amount = params.get('am') || '';
    message = params.get('tn') || '';
  }

  const schemeNames = {
    bitcoin: 'Bitcoin (BTC)',
    ethereum: 'Ethereum (ETH)',
    solana: 'Solana (SOL)',
    upi: 'UPI Payment',
  };

  const fields: ParsedQRField[] = [
    { key: 'scheme', label: 'Network / Protocol', value: schemeNames[scheme] },
    {
      key: 'address',
      label: scheme === 'upi' ? 'Payee UPI ID' : 'Wallet Address',
      value: address,
      copyable: true,
      mono: true,
    },
  ];
  if (amount) fields.push({ key: 'amount', label: 'Amount', value: amount, copyable: true, mono: true });
  if (label) fields.push({ key: 'label', label: 'Payee / Label', value: label });
  if (message) fields.push({ key: 'message', label: 'Memo / Note', value: message });

  return {
    type: 'crypto',
    typeLabel: schemeNames[scheme],
    raw,
    title: label || `${schemeNames[scheme]} Payment`,
    subtitle: amount ? `Amount: ${amount}` : address.slice(0, 22) + (address.length > 22 ? '…' : ''),
    fields,
    actions: [
      {
        id: 'copy-addr',
        label: scheme === 'upi' ? 'Copy UPI ID' : 'Copy Address',
        kind: 'copy',
        copyValue: address,
        primary: true,
      },
      {
        id: 'open-wallet',
        label: 'Open Payment App',
        kind: 'link',
        href: raw,
      },
    ],
    formValues: {
      scheme,
      address,
      amount,
      label,
      message,
      customUri: '',
    },
  };
}

function parseUrl(raw: string): ParsedQRResult | null {
  if (!/^https?:\/\//i.test(raw) && !/^ftp:\/\//i.test(raw)) return null;

  try {
    const parsed = new URL(raw);
    const fields: ParsedQRField[] = [
      { key: 'host', label: 'Domain / Host', value: parsed.hostname, copyable: true },
      { key: 'protocol', label: 'Protocol', value: parsed.protocol.replace(':', '').toUpperCase() },
    ];
    if (parsed.pathname && parsed.pathname !== '/') {
      fields.push({ key: 'path', label: 'Path', value: parsed.pathname, mono: true });
    }
    const paramEntries = Array.from(parsed.searchParams.entries());
    if (paramEntries.length > 0) {
      paramEntries.slice(0, 6).forEach(([k, v], idx) => {
        fields.push({
          key: `param_${idx}`,
          label: `Query: ${k}`,
          value: v,
          copyable: true,
          mono: true,
        });
      });
    }

    return {
      type: 'url',
      typeLabel: 'Website URL',
      raw,
      title: parsed.hostname,
      subtitle: parsed.pathname !== '/' ? parsed.pathname : parsed.href,
      fields,
      actions: [
        { id: 'open-url', label: 'Open Link', kind: 'link', href: raw, primary: true },
        { id: 'copy-url', label: 'Copy URL', kind: 'copy', copyValue: raw },
      ],
      formValues: { url: raw },
      securityNote:
        parsed.protocol === 'http:'
          ? 'Unencrypted HTTP link — verify the domain before visiting.'
          : undefined,
    };
  } catch {
    return null;
  }
}

function parsePlainText(raw: string): ParsedQRResult {
  let jsonPretty: string | undefined;
  const fields: ParsedQRField[] = [];

  const trimmed = raw.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const obj = JSON.parse(trimmed);
      jsonPretty = JSON.stringify(obj, null, 2);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        Object.entries(obj)
          .slice(0, 8)
          .forEach(([k, v]) => {
            fields.push({
              key: `json_${k}`,
              label: k,
              value: typeof v === 'object' ? JSON.stringify(v) : String(v),
              copyable: true,
              mono: typeof v === 'number' || typeof v === 'boolean',
            });
          });
      }
    } catch {
      // Not valid JSON, treat as plain text
    }
  }

  if (fields.length === 0) {
    fields.push({
      key: 'text',
      label: 'Decoded Text',
      value: raw,
      copyable: true,
    });
  }

  const singleLinePreview = trimmed.replace(/\s+/g, ' ').slice(0, 42);

  return {
    type: 'text',
    typeLabel: jsonPretty ? 'Structured JSON' : 'Plain Text',
    raw,
    title: jsonPretty ? 'JSON Payload' : singleLinePreview || 'Text Content',
    subtitle: `${raw.length} characters · ${new Blob([raw]).size} bytes`,
    fields,
    actions: [
      {
        id: 'copy-text',
        label: jsonPretty ? 'Copy JSON' : 'Copy Text',
        kind: 'copy',
        copyValue: jsonPretty || raw,
        primary: true,
      },
    ],
    formValues: { text: raw },
    jsonPretty,
  };
}

export function decodeStructuredQR(rawPayload: string): ParsedQRResult {
  const trimmed = rawPayload.trim();

  return (
    parseWifi(trimmed) ||
    parseVCard(trimmed) ||
    parseMeCard(trimmed) ||
    parseCalendar(trimmed) ||
    parseWhatsApp(trimmed) ||
    parseEmail(trimmed) ||
    parsePhone(trimmed) ||
    parseSms(trimmed) ||
    parseGeo(trimmed) ||
    parseCrypto(trimmed) ||
    parseUrl(trimmed) ||
    parsePlainText(rawPayload)
  );
}
