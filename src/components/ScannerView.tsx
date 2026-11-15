import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Flashlight,
  Image as ImageIcon,
  MapPin,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  Sparkles,
  SwitchCamera,
  Upload,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ParsedQRAction, ParsedQRResult, QRStyleSettings, SavedQRItem } from '../types/qr';
import { decodeStructuredQR } from '../utils/decoders';
import { QR_TYPE_CONFIG } from './TypeSelector';
import { downloadBlob, getQRCodeDataUrl } from '../utils/qrRenderer';
import { useToast } from '../context/ToastContext';

interface ScannerViewProps {
  onLoadInCreator: (result: ParsedQRResult) => void;
  onSaveToLibrary: (item: Omit<SavedQRItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

type ScanSourceMode = 'camera' | 'image';

const DEFAULT_SAVED_STYLE: QRStyleSettings = {
  fgColor: '#000000',
  bgColor: '#ffffff',
  size: 512,
  errorCorrectionLevel: 'M',
  margin: 2,
  logo: null,
};

export const ScannerView: React.FC<ScannerViewProps> = ({
  onLoadInCreator,
  onSaveToLibrary,
}) => {
  const [sourceMode, setSourceMode] = useState<ScanSourceMode>('camera');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scanResult, setScanResult] = useState<ParsedQRResult | null>(null);
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [savedToLib, setSavedToLib] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { showToast } = useToast();

  // Stop camera and animation loop cleanly
  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  // Process a successfully decoded string
  const handleDecodedPayload = useCallback(
    (rawString: string) => {
      const parsed = decodeStructuredQR(rawString);
      setScanResult(parsed);
      setRevealedFields({});
      setSavedToLib(false);
      setShowRawPayload(false);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(50);
        } catch {
          // Ignore vibration errors
        }
      }

      showToast(`Detected ${parsed.typeLabel}`, 'success');
    },
    [showToast]
  );

  // Camera frame scanning loop
  const startScanLoop = useCallback(() => {
    const tick = (now: number) => {
      const video = videoRef.current;
      const canvas = scanCanvasRef.current;

      if (!video || !canvas || !streamRef.current) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA && now - lastScanTimeRef.current >= 140) {
        lastScanTimeRef.current = now;

        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (vw > 0 && vh > 0) {
          // Scale down high-res camera feeds for fast decoding
          const maxDim = 720;
          const scale = Math.min(1, maxDim / Math.max(vw, vh));
          const w = Math.round(vw * scale);
          const h = Math.round(vh * scale);

          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });

            if (code && code.data) {
              stopCamera();
              handleDecodedPayload(code.data);
              return;
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [handleDecodedPayload, stopCamera]);

  // Start camera stream
  const startCamera = useCallback(
    async (mode: 'environment' | 'user' = facingMode) => {
      stopCamera();
      setCameraError(null);
      setCameraStarting(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStarting(false);
        setCameraError('Camera access is not supported in this browser or context. Try uploading an image instead.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        streamRef.current = stream;

        // Check torch capability
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
          const caps = videoTrack.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
          setTorchSupported(Boolean(caps.torch));
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
        }

        setCameraActive(true);
        setCameraStarting(false);
        startScanLoop();
      } catch (err: any) {
        stopCamera();
        setCameraStarting(false);
        const msg =
          err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings or upload a QR image.'
            : err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError'
            ? 'No camera device found on this device. You can upload or paste a QR image instead.'
            : err?.message || 'Could not start camera. Try uploading an image instead.';
        setCameraError(msg);
      }
    },
    [facingMode, startScanLoop, stopCamera]
  );

  // Start/stop camera automatically when switching mode or unmounting
  useEffect(() => {
    if (sourceMode === 'camera' && !scanResult) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [sourceMode, facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  // Toggle Flashlight / Torch
  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const nextState = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextState } as MediaTrackConstraintSet],
      });
      setTorchOn(nextState);
    } catch {
      showToast('Flashlight toggle not supported on this camera', 'error');
    }
  };

  // Switch Front/Back Camera
  const handleSwitchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
  };

  // Decode an uploaded or pasted image File/Blob
  const decodeImageFile = useCallback(
    (file: File | Blob) => {
      if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file (PNG, JPG, WebP, SVG)', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;

        setUploadedPreviewUrl(dataUrl);

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1400;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Fill white background first in case image is a transparent PNG/SVG QR
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = jsQR(imgData.data, imgData.width, imgData.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (decoded && decoded.data) {
            handleDecodedPayload(decoded.data);
          } else {
            showToast('No QR code detected in that image. Try cropping closer.', 'error');
          }
        };
        img.onerror = () => {
          showToast('Could not read the uploaded image.', 'error');
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [handleDecodedPayload, showToast]
  );

  // Global clipboard paste listener while ScannerView is mounted
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            setSourceMode('image');
            stopCamera();
            decodeImageFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [decodeImageFile, stopCamera]);

  const handleCopyText = async (value: string, key: string, label = 'Copied') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      showToast(`${label} to clipboard`, 'success');
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      showToast('Clipboard write failed', 'error');
    }
  };

  const handleActionClick = (action: ParsedQRAction) => {
    if (action.kind === 'copy' && action.copyValue) {
      handleCopyText(action.copyValue, action.id, action.label);
    } else if ((action.kind === 'download-vcf' || action.kind === 'download-ics') && action.fileContent) {
      const mime =
        action.kind === 'download-vcf'
          ? 'text/vcard;charset=utf-8'
          : 'text/calendar;charset=utf-8';
      const blob = new Blob([action.fileContent], { type: mime });
      downloadBlob(blob, action.filename || 'qrforge-export');
      showToast(`Downloaded ${action.filename}`, 'success');
    }
  };

  const handleSaveScannedToLibrary = async () => {
    if (!scanResult || savedToLib) return;
    let thumbnail: string | undefined;
    try {
      thumbnail = await getQRCodeDataUrl(scanResult.raw, DEFAULT_SAVED_STYLE, 256);
    } catch {
      thumbnail = undefined;
    }

    onSaveToLibrary({
      name: scanResult.title,
      type: scanResult.type,
      encodedData: scanResult.raw,
      formValues: scanResult.formValues,
      style: DEFAULT_SAVED_STYLE,
      isFavorite: false,
      thumbnail,
    });
    setSavedToLib(true);
  };

  const handleScanAgain = () => {
    setScanResult(null);
    setUploadedPreviewUrl(null);
    setSavedToLib(false);
    if (sourceMode === 'camera') {
      startCamera(facingMode);
    }
  };

  const typeConfig = scanResult
    ? QR_TYPE_CONFIG.find((c) => c.id === scanResult.type)
    : null;
  const TypeIcon = typeConfig?.icon || ScanLine;

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Hidden canvas for camera frame extraction */}
      <canvas ref={scanCanvasRef} className="hidden" aria-hidden="true" />

      {/* Top Mode Switcher Card */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            QR Scanner & Structured Reader
          </h2>
          <p className="text-xs text-white/60">
            Scan via camera, upload an image, or paste a screenshot (Ctrl/Cmd+V)
          </p>
        </div>

        <div
          className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 shrink-0"
          role="tablist"
          aria-label="Scanner input source"
        >
          <button
            type="button"
            role="tab"
            aria-selected={sourceMode === 'camera'}
            onClick={() => {
              setSourceMode('camera');
              if (!scanResult) startCamera(facingMode);
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
              sourceMode === 'camera'
                ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-md shadow-[#2f6bff]/30'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Camera</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={sourceMode === 'image'}
            onClick={() => {
              setSourceMode('image');
              stopCamera();
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
              sourceMode === 'image'
                ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-md shadow-[#2f6bff]/30'
                : 'text-white/70 hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Upload Image</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Camera Viewfinder OR Image Dropzone */}
        <div className="lg:col-span-6 glass-card rounded-3xl p-4 sm:p-6 space-y-4">
          {sourceMode === 'camera' ? (
            <>
              <div className="relative w-full aspect-square max-h-[380px] mx-auto rounded-2xl overflow-hidden bg-black/70 border border-white/15 flex items-center justify-center">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${
                    facingMode === 'user' ? '-scale-x-100' : ''
                  } ${cameraActive ? 'opacity-100' : 'opacity-0'}`}
                />

                {/* Reticle Overlay when scanning */}
                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    {/* Scrim border */}
                    <div className="relative w-52 h-52 sm:w-60 sm:h-60">
                      {/* 4 Corner Reticle Brackets */}
                      <span className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-[#4da3ff] rounded-tl-xl" />
                      <span className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-[#4da3ff] rounded-tr-xl" />
                      <span className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-[#4da3ff] rounded-bl-xl" />
                      <span className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-[#4da3ff] rounded-br-xl" />

                      {/* Animated Laser Line */}
                      <div className="animate-scan-line absolute left-2 right-2 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#4da3ff] to-transparent shadow-[0_0_12px_#4da3ff]" />
                    </div>
                  </div>
                )}

                {/* Starting spinner */}
                {cameraStarting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm p-6 text-center">
                    <div className="w-9 h-9 rounded-full border-3 border-[#4da3ff]/20 border-t-[#4da3ff] animate-spin" />
                    <span className="text-xs font-medium text-white/80">
                      Initializing camera...
                    </span>
                  </div>
                )}

                {/* Camera paused after scan */}
                {!cameraActive && !cameraStarting && !cameraError && scanResult && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#05060f]/85 backdrop-blur-md p-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#2f6bff]/20 border border-[#2f6bff]/40 flex items-center justify-center text-[#4da3ff]">
                      <Check className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">QR Code Captured</p>
                      <p className="text-xs text-white/60 mt-0.5">
                        Camera paused while reviewing structured output
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleScanAgain}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white text-xs font-semibold shadow-lg shadow-[#2f6bff]/30 active:scale-95 transition-all min-h-[44px]"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Scan Another Code</span>
                    </button>
                  </div>
                )}

                {/* Camera error / permission fallback */}
                {cameraError && !cameraStarting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#05060f]/90 p-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#ff3b4e]/15 border border-[#ff3b4e]/30 flex items-center justify-center text-[#ff6b7a]">
                      <CameraOff className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-white/80 max-w-xs leading-relaxed">
                      {cameraError}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => startCamera(facingMode)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white min-h-[44px]"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Camera</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceMode('image')}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-xs font-semibold text-white min-h-[44px]"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Image</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all min-h-[44px]"
                >
                  <SwitchCamera className="w-4 h-4 text-[#4da3ff]" />
                  <span>{facingMode === 'environment' ? 'Back Camera' : 'Front Camera'}</span>
                </button>

                <div className="flex items-center gap-2">
                  {torchSupported && cameraActive && (
                    <button
                      type="button"
                      onClick={handleToggleTorch}
                      aria-pressed={torchOn}
                      className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all min-h-[44px] ${
                        torchOn
                          ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                      }`}
                    >
                      <Flashlight className="w-4 h-4" />
                      <span>{torchOn ? 'Flash On' : 'Flash'}</span>
                    </button>
                  )}

                  {cameraActive ? (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#ff3b4e]/15 hover:bg-[#ff3b4e]/25 border border-[#ff3b4e]/30 text-xs font-semibold text-[#ff6b7a] min-h-[44px]"
                    >
                      <CameraOff className="w-4 h-4" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    !cameraStarting && (
                      <button
                        type="button"
                        onClick={() => {
                          setScanResult(null);
                          startCamera(facingMode);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#2f6bff]/20 hover:bg-[#2f6bff]/30 border border-[#2f6bff]/40 text-xs font-semibold text-[#4da3ff] min-h-[44px]"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Start Camera</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Image Upload / Drop / Paste Area */
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) decodeImageFile(file);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="hidden"
                id="qr-scan-file-input"
              />

              <label
                htmlFor="qr-scan-file-input"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) decodeImageFile(file);
                }}
                className={`relative flex flex-col items-center justify-center w-full min-h-[280px] sm:min-h-[340px] rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-[#4da3ff] bg-[#2f6bff]/15'
                    : 'border-white/15 hover:border-[#4da3ff]/50 bg-white/5 hover:bg-white/[0.08]'
                }`}
              >
                {uploadedPreviewUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-44 h-44 rounded-2xl bg-white p-2 shadow-xl flex items-center justify-center">
                      <img
                        src={uploadedPreviewUrl}
                        alt="Uploaded QR code preview"
                        className="w-full h-full object-contain rounded-lg"
                      />
                    </div>
                    <span className="text-xs font-semibold text-[#4da3ff]">
                      Tap or drop another image to re-scan
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-[#2f6bff]/15 border border-[#2f6bff]/30 flex items-center justify-center text-[#4da3ff] mb-3">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-white">
                      Upload or Drop QR Code Image
                    </p>
                    <p className="text-xs text-white/60 mt-1 max-w-xs">
                      Supports PNG, JPG, WebP, or SVG. You can also paste an image directly from your clipboard.
                    </p>
                  </>
                )}
              </label>
            </div>
          )}
        </div>

        {/* Right Column: Structured Output Card */}
        <div className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6">
          {scanResult ? (
            <div className="space-y-5">
              {/* Result Header */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#2f6bff] to-[#4da3ff] text-white shadow-lg shadow-[#2f6bff]/25 shrink-0">
                    <TypeIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#4da3ff] font-semibold">
                      <span>{scanResult.typeLabel}</span>
                      <span aria-hidden="true" className="text-white/30">·</span>
                      <span className="text-white/50 font-normal tabular-nums">
                        {new Blob([scanResult.raw]).size} bytes
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white truncate mt-0.5">
                      {scanResult.title}
                    </h3>
                    <p className="text-xs text-white/60 truncate">{scanResult.subtitle}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleScanAgain}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 hover:text-white shrink-0 min-h-[40px]"
                  title="Clear and scan another"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>

              {/* Optional Security Note */}
              {scanResult.securityNote && (
                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                  <span>{scanResult.securityNote}</span>
                </div>
              )}

              {/* Structured Fields Breakdown */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Structured Details
                </h4>
                <div className="divide-y divide-white/10 rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
                  {scanResult.fields.map((field) => {
                    const isHidden = field.sensitive && !revealedFields[field.key];
                    const displayValue = isHidden
                      ? '•'.repeat(Math.min(14, Math.max(6, field.value.length)))
                      : field.value;

                    return (
                      <div
                        key={field.key}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-medium text-white/50 block">
                            {field.label}
                          </span>
                          <span
                            className={`text-sm text-white break-all mt-0.5 block ${
                              field.mono ? 'font-mono tabular-nums' : 'font-medium'
                            }`}
                          >
                            {displayValue}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {field.sensitive && (
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedFields((prev) => ({
                                  ...prev,
                                  [field.key]: !prev[field.key],
                                }))
                              }
                              className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                              aria-label={isHidden ? `Reveal ${field.label}` : `Hide ${field.label}`}
                            >
                              {isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                          )}

                          {field.copyable && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(field.value, field.key, field.label)}
                              className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                              aria-label={`Copy ${field.label}`}
                            >
                              {copiedKey === field.key ? (
                                <Check className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Contextual Smart Actions */}
              {scanResult.actions.length > 0 && (
                <div className="flex flex-wrap gap-2.5">
                  {scanResult.actions.map((action) => {
                    const baseCls = action.primary
                      ? 'flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] hover:shadow-[0_0_24px_rgba(47,107,255,0.45)] text-white font-semibold text-sm transition-all active:scale-95 min-h-[46px]'
                      : 'flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm transition-all active:scale-95 min-h-[46px]';

                    if ((action.kind === 'link' || action.kind === 'maps') && action.href) {
                      return (
                        <a
                          key={action.id}
                          href={action.href}
                          target={action.href.startsWith('http') ? '_blank' : undefined}
                          rel={action.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className={baseCls}
                        >
                          {action.kind === 'maps' ? (
                            <MapPin className="w-4 h-4 shrink-0" />
                          ) : (
                            <ExternalLink className="w-4 h-4 shrink-0" />
                          )}
                          <span>{action.label}</span>
                        </a>
                      );
                    }

                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => handleActionClick(action)}
                        className={baseCls}
                      >
                        {action.kind === 'download-vcf' || action.kind === 'download-ics' ? (
                          <Download className="w-4 h-4 shrink-0" />
                        ) : copiedKey === action.id ? (
                          <Check className="w-4 h-4 shrink-0 text-emerald-300" />
                        ) : (
                          <Copy className="w-4 h-4 shrink-0" />
                        )}
                        <span>{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* QRForge Actions: Save to Library & Open in Generator */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleSaveScannedToLibrary}
                  disabled={savedToLib}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-semibold transition-all active:scale-95 min-h-[44px] ${
                    savedToLib
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-[#2f6bff]/15 hover:bg-[#2f6bff]/25 text-[#4da3ff] border-[#2f6bff]/35'
                  }`}
                >
                  {savedToLib ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <BookmarkPlus className="w-4 h-4" />
                  )}
                  <span>{savedToLib ? 'Saved to Library' : 'Save to Library'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onLoadInCreator(scanResult)}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/85 hover:text-white text-xs font-semibold transition-all active:scale-95 min-h-[44px]"
                >
                  <Sparkles className="w-4 h-4 text-[#4da3ff]" />
                  <span>Edit &amp; Customize QR</span>
                </button>
              </div>

              {/* Raw / JSON Payload Accordion */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowRawPayload(!showRawPayload)}
                  className="w-full flex items-center justify-between py-2 text-xs font-semibold text-white/60 hover:text-white transition-colors min-h-[40px]"
                >
                  <span className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-[#4da3ff]" />
                    <span>{scanResult.jsonPretty ? 'Formatted JSON & Raw Payload' : 'Raw Decoded Payload'}</span>
                  </span>
                  {showRawPayload ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showRawPayload && (
                  <div className="mt-2 relative rounded-2xl bg-black/50 border border-white/10 p-3.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(scanResult.jsonPretty || scanResult.raw, 'raw-payload', 'Raw payload')
                      }
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white"
                      aria-label="Copy raw payload"
                    >
                      {copiedKey === 'raw-payload' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <pre className="text-xs font-mono text-white/80 whitespace-pre-wrap break-all pr-8 max-h-56 overflow-y-auto">
                      {scanResult.jsonPretty || scanResult.raw}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Waiting / Ready State */
            <div className="flex flex-col items-center justify-center text-center py-8 px-4 min-h-[300px]">
              <div className="w-14 h-14 rounded-3xl bg-[#2f6bff]/15 border border-[#2f6bff]/30 flex items-center justify-center text-[#4da3ff] mb-4">
                <ScanLine className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white mb-1.5">
                Ready for Structured Output
              </h3>
              <p className="text-xs text-white/60 max-w-sm leading-relaxed mb-5">
                Point your camera at any QR code or upload an image. QRForge automatically detects the format and extracts clean, actionable fields.
              </p>

              <div className="w-full max-w-sm text-left space-y-2 p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-white/70">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">WiFi Credentials</span>
                  <span className="text-white/50">SSID · Encryption · Password</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Contacts (vCard / MECARD)</span>
                  <span className="text-white/50">1-Tap .vcf Export</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Calendar Events</span>
                  <span className="text-white/50">1-Tap .ics Invite</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">URLs · Geo · Crypto · JSON</span>
                  <span className="text-white/50">Parsed Fields &amp; Actions</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
