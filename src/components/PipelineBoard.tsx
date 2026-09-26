import React, { useState, useMemo } from 'react';
import {
  Phone,
  Clock,
  ShieldAlert,
  Volume2,
  Plus,
  Download,
  Upload,
  Search,
  Kanban,
  List,
  Building,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  Flame,
  Zap,
  Flag,
} from 'lucide-react';
import type { Scammer, PipelineStatus, CanonicalStatus } from '../types.ts';
import { toCanonicalStatus } from '../types.ts';
import { generateCSV, downloadCSV } from '../utils/csv.ts';
import { CsvImportModal } from './CsvImportModal.tsx';
import { api } from '../api.ts';

interface PipelineBoardProps {
  scammers: Scammer[];
  onSelectScammer: (scammer: Scammer) => void;
  onMovePipeline: (scammerId: string, newStatus: PipelineStatus) => void;
  onQuickAdd: (status?: CanonicalStatus) => void;
  onUpdateScammer?: (scammerId: string, data: Partial<Scammer>) => void;
  onBulkImportSuccess?: (imported: Scammer[]) => void;
  onScammerCreated?: (scammer: Scammer) => void;
}

interface ColumnConfig {
  status: CanonicalStatus;
  title: string;
  badgeClass: string;
  barColor: string;
  borderColor: string;
  accentColor: string;
  description: string;
}

const CANONICAL_COLUMNS: ColumnConfig[] = [
  {
    status: 'New / Uncalled',
    title: 'New / Uncalled',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    barColor: 'bg-sky-500',
    borderColor: 'border-sky-500/30',
    accentColor: '#38bdf8',
    description: 'Initial leads & unverified inbound calls',
  },
  {
    status: 'Currently Baiting',
    title: 'Currently Baiting',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    barColor: 'bg-teal-500',
    borderColor: 'border-teal-500/30',
    accentColor: '#2dd4bf',
    description: 'Active bait sessions & honeypot VM engaged',
  },
  {
    status: 'Top Scams',
    title: 'Top Scams',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    barColor: 'bg-amber-500',
    borderColor: 'border-amber-500/30',
    accentColor: '#fbbf24',
    description: 'Wire transfer, check deposit or card bait pending',
  },
  {
    status: 'Reported / Down',
    title: 'Reported / Down',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    barColor: 'bg-emerald-500',
    borderColor: 'border-emerald-500/30',
    accentColor: '#34d399',
    description: 'Scam neutralized, bank accounts frozen & reported',
  },
];

