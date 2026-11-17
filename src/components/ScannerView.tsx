import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileStack,
  Flashlight,
  Image as ImageIcon,
  Layers,
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
  ClipboardList,
  Volume2,
  VolumeX,
  AlertTriangle,
  XCircle,
  Play,
  Square,
  Repeat,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import {
  BatchItemResult,
  ExamSession,
  ParsedQRAction,
  ParsedQRResult,
  QRStyleSettings,
  SavedQRItem,
  VerificationStatus,
} from '../types/qr';
import { decodeStructuredQR } from '../utils/decoders';
import { QR_TYPE_CONFIG } from './TypeSelector';
import { downloadBlob, getQRCodeDataUrl } from '../utils/qrRenderer';
import { useToast } from '../context/ToastContext';
import { decodeAny, decodeImageFile } from '../lib/decode';
import {
  decodeBatchEntry,
  isPdfFile,
  processBatchFiles,
  renderPdfPageAt300Dpi,
} from '../lib/pdfBatch';
import {
  deleteSession as dbDeleteSession,
  getActiveSessionId,
  listSessions,
  playVerificationFeedback,
  saveSession as dbSaveSession,
  setActiveSessionId as dbSetActiveSessionId,
  verifyPayloadAgainstSession,
} from '../lib/sessionsDb';
import { SessionsView } from './SessionsView';

