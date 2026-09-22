import React, { useState } from 'react';
import {
  X,
  Phone,
  Clock,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Upload,
  Plus,
  Trash2,
  Edit2,
  Check,
  Radio,
  MessageSquare,
  DollarSign,
  Copy,
  Calendar,
  Building,
  Globe,
  MessageCircle,
  ArrowLeft,
  Flag,
  Image as ImageIcon,
  FileAudio,
  Eye,
  Edit3,
  Play,
  Volume2,
} from 'lucide-react';
import { api, getStoredUser } from '../api.ts';
import { AudioPlayerWidget } from './AudioPlayerWidget.tsx';
import type { Scammer, PipelineStatus, User, FraudAccount } from '../types.ts';

interface EvidenceMediaItem {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'audio';
  fileType: string;
  sizeBytes: number;
  uploadedAt: string;
}

interface ScammerDetailModalProps {
  scammer: Scammer;
  isOpen: boolean;
  isStandalone?: boolean;
  onClose: () => void;
  onUpdateScammer: (updated: Scammer) => void;
  onDeleteScammer: (id: string) => void;
  currentUser?: User | null;
}

export const ScammerDetailModal: React.FC<ScammerDetailModalProps> = ({
  scammer,
  isOpen,
  isStandalone = false,
  onClose,
  onUpdateScammer,
  onDeleteScammer,
  currentUser,
}) => {
  // Fields state
  const [fullName, setFullName] = useState(scammer.fullName);
  const [alias, setAlias] = useState(scammer.alias || '');
  const [status, setStatus] = useState<PipelineStatus>(scammer.status);
  const [flagged, setFlagged] = useState<boolean>(scammer.flagged);
  const [dangerLevel, setDangerLevel] = useState(scammer.dangerLevel || 'medium');
  const [targetValue, setTargetValue] = useState<number>(scammer.targetValue || 0);
  const [priority, setPriority] = useState<number>(scammer.priority || 1);
  const [carrier, setCarrier] = useState(scammer.carrier || '');
  const [location, setLocation] = useState(scammer.location || '');
  const [scamType, setScamType] = useState(scammer.scamType || 'Tech / Refund');
  const [organization, setOrganization] = useState(scammer.organization || '');
  const [remoteAccessId, setRemoteAccessId] = useState(scammer.remoteAccessId || '');
  const [ipAddress, setIpAddress] = useState(scammer.ipAddress || '');
  const [notes, setNotes] = useState(scammer.notes || '');

  // Phone Numbers (up to 4) & WhatsApp
  const initialPhones =
    Array.isArray(scammer.phoneNumbers) && scammer.phoneNumbers.length > 0
      ? scammer.phoneNumbers
      : [scammer.phoneNumber];

  const [phoneList, setPhoneList] = useState<string[]>(() => {
    const list = [...initialPhones];
    while (list.length < 4) list.push('');
    return list.slice(0, 4);
  });

  const [whatsappNumber, setWhatsappNumber] = useState(scammer.whatsappNumber || '');

  // Quick Call Logger State (HH:MM:SS & Date Picker)
  const [loggerHours, setLoggerHours] = useState<number>(0);
  const [loggerMins, setLoggerMins] = useState<number>(0);
  const [loggerSecs, setLoggerSecs] = useState<number>(0);
  const [loggerDate, setLoggerDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [loggerNotes, setLoggerNotes] = useState('');
  const [loggerPersona, setLoggerPersona] = useState('');

  // Receiver Accounts / Reported Assets form
  const [showAddFraud, setShowAddFraud] = useState(false);
  const [fraudType, setFraudType] = useState('bank_account');
  const [fraudDetails, setFraudDetails] = useState('');
  const [fraudInstitution, setFraudInstitution] = useState('');
  const [fraudHolder, setFraudHolder] = useState('');

  // Evidence & Media State
  const [evidenceMedia, setEvidenceMedia] = useState<EvidenceMediaItem[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [editingMediaName, setEditingMediaName] = useState<string>('');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);

  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  // Save changes to scammer
  const handleSaveScammerInfo = async (fieldOverrides: Partial<Scammer> = {}) => {
    try {
      const activePhones = phoneList.map((p) => p.trim()).filter(Boolean);
      const primaryPhone = activePhones[0] || scammer.phoneNumber;

      const payload: Partial<Scammer> = {
        fullName: fullName.trim(),
        alias: alias.trim() || null,
        phoneNumber: primaryPhone,
        phoneNumbers: activePhones.length > 0 ? activePhones : [primaryPhone],
        whatsappNumber: whatsappNumber.trim() || null,
        status,
        flagged,
        dangerLevel,
        targetValue,
        priority,
        carrier,
        location,
        scamType,
        organization,
        remoteAccessId,
        ipAddress,
        notes,
        ...fieldOverrides,
      };
      const res = await api.updateScammer(scammer.id, payload);
      onUpdateScammer(res.scammer);
    } catch (err) {
      console.error('Save scammer error:', err);
    }
  };

  const handlePhoneChange = (index: number, val: string) => {
    const updated = [...phoneList];
    updated[index] = val;
    setPhoneList(updated);
  };

  // Status change handler
  const handleStatusChange = async (newStatus: PipelineStatus) => {
    setStatus(newStatus);
    await handleSaveScammerInfo({ status: newStatus });
  };

  // Flag toggle
  const handleToggleFlag = async () => {
    const nextFlag = !flagged;
    setFlagged(nextFlag);
    await handleSaveScammerInfo({ flagged: nextFlag });
  };

  // Quick Call Logger Submission
  const handleQuickLogCall = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const h = Math.max(0, Number(loggerHours) || 0);
    const m = Math.max(0, Number(loggerMins) || 0);
    const s = Math.max(0, Number(loggerSecs) || 0);

    const totalMinsCalculated = Math.round(h * 60 + m + s / 60);
    const durationMinutes = totalMinsCalculated > 0 ? totalMinsCalculated : 1;

    try {
      const res = await api.addCall(scammer.id, {
        durationMinutes,
        date: loggerDate ? new Date(loggerDate).toISOString() : new Date().toISOString(),
        notes: loggerNotes.trim() || undefined,
        victimPersonaUsed: loggerPersona.trim() || undefined,
      });

      const updatedCalls = [res.call, ...scammer.calls];
      const updatedScammer: Scammer = {
        ...scammer,
        calls: updatedCalls,
        totalTimeSpent: res.scammerTotalMinutes,
        todayTimeSpent: res.todayMinutes,
      };
      onUpdateScammer(updatedScammer);

      // Reset form
      setLoggerHours(0);
      setLoggerMins(0);
      setLoggerSecs(0);
      setLoggerNotes('');
      setLoggerPersona('');
      setLoggerDate(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error('Quick call log error:', err);
    }
  };

  // Delete Call
  const handleDeleteCall = async (callId: string) => {
    if (!confirm('Delete this call log record?')) return;
    try {
      const res = await api.deleteCall(scammer.id, callId);
      const updatedCalls = scammer.calls.filter((c) => c.id !== callId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayMinutes = updatedCalls
        .filter((c) => new Date(c.date) >= today)
        .reduce((sum, c) => sum + c.durationMinutes, 0);

      onUpdateScammer({
        ...scammer,
        calls: updatedCalls,
        totalTimeSpent: res.totalMinutes,
        todayTimeSpent: todayMinutes,
      });
    } catch (err) {
      console.error('Delete call error:', err);
    }
  };

  // Add Receiver Account / Asset
  const handleAddFraudAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fraudDetails.trim()) return;

    try {
      const res = await api.addFraudAccount(scammer.id, {
        accountType: fraudType,
        accountDetails: fraudDetails.trim(),
        institution: fraudInstitution.trim() || undefined,
        holderName: fraudHolder.trim() || undefined,
        reportedToBank: false,
      });

      const updatedAccounts = [res.account, ...(scammer.fraudAccounts || [])];
      onUpdateScammer({
        ...scammer,
        fraudAccounts: updatedAccounts,
      });

      setShowAddFraud(false);
      setFraudDetails('');
      setFraudInstitution('');
      setFraudHolder('');
    } catch (err) {
      console.error('Add fraud account error:', err);
    }
  };

  // Delete Fraud Account
  const handleDeleteFraudAccount = async (accId: string) => {
    try {
      await api.deleteFraudAccount(scammer.id, accId);
      const updated = scammer.fraudAccounts.filter((a) => a.id !== accId);
      onUpdateScammer({
        ...scammer,
        fraudAccounts: updated,
      });
    } catch (err) {
      console.error('Delete fraud account error:', err);
    }
  };

  // Process Evidence & Media File (Image & Audio with 3MB Limit, Admin Exempt)
  const processMediaFile = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isAudio = file.type.startsWith('audio/');

    if (!isImage && !isAudio) {
      setMediaError('Only image (.png, .jpg, .webp, .gif) and audio (.mp3, .wav, .m4a, .webm) files are supported.');
      return;
    }

    const userEmail = (currentUser?.email || getStoredUser()?.email || '').toLowerCase().trim();
    const isAdminExempt = userEmail === 'cookiescambait@gmail.com';
    const maxBytes = 3 * 1024 * 1024; // 3MB

    if (file.size > maxBytes && !isAdminExempt) {
      setMediaError(
        `File "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(
          1
        )}MB. Maximum size is 3MB. Admin account cookiescambait@gmail.com is exempt.`
      );
      return;
    }

    setMediaError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newItem: EvidenceMediaItem = {
        id: crypto.randomUUID(),
        name: file.name,
        url: dataUrl,
        type: isImage ? 'image' : 'audio',
        fileType: file.type,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      };
      setEvidenceMedia((prev) => [newItem, ...prev]);
    };
    reader.readAsDataURL(file);
  };

  // Drag & drop handlers for Evidence Media
  const handleMediaDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMedia(true);
  };

  const handleMediaDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMedia(false);
  };

  const handleMediaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMedia(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        processMediaFile(files[i]);
      }
    }
  };

  // Clipboard Paste Handler for Media
  const handleMediaPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && (file.type.startsWith('image/') || file.type.startsWith('audio/'))) {
          e.preventDefault();
          processMediaFile(file);
        }
      }
    }
  };

  // Save renamed media asset
  const handleSaveMediaName = (id: string) => {
    if (!editingMediaName.trim()) return;
    setEvidenceMedia((prev) =>
      prev.map((m) => (m.id === id ? { ...m, name: editingMediaName.trim() } : m))
    );
    setEditingMediaId(null);
    setEditingMediaName('');
  };

  // Delete media asset
  const handleDeleteMedia = (id: string) => {
    setEvidenceMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const formatAccountTypeLabel = (type: string) => {
    if (type === 'phone_website' || type === 'gift_card') return 'Phone / Website';
    if (type === 'bank_account') return 'Bank Account';
    if (type === 'crypto_wallet') return 'Crypto Wallet';
    if (type === 'zelle') return 'Zelle Recipient';
    if (type === 'wire') return 'Wire Details';
    if (type === 'whatsapp') return 'WhatsApp';
    return type.replace(/_/g, ' ');
  };

  // Dynamic Call Log Stats Calculation
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todayMinutes = scammer.calls
    ? scammer.calls
        .filter((c) => new Date(c.date) >= startOfToday)
        .reduce((sum, c) => sum + (c.durationMinutes || 0), 0)
    : 0;

  const totalMinutes = scammer.calls
    ? scammer.calls.reduce((sum, c) => sum + (c.durationMinutes || 0), 0)
    : scammer.totalTimeSpent || 0;

  const totalCallsCount = scammer.calls ? scammer.calls.length : 0;
  const amountWastedDollars = Math.round((totalMinutes / 60) * 850);

  const formatDurationDisplay = (mins: number) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col p-2 sm:p-3 gap-2.5 overflow-hidden antialiased">
      {/* Navigation Top Header Bar */}
      <header className="bg-slate-900/90 border border-slate-800/90 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-slate-700/80"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Pipeline</span>
          </button>

          <div className="h-5 w-px bg-slate-800 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                flagged
                  ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Flag className={`w-4 h-4 ${flagged ? 'text-rose-400 fill-rose-400' : ''}`} />
            </div>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => handleSaveScammerInfo()}
              className="text-sm sm:text-base font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-rose-500 focus:outline-none tracking-tight"
            />
            {scammer.alias && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono border border-slate-700 hidden sm:inline-block">
                &quot;{scammer.alias}&quot;
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 font-mono">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-emerald-400 font-bold">{todayMinutes}m Today</span>
            <span className="text-slate-600">|</span>
            <span>{totalMinutes}m Total</span>
          </div>

          <button
            type="button"
            onClick={() => copyToClipboard(`${window.location.origin}/share/${scammer.id}`)}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border bg-slate-800 text-slate-200 border-slate-700 hover:text-white"
          >
            <Copy className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{copySuccess ? 'Copied!' : 'Share Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleFlag}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
              flagged
                ? 'bg-rose-600/20 text-rose-300 border-rose-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <Flag className={`w-3.5 h-3.5 ${flagged ? 'text-rose-400 fill-rose-400' : ''}`} />
            <span className="hidden sm:inline">{flagged ? 'Flagged' : 'Flag Target'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete scammer target ${scammer.fullName}?`)) {
                onDeleteScammer(scammer.id);
                onClose();
              }
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
            title="Delete Target Case"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Single-Page 3-Column Scroll-less Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 items-stretch">
        {/* COLUMN 1 (Col Span 3.5): Quick Call Logger, Stats Grid & Call Logs List */}
        <div className="lg:col-span-4 flex flex-col gap-2 shadow">
          {/* Box 1: Quick Call Logger (HH:MM:SS + Date Picker + Add Button) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-2 shadow">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Call Logger
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">Manual Entry</span>
            </div>

            <form onSubmit={handleQuickLogCall} className="space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-1.5">
                {/* HH */}
                <div>
                  <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Hours (HH)</label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={loggerHours}
                    onChange={(e) => setLoggerHours(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
                  />
                </div>

                {/* MM */}
                <div>
                  <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Mins (MM)</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={loggerMins}
                    onChange={(e) => setLoggerMins(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
                  />
                </div>

                {/* SS */}
                <div>
                  <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Secs (SS)</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={loggerSecs}
                    onChange={(e) => setLoggerSecs(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {/* Date Picker */}
                <div>
                  <label className="block text-[9px] font-semibold text-slate-400 mb-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-400" />
                    Call Date
                  </label>
                  <input
                    type="date"
                    value={loggerDate}
                    onChange={(e) => setLoggerDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 cursor-pointer"
                  />
                </div>

                {/* Persona */}
                <div>
                  <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Persona / Notes</label>
                  <input
                    type="text"
                    placeholder="Grandma Gertrude"
                    value={loggerNotes}
                    onChange={(e) => setLoggerNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Call Entry</span>
              </button>
            </form>
          </div>

          {/* Box 2: Stats Grid with Amount Wasted ($) */}
          <div className="grid grid-cols-4 gap-1.5 bg-slate-900/90 border border-slate-800 rounded-xl p-2 shadow text-center">
            <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
              <p className="text-[9px] text-slate-400 font-semibold uppercase">Today</p>
              <p className="text-xs font-bold text-emerald-400 mt-0.5">{formatDurationDisplay(todayMinutes)}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
              <p className="text-[9px] text-slate-400 font-semibold uppercase">Wasted</p>
              <p className="text-xs font-bold text-amber-300 mt-0.5">{formatDurationDisplay(totalMinutes)}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
              <p className="text-[9px] text-slate-400 font-semibold uppercase">Calls</p>
              <p className="text-xs font-bold text-sky-400 mt-0.5">{totalCallsCount}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
              <p className="text-[9px] text-slate-400 font-semibold uppercase">Amt Wasted</p>
              <p className="text-xs font-bold text-rose-400 mt-0.5">${amountWastedDollars.toLocaleString()}</p>
            </div>
          </div>

          {/* Box 3: Call Logs List (Moved to Column 1 bottom as per P4) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col flex-1 shadow min-h-[180px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Call Logs ({totalCallsCount})
                </h3>
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[220px] flex-1 pr-1">
              {totalCallsCount === 0 ? (
                <div className="text-center py-6 bg-slate-950/50 rounded-lg border border-slate-800 text-slate-400 text-[11px] p-3">
                  No call logs recorded yet. Use the Call Logger above to record call sessions.
                </div>
              ) : (
                scammer.calls.map((call) => (
                  <div
                    key={call.id}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-1 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold font-mono text-[10px] border border-rose-500/30">
                          {call.durationMinutes}m
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(call.date).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        {call.victimPersonaUsed && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800 truncate max-w-[100px]">
                            {call.victimPersonaUsed}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteCall(call.id)}
                        className="text-slate-500 hover:text-rose-400 p-0.5"
                        title="Delete call"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    {call.notes && (
                      <p className="text-[11px] text-slate-300 leading-snug">{call.notes}</p>
                    )}

                    {call.audioRecordingUrl && (
                      <AudioPlayerWidget
                        audioUrl={call.audioRecordingUrl}
                        audioName={call.audioRecordingName}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2 (Col Span 4.5): Phone Numbers, WhatsApp & Case Dossier Profile */}
        <div className="lg:col-span-4 flex flex-col gap-2.5">
          {/* Phone Numbers & WhatsApp Intel */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 shadow">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Phone Numbers &amp; WhatsApp Intel
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">4 Phones + 1 WhatsApp</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx}>
                  <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">
                    Phone #{idx + 1} {idx === 0 ? '(Primary)' : ''}
                  </label>
                  <input
                    type="text"
                    placeholder={`e.g. +1 (800) 555-010${idx + 1}`}
                    value={phoneList[idx]}
                    onChange={(e) => handlePhoneChange(idx, e.target.value)}
                    onBlur={() => handleSaveScammerInfo()}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5 flex items-center gap-1">
                  <MessageCircle className="w-3 h-3 text-emerald-400" />
                  WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="e.g. +1 800 555 9988"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-emerald-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Carrier / VoIP</label>
                <input
                  type="text"
                  placeholder="e.g. TextNow"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Location</label>
                <input
                  type="text"
                  placeholder="e.g. Kolkata"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Case Profile & Dossier Details */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col flex-1 space-y-2 shadow">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Case Profile &amp; Details
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Pipeline Stage</label>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as PipelineStatus)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-semibold"
                >
                  <option value="New / Uncalled">1. New / Uncalled</option>
                  <option value="Currently Baiting">2. Currently Baiting</option>
                  <option value="Top Scams">3. Top Scams</option>
                  <option value="Reported / Down">4. Reported / Down</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Target Deal / Fraud ($)</label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={targetValue}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setTargetValue(val);
                    handleSaveScammerInfo({ targetValue: val });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-emerald-400 font-mono font-bold"
                  placeholder="e.g. 4500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Scam Type</label>
                <select
                  value={scamType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScamType(val);
                    handleSaveScammerInfo({ scamType: val });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-amber-300"
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
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Fake Organization</label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  placeholder="e.g. Geek Squad"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Priority Rating</label>
                <div className="flex items-center gap-1 h-6 px-2 bg-slate-950 border border-slate-800 rounded-lg">
                  {[1, 2, 3].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => {
                        setPriority(star);
                        handleSaveScammerInfo({ priority: star });
                      }}
                      className="text-xs transition hover:scale-125"
                    >
                      <span className={star <= priority ? 'text-amber-400' : 'text-slate-700'}>★</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Scam Threat Level</label>
                <select
                  value={dangerLevel}
                  onChange={(e) => {
                    const val = e.target.value as any;
                    setDangerLevel(val);
                    handleSaveScammerInfo({ dangerLevel: val });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                >
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Threat</option>
                  <option value="critical">Critical Threat</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Remote Access ID</label>
                <input
                  type="text"
                  value={remoteAccessId}
                  onChange={(e) => setRemoteAccessId(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  placeholder="AnyDesk or UltraViewer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">Logged Scammer IP</label>
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  placeholder="Grabify or connection IP"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* General Notes */}
            <div className="flex-1 flex flex-col">
              <label className="block text-[9px] font-semibold text-slate-400 mb-0.5">
                General Operations Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => handleSaveScammerInfo()}
                placeholder="Behavioral traits, background noise, fake data fed during bait..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white flex-1 min-h-[45px] leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* COLUMN 3 (Col Span 4): Receiver Assets & Evidence & Media */}
        <div className="lg:col-span-4 flex flex-col gap-2.5">
          {/* Receiver Assets / Reported Assets (Moved to Column 3 as per P4) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col shadow">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-rose-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Receiver Assets ({scammer.fraudAccounts.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFraud(!showAddFraud)}
                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold flex items-center gap-1 transition shadow"
              >
                <Plus className="w-3 h-3" />
                {showAddFraud ? 'Close' : 'Add Asset'}
              </button>
            </div>

            {showAddFraud && (
              <form
                onSubmit={handleAddFraudAccount}
                className="bg-slate-950 border border-rose-500/40 rounded-xl p-2 mb-2 space-y-1.5 text-xs"
              >
                <div>
                  <label className="block text-[9px] font-medium text-slate-300 mb-0.5">Asset Type</label>
                  <select
                    value={fraudType}
                    onChange={(e) => setFraudType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="bank_account">Bank Account</option>
                    <option value="crypto_wallet">Crypto Wallet</option>
                    <option value="zelle">Zelle Recipient</option>
                    <option value="wire">Wire Transfer</option>
                    <option value="phone_website">Phone Number / Website</option>
                    <option value="whatsapp">WhatsApp Contact</option>
                    <option value="paypal">PayPal / CashApp</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-medium text-slate-300 mb-0.5">Details (Account / Phone / URL)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +1 (800) 555-0199 or Chase 12345678"
                    value={fraudDetails}
                    onChange={(e) => setFraudDetails(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[9px] font-medium text-slate-300 mb-0.5">Institution</label>
                    <input
                      type="text"
                      placeholder="e.g. Chase Bank"
                      value={fraudInstitution}
                      onChange={(e) => setFraudInstitution(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-medium text-slate-300 mb-0.5">Holder</label>
                    <input
                      type="text"
                      placeholder="e.g. Money Mule"
                      value={fraudHolder}
                      onChange={(e) => setFraudHolder(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddFraud(false)}
                    className="px-2 py-1 text-[11px] text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-[11px] font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded transition"
                  >
                    Save Asset
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-1.5 overflow-y-auto max-h-[160px] flex-1 pr-1">
              {scammer.fraudAccounts.length === 0 ? (
                <div className="text-center py-4 bg-slate-950/50 rounded-lg border border-slate-800 text-slate-400 text-[11px] p-2">
                  No receiver assets logged yet. Click &quot;Add Asset&quot; to record bank accounts, wallets, or phone numbers.
                </div>
              ) : (
                scammer.fraudAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {formatAccountTypeLabel(acc.accountType)}
                        </span>
                        {acc.institution && (
                          <span className="text-[11px] text-slate-300 font-semibold truncate">
                            {acc.institution}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-slate-100 truncate">{acc.accountDetails}</p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(acc.accountDetails)}
                        className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                        title="Copy"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFraudAccount(acc.id)}
                        className="p-1 rounded bg-slate-800 text-slate-400 hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Evidence & Media Section (P5: Drag/drop, Click/search, Paste, 3MB limit, List view with rename & player) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col flex-1 shadow">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Evidence &amp; Media ({evidenceMedia.length})
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">Max 3MB per file</span>
            </div>

            {/* Drag, Drop & Paste Zone */}
            <div
              onDragOver={handleMediaDragOver}
              onDragLeave={handleMediaDragLeave}
              onDrop={handleMediaDrop}
              onPaste={handleMediaPaste}
              tabIndex={0}
              className={`border-2 border-dashed rounded-xl p-2.5 text-center cursor-pointer transition focus:outline-none mb-2 ${
                isDraggingMedia
                  ? 'border-sky-500 bg-sky-500/10'
                  : 'border-slate-800 bg-slate-950 hover:border-slate-700'
              }`}
              onClick={() => {
                const el = document.getElementById('evidence-media-input');
                if (el) el.click();
              }}
            >
              <input
                type="file"
                id="evidence-media-input"
                accept="image/*,audio/*"
                multiple
                onChange={(e) => {
                  const files = e.target.files;
                  if (files) {
                    for (let i = 0; i < files.length; i++) {
                      processMediaFile(files[i]);
                    }
                  }
                }}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
                <Upload className="w-4 h-4 text-sky-400" />
                <p className="text-[11px] font-medium text-slate-200">
                  Drag &amp; drop images/audio, click to browse, or paste (Ctrl+V)
                </p>
                <p className="text-[9px] text-slate-400">Images (.png, .jpg) &amp; Audio (.mp3, .wav) • Limit 3MB</p>
              </div>
            </div>

            {mediaError && (
              <div className="mb-2 p-1.5 rounded bg-rose-950/60 border border-rose-800 text-[10px] text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span>{mediaError}</span>
              </div>
            )}

            {/* Evidence & Media List */}
            <div className="space-y-1.5 overflow-y-auto max-h-[220px] flex-1 pr-1">
              {evidenceMedia.length === 0 ? (
                <div className="text-center py-6 bg-slate-950/50 rounded-lg border border-slate-800 text-slate-400 text-[11px] p-2">
                  No evidence or media files uploaded yet. Drag &amp; drop or paste files above.
                </div>
              ) : (
                evidenceMedia.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-1.5 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {item.type === 'image' ? (
                          <ImageIcon className="w-4 h-4 text-sky-400 shrink-0" />
                        ) : (
                          <FileAudio className="w-4 h-4 text-rose-400 shrink-0" />
                        )}

                        {editingMediaId === item.id ? (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="text"
                              value={editingMediaName}
                              onChange={(e) => setEditingMediaName(e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white w-full"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveMediaName(item.id)}
                              className="p-1 rounded bg-emerald-600 text-white text-[10px]"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className="text-xs font-semibold text-slate-100 truncate cursor-pointer hover:text-sky-300"
                            onClick={() => {
                              if (item.type === 'image') setPreviewImage(item.url);
                            }}
                          >
                            {item.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9px] text-slate-400 font-mono">
                          {(item.sizeBytes / 1024).toFixed(0)}KB
                        </span>

                        {item.type === 'image' && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(item.url)}
                            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                            title="View full image"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditingMediaId(item.id);
                            setEditingMediaName(item.name);
                          }}
                          className="p-1 rounded bg-slate-800 text-slate-400 hover:text-amber-300"
                          title="Rename asset"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteMedia(item.id)}
                          className="p-1 rounded bg-slate-800 text-slate-400 hover:text-rose-400"
                          title="Delete asset"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Media Inline Preview or Audio Player */}
                    {item.type === 'image' ? (
                      <div
                        className="w-full h-16 bg-slate-900 rounded overflow-hidden cursor-pointer flex items-center justify-center border border-slate-800 hover:border-sky-500/50 transition"
                        onClick={() => setPreviewImage(item.url)}
                      >
                        <img
                          src={item.url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="bg-slate-900 rounded p-1.5 border border-slate-800">
                        <audio controls src={item.url} className="w-full h-8" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Full Size Modal Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-2">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-rose-600 transition z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Evidence preview"
              className="max-h-[85vh] w-auto object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};
