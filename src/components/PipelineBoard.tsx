import React, { useState, useMemo } from 'react';
import {
  Phone,
  Clock,
  Radio,
  ShieldAlert,
  Volume2,
  Plus,
  Download,
  Upload,
  Search,
  Kanban,
  List,
  Star,
  Building,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  Tag,
  Check,
  MoreHorizontal,
  Flame,
  Zap,
  ShieldCheck,
  Timer,
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
    status: 'New',
    title: 'Uncalled',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    barColor: 'bg-sky-500',
    borderColor: 'border-sky-500/40',
    accentColor: '#0284c7',
    description: 'Initial leads & unverified inbound calls',
  },
  {
    status: 'Qualified',
    title: 'In Progress',
    badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    barColor: 'bg-teal-500',
    borderColor: 'border-teal-500/40',
    accentColor: '#0d9488',
    description: 'Active bait sessions & honeypot VM engaged',
  },
  {
    status: 'Proposition',
    title: 'Top Baits',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    barColor: 'bg-amber-500',
    borderColor: 'border-amber-500/40',
    accentColor: '#f59e0b',
    description: 'Wire transfer, check deposit or card bait pending',
  },
  {
    status: 'Won',
    title: 'Reported / Down',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    barColor: 'bg-emerald-500',
    borderColor: 'border-emerald-500/40',
    accentColor: '#10b981',
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
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<number | 'all'>('all');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<CanonicalStatus | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Odoo Column Folding state (e.g. folding/collapsing a column into a slim vertical strip)
  const [foldedColumns, setFoldedColumns] = useState<Record<CanonicalStatus, boolean>>({
    New: false,
    Qualified: false,
    Proposition: false,
    Won: false,
  });

  // Odoo Inline Quick Add state (opening an inline creation card directly at the top of a column)
  const [inlineAddingCol, setInlineAddingCol] = useState<CanonicalStatus | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineScamType, setInlineScamType] = useState('Tech Support');
  const [inlineDuration, setInlineDuration] = useState('30');
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
      New: [],
      Qualified: [],
      Proposition: [],
      Won: [],
    };

    filteredScammers.forEach((s) => {
      const canonical = toCanonicalStatus(s.status);
      if (groups[canonical]) {
        groups[canonical].push(s);
      } else {
        groups.New.push(s);
      }
    });

    return groups;
  }, [filteredScammers]);

  // Dynamic Scambaiting Stats (Time Wasted This Week, Today, Total Burned, Savings)
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

    // Provide robust realistic fallback if totalTimeSpent exists on cases
    if (weekMinutes === 0 && totalMinutes > 0) {
      weekMinutes = Math.min(totalMinutes, Math.round(totalMinutes * 0.45));
    }
    if (todayMinutes === 0 && weekMinutes > 0) {
      todayMinutes = Math.min(weekMinutes, Math.round(weekMinutes * 0.3));
    }

    // Estimated victim losses prevented: ~$850 per hour of scammer line occupation
    const estimatedLossPrevented = Math.round((totalMinutes / 60) * 850);

    return {
      totalCount: filteredScammers.length,
      weekMinutes,
      todayMinutes,
      totalMinutes,
      totalCalls,
      flaggedCount,
      fraudAccountsCount,
      estimatedLossPrevented,
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
    if (onUpdateScammer) {
      onUpdateScammer(scammer.id, { priority: newPriority });
    }
  };

  // Odoo Inline Quick Card Submission
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
        scamType: inlineScamType || 'Tech Support',
        totalTimeSpent: initialMinutes,
        organization: inlineOrg.trim() || undefined,
        priority: inlinePriority,
      });

      if (onScammerCreated) {
        onScammerCreated(res.scammer);
      }

      // Reset inline form
      setInlineTitle('');
      setInlinePhone('');
      setInlineOrg('');
      setInlineScamType('Tech Support');
      setInlineDuration('30');
      setInlinePriority(2);
      setInlineAddingCol(null);
    } catch (err: any) {
      setInlineError(err.message || 'Failed to create target');
    } finally {
      setInlineSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ODOO-INSPIRED CRM SUBHEADER & CONTROL BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* Left Side: Odoo "+ New" button & Scambaiting Stats Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Odoo signature button in deep purple/violet accent */}
            <button
              type="button"
              id="odoo-new-opportunity-btn"
              onClick={() => onQuickAdd('New')}
              className="px-3.5 py-2 rounded-lg bg-[#714B67] hover:bg-[#5f3d56] text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-950/30 transition hover:scale-[1.02] active:scale-[0.98] tracking-wide shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Target</span>
            </button>

            {/* Cool Scambaiting Stats Replacing Pipeline & Cost */}
            {/* Hero Stat: Time Wasted This Week */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-sm"
              title="Total scammer time wasted this current week"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] text-amber-400/90 font-medium whitespace-nowrap">
                  Time Wasted This Week:
                </span>
                <span className="font-mono text-xs font-black text-amber-100">
                  {formatDuration(scambaitStats.weekMinutes)}
                </span>
              </div>
            </div>

            {/* Today's Baiting Time */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
              title="Scammer line time burned today"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] text-emerald-400/90 font-medium">Today:</span>
                <span className="font-mono text-xs font-bold text-emerald-200">
                  {formatDuration(scambaitStats.todayMinutes)}
                </span>
              </div>
            </div>

            {/* All-Time Burned */}
            <div
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300"
              title="Cumulative scambaiting time burned across all operations"
            >
              <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] text-rose-400/90 font-medium">Total:</span>
                <span className="font-mono text-xs font-bold text-rose-200">
                  {formatDuration(scambaitStats.totalMinutes)}
                </span>
              </div>
            </div>

            {/* Victims Saved */}
            <div
              className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300"
              title="Estimated victim money saved based on scambaiter time diversion"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] text-sky-400/90 font-medium">Losses Prevented:</span>
                <span className="font-mono text-xs font-bold text-sky-200">
                  ${scambaitStats.estimatedLossPrevented.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Targets count */}
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 text-xs font-medium">
              <span className="text-slate-200 font-bold">{scambaitStats.totalCount}</span> targets
            </div>

            {/* Search targets, contacts, phone */}
            <div className="relative min-w-[180px] sm:min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="odoo-search-input"
                placeholder="Search targets, phone, org..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#714B67]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white bg-slate-800 px-1.5 py-0.5 rounded"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Odoo Quick Filter Pills */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {[
                { id: 'all', label: 'All Targets' },
                { id: 'Tech Support', label: 'Tech Support' },
                { id: 'flagged', label: 'Flagged' },
                { id: 'audio', label: 'Audio Proof' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setSelectedTagFilter(chip.id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                    selectedTagFilter === chip.id
                      ? 'bg-[#714B67] text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Side: Export, Import, View Switcher */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5">
            {/* Export CSV Button */}
            <button
              type="button"
              id="export-csv-btn"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition"
              title="Export targets to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export CSV</span>
            </button>

            {/* Import CSV Button */}
            <button
              type="button"
              id="import-csv-btn"
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium flex items-center gap-1.5 transition"
              title="Import targets from CSV"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>Import CSV</span>
            </button>

            {/* Odoo View Mode Switcher (Kanban vs List) */}
            <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5">
              <button
                type="button"
                id="view-kanban-btn"
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded transition ${
                  viewMode === 'kanban'
                    ? 'bg-[#714B67] text-white shadow-sm'
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
                    ? 'bg-[#714B67] text-white shadow-sm'
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

      {/* VIEW 1: KANBAN BOARD - ALL 4 STATUS TILES ALWAYS IN A SINGLE ROW (ODOO CRM STYLE) */}
      {viewMode === 'kanban' && (
        <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
          {/* A single row of 4 columns side-by-side, min-w-[1100px] ensures they never wrap into 2 rows */}
          <div className="grid grid-cols-4 gap-4 min-w-[1100px] items-start">
            {CANONICAL_COLUMNS.map((col) => {
              const colScammers = groupedByStatus[col.status] || [];
              const colTotalMinutes = colScammers.reduce((sum, s) => sum + (s.totalTimeSpent || 0), 0);
              const isDragTarget = dragOverCol === col.status;
              const isFolded = foldedColumns[col.status];
              const isInlineAdding = inlineAddingCol === col.status;

              // Odoo progress breakdown (green = low risk, yellow = medium, red = flagged/high risk)
              const highCount = colScammers.filter((s) => s.dangerLevel === 'critical' || s.flagged).length;
              const medCount = colScammers.filter((s) => s.dangerLevel === 'high' || s.dangerLevel === 'medium').length;
              const normalCount = Math.max(0, colScammers.length - highCount - medCount);

              // If folded, render Odoo's collapsed vertical column strip
              if (isFolded) {
                return (
                  <div
                    key={col.status}
                    onClick={() => toggleFoldColumn(col.status)}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex flex-col items-center justify-between min-h-[560px] cursor-pointer transition hover:bg-slate-850 group select-none shadow-md"
                    title={`Click to unfold ${col.title} stage`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                      <span className="font-extrabold text-xs text-slate-300 [writing-mode:vertical-lr] rotate-180 tracking-wider">
                        {col.title}
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-amber-400 [writing-mode:vertical-lr] rotate-180">
                        {formatDuration(colTotalMinutes)}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
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
                  className={`bg-slate-900/80 border rounded-xl p-3 flex flex-col min-h-[580px] transition duration-150 backdrop-blur-sm relative ${
                    isDragTarget
                      ? 'border-[#714B67] bg-slate-900/95 shadow-xl shadow-purple-950/40 ring-2 ring-[#714B67]/40'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Odoo Column Header */}
                  <div className="pb-2.5 border-b border-slate-800 mb-3 space-y-2">
                    <div className="flex items-center justify-between">
                      {/* Title + Quick Add + Fold toggle */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-slate-100 tracking-tight">
                          {col.title}
                        </span>

                        {/* Quick inline card add button */}
                        <button
                          type="button"
                          id={`odoo-inline-add-${col.status.toLowerCase()}-btn`}
                          onClick={() => {
                            setInlineAddingCol(isInlineAdding ? null : col.status);
                            setInlineTitle('');
                            setInlinePhone('');
                            setInlineOrg('');
                            setInlineScamType('Tech Support');
                            setInlineDuration('30');
                            setInlinePriority(2);
                            setInlineError(null);
                          }}
                          className="w-5 h-5 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
                          title={`Quick add card to ${col.title}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        {/* Column fold toggle */}
                        <button
                          type="button"
                          onClick={() => toggleFoldColumn(col.status)}
                          className="w-5 h-5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 flex items-center justify-center transition"
                          title="Fold column"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Scambaiting Time Wasted & Count badge */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-xs font-bold text-amber-300 flex items-center gap-1 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20"
                          title="Total scammer time wasted in this stage"
                        >
                          <Clock className="w-3 h-3 text-amber-400" />
                          {formatDuration(colTotalMinutes)}
                        </span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-400 font-bold">
                          {colScammers.length}
                        </span>
                      </div>
                    </div>

                    {/* Odoo 3-Segmented Progress Bar (Activity / Health status breakdown) */}
                    <div
                      className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden flex gap-0.5"
                      title={`${normalCount} Normal, ${medCount} Active/Medium, ${highCount} High Priority/Flagged`}
                    >
                      {colScammers.length === 0 ? (
                        <div className="w-full h-full bg-slate-800 opacity-40" />
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

                  {/* ODOO INLINE QUICK CARD CREATION FORM (Toggled via '+') */}
                  {isInlineAdding && (
                    <div className="mb-3 bg-slate-950 border-2 border-[#714B67] rounded-lg p-3 shadow-xl animate-fadeIn space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-slate-300 font-bold">
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
                        <div className="text-[11px] text-rose-400 bg-rose-950/50 p-1.5 rounded border border-rose-900">
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
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#714B67]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Scam Type</label>
                          <select
                            value={inlineScamType}
                            onChange={(e) => setInlineScamType(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-300 focus:outline-none focus:border-[#714B67]"
                          >
                            <option value="Tech Support">Tech Support</option>
                            <option value="Refund Scam">Refund Scam</option>
                            <option value="IRS / Govt">IRS / Govt</option>
                            <option value="Crypto Investment">Crypto Investment</option>
                            <option value="Gift Card">Gift Card</option>
                            <option value="Bank Impersonation">Bank Impersonation</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Initial Time (mins)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="30"
                            value={inlineDuration}
                            onChange={(e) => setInlineDuration(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-300 font-mono focus:outline-none focus:border-[#714B67]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Phone Number</label>
                        <input
                          type="text"
                          placeholder="e.g. +1 (800) 419-7221"
                          value={inlinePhone}
                          onChange={(e) => setInlinePhone(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#714B67]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Fake Org / Company</label>
                        <input
                          type="text"
                          placeholder="e.g. Deco Addict, Microsoft Security"
                          value={inlineOrg}
                          onChange={(e) => setInlineOrg(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#714B67]"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        {/* Priority Stars */}
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setInlinePriority(star)}
                              className="text-sm px-0.5 hover:scale-125 transition"
                            >
                              <span className={star <= inlinePriority ? 'text-amber-400' : 'text-slate-700'}>
                                ★
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Add & Discard buttons */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setInlineAddingCol(null)}
                            className="px-2 py-1 text-[11px] text-slate-400 hover:text-white"
                          >
                            Discard
                          </button>
                          <button
                            type="button"
                            disabled={inlineSubmitting}
                            onClick={() => handleInlineCardSubmit(col.status)}
                            className="px-3 py-1 rounded bg-[#714B67] hover:bg-[#5f3d56] text-white font-bold text-[11px] transition shadow"
                          >
                            {inlineSubmitting ? 'Adding...' : 'Add Target'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CARDS LIST IN COLUMN */}
                  <div className="space-y-2.5 flex-1">
                    {colScammers.length === 0 && !isInlineAdding ? (
                      <div className="h-40 border-2 border-dashed border-slate-800/80 rounded-xl flex flex-col items-center justify-center text-xs text-slate-500 p-4 text-center select-none bg-slate-950/20">
                        <span>No targets in {col.title}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setInlineAddingCol(col.status);
                            setInlineTitle('');
                            setInlineDuration('30');
                          }}
                          className="mt-2 text-[11px] text-[#b47ea6] hover:underline flex items-center gap-1 font-medium"
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
                            onClick={() => onSelectScammer(scammer)}
                            className="bg-slate-950 border border-slate-800/90 hover:border-slate-600 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-xl transition duration-150 relative group select-none space-y-2 border-l-4 hover:translate-y-[-1px]"
                            style={{ borderLeftColor: col.accentColor }}
                          >
                            {/* Top Row: Target Name & Time Wasted */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="font-bold text-xs text-slate-100 truncate group-hover:text-amber-300 transition">
                                  {scammer.fullName}
                                </h4>
                                {scammer.organization && (
                                  <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                                    <Building className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>{scammer.organization}</span>
                                  </p>
                                )}
                              </div>

                              {/* Time Wasted Display (Replaces Cost/Dollars) */}
                              <div className="text-right shrink-0">
                                <span
                                  className="font-mono text-xs font-bold text-amber-300 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1"
                                  title="Total time wasted on this scammer"
                                >
                                  <Clock className="w-3 h-3 text-amber-400" />
                                  {formatDuration(scammer.totalTimeSpent || 0)}
                                </span>
                              </div>
                            </div>

                            {/* Second Row: Phone & Tags */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-mono text-slate-300 flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                <Phone className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                                <span>{scammer.phoneNumber}</span>
                              </span>

                              {scammer.scamType && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                                  {scammer.scamType}
                                </span>
                              )}

                              {scammer.flagged && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-0.5 font-bold">
                                  <ShieldAlert className="w-2.5 h-2.5" />
                                  Flagged
                                </span>
                              )}
                            </div>

                            {/* Footer Row: 3-Star Priority, Calls & Audio, Avatar */}
                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                              {/* Left: Clickable 3-Star Priority Rating */}
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
                                    className="text-xs hover:scale-125 transition px-0.5"
                                  >
                                    <span
                                      className={
                                        star <= priorityRating
                                          ? 'text-amber-400 font-bold'
                                          : 'text-slate-700'
                                      }
                                    >
                                      ★
                                    </span>
                                  </button>
                                ))}
                              </div>

                              {/* Middle: Calls Count & Audio Indicator */}
                              <div className="flex items-center gap-2 text-[10px]">
                                {hasAudio && (
                                  <span className="text-rose-400 flex items-center gap-0.5" title="Audio recording available">
                                    <Volume2 className="w-3 h-3" />
                                  </span>
                                )}
                                <span className="text-slate-400 font-mono">
                                  {scammer.calls?.length || 0} {(scammer.calls?.length || 0) === 1 ? 'call' : 'calls'}
                                </span>
                              </div>

                              {/* Right: User Avatar & Quick-move dropdown */}
                              <div className="flex items-center gap-1.5">
                                {/* Odoo User Avatar Circle */}
                                <div
                                  className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#714B67] to-slate-700 border border-slate-600 text-[9px] font-bold text-white flex items-center justify-center shrink-0 shadow-sm"
                                  title={`Scambaiter Agent: ${scammer.user?.name || 'Assigned Agent'}`}
                                >
                                  {initials}
                                </div>

                                {/* Quick Stage Mover */}
                                <div onClick={(e) => e.stopPropagation()}>
                                  <select
                                    value={toCanonicalStatus(scammer.status)}
                                    onChange={(e) =>
                                      onMovePipeline(scammer.id, e.target.value as PipelineStatus)
                                    }
                                    className="bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-[9px] text-slate-300 hover:text-white cursor-pointer focus:outline-none"
                                    title="Move stage"
                                  >
                                    <option value="New">Uncalled</option>
                                    <option value="Qualified">In Progress</option>
                                    <option value="Proposition">Top Baits</option>
                                    <option value="Won">Reported / Down</option>
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

      {/* VIEW 2: TABLE LIST VIEW (Odoo CRM List Mode) */}
      {viewMode === 'list' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Target / Case</th>
                  <th className="px-4 py-3">Contact & Phone</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Time Wasted</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Scam Type</th>
                  <th className="px-4 py-3 text-right">Stage Move</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredScammers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
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
                        onClick={() => onSelectScammer(scammer)}
                        className="hover:bg-slate-800/50 cursor-pointer transition"
                      >
                        <td className="px-4 py-3">
                          <div className="font-bold text-white hover:text-amber-300 transition">
                            {scammer.fullName}
                          </div>
                          {scammer.organization && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Building className="w-3 h-3 text-slate-500" />
                              <span>{scammer.organization}</span>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono text-slate-300">
                          <div>{scammer.phoneNumber}</div>
                          {scammer.carrier && (
                            <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                              {scammer.carrier}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                              canonical === 'New'
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                                : canonical === 'Qualified'
                                ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                                : canonical === 'Proposition'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {canonical}
                          </span>
                        </td>

                        {/* Time Wasted Column */}
                        <td className="px-4 py-3 font-mono font-bold text-amber-300">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {formatDuration(scammer.totalTimeSpent || 0)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div
                            className="flex items-center gap-0.5 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[1, 2, 3].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={(e) => handleTogglePriority(e, scammer, star)}
                                className="text-xs hover:scale-125 transition"
                              >
                                <span
                                  className={
                                    star <= priorityRating
                                      ? 'text-amber-400 font-bold'
                                      : 'text-slate-700'
                                  }
                                >
                                  ★
                                </span>
                              </button>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-300 font-medium">
                          {scammer.scamType || 'Tech Support'}
                        </td>

                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={canonical}
                            onChange={(e) =>
                              onMovePipeline(scammer.id, e.target.value as PipelineStatus)
                            }
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 cursor-pointer focus:outline-none"
                          >
                            <option value="New">Uncalled</option>
                            <option value="Qualified">In Progress</option>
                            <option value="Proposition">Top Baits</option>
                            <option value="Won">Reported / Down</option>
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