interface ScannerViewProps {
  onLoadInCreator: (result: ParsedQRResult) => void;
  onSaveToLibrary: (item: Omit<SavedQRItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

type ScannerSubView = 'scan' | 'batch' | 'sessions';
type ScanSourceMode = 'camera' | 'image';

interface LastVerificationBanner {
  status: VerificationStatus;
  candidateName?: string;
  regNumber?: string;
  firstScannedAt?: number;
  scanCount?: number;
  decodeMethod?: string;
}

const DEFAULT_SAVED_STYLE: QRStyleSettings = {
  fgColor: '#000000',
  bgColor: '#ffffff',
  size: 512,
  errorCorrectionLevel: 'M',
  margin: 2,
  logo: null,
};

const CAMERA_FRAME_INTERVAL_MS = 166; // ~6 fps cap
const CONTINUOUS_COOLDOWN_MS = 1800; // cooldown before re-triggering identical payload in continuous camera mode

export const ScannerView: React.FC<ScannerViewProps> = ({
  onLoadInCreator,
  onSaveToLibrary,
}) => {
  const [subView, setSubView] = useState<ScannerSubView>('scan');
  const [sourceMode, setSourceMode] = useState<ScanSourceMode>('camera');

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [continuousScan, setContinuousScan] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(true);

  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scanResult, setScanResult] = useState<ParsedQRResult | null>(null);
  const [lastVerification, setLastVerification] = useState<LastVerificationBanner | null>(null);
  const [lastDecodeMeta, setLastDecodeMeta] = useState<{ method: string; ms: number } | null>(null);
  const [revealedFields, setRevealedFields] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [savedToLib, setSavedToLib] = useState(false);

  // IndexedDB Exam Sessions State
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Batch Import State
  const [batchItems, setBatchItems] = useState<BatchItemResult[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchElapsedMs, setBatchElapsedMs] = useState(0);
  const [batchDragging, setBatchDragging] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Record<string, boolean>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const isDecodingFrameRef = useRef<boolean>(false);
  const lastCameraPayloadRef = useRef<{ data: string; at: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const batchAbortRef = useRef<AbortController | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  // Mutable refs for async loops (camera & batch) so rapid scans never read stale closure state
  const activeSessionRef = useRef<ExamSession | null>(null);
  const continuousScanRef = useRef<boolean>(continuousScan);
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  const { showToast } = useToast();

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    continuousScanRef.current = continuousScan;
  }, [continuousScan]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Load Exam Sessions + Active Session ID from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [loaded, savedActiveId] = await Promise.all([
          listSessions(),
          getActiveSessionId(),
        ]);
        if (!mounted) return;
        setSessions(loaded);
        if (savedActiveId && loaded.some((s) => s.id === savedActiveId)) {
          setActiveSessionId(savedActiveId);
        }
      } catch (err) {
        console.warn('IndexedDB sessions load failed:', err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Revoke any single-image blob preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  const handleSelectActiveSession = useCallback(async (id: string | null) => {
    setActiveSessionId(id);
    try {
      await dbSetActiveSessionId(id);
    } catch {
      // Ignore meta storage error
    }
  }, []);

  const handleCreateSession = useCallback(async (session: ExamSession) => {
    await dbSaveSession(session);
    setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
  }, []);

  const handleUpdateSession = useCallback(async (session: ExamSession) => {
    await dbSaveSession(session);
    setSessions((prev) =>
      prev.map((s) => (s.id === session.id ? session : s))
    );
  }, []);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await dbDeleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSessionId === id) {
        await handleSelectActiveSession(null);
      }
    },
    [activeSessionId, handleSelectActiveSession]
  );

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
    isDecodingFrameRef.current = false;
    setCameraActive(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  // Process a successfully decoded string (supports both regular QR reading and active Session verification)
  const handleDecodedPayload = useCallback(
    async (
      rawString: string,
      source: 'camera' | 'image' | 'batch',
      meta?: { method?: string; durationMs?: number; sourceFile?: string }
    ) => {
      const parsed = decodeStructuredQR(rawString);
      setScanResult(parsed);
      setRevealedFields({});
      setSavedToLib(false);
      setShowRawPayload(false);
      if (meta?.method) {
        setLastDecodeMeta({ method: meta.method, ms: meta.durationMs || 0 });
      } else {
        setLastDecodeMeta(null);
      }

      const currentSession = activeSessionRef.current;
      if (currentSession) {
        const res = verifyPayloadAgainstSession(
          currentSession,
          rawString,
          source,
          meta?.sourceFile
        );
        activeSessionRef.current = res.updatedSession;
        setSessions((prev) =>
          prev.map((s) => (s.id === res.updatedSession.id ? res.updatedSession : s))
        );
        dbSaveSession(res.updatedSession).catch((err) =>
          console.warn('Failed to persist verification:', err)
        );

        setLastVerification({
          status: res.status,
          candidateName: res.candidate?.name,
          regNumber: res.candidate?.regNumber,
          firstScannedAt: res.firstScannedAt,
          scanCount: res.scanCount,
          decodeMethod: meta?.method,
        });

        playVerificationFeedback(res.status, soundEnabledRef.current);

        if (res.status === 'verified') {
          showToast(`Verified: ${res.candidate?.name}`, 'success');
        } else if (res.status === 'already_scanned') {
          showToast(`Already scanned: ${res.candidate?.name}`, 'info');
        } else {
          showToast('Not on session roster', 'error');
        }
      } else {
        setLastVerification(null);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(50);
          } catch {
            // Ignore
          }
        }
        showToast(`Detected ${parsed.typeLabel}`, 'success');
      }
    },
    [showToast]
  );

  // Camera frame scanning loop (~6 fps; fast plan normally, thorough plan every 4th frame)
  const startScanLoop = useCallback(() => {
    frameCountRef.current = 0;

    const tick = (now: number) => {
      const video = videoRef.current;
      if (!video || !streamRef.current) return;

      if (
        video.readyState >= video.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0 &&
        !isDecodingFrameRef.current &&
        now - lastScanTimeRef.current >= CAMERA_FRAME_INTERVAL_MS
      ) {
        lastScanTimeRef.current = now;
        frameCountRef.current += 1;
        const isThoroughFrame = frameCountRef.current % 4 === 0;
        isDecodingFrameRef.current = true;

        decodeAny(video, isThoroughFrame)
          .then(async (hit) => {
            if (!hit || !hit.data || !streamRef.current) return;

            const hasActiveSession = Boolean(activeSessionRef.current);
            const keepScanning = hasActiveSession && continuousScanRef.current;

            if (keepScanning) {
              const prev = lastCameraPayloadRef.current;
              const nowMs = Date.now();
              if (prev && prev.data === hit.data && nowMs - prev.at < CONTINUOUS_COOLDOWN_MS) {
                return;
              }
              lastCameraPayloadRef.current = { data: hit.data, at: nowMs };
              await handleDecodedPayload(hit.data, 'camera', {
                method: hit.method,
                durationMs: hit.durationMs,
              });
            } else {
              stopCamera();
              await handleDecodedPayload(hit.data, 'camera', {
                method: hit.method,
                durationMs: hit.durationMs,
              });
            }
          })
          .catch(() => {
            // Ignore per-frame decode errors
          })
          .finally(() => {
            isDecodingFrameRef.current = false;
          });
      }

      if (streamRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
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
        setCameraError(
          'Camera access is not supported in this browser or context. Try uploading an image instead.'
        );
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

  // Manage camera lifecycle based on subView & sourceMode
  useEffect(() => {
    const shouldRun =
      subView === 'scan' &&
      sourceMode === 'camera' &&
      (!scanResult || (Boolean(activeSessionRef.current) && continuousScan));

    if (shouldRun) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [subView, sourceMode, facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      batchAbortRef.current?.abort();
    };
  }, [stopCamera]);

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

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Decode a single uploaded image or PDF page
  const handleSingleFileDecode = useCallback(
    async (file: File | Blob) => {
      const isPdf = file instanceof File && isPdfFile(file);
      const isImg = file.type.startsWith('image/');

      if (!isImg && !isPdf) {
        showToast('Please select a valid image (PNG, JPG, WebP, SVG) or PDF file', 'error');
        return;
      }

      try {
        if (isPdf && file instanceof File) {
          const canvas = await renderPdfPageAt300Dpi(file, 1);
          const dataUrl = canvas.toDataURL('image/png');
          setUploadedPreviewUrl(dataUrl);
          const hit = await decodeAny(canvas, true);
          if (hit && hit.data) {
            await handleDecodedPayload(hit.data, 'image', {
              method: `${hit.method} · 300 DPI PDF`,
              durationMs: hit.durationMs,
              sourceFile: file.name,
            });
          } else {
            showToast('No QR code detected on page 1 of PDF.', 'error');
          }
          return;
        }

        const { hit, previewUrl } = await decodeImageFile(file, true);
        if (previewObjectUrlRef.current) {
          URL.revokeObjectURL(previewObjectUrlRef.current);
        }
        previewObjectUrlRef.current = previewUrl;
        setUploadedPreviewUrl(previewUrl);

        if (hit && hit.data) {
          await handleDecodedPayload(hit.data, 'image', {
            method: hit.method,
            durationMs: hit.durationMs,
            sourceFile: file instanceof File ? file.name : 'pasted-image',
          });
        } else {
          showToast('No QR code detected in that image. Try cropping closer or checking contrast.', 'error');
        }
      } catch (err: any) {
        showToast(err?.message || 'Could not decode file', 'error');
      }
    },
    [handleDecodedPayload, showToast]
  );

  // Global clipboard paste listener while in Scanner sub-view
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (subView !== 'scan') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            setSourceMode('image');
            stopCamera();
            handleSingleFileDecode(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [subView, handleSingleFileDecode, stopCamera]);

  // --- Batch Import Handlers ---
  const handleStartBatch = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(
        (f) => f.type.startsWith('image/') || isPdfFile(f)
      );
      if (files.length === 0) {
        showToast('Select at least one image or PDF file', 'error');
        return;
      }

      batchAbortRef.current?.abort();
      const controller = new AbortController();
      batchAbortRef.current = controller;

      setBatchRunning(true);
      setBatchElapsedMs(0);
      const startedAt = performance.now();

      const timer = window.setInterval(() => {
        setBatchElapsedMs(Math.round(performance.now() - startedAt));
      }, 200);

      try {
        await processBatchFiles(
          files,
          {
            onItemsInitialized: (items) => {
              setBatchItems(items);
            },
            onItemUpdate: (id, patch) => {
              setBatchItems((prev) =>
                prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
              );
            },
            onDecodedItem: async (entry, rawPayload) => {
              const sess = activeSessionRef.current;
              if (!sess) return;
              const res = verifyPayloadAgainstSession(
                sess,
                rawPayload,
                'batch',
                entry.fileName
              );
              activeSessionRef.current = res.updatedSession;
              setSessions((prev) =>
                prev.map((s) => (s.id === res.updatedSession.id ? res.updatedSession : s))
              );
              await dbSaveSession(res.updatedSession);
              return {
                verificationStatus: res.status,
                candidateName: res.candidate?.name,
                regNumber: res.candidate?.regNumber,
              };
            },
          },
          controller.signal
        );

        setBatchElapsedMs(Math.round(performance.now() - startedAt));
      } finally {
        window.clearInterval(timer);
        setBatchRunning(false);
        if (batchAbortRef.current === controller) {
          batchAbortRef.current = null;
        }
      }
    },
    [showToast]
  );

  const handleRetryBatchItem = useCallback(
    async (item: BatchItemResult) => {
      setRetryingIds((prev) => ({ ...prev, [item.id]: true }));
      setBatchItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: 'processing', error: undefined } : it
        )
      );

      try {
        const hit = await decodeBatchEntry(item.file, item.pageNumber);
        if (hit && hit.data) {
          let extra: Partial<BatchItemResult> = {};
          const sess = activeSessionRef.current;
          if (sess) {
            const res = verifyPayloadAgainstSession(
              sess,
              hit.data,
              'batch',
              item.fileName
            );
            activeSessionRef.current = res.updatedSession;
            setSessions((prev) =>
              prev.map((s) => (s.id === res.updatedSession.id ? res.updatedSession : s))
            );
            await dbSaveSession(res.updatedSession);
            extra = {
              verificationStatus: res.status,
              candidateName: res.candidate?.name,
              regNumber: res.candidate?.regNumber,
            };
          }

          setBatchItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    status: 'decoded',
                    rawPayload: hit.data,
                    decodeMethod: hit.method,
                    ...extra,
                  }
                : it
            )
          );
          showToast(`Decoded ${item.fileName}`, 'success');
        } else {
          setBatchItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'failed', error: 'No readable QR code found' }
                : it
            )
          );
          showToast(`Still no QR found in ${item.fileName}`, 'error');
        }
      } catch (err: any) {
        setBatchItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: 'failed', error: err?.message || 'Retry failed' }
              : it
          )
        );
      } finally {
        setRetryingIds((prev) => ({ ...prev, [item.id]: false }));
      }
    },
    [showToast]
  );

  const handleRetryAllFailed = useCallback(async () => {
    const failed = batchItems.filter((i) => i.status === 'failed');
    for (const item of failed) {
      await handleRetryBatchItem(item);
    }
  }, [batchItems, handleRetryBatchItem]);

  const batchSummary = useMemo(() => {
    const total = batchItems.length;
    const decoded = batchItems.filter((i) => i.status === 'decoded').length;
    const failed = batchItems.filter((i) => i.status === 'failed').length;
    const processed = decoded + failed;
    const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
    return { total, decoded, failed, processed, pct };
  }, [batchItems]);

  // Helper actions for structured output
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
    } else if (
      (action.kind === 'download-vcf' || action.kind === 'download-ics') &&
      action.fileContent
    ) {
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
    setLastVerification(null);
    setLastDecodeMeta(null);
    setUploadedPreviewUrl(null);
    setSavedToLib(false);
    lastCameraPayloadRef.current = null;
    if (sourceMode === 'camera') {
      setIsFullscreen(true);
      startCamera(facingMode);
    }
  };

  const typeConfig = scanResult
    ? QR_TYPE_CONFIG.find((c) => c.id === scanResult.type)
    : null;
  const TypeIcon = typeConfig?.icon || ScanLine;

  const activeVerifiedCount = activeSession
    ? Object.keys(activeSession.verifiedByReg).length
    : 0;

  const isViewfinderFullscreen =
    isFullscreen &&
    subView === 'scan' &&
    sourceMode === 'camera' &&
    (cameraActive || cameraStarting);

  // Lock body scroll and allow Escape key to exit fullscreen scanner
  useEffect(() => {
    if (!isViewfinderFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isViewfinderFullscreen]);

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Top Sub-View Bar (Scanner | Batch Import | Sessions) */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              QR Scanner &amp; Exam Badge Verification
            </h2>
            <p className="text-xs text-white/60">
              Multi-pass decoder for framed badges, 300 DPI PDFs, and offline roster verification
            </p>
          </div>

          <div
            className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10 shrink-0"
            role="tablist"
            aria-label="Scanner workspace view"
          >
            <button
              type="button"
              role="tab"
              aria-selected={subView === 'scan'}
              onClick={() => setSubView('scan')}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
                subView === 'scan'
                  ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-md shadow-[#2f6bff]/30'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <ScanLine className="w-4 h-4" />
              <span>Scanner</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={subView === 'batch'}
              onClick={() => {
                setSubView('batch');
                stopCamera();
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
                subView === 'batch'
                  ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-md shadow-[#2f6bff]/30'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Batch</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={subView === 'sessions'}
              onClick={() => {
                setSubView('sessions');
                stopCamera();
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
                subView === 'sessions'
                  ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-md shadow-[#2f6bff]/30'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Sessions</span>
            </button>
          </div>
        </div>

        {/* Active Session Status Bar (visible on Scanner & Batch views) */}
        {subView !== 'sessions' && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-white/10">
            {activeSession ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {activeSession.name}{' '}
                    <span className="font-normal text-white/50">· {activeSession.paperUnit}</span>
                  </p>
                  <p className="text-[11px] text-emerald-300 font-semibold tabular-nums">
                    {activeVerifiedCount} / {activeSession.roster.length} verified
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-white/55">
                <ClipboardList className="w-4 h-4 text-[#4da3ff] shrink-0" />
                <span>No exam session active — standard QR decode mode</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {activeSession && subView === 'scan' && sourceMode === 'camera' && (
                <button
                  type="button"
                  onClick={() => setContinuousScan((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all min-h-[38px] ${
                    continuousScan
                      ? 'bg-[#2f6bff]/20 border-[#2f6bff]/45 text-[#4da3ff]'
                      : 'bg-white/5 border-white/10 text-white/65'
                  }`}
                  title="Keep camera running between candidate badges"
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>{continuousScan ? 'Continuous' : 'Single'}</span>
                </button>
              )}

              {activeSession && (
                <button
                  type="button"
                  onClick={() => setSoundEnabled((v) => !v)}
                  className={`p-2 rounded-xl border text-xs transition-all min-h-[38px] min-w-[38px] flex items-center justify-center ${
                    soundEnabled
                      ? 'bg-white/10 border-white/15 text-white'
                      : 'bg-white/5 border-white/10 text-white/45'
                  }`}
                  aria-label={soundEnabled ? 'Mute verification audio' : 'Unmute verification audio'}
                  title={soundEnabled ? 'Verification audio on' : 'Verification audio muted'}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setSubView('sessions');
                  stopCamera();
                }}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 hover:text-white min-h-[38px]"
              >
                {activeSession ? 'View Roster' : 'Load Session'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* === SUB-VIEW 1: LIVE CAMERA & SINGLE IMAGE/PDF SCAN === */}
      {subView === 'scan' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Camera Viewfinder OR Single Image/PDF Dropzone
              Drop .glass-card when fullscreen so backdrop-filter does not trap fixed positioning */}
          <div
            className={
              isViewfinderFullscreen
                ? 'lg:col-span-6'
                : 'lg:col-span-6 glass-card rounded-3xl p-4 sm:p-6 space-y-4'
            }
          >
            {!isViewfinderFullscreen && (
              <div
                className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-white/5 border border-white/10"
                role="tablist"
                aria-label="Scanner input source"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceMode === 'camera'}
                  onClick={() => {
                    setSourceMode('camera');
                    setIsFullscreen(true);
                    if (!scanResult || (activeSession && continuousScan)) {
                      startCamera(facingMode);
                    }
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
                    setIsFullscreen(false);
                    stopCamera();
                  }}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all min-h-[44px] ${
                    sourceMode === 'image'
                      ? 'bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white shadow-md shadow-[#2f6bff]/30'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Upload Image / PDF</span>
                </button>
              </div>
            )}

            {sourceMode === 'camera' ? (
              <>
                <div
                  className={
                    isViewfinderFullscreen
                      ? 'fixed inset-0 z-[70] bg-black flex flex-col justify-between overflow-hidden'
                      : 'relative w-full h-[56dvh] min-h-[360px] max-h-[640px] mx-auto rounded-2xl overflow-hidden bg-black/75 border border-white/15 flex items-center justify-center'
                  }
                >
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${
                      isViewfinderFullscreen ? 'absolute inset-0' : ''
                    } ${facingMode === 'user' ? '-scale-x-100' : ''} ${
                      cameraActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />

                  {/* Subtle Vignette + Reticle Overlay when scanning */}
                  {cameraActive && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div
                        className={`relative rounded-2xl ${
                          isViewfinderFullscreen
                            ? 'w-64 h-64 sm:w-80 sm:h-80 shadow-[0_0_0_9999px_rgba(5,6,15,0.45)]'
                            : 'w-56 h-56 sm:w-64 sm:h-64 shadow-[0_0_0_9999px_rgba(5,6,15,0.3)]'
                        }`}
                      >
                        <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#4da3ff] rounded-tl-xl" />
                        <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#4da3ff] rounded-tr-xl" />
                        <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#4da3ff] rounded-bl-xl" />
                        <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#4da3ff] rounded-br-xl" />
                        <div className="animate-scan-line absolute left-2 right-2 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#4da3ff] to-transparent shadow-[0_0_12px_#4da3ff]" />
                      </div>
                    </div>
                  )}

                  {/* Inline top-right Fullscreen expand trigger */}
                  {!isViewfinderFullscreen && cameraActive && (
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(true)}
                      className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-xs font-semibold text-white min-h-[44px]"
                      aria-label="Expand scanner to full screen"
                    >
                      <Maximize2 className="w-4 h-4 text-[#4da3ff]" />
                      <span>Full Screen</span>
                    </button>
                  )}

                  {/* Fullscreen Top HUD */}
                  {isViewfinderFullscreen && (
                    <div className="relative z-10 flex items-center justify-between gap-2 px-4 pt-safe pb-4 bg-gradient-to-b from-black/85 via-black/45 to-transparent">
                      <button
                        type="button"
                        onClick={() => setIsFullscreen(false)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 text-xs font-semibold text-white min-h-[44px]"
                        aria-label="Exit full screen scanner"
                      >
                        <Minimize2 className="w-4 h-4 text-[#4da3ff]" />
                        <span>Exit</span>
                      </button>

                      <div className="min-w-0 text-center px-2">
                        {activeSession ? (
                          <>
                            <p className="text-xs font-bold text-white truncate">
                              {activeSession.name}
                            </p>
                            <p className="text-[11px] font-semibold text-emerald-300 tabular-nums">
                              {activeVerifiedCount} / {activeSession.roster.length} verified
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-white">QRForge Scanner</p>
                            <p className="text-[11px] text-white/70">Aim QR code inside frame</p>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {torchSupported && cameraActive && (
                          <button
                            type="button"
                            onClick={handleToggleTorch}
                            aria-pressed={torchOn}
                            className={`p-2.5 rounded-xl backdrop-blur-md border min-h-[44px] min-w-[44px] flex items-center justify-center ${
                              torchOn
                                ? 'bg-amber-500/30 border-amber-400/60 text-amber-300'
                                : 'bg-black/55 border-white/15 text-white'
                            }`}
                            aria-label={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                          >
                            <Flashlight className="w-4 h-4" />
                          </button>
                        )}

                        {activeSession && (
                          <button
                            type="button"
                            onClick={() => setSoundEnabled((v) => !v)}
                            className="p-2.5 rounded-xl bg-black/55 backdrop-blur-md border border-white/15 text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                            aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
                          >
                            {soundEnabled ? (
                              <Volume2 className="w-4 h-4" />
                            ) : (
                              <VolumeX className="w-4 h-4 text-white/50" />
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleSwitchCamera}
                          className="p-2.5 rounded-xl bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label="Switch front or back camera"
                        >
                          <SwitchCamera className="w-4 h-4 text-[#4da3ff]" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Fullscreen Bottom HUD: Live Verification Card + Quick Navigation */}
                  {isViewfinderFullscreen && (
                    <div className="relative z-10 px-4 pb-safe pt-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent space-y-3 mt-auto">
                      {lastVerification && (
                        <div
                          className={`max-w-lg mx-auto p-3.5 rounded-2xl backdrop-blur-xl border flex items-start gap-3 shadow-2xl ${
                            lastVerification.status === 'verified'
                              ? 'bg-emerald-950/85 border-emerald-400/50 text-emerald-100'
                              : lastVerification.status === 'already_scanned'
                              ? 'bg-amber-950/85 border-amber-400/50 text-amber-100'
                              : 'bg-rose-950/85 border-[#ff3b4e]/60 text-rose-100'
                          }`}
                        >
                          {lastVerification.status === 'verified' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : lastVerification.status === 'already_scanned' ? (
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-5 h-5 text-[#ff6b7a] shrink-0 mt-0.5" />
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold uppercase tracking-wider opacity-85">
                              {lastVerification.status === 'verified'
                                ? 'Verified Candidate'
                                : lastVerification.status === 'already_scanned'
                                ? 'Already Scanned'
                                : 'Not on Roster'}
                            </p>
                            <p className="text-sm font-bold text-white truncate">
                              {lastVerification.candidateName || 'Unrecognized Payload'}
                            </p>
                            {lastVerification.regNumber && (
                              <p className="text-xs font-mono opacity-80 truncate">
                                {lastVerification.regNumber}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setIsFullscreen(false)}
                              className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold text-white min-h-[36px]"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => setLastVerification(null)}
                              className="p-1.5 rounded-lg text-white/70 hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center"
                              aria-label="Dismiss banner"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="max-w-lg mx-auto flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsFullscreen(false);
                            setSourceMode('image');
                            stopCamera();
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/20 backdrop-blur-md border border-white/15 text-xs font-semibold text-white min-h-[44px]"
                        >
                          <Upload className="w-4 h-4 text-[#4da3ff]" />
                          <span>Upload</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsFullscreen(false);
                            setSubView('batch');
                            stopCamera();
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/20 backdrop-blur-md border border-white/15 text-xs font-semibold text-white min-h-[44px]"
                        >
                          <Layers className="w-4 h-4 text-[#4da3ff]" />
                          <span>Batch</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsFullscreen(false);
                            setSubView('sessions');
                            stopCamera();
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/20 backdrop-blur-md border border-white/15 text-xs font-semibold text-white min-h-[44px]"
                        >
                          <ClipboardList className="w-4 h-4 text-[#4da3ff]" />
                          <span>Sessions</span>
                        </button>

                        {activeSession && (
                          <button
                            type="button"
                            onClick={() => setContinuousScan((v) => !v)}
                            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl backdrop-blur-md border text-xs font-semibold min-h-[44px] ${
                              continuousScan
                                ? 'bg-[#2f6bff]/35 border-[#4da3ff]/60 text-white'
                                : 'bg-white/15 border-white/15 text-white/75'
                            }`}
                          >
                            <Repeat className="w-4 h-4" />
                            <span>{continuousScan ? 'Continuous' : 'Single'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            stopCamera();
                            setIsFullscreen(false);
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#ff3b4e]/25 hover:bg-[#ff3b4e]/40 backdrop-blur-md border border-[#ff3b4e]/45 text-xs font-semibold text-[#ffb3bb] min-h-[44px]"
                        >
                          <CameraOff className="w-4 h-4" />
                          <span>Stop</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {cameraStarting && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm p-6 text-center">
                      <div className="w-9 h-9 rounded-full border-3 border-[#4da3ff]/20 border-t-[#4da3ff] animate-spin" />
                      <span className="text-xs font-medium text-white/85">
                        Initializing camera...
                      </span>
                    </div>
                  )}

                  {!cameraActive && !cameraStarting && !cameraError && scanResult && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#05060f]/85 backdrop-blur-md p-6 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-[#2f6bff]/20 border border-[#2f6bff]/40 flex items-center justify-center text-[#4da3ff]">
                        <Check className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">QR Code Captured</p>
                        <p className="text-xs text-white/60 mt-0.5">
                          Camera paused while reviewing output
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

                {/* Inline Camera Controls */}
                {!isViewfinderFullscreen && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
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
                              setIsFullscreen(true);
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
                )}
              </>
            ) : (
              /* Single Image / PDF Upload / Drop / Paste Area */
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 1) {
                      setSubView('batch');
                      handleStartBatch(files);
                    } else if (files?.[0]) {
                      handleSingleFileDecode(files[0]);
                    }
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
                    const files = e.dataTransfer.files;
                    if (files && files.length > 1) {
                      setSubView('batch');
                      handleStartBatch(files);
                    } else if (files?.[0]) {
                      handleSingleFileDecode(files[0]);
                    }
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
                        Tap or drop another badge image / PDF to re-scan
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-[#2f6bff]/15 border border-[#2f6bff]/30 flex items-center justify-center text-[#4da3ff] mb-3">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-white">
                        Upload or Drop Badge Image or PDF
                      </p>
                      <p className="text-xs text-white/60 mt-1 max-w-xs">
                        Supports framed CDACC badges (PNG, JPG, WebP, SVG), 300 DPI PDFs, or Ctrl/Cmd+V paste.
                      </p>
                    </>
                  )}
                </label>
              </div>
            )}
          </div>

          {/* Right Column: Verification Banner + Structured Output Card */}
          <div className="lg:col-span-6 glass-card rounded-3xl p-5 sm:p-6 space-y-5">
            {/* Session Verification Result Banner */}
            {lastVerification && (
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  lastVerification.status === 'verified'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                    : lastVerification.status === 'already_scanned'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                    : 'bg-[#ff3b4e]/15 border-[#ff3b4e]/45 text-[#ffb3bb]'
                }`}
              >
                {lastVerification.status === 'verified' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                ) : lastVerification.status === 'already_scanned' ? (
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-6 h-6 text-[#ff6b7a] shrink-0 mt-0.5" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {lastVerification.status === 'verified'
                        ? 'Verified Candidate'
                        : lastVerification.status === 'already_scanned'
                        ? 'Already Scanned'
                        : 'Not on Roster'}
                    </span>
                    {lastVerification.scanCount && lastVerification.scanCount > 1 && (
                      <span className="text-xs font-mono font-bold tabular-nums">
                        Scan #{lastVerification.scanCount}
                      </span>
                    )}
                  </div>

                  {lastVerification.candidateName ? (
                    <>
                      <p className="text-base font-bold text-white mt-0.5 truncate">
                        {lastVerification.candidateName}
                      </p>
                      <p className="text-xs font-mono opacity-85 truncate">
                        {lastVerification.regNumber}
                        {lastVerification.status === 'already_scanned' &&
                          lastVerification.firstScannedAt &&
                          ` · First scanned ${new Date(lastVerification.firstScannedAt).toLocaleTimeString()}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs mt-1 text-white/80">
                      Decoded payload did not match any registration number in the active roster.
                    </p>
                  )}
                </div>
              </div>
            )}

            {scanResult ? (
              <div className="space-y-5">
                {/* Result Header */}
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#2f6bff] to-[#4da3ff] text-white shadow-lg shadow-[#2f6bff]/25 shrink-0">
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#4da3ff] font-semibold">
                        <span>{scanResult.typeLabel}</span>
                        <span aria-hidden="true" className="text-white/30">·</span>
                        <span className="text-white/50 font-normal tabular-nums">
                          {new Blob([scanResult.raw]).size} bytes
                        </span>
                        {lastDecodeMeta && (
                          <>
                            <span aria-hidden="true" className="text-white/30">·</span>
                            <span className="text-white/50 font-normal">
                              {lastDecodeMeta.method} ({lastDecodeMeta.ms}ms)
                            </span>
                          </>
                        )}
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

                {scanResult.securityNote && (
                  <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                    <span>{scanResult.securityNote}</span>
                  </div>
                )}

                {/* Structured Fields */}
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

                {/* QRForge Library & Editor Actions */}
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

                {/* Raw Payload Accordion */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRawPayload(!showRawPayload)}
                    className="w-full flex items-center justify-between py-2 text-xs font-semibold text-white/60 hover:text-white transition-colors min-h-[40px]"
                  >
                    <span className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-[#4da3ff]" />
                      <span>
                        {scanResult.jsonPretty ? 'Formatted JSON & Raw Payload' : 'Raw Decoded Payload'}
                      </span>
                    </span>
                    {showRawPayload ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>

                  {showRawPayload && (
                    <div className="mt-2 relative rounded-2xl bg-black/50 border border-white/10 p-3.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyText(
                            scanResult.jsonPretty || scanResult.raw,
                            'raw-payload',
                            'Raw payload'
                          )
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
              /* Waiting State */
              <div className="flex flex-col items-center justify-center text-center py-8 px-4 min-h-[300px]">
                <div className="w-14 h-14 rounded-3xl bg-[#2f6bff]/15 border border-[#2f6bff]/30 flex items-center justify-center text-[#4da3ff] mb-4">
                  <ScanLine className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-white mb-1.5">
                  {activeSession ? 'Ready to Verify Badges' : 'Ready for Structured Output'}
                </h3>
                <p className="text-xs text-white/60 max-w-sm leading-relaxed mb-5">
                  {activeSession
                    ? `Point your camera at a candidate badge or upload an image/PDF to verify against "${activeSession.name}".`
                    : 'Point your camera at any QR code or upload a badge image/PDF. Software quiet-zone padding handles framed CDACC badges automatically.'}
                </p>

                <div className="w-full max-w-sm text-left space-y-2 p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-white/70">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">CDACC / Framed Badges</span>
                    <span className="text-white/50">Crop · 12%/20% White Pad</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">Camera Loop</span>
                    <span className="text-white/50">~6 fps · Thorough every 4th</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">Batch &amp; PDFs</span>
                    <span className="text-white/50">300 DPI · IndexedDB Roster</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === SUB-VIEW 2: BATCH IMPORT (MULTI-IMAGE & 300 DPI PDF) === */}
      {subView === 'batch' && (
        <div className="space-y-6">
          <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
            <input
              ref={batchInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleStartBatch(e.target.files);
                }
                if (batchInputRef.current) batchInputRef.current.value = '';
              }}
              className="hidden"
              id="qr-batch-file-input"
            />

            <label
              htmlFor="qr-batch-file-input"
              onDragOver={(e) => {
                e.preventDefault();
                setBatchDragging(true);
              }}
              onDragLeave={() => setBatchDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setBatchDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleStartBatch(e.dataTransfer.files);
                }
              }}
              className={`flex flex-col items-center justify-center w-full min-h-[170px] rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                batchDragging
                  ? 'border-[#4da3ff] bg-[#2f6bff]/15'
                  : 'border-white/15 hover:border-[#4da3ff]/50 bg-white/5 hover:bg-white/[0.08]'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-[#2f6bff]/15 border border-[#2f6bff]/30 flex items-center justify-center text-[#4da3ff] mb-3">
                <FileStack className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white">
                Select or Drop Multiple Badge Images &amp; PDFs
              </p>
              <p className="text-xs text-white/60 mt-1 max-w-md">
                Multi-page PDFs are rendered at 300 DPI and decoded page by page.
                {activeSession
                  ? ` Decoded badges automatically verify against "${activeSession.name}".`
                  : ' Activate a Session to verify attendance during batch import.'}
              </p>
            </label>

            {/* Batch Progress & Controls */}
            {batchItems.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-[11px] text-white/55 block">Progress</span>
                    <span className="text-lg font-bold text-white tabular-nums">
                      {batchSummary.processed}{' '}
                      <span className="text-xs font-normal text-white/50">/ {batchSummary.total}</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                    <span className="text-[11px] text-emerald-300/80 block">Decoded</span>
                    <span className="text-lg font-bold text-emerald-300 tabular-nums">
                      {batchSummary.decoded}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#ff3b4e]/10 border border-[#ff3b4e]/25">
                    <span className="text-[11px] text-[#ff8895] block">Failed</span>
                    <span className="text-lg font-bold text-[#ff8895] tabular-nums">
                      {batchSummary.failed}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-[11px] text-white/55 block">Elapsed</span>
                    <span className="text-lg font-bold text-[#4da3ff] tabular-nums font-mono">
                      {(batchElapsedMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>
                      {batchRunning ? 'Decoding batch...' : 'Batch complete'}
                    </span>
                    <span className="font-mono text-[#4da3ff] tabular-nums">
                      {batchSummary.pct}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] transition-all duration-150"
                      style={{ width: `${batchSummary.pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {batchRunning ? (
                    <button
                      type="button"
                      onClick={() => batchAbortRef.current?.abort()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff3b4e]/20 hover:bg-[#ff3b4e]/30 border border-[#ff3b4e]/40 text-xs font-semibold text-[#ff8895] min-h-[42px]"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Stop Batch</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {batchSummary.failed > 0 && (
                        <button
                          type="button"
                          onClick={handleRetryAllFailed}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold text-amber-200 min-h-[42px]"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry All Failed ({batchSummary.failed})</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setBatchItems([])}
                        className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/75 min-h-[42px]"
                      >
                        Clear Results
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Failed Items List with Per-File Retry */}
          {batchItems.some((i) => i.status === 'failed') && (
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3 border border-[#ff3b4e]/30">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-[#ff8895] flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  <span>Failed Files ({batchSummary.failed})</span>
                </h4>
              </div>

              <div className="rounded-2xl bg-black/30 border border-white/10 divide-y divide-white/10 max-h-72 overflow-y-auto">
                {batchItems
                  .filter((i) => i.status === 'failed')
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {item.fileName}
                        </p>
                        <p className="text-[11px] text-[#ff8895] truncate">
                          {item.error || 'No readable QR code found'}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={Boolean(retryingIds[item.id]) || batchRunning}
                        onClick={() => handleRetryBatchItem(item)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white disabled:opacity-40 shrink-0 min-h-[40px]"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${retryingIds[item.id] ? 'animate-spin' : ''}`}
                        />
                        <span>{retryingIds[item.id] ? 'Retrying...' : 'Retry'}</span>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Decoded Batch Results List */}
          {batchItems.some((i) => i.status === 'decoded') && (
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Decoded Results ({batchSummary.decoded})</span>
              </h4>

              <div className="rounded-2xl bg-black/25 border border-white/10 divide-y divide-white/10 max-h-96 overflow-y-auto">
                {batchItems
                  .filter((i) => i.status === 'decoded')
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-xs font-bold text-white truncate">
                            {item.candidateName || item.fileName}
                          </span>
                          {item.candidateName && (
                            <span className="text-[11px] text-white/50 truncate">
                              · {item.fileName}
                            </span>
                          )}
                          {item.decodeMethod && (
                            <span className="text-[11px] text-[#4da3ff]/80">
                              · {item.decodeMethod}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-white/65 truncate mt-0.5">
                          {item.rawPayload}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.verificationStatus && (
                          <span
                            className={`text-xs font-semibold ${
                              item.verificationStatus === 'verified'
                                ? 'text-emerald-400'
                                : item.verificationStatus === 'already_scanned'
                                ? 'text-amber-300'
                                : 'text-[#ff6b7a]'
                            }`}
                          >
                            {item.verificationStatus === 'verified'
                              ? 'Verified'
                              : item.verificationStatus === 'already_scanned'
                              ? 'Already scanned'
                              : 'Not on roster'}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (!item.rawPayload) return;
                            const parsed = decodeStructuredQR(item.rawPayload);
                            setScanResult(parsed);
                            setLastVerification(
                              item.verificationStatus
                                ? {
                                    status: item.verificationStatus,
                                    candidateName: item.candidateName,
                                    regNumber: item.regNumber,
                                    decodeMethod: item.decodeMethod,
                                  }
                                : null
                            );
                            setSubView('scan');
                            setSourceMode('image');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 min-h-[38px]"
                        >
                          <Play className="w-3 h-3 text-[#4da3ff]" />
                          <span>Inspect</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === SUB-VIEW 3: SESSIONS + ROSTER === */}
      {subView === 'sessions' && (
        <SessionsView
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectActiveSession={handleSelectActiveSession}
          onCreateSession={handleCreateSession}
          onUpdateSession={handleUpdateSession}
          onDeleteSession={handleDeleteSession}
        />
      )}
    </div>
  );
};
