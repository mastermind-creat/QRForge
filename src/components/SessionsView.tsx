import React, { useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FolderPlus,
  Search,
  Trash2,
  Upload,
  UserCheck,
  UserMinus,
  Users,
  AlertTriangle,
  XCircle,
  Clock,
  BookOpen,
  Power,
} from 'lucide-react';
import { ExamSession, RosterCandidate } from '../types/qr';
import {
  buildAttendanceCSV,
  createExamSession,
  parseRosterText,
} from '../lib/sessionsDb';
import { downloadBlob } from '../utils/qrRenderer';
import { useToast } from '../context/ToastContext';

interface SessionsViewProps {
  sessions: ExamSession[];
  activeSessionId: string | null;
  onSelectActiveSession: (id: string | null) => void;
  onCreateSession: (session: ExamSession) => Promise<void>;
  onUpdateSession: (session: ExamSession) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
}

type RosterTab = 'unscanned' | 'verified' | 'log';

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  activeSessionId,
  onSelectActiveSession,
  onCreateSession,
  onUpdateSession,
  onDeleteSession,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(sessions.length === 0);
  const [name, setName] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paperUnit, setPaperUnit] = useState('');
  const [rosterText, setRosterText] = useState('');

  const [rosterTab, setRosterTab] = useState<RosterTab>('unscanned');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAppendRoster, setShowAppendRoster] = useState(false);
  const [appendText, setAppendText] = useState('');

  const csvInputRef = useRef<HTMLInputElement>(null);
  const appendCsvRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );

  const parsedPreview = useMemo(() => parseRosterText(rosterText), [rosterText]);
  const parsedAppendPreview = useMemo(() => parseRosterText(appendText), [appendText]);

  const handleCsvUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') {
        setter(text);
        const count = parseRosterText(text).length;
        showToast(`Loaded ${count} candidate${count === 1 ? '' : 's'} from ${file.name}`, 'success');
      }
    };
    reader.onerror = () => {
      showToast('Failed to read CSV file', 'error');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Please enter a session name', 'error');
      return;
    }
    if (!paperUnit.trim()) {
      showToast('Please enter a paper / unit code or title', 'error');
      return;
    }
    if (parsedPreview.length === 0) {
      showToast('Add at least one candidate (reg number, name)', 'error');
      return;
    }

    const session = createExamSession({
      name,
      date: date || new Date().toISOString().slice(0, 10),
      paperUnit,
      roster: parsedPreview,
    });

    await onCreateSession(session);
    onSelectActiveSession(session.id);

    setName('');
    setPaperUnit('');
    setRosterText('');
    setShowCreateForm(false);
    showToast(`Session "${session.name}" created (${session.roster.length} candidates)`, 'success');
  };

  const handleAppendRoster = async () => {
    if (!activeSession || parsedAppendPreview.length === 0) return;

    const existingMap = new Map<string, RosterCandidate>();
    for (const c of activeSession.roster) {
      existingMap.set(c.normalizedReg, c);
    }

    let added = 0;
    let updated = 0;
    for (const cand of parsedAppendPreview) {
      if (existingMap.has(cand.normalizedReg)) {
        updated++;
      } else {
        added++;
      }
      existingMap.set(cand.normalizedReg, cand);
    }

    const updatedSession: ExamSession = {
      ...activeSession,
      roster: Array.from(existingMap.values()),
      updatedAt: Date.now(),
    };

    await onUpdateSession(updatedSession);
    setAppendText('');
    setShowAppendRoster(false);
    showToast(`Roster updated: ${added} added, ${updated} refreshed`, 'success');
  };

  const handleExportCSV = (session: ExamSession) => {
    const csv = buildAttendanceCSV(session);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const safeName = session.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    downloadBlob(blob, `${safeName}-${session.date}-attendance.csv`);
    showToast('Attendance CSV exported', 'success');
  };

  const activeStats = useMemo(() => {
    if (!activeSession) return null;
    const expected = activeSession.roster.length;
    const verifiedList = activeSession.roster.filter(
      (c) => Boolean(activeSession.verifiedByReg[c.normalizedReg])
    );
    const unscannedList = activeSession.roster.filter(
      (c) => !activeSession.verifiedByReg[c.normalizedReg]
    );
    const unknownCount = activeSession.scans.filter((s) => s.status === 'not_on_roster').length;
    const pct = expected > 0 ? Math.round((verifiedList.length / expected) * 100) : 0;

    return {
      expected,
      scanned: verifiedList.length,
      remaining: unscannedList.length,
      unknownCount,
      pct,
      verifiedList,
      unscannedList,
    };
  }, [activeSession]);

  const filteredUnscanned = useMemo(() => {
    if (!activeStats) return [];
    const q = candidateSearch.trim().toLowerCase();
    if (!q) return activeStats.unscannedList;
    return activeStats.unscannedList.filter(
      (c) => c.regNumber.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [activeStats, candidateSearch]);

  const filteredVerified = useMemo(() => {
    if (!activeStats) return [];
    const q = candidateSearch.trim().toLowerCase();
    if (!q) return activeStats.verifiedList;
    return activeStats.verifiedList.filter(
      (c) => c.regNumber.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [activeStats, candidateSearch]);

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="glass-card rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#4da3ff]" />
            <span>Exam Verification Sessions</span>
          </h3>
          <p className="text-xs text-white/60 mt-0.5">
            Stored offline in IndexedDB. Load a roster to verify candidate badges live or in batch.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white text-xs font-semibold shadow-md shadow-[#2f6bff]/30 active:scale-95 transition-all min-h-[44px] shrink-0"
        >
          <FolderPlus className="w-4 h-4" />
          <span>{showCreateForm ? 'Close Form' : 'New Session'}</span>
        </button>
      </div>

      {/* Create Session Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 border border-[#2f6bff]/30"
        >
          <h4 className="text-sm font-bold text-white">Create Exam Session &amp; Roster</h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-white/75 block mb-1">
                Session Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CDACC Nov 2025 Morning"
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-base text-white placeholder-white/35 min-h-[44px]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white/75 block mb-1">
                Exam Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-base text-white min-h-[44px]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white/75 block mb-1">
                Paper / Unit
              </label>
              <input
                type="text"
                value={paperUnit}
                onChange={(e) => setPaperUnit(e.target.value)}
                placeholder="e.g. ICT/OS/CR/01/5/A"
                className="w-full glass-input rounded-xl px-3.5 py-2.5 text-base text-white placeholder-white/35 min-h-[44px]"
                required
              />
            </div>
          </div>

          {/* Roster Upload / Paste */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-white/75">
                Candidate Roster (CSV upload or paste <span className="font-mono text-[#4da3ff]">reg_number, name</span>)
              </label>

              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain"
                onChange={(e) => handleCsvUpload(e, setRosterText)}
                className="hidden"
                id="session-roster-csv-input"
              />
              <label
                htmlFor="session-roster-csv-input"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white cursor-pointer min-h-[38px]"
              >
                <Upload className="w-3.5 h-3.5 text-[#4da3ff]" />
                <span>Upload CSV</span>
              </label>
            </div>

            <textarea
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
              rows={5}
              placeholder={`reg_number,name\nCDACC/ICT/2025/001,Jane Wanjiku\nCDACC/ICT/2025/002,Brian Otieno`}
              className="w-full glass-input rounded-2xl px-3.5 py-3 text-base font-mono text-white placeholder-white/30"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-white/60">
                Detected candidates:{' '}
                <strong className="text-[#4da3ff] tabular-nums">{parsedPreview.length}</strong>
              </span>
              {parsedPreview.length > 0 && (
                <span className="text-white/50 truncate max-w-md">
                  First: {parsedPreview[0].regNumber} ({parsedPreview[0].name})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 min-h-[44px]"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2f6bff] to-[#4da3ff] text-white text-xs font-semibold shadow-lg shadow-[#2f6bff]/30 min-h-[44px]"
            >
              Save &amp; Activate Session
            </button>
          </div>
        </form>
      )}

      {/* Active Session Live Dashboard */}
      {activeSession && activeStats && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-5 border border-[#4da3ff]/30">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Active Verification Session</span>
              </div>
              <h4 className="text-lg font-bold text-white">{activeSession.name}</h4>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#4da3ff]" />
                  {activeSession.date}
                </span>
                <span aria-hidden="true" className="text-white/30">·</span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-[#4da3ff]" />
                  {activeSession.paperUnit}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAppendRoster((v) => !v)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/85 min-h-[44px]"
              >
                <Users className="w-4 h-4 text-[#4da3ff]" />
                <span>Add Roster</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportCSV(activeSession)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2f6bff]/20 hover:bg-[#2f6bff]/30 border border-[#2f6bff]/40 text-xs font-semibold text-[#4da3ff] min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => onSelectActiveSession(null)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/70 hover:text-white min-h-[44px]"
                title="Deactivate session verification"
              >
                <Power className="w-4 h-4" />
                <span>Deactivate</span>
              </button>
            </div>
          </div>

          {/* Append Roster Drawer */}
          {showAppendRoster && (
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">
                  Append / Merge Additional Candidates
                </span>
                <input
                  ref={appendCsvRef}
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain"
                  onChange={(e) => handleCsvUpload(e, setAppendText)}
                  className="hidden"
                  id="append-roster-csv-input"
                />
                <label
                  htmlFor="append-roster-csv-input"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#4da3ff]" />
                  <span>Load CSV</span>
                </label>
              </div>
              <textarea
                value={appendText}
                onChange={(e) => setAppendText(e.target.value)}
                rows={3}
                placeholder="Paste additional reg_number, name rows..."
                className="w-full glass-input rounded-xl px-3 py-2 text-base font-mono text-white placeholder-white/30"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60">
                  Ready to merge: <strong className="text-[#4da3ff]">{parsedAppendPreview.length}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAppendRoster(false)}
                    className="px-3 py-2 rounded-xl bg-white/5 text-xs font-semibold text-white/70 min-h-[40px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={parsedAppendPreview.length === 0}
                    onClick={handleAppendRoster}
                    className="px-4 py-2 rounded-xl bg-[#2f6bff] text-xs font-semibold text-white disabled:opacity-40 min-h-[40px]"
                  >
                    Merge Candidates
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Live Counters */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
              <span className="text-[11px] font-medium text-emerald-300/80 block">
                Verified / Expected
              </span>
              <span className="text-xl sm:text-2xl font-bold text-white tabular-nums mt-0.5 block">
                {activeStats.scanned}{' '}
                <span className="text-sm font-normal text-white/50">/ {activeStats.expected}</span>
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[11px] font-medium text-white/60 block">
                Not Yet Scanned
              </span>
              <span className="text-xl sm:text-2xl font-bold text-white tabular-nums mt-0.5 block">
                {activeStats.remaining}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#ff3b4e]/10 border border-[#ff3b4e]/25">
              <span className="text-[11px] font-medium text-[#ff8895] block">
                Not on Roster
              </span>
              <span className="text-xl sm:text-2xl font-bold text-white tabular-nums mt-0.5 block">
                {activeStats.unknownCount}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Attendance Completion</span>
              <span className="font-mono text-[#4da3ff] font-semibold tabular-nums">
                {activeStats.pct}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2f6bff] to-emerald-400 transition-all duration-300"
                style={{ width: `${activeStats.pct}%` }}
              />
            </div>
          </div>

          {/* Roster / Log Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-white/5 border border-white/10">
              <button
                type="button"
                onClick={() => setRosterTab('unscanned')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all min-h-[40px] ${
                  rosterTab === 'unscanned'
                    ? 'bg-[#2f6bff] text-white'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Pending ({activeStats.remaining})
              </button>
              <button
                type="button"
                onClick={() => setRosterTab('verified')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all min-h-[40px] ${
                  rosterTab === 'verified'
                    ? 'bg-emerald-500/80 text-white'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Verified ({activeStats.scanned})
              </button>
              <button
                type="button"
                onClick={() => setRosterTab('log')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all min-h-[40px] ${
                  rosterTab === 'log'
                    ? 'bg-white/20 text-white'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Scan Log ({activeSession.scans.length})
              </button>
            </div>

            {rosterTab !== 'log' && (
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  placeholder="Search reg or name..."
                  className="w-full glass-input rounded-xl pl-9 pr-3.5 py-2 text-base text-white placeholder-white/35 min-h-[44px]"
                />
              </div>
            )}
          </div>

          {/* Lists */}
          <div className="rounded-2xl bg-black/25 border border-white/10 divide-y divide-white/10 max-h-80 overflow-y-auto">
            {rosterTab === 'unscanned' && (
              filteredUnscanned.length === 0 ? (
                <div className="p-6 text-center text-xs text-white/60">
                  {activeStats.remaining === 0
                    ? 'All candidates on this roster have been verified.'
                    : 'No pending candidates match your search.'}
                </div>
              ) : (
                filteredUnscanned.map((c) => (
                  <div
                    key={c.normalizedReg}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                      <p className="text-xs font-mono text-white/55 truncate">{c.regNumber}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-white/45 shrink-0">
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>Not scanned</span>
                    </span>
                  </div>
                ))
              )
            )}

            {rosterTab === 'verified' && (
              filteredVerified.length === 0 ? (
                <div className="p-6 text-center text-xs text-white/60">
                  No verified candidates yet.
                </div>
              ) : (
                filteredVerified.map((c) => {
                  const entry = activeSession.verifiedByReg[c.normalizedReg];
                  return (
                    <div
                      key={c.normalizedReg}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                        <p className="text-xs font-mono text-emerald-300/80 truncate">{c.regNumber}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="flex items-center justify-end gap-1 text-xs font-semibold text-emerald-400">
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Verified</span>
                        </span>
                        {entry && (
                          <span className="text-[11px] text-white/50 tabular-nums block">
                            {new Date(entry.firstScannedAt).toLocaleTimeString()} · ×{entry.scanCount}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            )}

            {rosterTab === 'log' && (
              activeSession.scans.length === 0 ? (
                <div className="p-6 text-center text-xs text-white/60">
                  No scans recorded in this session yet.
                </div>
              ) : (
                activeSession.scans.map((scan) => (
                  <div
                    key={scan.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {scan.status === 'verified' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : scan.status === 'already_scanned' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-[#ff6b7a] shrink-0" />
                        )}
                        <p className="text-sm font-semibold text-white truncate">
                          {scan.candidateName || 'Unknown Payload'}
                        </p>
                      </div>
                      <p className="text-xs font-mono text-white/55 truncate pl-6">
                        {scan.regNumber ? `${scan.regNumber} · ` : ''}
                        {scan.rawPayload}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-semibold block ${
                          scan.status === 'verified'
                            ? 'text-emerald-400'
                            : scan.status === 'already_scanned'
                            ? 'text-amber-300'
                            : 'text-[#ff6b7a]'
                        }`}
                      >
                        {scan.status === 'verified'
                          ? 'Verified'
                          : scan.status === 'already_scanned'
                          ? 'Already scanned'
                          : 'Not on roster'}
                      </span>
                      <span className="text-[11px] text-white/45 flex items-center justify-end gap-1 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {new Date(scan.scannedAt).toLocaleTimeString()} · {scan.source}
                      </span>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}

      {/* Saved Sessions List */}
      <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#4da3ff]" />
            <span>Saved Sessions ({sessions.length})</span>
          </h4>
        </div>

        {sessions.length === 0 ? (
          <div className="py-8 text-center text-xs text-white/55">
            No saved exam sessions yet. Create one above to verify candidate rosters.
          </div>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((sess) => {
              const isSelected = sess.id === activeSessionId;
              const verifiedCount = Object.keys(sess.verifiedByReg).length;
              return (
                <div
                  key={sess.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-[#2f6bff]/15 border-[#4da3ff]/50'
                      : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.07]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-bold text-white truncate">{sess.name}</h5>
                      {isSelected && (
                        <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/60 mt-0.5 truncate">
                      {sess.date} · {sess.paperUnit} ·{' '}
                      <span className="text-white/80 font-semibold tabular-nums">
                        {verifiedCount}/{sess.roster.length} verified
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isSelected && (
                      <button
                        type="button"
                        onClick={() => onSelectActiveSession(sess.id)}
                        className="px-3.5 py-2 rounded-xl bg-[#2f6bff]/20 hover:bg-[#2f6bff]/30 border border-[#2f6bff]/40 text-xs font-semibold text-[#4da3ff] min-h-[40px]"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExportCSV(sess)}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 min-h-[40px]"
                      aria-label={`Export ${sess.name} CSV`}
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {confirmDeleteId === sess.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteSession(sess.id);
                            setConfirmDeleteId(null);
                            showToast('Session deleted', 'info');
                          }}
                          className="px-3 py-2 rounded-xl bg-[#ff3b4e] text-white text-xs font-semibold min-h-[40px]"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-2 rounded-xl bg-white/10 text-white/75 text-xs font-semibold min-h-[40px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(sess.id)}
                        className="p-2 rounded-xl bg-[#ff3b4e]/10 hover:bg-[#ff3b4e]/20 border border-[#ff3b4e]/25 text-[#ff6b7a] min-h-[40px] min-w-[40px] flex items-center justify-center"
                        aria-label={`Delete ${sess.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
