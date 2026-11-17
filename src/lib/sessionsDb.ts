import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  AttendanceScanRecord,
  ExamSession,
  RosterCandidate,
  VerificationStatus,
} from '../types/qr';

const DB_NAME = 'qrforge-exam-sessions';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_META = 'meta';

interface QRForgeSessionsDB extends DBSchema {
  sessions: {
    key: string;
    value: ExamSession;
    indexes: { 'by-updated': number };
  };
  meta: {
    key: string;
    value: string;
  };
}

let dbPromise: Promise<IDBPDatabase<QRForgeSessionsDB>> | null = null;

function getDb(): Promise<IDBPDatabase<QRForgeSessionsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<QRForgeSessionsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          store.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      },
    });
  }
  return dbPromise;
}

export async function listSessions(): Promise<ExamSession[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORE_SESSIONS, 'by-updated');
  return all.reverse();
}

export async function getSession(id: string): Promise<ExamSession | undefined> {
  const db = await getDb();
  return db.get(STORE_SESSIONS, id);
}

export async function saveSession(session: ExamSession): Promise<void> {
  const db = await getDb();
  await db.put(STORE_SESSIONS, session);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_SESSIONS, id);
}

export async function getActiveSessionId(): Promise<string | null> {
  const db = await getDb();
  const val = await db.get(STORE_META, 'activeSessionId');
  return val || null;
}

export async function setActiveSessionId(id: string | null): Promise<void> {
  const db = await getDb();
  if (id) {
    await db.put(STORE_META, id, 'activeSessionId');
  } else {
    await db.delete(STORE_META, 'activeSessionId');
  }
}

/**
 * Normalizes registration numbers and QR payloads for resilient substring matching
 * (uppercased, stripped of whitespace, slashes, hyphens, dots, colons).
 */
