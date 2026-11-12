# QRForge ⚡

A mobile-first, glassmorphic Progressive Web App (PWA) QR code generator built with React 19, Vite, Tailwind CSS, and the `qrcode` engine. 100% client-side with persistent offline library storage in `localStorage`.

---

## ✨ Features

1. **11 Supported QR Code Types**:
   - **URL**: Websites, landing pages, articles, and repos.
   - **Text**: Raw text, notes, keys, and serial numbers.
   - **WiFi**: Instant network access (`WIFI:T:WPA;S:ssid;P:password;H:false;;`).
   - **vCard (Contact)**: Digital business card (vCard 3.0 specification).
   - **Email**: Pre-filled mail (`mailto:`) with subject and message body.
   - **Phone**: Direct dial (`tel:`).
   - **SMS**: Direct message (`SMSTO:`) with pre-composed text.
   - **WhatsApp**: Direct chat (`https://wa.me/`) with pre-composed message.
   - **Calendar Event**: iCalendar format (`BEGIN:VEVENT`) with start/end time, location, and description.
   - **Geo Location**: GPS coordinates (`geo:lat,lng`) with "Use My Location" browser geolocation button.
   - **Crypto / Payment**: Bitcoin, Ethereum, Solana, UPI, and custom payment URIs.

2. **Live Debounced Preview**:
   - Updates smoothly in real-time as you type (~180ms debounce).
   - QR modules render on a high-contrast, rounded scannable white tile inside the glassmorphic card.
   - Real-time payload byte count and high-density warnings.

3. **Deep Customization**:
   - **Foreground & Background Colors**: Obsidian, Electric Blue, Crimson, Emerald, Violet presets + custom hex color picker + transparent background option.
   - **Error Correction Levels**: L (7%), M (15%), Q (25%), H (30%) with helpful scannability guidance.
   - **Resolution Sizes**: 256px, 512px, 1024px, and 2048px for print & posters.
   - **Quiet Margins**: 0, 1, 2, or 4 modules.
   - **Center Logo Upload**: Embed brand icons/logos with custom backing shapes (rounded squircle, circle, square, or borderless) and size controls (automatically sets error correction to High).

4. **Instant Export & Actions**:
   - Download High-Resolution PNG at exact selected pixel resolution.
   - Download Vector SVG for graphic design and print materials.
   - Copy PNG image directly to clipboard (`ClipboardItem`).
   - Native Web Share API with clipboard fallback.
   - Save to offline library.

5. **Offline Library (`localStorage`)**:
   - Versioned schema (`qrforge:v1`) wrapped in a resilient `useLocalStorage` hook with automatic quota error handling.
   - Search by name, content, or type.
   - Filter by type or Favorites.
   - Sort by Newest, Oldest, or Name (A-Z).
   - Card details bottom-sheet on mobile / modal on desktop: re-download, copy, duplicate, edit, delete.
   - Export and import library backups as JSON files.

6. **Glassmorphism Aesthetic & Mobile Ergonomics**:
   - Palette: Deep black/navy `#05060f` to `#0a1230`, electric blue primary (`#2f6bff` / `#4da3ff`), crisp white text, and crimson red `#ff3b4e` accent.
   - CSS-animated glowing ambient orbs with `prefers-reduced-motion` compliance.
   - Designed for 360px touch viewports with touch targets $\ge 44px$ and 16px minimum input font to prevent iOS Safari auto-zoom.
   - Sticky bottom action bar on mobile Create screen.
   - Bottom tab bar on mobile (Create | Library | Settings).
   - PWA install button with dedicated iOS Safari "Add to Home Screen" instructions.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or Node.js 22+

### Installation & Run

```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The app will be accessible at `http://localhost:3000`.

### Production Build

```bash
# Build production bundle with Vite and PWA service worker
npm run build

# Preview production build locally
npm run preview
```

## 📱 Android APK & WebAPK Installation

QRForge is configured with full **WebAPK** and **Trusted Web Activity (TWA)** compliance, enabling it to be installed or packaged as an Android `.apk` in 3 ways:

### 1. Direct Native WebAPK (1-Tap on Android)
When accessed via **Google Chrome, Samsung Internet, Edge, or Brave on Android**:
- Tap **"Install APK"** in the app header or settings.
- Google Chrome automatically invokes Android's WebAPK minting service, compiling and installing a signed native `.apk` (`org.chromium.webapk.*`) directly into your Android OS App Drawer and Settings > Apps.

### 2. Standalone APK with PWABuilder (No Coding)
- Go to [PWABuilder.com](https://www.pwabuilder.com/) and enter your deployed URL.
- Tap **"Build APK"** to download a signed `app-release.apk` for sideloading on any Android device or `app.aab` for Google Play Console.

### 3. Build APK with Google Bubblewrap CLI (Command Line)
Download `twa-manifest.json` from the in-app APK Hub or run:
```bash
# Initialize and build Android APK directly
npx @bubblewrap/cli init --manifest=https://<your-app-url>/manifest.json
npx @bubblewrap/cli build
```
This generates `app-release-signed.apk` ready to install via `adb install` or direct device sideloading.

---

## 🔒 Privacy & Local-First

QRForge runs **100% on the client side**. No data, URLs, passwords, contacts, or analytics ever leave your device or touch an external server.