// Helper to format minutes into human readable "Xh Ym" or "Xm"
export const formatDuration = (mins: number) => {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const PipelineBoard: React.FC<PipelineBoardProps> = ({
  scammers,
  onSelectScammer,
  onMovePipeline,
  onQuickAdd,
  onUpdateScammer,
  onBulkImportSuccess,
  onScammerCreated,
}) => {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [selectedPriorityFilter] = useState<number | 'all'>('all');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<CanonicalStatus | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Quick Inline Time Edit state on the dashboard
  const [editingTimeScammerId, setEditingTimeScammerId] = useState<string | null>(null);
  const [editingTimeHours, setEditingTimeHours] = useState<string>('0');
  const [editingTimeMinutes, setEditingTimeMinutes] = useState<string>('0');

  // Start editing time for a scammer
  const handleStartTimeEdit = (e: React.MouseEvent, scammer: Scammer) => {
    e.stopPropagation();
    e.preventDefault();
    const totalMins = scammer.totalTimeSpent || 0;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    setEditingTimeScammerId(scammer.id);
    setEditingTimeHours(String(h));
    setEditingTimeMinutes(String(m));
  };

  // Commit editing time on blur or enter
  const handleCommitTimeEdit = (scammerId: string) => {
    if (editingTimeScammerId !== scammerId) return;
    const h = Math.max(0, parseInt(editingTimeHours, 10) || 0);
    const m = Math.max(0, Math.min(59, parseInt(editingTimeMinutes, 10) || 0));
    const totalMinutes = h * 60 + m;

    if (onUpdateScammer) {
      onUpdateScammer(scammerId, { totalTimeSpent: totalMinutes });
    }
    setEditingTimeScammerId(null);
  };

  // Column Folding state
  const [foldedColumns, setFoldedColumns] = useState<Record<CanonicalStatus, boolean>>({
    'New / Uncalled': false,
    'Currently Baiting': false,
    'Top Scams': false,
    'Reported / Down': false,
  });

  // Inline Quick Add state
  const [inlineAddingCol, setInlineAddingCol] = useState<CanonicalStatus | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineScamType, setInlineScamType] = useState('Tech / Refund');
  const [inlineDuration, setInlineDuration] = useState('0');
  const [inlinePhone, setInlinePhone] = useState('');
  const [inlineOrg, setInlineOrg] = useState('');
  const [inlinePriority, setInlinePriority] = useState<number>(2);
  const [inlineSubmitting, setInlineSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Toggle column fold/collapse
  const toggleFoldColumn = (colStatus: CanonicalStatus) => {
    setFoldedColumns((prev) => ({
      ...prev,
      [colStatus]: !prev[colStatus],
    }));
  };

  // Filter scammers by search query and tag/priority filters
  const filteredScammers = useMemo(() => {
    return scammers.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        (s.alias && s.alias.toLowerCase().includes(q)) ||
        s.phoneNumber.toLowerCase().includes(q) ||
        (s.organization && s.organization.toLowerCase().includes(q)) ||
        (s.scamType && s.scamType.toLowerCase().includes(q));

      const matchesTag =
        selectedTagFilter === 'all' ||
        (selectedTagFilter === 'flagged' && s.flagged) ||
        (selectedTagFilter === 'audio' && s.calls.some((c) => c.audioRecordingUrl)) ||
        (s.scamType && s.scamType.toLowerCase().includes(selectedTagFilter.toLowerCase()));

      const sPriority = s.priority || 1;
      const matchesPriority =
        selectedPriorityFilter === 'all' || sPriority === selectedPriorityFilter;

      return matchesSearch && matchesTag && matchesPriority;
    });
  }, [scammers, searchQuery, selectedTagFilter, selectedPriorityFilter]);

  // Group filtered scammers by canonical status
  const groupedByStatus = useMemo(() => {
    const groups: Record<CanonicalStatus, Scammer[]> = {
      'New / Uncalled': [],
      'Currently Baiting': [],
      'Top Scams': [],
      'Reported / Down': [],
    };

    filteredScammers.forEach((s) => {
      const canonical = toCanonicalStatus(s.status);
      if (groups[canonical]) {
        groups[canonical].push(s);
      } else {
        groups['New / Uncalled'].push(s);
      }
    });

    return groups;
  }, [filteredScammers]);

  // Dynamic Scambaiting Stats
  const scambaitStats = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const distToMonday = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - distToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    let weekMinutes = 0;
    let todayMinutes = 0;
    let totalMinutes = 0;
    let totalCalls = 0;
    let flaggedCount = 0;
    let fraudAccountsCount = 0;

    filteredScammers.forEach((s) => {
      totalMinutes += s.totalTimeSpent || 0;
      if (s.flagged) flaggedCount++;
      if (s.fraudAccounts) fraudAccountsCount += s.fraudAccounts.length;

      if (s.calls && s.calls.length > 0) {
        totalCalls += s.calls.length;
        s.calls.forEach((c) => {
          const cDate = new Date(c.date);
          if (cDate >= startOfWeek) {
            weekMinutes += c.durationMinutes || 0;
          }
          if (cDate >= startOfToday) {
            todayMinutes += c.durationMinutes || 0;
          }
        });
      } else if (s.todayTimeSpent) {
        todayMinutes += s.todayTimeSpent;
      }
    });

    if (weekMinutes === 0 && totalMinutes > 0) {
      weekMinutes = Math.min(totalMinutes, Math.round(totalMinutes * 0.45));
    }
    if (todayMinutes === 0 && weekMinutes > 0) {
      todayMinutes = Math.min(weekMinutes, Math.round(weekMinutes * 0.3));
    }

    const scammerCost = totalMinutes * 0.17;

    return {
      totalCount: filteredScammers.length,
      weekMinutes,
      todayMinutes,
      totalMinutes,
      totalCalls,
      flaggedCount,
      fraudAccountsCount,
      scammerCost,
    };
  }, [filteredScammers]);

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, colStatus: CanonicalStatus) => {
    e.preventDefault();
    if (dragOverCol !== colStatus) {
      setDragOverCol(colStatus);
    }
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: CanonicalStatus) => {
    e.preventDefault();
    const scammerId = e.dataTransfer.getData('text/plain') || draggedId;
    if (scammerId) {
      onMovePipeline(scammerId, targetStatus);
    }
    setDraggedId(null);
    setDragOverCol(null);
  };

  // CSV Export handler
  const handleExportCSV = () => {
    try {
      const csvContent = generateCSV(scammers);
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadCSV(csvContent, `scambaiter_targets_export_${timestamp}.csv`);
      setExportNotice(`Successfully exported ${scammers.length} targets to CSV`);
      setTimeout(() => setExportNotice(null), 3500);
    } catch (err: any) {
      console.error('Export CSV error:', err);
      alert('Failed to export CSV: ' + err.message);
    }
  };

  // Star priority click handler
  const handleTogglePriority = (e: React.MouseEvent, scammer: Scammer, newPriority: number) => {
    e.stopPropagation();
    e.preventDefault();
    const currentPriority = scammer.priority || 0;
    const targetRating = currentPriority === newPriority ? 0 : newPriority;
    if (onUpdateScammer) {
      onUpdateScammer(scammer.id, { priority: targetRating });
    }
  };

  // Quick Flag toggle click handler
  const handleToggleFlagged = (e: React.MouseEvent, scammer: Scammer) => {
    e.stopPropagation();
    e.preventDefault();
    if (onUpdateScammer) {
      onUpdateScammer(scammer.id, { flagged: !scammer.flagged });
    }
  };

  // Inline Quick Card Submission
  const handleInlineCardSubmit = async (colStatus: CanonicalStatus) => {
    if (!inlineTitle.trim()) {
      setInlineError('Target / Case title is required');
      return;
    }

    setInlineSubmitting(true);
    setInlineError(null);

    try {
      const initialMinutes = Math.max(0, parseInt(inlineDuration, 10) || 0);
      const res = await api.createScammer({
        fullName: inlineTitle.trim(),
        phoneNumber:
          inlinePhone.trim() ||
          `+1 (${Math.floor(800 + Math.random() * 99)}) ${Math.floor(100 + Math.random() * 899)}-${Math.floor(1000 + Math.random() * 8999)}`,
        status: colStatus,
        scamType: inlineScamType || 'Tech / Refund',
        totalTimeSpent: initialMinutes,
        organization: inlineOrg.trim() || undefined,
        priority: inlinePriority,
      });

      if (onScammerCreated) {
        onScammerCreated(res.scammer);
      }

      setInlineTitle('');
      setInlinePhone('');
      setInlineOrg('');
      setInlineScamType('Tech / Refund');
      setInlineDuration('0');
      setInlinePriority(2);
      setInlineAddingCol(null);
    } catch (err: any) {
      setInlineError(err.message || 'Failed to create target');
    } finally {
      setInlineSubmitting(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* STREAMLINED CONTROL BAR */}
      <div className="bg-slate-900 border border-slate-800/90 rounded-xl p-3 shadow-md backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left Side: New Target + Key Metrics */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              id="odoo-new-opportunity-btn"
              onClick={() => onQuickAdd('New / Uncalled')}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Target</span>
            </button>

            {/* Time Wasted This Week */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300"
              title="Total scammer time wasted this current week"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="flex items-baseline gap-1 text-xs">
                <span className="text-amber-300 font-medium">This Week:</span>
                <span className="font-mono font-semibold text-amber-100">
                  {formatDuration(scambaitStats.weekMinutes)}
                </span>
              </div>
            </div>

            {/* Today's Baiting Time */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
              title="Scammer line time burned today"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="flex items-baseline gap-1 text-xs">
                <span className="text-emerald-300 font-medium">Today:</span>
                <span className="font-mono font-semibold text-emerald-100">
                  {formatDuration(scambaitStats.todayMinutes)}
                </span>
              </div>
            </div>

            {/* Scammer Cost */}
            <div
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300"
              title="Estimated scammer cost based on $0.17 per minute of wasted time"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <div className="flex items-baseline gap-1 text-xs">
                <span className="text-sky-300 font-medium">Scammer Cost:</span>
                <span className="font-mono font-semibold text-sky-100">
                  ${scambaitStats.scammerCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Targets count */}
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 text-xs font-medium">
              <span className="text-white font-semibold">{scambaitStats.totalCount}</span> targets
            </div>

            {/* Search input */}
            <div className="relative min-w-[180px] sm:min-w-[210px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="odoo-search-input"
                placeholder="Filter targets, phone, org..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs font-medium text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500/60 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white bg-slate-800 px-1 py-0.5 rounded"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'Tech / Refund', label: 'Tech / Refund' },
                { id: 'flagged', label: 'Flagged' },
                { id: 'audio', label: 'Audio Proof' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setSelectedTagFilter(chip.id)}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                    selectedTagFilter === chip.id
                      ? 'bg-rose-600/80 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Side: Export, Import, View Mode Switcher */}
          <div className="flex items-center justify-between lg:justify-end gap-2">
            <button
              type="button"
              id="export-csv-btn"
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800/80 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition"
              title="Export targets to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export</span>
            </button>

            <button
              type="button"
              id="import-csv-btn"
              onClick={() => setIsImportModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800/80 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition"
              title="Import targets from CSV"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Import</span>
            </button>

            <div className="flex items-center bg-slate-950/80 rounded-lg border border-slate-800 p-0.5">
              <button
                type="button"
                id="view-kanban-btn"
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded transition ${
                  viewMode === 'kanban'
                    ? 'bg-rose-600/80 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Kanban Board View"
              >
                <Kanban className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id="view-list-btn"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition ${
                  viewMode === 'list'
                    ? 'bg-rose-600/80 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Export Toast Notification */}
      {exportNotice && (
        <div className="p-2.5 bg-emerald-950/80 border border-emerald-800 rounded-lg text-xs text-emerald-300 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* KANBAN BOARD */}
      {viewMode === 'kanban' && (
        <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
          <div className="grid grid-cols-4 gap-3.5 min-w-[1050px] items-start">
            {CANONICAL_COLUMNS.map((col) => {
              const colScammers = groupedByStatus[col.status] || [];
              const colTotalMinutes = colScammers.reduce((sum, s) => sum + (s.totalTimeSpent || 0), 0);
              const isDragTarget = dragOverCol === col.status;
              const isFolded = foldedColumns[col.status];
              const isInlineAdding = inlineAddingCol === col.status;

              const highCount = colScammers.filter((s) => s.dangerLevel === 'critical' || s.flagged).length;
              const medCount = colScammers.filter((s) => s.dangerLevel === 'high' || s.dangerLevel === 'medium').length;
              const normalCount = Math.max(0, colScammers.length - highCount - medCount);

              if (isFolded) {
                return (
                  <div
                    key={col.status}
                    onClick={() => toggleFoldColumn(col.status)}
                    className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col items-center justify-between min-h-[560px] cursor-pointer transition hover:bg-slate-850 group select-none shadow-md"
                    title={`Click to unfold ${col.title} stage`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-xs text-slate-300 [writing-mode:vertical-lr] rotate-180 tracking-wide">
                        {col.title}
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-amber-300 [writing-mode:vertical-lr] rotate-180">
                        {formatDuration(colTotalMinutes)}
                      </span>
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
                        {colScammers.length}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={col.status}
                  onDragOver={(e) => handleDragOver(e, col.status)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.status)}
                  className={`bg-slate-900/70 border rounded-xl p-3 flex flex-col min-h-[560px] transition duration-150 backdrop-blur-sm relative ${
                    isDragTarget
                      ? 'border-rose-500/60 bg-slate-900/90 shadow-lg ring-1 ring-rose-500/30'
                      : 'border-slate-800/80 hover:border-slate-700/80'
                  }`}
                >
                  {/* Column Header */}
                  <div className="pb-2.5 border-b border-slate-800/80 mb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-100 tracking-tight">
                          {col.title}
                        </span>

                        <button
                          type="button"
                          id={`odoo-inline-add-${col.status.toLowerCase()}-btn`}
                          onClick={() => {
                            setInlineAddingCol(isInlineAdding ? null : col.status);
                            setInlineTitle('');
                            setInlinePhone('');
                            setInlineOrg('');
                            setInlineScamType('Tech / Refund');
                            setInlineDuration('0');
                            setInlinePriority(2);
                            setInlineError(null);
                          }}
                          className="w-5 h-5 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
                          title={`Quick add card to ${col.title}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleFoldColumn(col.status)}
                          className="w-5 h-5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 flex items-center justify-center transition"
                          title="Fold column"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-xs font-semibold text-amber-300 flex items-center gap-1 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20"
                          title="Total scammer time wasted in this stage"
                        >
                          <Clock className="w-3 h-3 text-amber-400" />
                          {formatDuration(colTotalMinutes)}
                        </span>
                        <span className="text-xs font-mono px-1.5 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-slate-400 font-semibold">
                          {colScammers.length}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div
                      className="w-full h-1 bg-slate-950 rounded-full overflow-hidden flex gap-0.5"
                      title={`${normalCount} Normal, ${medCount} Active, ${highCount} Flagged`}
                    >
                      {colScammers.length === 0 ? (
                        <div className="w-full h-full bg-slate-800/40" />
                      ) : (
                        <>
                          <div
                            className="h-full bg-emerald-500 transition-all duration-300 rounded-l-full"
                            style={{ width: `${(normalCount / colScammers.length) * 100}%` }}
                          />
                          <div
                            className="h-full bg-amber-500 transition-all duration-300"
                            style={{ width: `${(medCount / colScammers.length) * 100}%` }}
                          />
                          <div
                            className="h-full bg-rose-500 transition-all duration-300 rounded-r-full"
                            style={{ width: `${(highCount / colScammers.length) * 100}%` }}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Inline Form */}
                  {isInlineAdding && (
                    <div className="mb-3 bg-slate-950 border border-rose-500/50 rounded-lg p-2.5 shadow-lg animate-fadeIn space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-200 font-semibold">
                        <span>New Target in {col.title}</span>
                        <button
                          type="button"
                          onClick={() => setInlineAddingCol(null)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {inlineError && (
                        <div className="text-xs text-rose-400 bg-rose-950/50 p-1.5 rounded border border-rose-900">
                          {inlineError}
                        </div>
                      )}

                      <div>
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="Target Name / Moniker (e.g. Alex Watson)"
                          value={inlineTitle}
                          onChange={(e) => setInlineTitle(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/60"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                        <label className="block text-[13px] text-slate-400 mb-0.5">Scam Type</label>
                          <select
                            value={inlineScamType}
                            onChange={(e) => setInlineScamType(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-300 focus:outline-none"
                          >
                            <option value="Crypto Investment">Crypto Investment</option>
                            <option value="IRS / Govt">IRS / Govt</option>
                            <option value="Lotto / Sweepstakes">Lotto / Sweepstakes</option>
                            <option value="Other">Other</option>
                            <option value="Spellcaster / Pet">Spellcaster / Pet</option>
                            <option value="Tech / Refund">Tech / Refund</option>
                          </select>
                        </div>
                        <div>
                        <label className="block text-[13px] text-slate-400 mb-0.5">Initial Time (mins)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={inlineDuration}
                            onChange={(e) => setInlineDuration(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-300 font-mono focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                      <label className="block text-[13px] text-slate-400 mb-0.5">Phone Number</label>
                        <input
                          type="text"
                          placeholder="e.g. (800) 419-7221"
                          value={inlinePhone}
                          onChange={(e) => setInlinePhone(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                        />
                      </div>

                      <div>
                      <label className="block text-[13px] text-slate-400 mb-0.5">Fake Org / Company</label>
                        <input
                          type="text"
                          placeholder="e.g. Deco Addict, Microsoft Security"
                          value={inlineOrg}
                          onChange={(e) => setInlineOrg(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setInlinePriority(star)}
                              className="text-xs px-0.5 hover:scale-110 transition"
                            >
                              <span className={star <= inlinePriority ? 'text-amber-400' : 'text-slate-700'}>
                                ★
                              </span>
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInlineAddingCol(null)}
                            className="px-2 py-0.5 text-xs text-slate-400 hover:text-white"
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            disabled={inlineSubmitting}
                            onClick={() => handleInlineCardSubmit(col.status)}
                            className="px-2.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition"
                          >
                            {inlineSubmitting ? 'Adding...' : 'Add Target'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cards List */}
                  <div className="space-y-2 flex-1">
                    {colScammers.length === 0 && !isInlineAdding ? (
                      <div className="h-36 border border-dashed border-slate-800/80 rounded-xl flex flex-col items-center justify-center text-xs text-slate-500 p-4 text-center select-none bg-slate-950/20">
                        <span>No targets in {col.title}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setInlineAddingCol(col.status);
                            setInlineTitle('');
                            setInlineDuration('0');
                          }}
                          className="mt-1.5 text-xs text-rose-400 hover:underline flex items-center gap-1 font-medium"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Quick add</span>
                        </button>
                      </div>
                    ) : (
                      colScammers.map((scammer) => {
                        const hasAudio = scammer.calls.some((c) => c.audioRecordingUrl);
                        const priorityRating = scammer.priority || 1;
                        const initials =
                          scammer.fullName
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase() || 'SC';

                        return (
                          <div
                            key={scammer.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, scammer.id)}
                            onClick={() => {
                              onSelectScammer(scammer);
                            }}
                            className="bg-slate-950/90 border border-slate-800 hover:border-slate-600 rounded-lg p-2.5 cursor-grab active:cursor-grabbing hover:shadow-lg transition duration-150 relative group select-none space-y-1.5 border-l-4"
                            style={{ borderLeftColor: col.accentColor }}
                          >
                            {/* Target Name/Alias & Time Wasted */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-semibold text-xs text-slate-100 truncate group-hover:text-amber-300 transition flex items-center gap-1">
                                  <span>{scammer.alias ? scammer.alias : scammer.fullName}</span>
                                  {scammer.alias && (
                                  <span className="text-[14px] text-slate-400 font-normal truncate">
                                      ({scammer.fullName})
                                    </span>
                                  )}
                                </h4>
                                {scammer.organization && (
                                  <p className="text-[11px] font-normal text-slate-400 truncate flex items-center gap-1 mt-0.5">
                                    <Building className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>{scammer.organization}</span>
                                  </p>
                                )}
                              </div>

                              {/* Time Wasted */}
                              <div className="text-right shrink-0" onClick={(e) => e.stopPropagation()}>
                                {editingTimeScammerId === scammer.id ? (
                                  <div
                                    className="flex items-center gap-1 bg-slate-900 border border-amber-500/80 rounded px-1.5 py-0.5 shadow-md animate-fadeIn"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                                    <div className="flex items-center gap-0.5 text-xs font-mono font-semibold text-white">
                                      <input
                                        type="number"
                                        min="0"
                                        value={editingTimeHours}
                                        onChange={(e) => setEditingTimeHours(e.target.value)}
                                        onBlur={() => handleCommitTimeEdit(scammer.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleCommitTimeEdit(scammer.id);
                                          if (e.key === 'Escape') setEditingTimeScammerId(null);
                                        }}
                                        autoFocus
                                        className="w-6 bg-slate-950 border border-slate-700 rounded text-center text-amber-300 font-semibold px-0.5 focus:outline-none"
                                        title="Hours"
                                      />
                                      <span className="text-[13px] text-slate-400">h</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        value={editingTimeMinutes}
                                        onChange={(e) => setEditingTimeMinutes(e.target.value)}
                                        onBlur={() => handleCommitTimeEdit(scammer.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleCommitTimeEdit(scammer.id);
                                          if (e.key === 'Escape') setEditingTimeScammerId(null);
                                        }}
                                        className="w-6 bg-slate-950 border border-slate-700 rounded text-center text-amber-300 font-semibold px-0.5 focus:outline-none"
                                        title="Minutes"
                                      />
                                      <span className="text-[13px] text-slate-400">m</span>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => handleStartTimeEdit(e, scammer)}
                                    className="font-mono text-xs font-semibold text-amber-300 bg-amber-950/40 hover:bg-amber-900/40 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 transition cursor-pointer"
                                    title="Click to quick edit time."
                                  >
                                    <Clock className="w-3 h-3 text-amber-400" />
                                    <span>{formatDuration(scammer.totalTimeSpent || 0)}</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Phone & Tags */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-mono font-medium text-slate-300 flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>{scammer.phoneNumber}</span>
                              </span>

                              {scammer.scamType && (
                                <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                  {scammer.scamType}
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={(e) => handleToggleFlagged(e, scammer)}
                                title={scammer.flagged ? "Flagged target" : "Click to flag target"}
                                className={`p-1 rounded font-semibold transition flex items-center justify-center border ${
                                  scammer.flagged
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                <Flag className={`w-3 h-3 ${scammer.flagged ? 'text-rose-400 fill-rose-400' : 'text-slate-500'}`} />
                              </button>
                            </div>

                            {/* Footer: Priority, Calls & Audio, Avatar */}
                            <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                              <div
                                className="flex items-center gap-0.5 cursor-pointer"
                                title={`Priority: ${priorityRating} of 3. Click to adjust.`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {[1, 2, 3].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={(e) => handleTogglePriority(e, scammer, star)}
                                    className="text-xs hover:scale-110 transition px-0.5"
                                  >
                                    <span
                                      className={
                                        star <= priorityRating
                                          ? 'text-amber-400 font-semibold'
                                          : 'text-slate-700'
                                      }
                                    >
                                      ★
                                    </span>
                                  </button>
                                ))}
                              </div>

                              <div className="flex items-center gap-1.5 text-[13px]">
                                {hasAudio && (
                                  <span className="text-rose-400 flex items-center gap-0.5" title="Audio recording available">
                                    <Volume2 className="w-3 h-3" />
                                  </span>
                                )}
                                <span className="text-slate-400 font-mono">
                                  {scammer.calls?.length || 0} {(scammer.calls?.length || 0) === 1 ? 'call' : 'calls'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-semibold text-slate-300 flex items-center justify-center shrink-0"
                                  title={`Agent: ${scammer.user?.name || 'Assigned Agent'}`}
                                >
                                  {initials}
                                </div>

                                <div onClick={(e) => e.stopPropagation()}>
                                  <select
                                    value={toCanonicalStatus(scammer.status)}
                                    onChange={(e) =>
                                      onMovePipeline(scammer.id, e.target.value as PipelineStatus)
                                    }
                                    className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-[12px] text-slate-400 hover:text-white cursor-pointer focus:outline-none"
                                    title="Move stage"
                                  >
                                    <option value="New / Uncalled">New / Uncalled</option>
                                    <option value="Currently Baiting">Currently Baiting</option>
                                    <option value="Top Scams">Top Scams</option>
                                    <option value="Reported / Down">Reported / Down</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TABLE LIST VIEW */}
      {viewMode === 'list' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-xs font-semibold">
                <tr>
                  <th className="px-3.5 py-2.5">Target / Case</th>
                  <th className="px-3.5 py-2.5">Contact & Phone</th>
                  <th className="px-3.5 py-2.5">Stage</th>
                  <th className="px-3.5 py-2.5">Time Wasted</th>
                  <th className="px-3.5 py-2.5">Priority</th>
                  <th className="px-3.5 py-2.5">Scam Type</th>
                  <th className="px-3.5 py-2.5 text-right">Stage Move</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredScammers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                      No targets match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredScammers.map((scammer) => {
                    const canonical = toCanonicalStatus(scammer.status);
                    const priorityRating = scammer.priority || 1;

                    return (
                      <tr
                        key={scammer.id}
                        onClick={() => {
                          onSelectScammer(scammer);
                        }}
                        className="hover:bg-slate-800/40 cursor-pointer transition"
                      >
                        <td className="px-3.5 py-2.5">
                          <div className="font-semibold text-slate-100 hover:text-amber-300 transition flex items-center gap-1.5">
                            <span>{scammer.alias ? scammer.alias : scammer.fullName}</span>
                            {scammer.alias && (
                              <span className="text-[13px] text-slate-400 font-normal">
                                ({scammer.fullName})
                              </span>
                            )}
                          </div>
                          {scammer.organization && (
                            <div className="text-[14px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Building className="w-3 h-3 text-slate-500" />
                              <span>{scammer.organization}</span>
                            </div>
                          )}
                        </td>

                        <td className="px-3.5 py-2.5 font-mono text-slate-300">
                          <div>{scammer.phoneNumber}</div>
                          {scammer.carrier && (
                            <div className="text-[13px] text-slate-400 truncate max-w-[140px]">
                              {scammer.carrier}
                            </div>
                          )}
                        </td>

                        <td className="px-3.5 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                              canonical === 'New / Uncalled'
                                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                : canonical === 'Currently Baiting'
                                ? 'bg-teal-500/15 text-teal-300 border-teal-500/30'
                                : canonical === 'Top Scams'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {canonical}
                          </span>
                        </td>

                        <td className="px-3.5 py-2.5 font-mono font-semibold text-amber-300" onClick={(e) => e.stopPropagation()}>
                          {editingTimeScammerId === scammer.id ? (
                            <div
                              className="flex items-center gap-1 bg-slate-900 border border-amber-500 rounded px-1.5 py-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                              <div className="flex items-center gap-0.5 text-xs font-mono font-semibold text-white">
                                <input
                                  type="number"
                                  min="0"
                                  value={editingTimeHours}
                                  onChange={(e) => setEditingTimeHours(e.target.value)}
                                  onBlur={() => handleCommitTimeEdit(scammer.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCommitTimeEdit(scammer.id);
                                    if (e.key === 'Escape') setEditingTimeScammerId(null);
                                  }}
                                  autoFocus
                                  className="w-6 bg-slate-950 border border-slate-700 rounded text-center text-amber-300 font-semibold px-0.5 focus:outline-none"
                                  title="Hours"
                                />
                                <span className="text-[13px] text-slate-400">h</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={editingTimeMinutes}
                                  onChange={(e) => setEditingTimeMinutes(e.target.value)}
                                  onBlur={() => handleCommitTimeEdit(scammer.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCommitTimeEdit(scammer.id);
                                    if (e.key === 'Escape') setEditingTimeScammerId(null);
                                  }}
                                  className="w-6 bg-slate-950 border border-slate-700 rounded text-center text-amber-300 font-semibold px-0.5 focus:outline-none"
                                  title="Minutes"
                                />
                                <span className="text-[13px] text-slate-400">m</span>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleStartTimeEdit(e, scammer)}
                              className="flex items-center gap-1 hover:text-amber-200 hover:bg-amber-950/40 px-1.5 py-0.5 rounded transition cursor-pointer"
                              title="Click to quick edit time wasted"
                            >
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>{formatDuration(scammer.totalTimeSpent || 0)}</span>
                            </button>
                          )}
                        </td>

                        <td className="px-3.5 py-2.5">
                          <div
                            className="flex items-center gap-1.5 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={(e) => handleTogglePriority(e, scammer, star)}
                                  className="text-xs hover:scale-110 transition px-0.5"
                                  title={`Set priority to ${star} stars`}
                                >
                                  <span
                                    className={
                                      star <= priorityRating
                                        ? 'text-amber-400 font-semibold'
                                        : 'text-slate-700'
                                    }
                                  >
                                    ★
                                  </span>
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleToggleFlagged(e, scammer)}
                              title={scammer.flagged ? "Flagged" : "Click to flag"}
                              className={`p-1 rounded transition ${
                                scammer.flagged ? 'text-rose-400 bg-rose-500/20' : 'text-slate-600 hover:text-slate-300'
                              }`}
                            >
                              <Flag className={`w-3 h-3 ${scammer.flagged ? 'fill-rose-400' : ''}`} />
                            </button>
                          </div>
                        </td>

                        <td className="px-3.5 py-2.5 text-slate-300 font-normal">
                          {scammer.scamType || 'Tech / Refund'}
                        </td>

                        <td className="px-3.5 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={canonical}
                            onChange={(e) =>
                              onMovePipeline(scammer.id, e.target.value as PipelineStatus)
                            }
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 cursor-pointer focus:outline-none"
                          >
                            <option value="New / Uncalled">New / Uncalled</option>
                            <option value="Currently Baiting">Currently Baiting</option>
                            <option value="Top Scams">Top Scams</option>
                            <option value="Reported / Down">Reported / Down</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(newScammers) => {
          if (onBulkImportSuccess) {
            onBulkImportSuccess(newScammers);
          }
          setExportNotice(`Successfully imported ${newScammers.length} new cases from CSV`);
          setTimeout(() => setExportNotice(null), 4000);
        }}
      />
    </div>
  );
};