export function normalizeForMatch(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Parses CSV/TSV roster text (supports comma, semicolon, or tab separated values,
 * optional header row, and quoted fields).
 */
export function parseRosterText(rawText: string): RosterCandidate[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const splitCsvLine = (line: string, delimiter: string): string[] => {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    out.push(current.trim());
    return out;
  };

  const candidates: RosterCandidate[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const delimiter = line.includes('\t')
      ? '\t'
      : line.includes(';')
      ? ';'
      : ',';
    const cols = splitCsvLine(line, delimiter);
    if (cols.length === 0) continue;

    const col0 = (cols[0] || '').trim();
    const col1 = (cols[1] || '').trim();

    // Skip common header row on first line
    if (
      i === 0 &&
      /^(reg|reg[_\s-]*no|reg[_\s-]*number|registration|id|candidate[_\s-]*id|student[_\s-]*id)$/i.test(
        col0
      )
    ) {
      continue;
    }

    if (!col0) continue;
    const normalizedReg = normalizeForMatch(col0);
    if (!normalizedReg || seen.has(normalizedReg)) continue;

    seen.add(normalizedReg);
    candidates.push({
      regNumber: col0,
      normalizedReg,
      name: col1 || col0,
    });
  }

  return candidates;
}

export function createExamSession(params: {
  name: string;
  date: string;
  paperUnit: string;
  roster: RosterCandidate[];
}): ExamSession {
  const now = Date.now();
  return {
    id: `sess_${now}_${Math.random().toString(36).slice(2, 7)}`,
    name: params.name.trim(),
    date: params.date,
    paperUnit: params.paperUnit.trim(),
    roster: params.roster,
    scans: [],
    verifiedByReg: {},
    createdAt: now,
    updatedAt: now,
  };
}

export interface VerifyPayloadResult {
  status: VerificationStatus;
  candidate?: RosterCandidate;
  firstScannedAt?: number;
  scanCount?: number;
  updatedSession: ExamSession;
  record: AttendanceScanRecord;
}

/**
 * Matches a decoded QR payload against an ExamSession's roster.
 * Match rule: normalized payload contains candidate's normalized reg number.
 */
export function verifyPayloadAgainstSession(
  session: ExamSession,
  rawPayload: string,
  source: 'camera' | 'image' | 'batch',
  sourceFile?: string
): VerifyPayloadResult {
  const normPayload = normalizeForMatch(rawPayload);
  const now = Date.now();

  let matchedCandidate: RosterCandidate | undefined;

  if (normPayload.length > 0 && session.roster.length > 0) {
    // 1. Exact normalized match first
    matchedCandidate = session.roster.find(
      (c) => c.normalizedReg === normPayload
    );

    // 2. Substring match sorted longest regNumber first to avoid short-prefix collisions
    if (!matchedCandidate) {
      const sortedRoster = [...session.roster].sort(
        (a, b) => b.normalizedReg.length - a.normalizedReg.length
      );
      matchedCandidate = sortedRoster.find(
        (c) => c.normalizedReg.length > 0 && normPayload.includes(c.normalizedReg)
      );
    }
  }

  let status: VerificationStatus;
  let firstScannedAt: number | undefined;
  let scanCount: number | undefined;
  const nextVerifiedByReg = { ...session.verifiedByReg };

  if (!matchedCandidate) {
    status = 'not_on_roster';
  } else {
    const existing = nextVerifiedByReg[matchedCandidate.normalizedReg];
    if (existing) {
      status = 'already_scanned';
      firstScannedAt = existing.firstScannedAt;
      scanCount = existing.scanCount + 1;
      nextVerifiedByReg[matchedCandidate.normalizedReg] = {
        ...existing,
        lastScannedAt: now,
        scanCount,
      };
    } else {
      status = 'verified';
      firstScannedAt = now;
      scanCount = 1;
      nextVerifiedByReg[matchedCandidate.normalizedReg] = {
        regNumber: matchedCandidate.regNumber,
        name: matchedCandidate.name,
        firstScannedAt: now,
        lastScannedAt: now,
        scanCount: 1,
      };
    }
  }

  const record: AttendanceScanRecord = {
    id: `scan_${now}_${Math.random().toString(36).slice(2, 7)}`,
    regNumber: matchedCandidate?.regNumber,
    candidateName: matchedCandidate?.name,
    rawPayload,
    status,
    scannedAt: now,
    source,
    sourceFile,
  };

  const updatedSession: ExamSession = {
    ...session,
    verifiedByReg: nextVerifiedByReg,
    scans: [record, ...session.scans],
    updatedAt: now,
  };

  return {
    status,
    candidate: matchedCandidate,
    firstScannedAt,
    scanCount,
    updatedSession,
    record,
  };
}

/**
 * Exports full attendance sheet (all roster candidates with verification status & timestamps,
 * plus any unrecognized scans) as CSV.
 */
export function buildAttendanceCSV(session: ExamSession): string {
  const escapeCsv = (val: string) => {
    const s = String(val ?? '');
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows: string[] = [];
  rows.push(
    [
      'Session',
      'Date',
      'Paper/Unit',
      'Reg Number',
      'Candidate Name',
      'Status',
      'First Scanned (ISO)',
      'First Scanned (Local)',
      'Scan Count',
    ]
      .map(escapeCsv)
      .join(',')
  );

  for (const cand of session.roster) {
    const entry = session.verifiedByReg[cand.normalizedReg];
    const firstIso = entry ? new Date(entry.firstScannedAt).toISOString() : '';
    const firstLocal = entry ? new Date(entry.firstScannedAt).toLocaleString() : '';
    rows.push(
      [
        session.name,
        session.date,
        session.paperUnit,
        cand.regNumber,
        cand.name,
        entry ? 'Verified' : 'Not Scanned',
        firstIso,
        firstLocal,
        entry ? String(entry.scanCount) : '0',
      ]
        .map(escapeCsv)
        .join(',')
    );
  }

  // Append unrecognized scans for auditability
  const unknownScans = session.scans.filter((s) => s.status === 'not_on_roster');
  for (const scan of unknownScans) {
    rows.push(
      [
        session.name,
        session.date,
        session.paperUnit,
        scan.rawPayload,
        'Unrecognized Payload',
        'Not on Roster',
        new Date(scan.scannedAt).toISOString(),
        new Date(scan.scannedAt).toLocaleString(),
        '1',
      ]
        .map(escapeCsv)
        .join(',')
    );
  }

  return rows.join('\n');
}

// Offline Web Audio synthesizer for distinct verification tones
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playVerificationFeedback(
  status: VerificationStatus,
  soundEnabled = true
): void {
  // Distinct haptic vibration patterns
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (status === 'verified') {
        navigator.vibrate([65]);
      } else if (status === 'already_scanned') {
        navigator.vibrate([55, 60, 55]);
      } else {
        navigator.vibrate([180, 70, 180]);
      }
    } catch {
      // Ignore vibration errors
    }
  }

  if (!soundEnabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const playTone = (
    freq: number,
    startOffset: number,
    duration: number,
    type: OscillatorType,
    gainPeak = 0.16
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + startOffset);
    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + startOffset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.02);
  };

  if (status === 'verified') {
    // Crisp ascending chime
    playTone(880, 0, 0.09, 'sine', 0.18);
    playTone(1318.5, 0.09, 0.14, 'sine', 0.18);
  } else if (status === 'already_scanned') {
    // Double neutral mid-tone pulse
    playTone(523.25, 0, 0.08, 'triangle', 0.16);
    playTone(523.25, 0.12, 0.09, 'triangle', 0.16);
  } else {
    // Low warning buzz
    playTone(230, 0, 0.14, 'sawtooth', 0.13);
    playTone(175, 0.15, 0.18, 'sawtooth', 0.13);
  }
}
