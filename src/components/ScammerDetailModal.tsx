import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  Clock,
  Shield,
  Upload,
  Plus,
  Trash2,
  Check,
  DollarSign,
  Copy,
  Building,
  MessageCircle,
  ArrowLeft,
  Flag,
  Image as ImageIcon,
  FileAudio,
  Eye,
  Edit3,
  FileText,
  ChevronRight,
  User as UserIcon,
  Radio,
  AlertTriangle,
  Tag,
} from 'lucide-react';
import { api, getStoredUser } from '../api.ts';
import { AudioPlayerWidget } from './AudioPlayerWidget.tsx';
import type { Scammer, PipelineStatus, User, CanonicalStatus } from '../types.ts';
import { toCanonicalStatus } from '../types.ts';

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
  const [location, setLocation] = useState(scammer.location || '');
  const [scamType, setScamType] = useState(scammer.scamType || 'Tech / Refund');
  const [organization, setOrganization] = useState(scammer.organization || '');
  const [ipAddress, setIpAddress] = useState(scammer.ipAddress || '');
  const [notes, setNotes] = useState(scammer.notes || '');

  // Active Dossier Notebook Tab (Default Operations Notes)
  const [activeTab, setActiveTab] = useState<'notes' | 'receiver_info'>('notes');

  // Phone Numbers (Primary, Secondary, Third) & WhatsApp
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

  // Quick edit total time state (click, edit, click out to save)
  const [isEditingTotalTime, setIsEditingTotalTime] = useState(false);
  const [editHoursVal, setEditHoursVal] = useState<string>('0');
  const [editMinsVal, setEditMinsVal] = useState<string>('0');

  // Top Banner (Organization & Scam Type) Quick-Edit State (P1: Save ONLY when check mark is clicked)
  const [isEditingTopBanner, setIsEditingTopBanner] = useState(false);
  const [editBannerOrg, setEditBannerOrg] = useState(scammer.organization || '');
  const [editBannerScamType, setEditBannerScamType] = useState(scammer.scamType || 'Tech / Refund');

  // Sync state when scammer changes
  useEffect(() => {
    setFullName(scammer.fullName);
    setAlias(scammer.alias || '');
    setStatus(scammer.status);
    setFlagged(scammer.flagged);
    setDangerLevel(scammer.dangerLevel || 'medium');
    setTargetValue(scammer.targetValue || 0);
    setPriority(scammer.priority || 1);
    setLocation(scammer.location || '');
    setScamType(scammer.scamType || 'Tech / Refund');
    setOrganization(scammer.organization || '');
    setIpAddress(scammer.ipAddress || '');
    setNotes(scammer.notes || '');

    const activeP =
      Array.isArray(scammer.phoneNumbers) && scammer.phoneNumbers.length > 0
        ? scammer.phoneNumbers
        : [scammer.phoneNumber];
    const list = [...activeP];
    while (list.length < 4) list.push('');
    setPhoneList(list.slice(0, 4));

    setWhatsappNumber(scammer.whatsappNumber || '');
    setEditBannerOrg(scammer.organization || '');
    setEditBannerScamType(scammer.scamType || 'Tech / Refund');
    setActiveTab('notes'); // P3: Ensure Operations notes is default active tab
  }, [scammer]);

  const handleStartEditingTopBanner = () => {
    setEditBannerOrg(organization || '');
    setEditBannerScamType(scamType || 'Tech / Refund');
    setIsEditingTopBanner(true);
  };

  // P1: Save top banner edits ONLY when orange check mark button is clicked
  const handleCommitTopBanner = () => {
    setIsEditingTopBanner(false);
    const newOrg = editBannerOrg.trim();
    const newScamType = editBannerScamType.trim() || 'Tech / Refund';
    setOrganization(newOrg);
    setScamType(newScamType);
    handleSaveScammerInfo({
      organization: newOrg,
      scamType: newScamType,
    });
  };

  const handleCancelTopBanner = () => {
    setEditBannerOrg(organization || '');
    setEditBannerScamType(scamType || 'Tech / Refund');
    setIsEditingTopBanner(false);
  };

  const handleStartEditingTime = () => {
    const total = scammer.totalTimeSpent || 0;
    setEditHoursVal(String(Math.floor(total / 60)));
    setEditMinsVal(String(total % 60));
    setIsEditingTotalTime(true);
  };

  const handleCommitEditingTime = () => {
    if (!isEditingTotalTime) return;
    const h = Math.max(0, parseInt(editHoursVal, 10) || 0);
    const m = Math.max(0, Math.min(59, parseInt(editMinsVal, 10) || 0));
    const newTotalMinutes = h * 60 + m;
    setIsEditingTotalTime(false);
    handleSaveScammerInfo({ totalTimeSpent: newTotalMinutes });
  };

  // Quick Call Logger State (HH:MM:SS & Date Picker)
  const [showCallLogger, setShowCallLogger] = useState(true);
  const [loggerHours, setLoggerHours] = useState<number>(0);
  const [loggerMins, setLoggerMins] = useState<number>(0);
  const [loggerSecs, setLoggerSecs] = useState<number>(0);
  const [loggerDate, setLoggerDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [loggerNotes, setLoggerNotes] = useState('');
  const [loggerPersona, setLoggerPersona] = useState('');

  // Receiver Info form state (P4)
  const [showAddFraud, setShowAddFraud] = useState(false);
  const [fraudType, setFraudType] = useState('bank_account');
  const [fraudDetails, setFraudDetails] = useState(''); // Name
  const [fraudInstitution, setFraudInstitution] = useState(''); // Phone Number / Email
  const [fraudHolder, setFraudHolder] = useState(''); // Address

  // Evidence & Media State (P5: Moved under Effortless Communication)
  const [evidenceMedia, setEvidenceMedia] = useState<EvidenceMediaItem[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [editingMediaName, setEditingMediaName] = useState<string>('');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);

  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  // Helper to check audio file duration
  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      const objectUrl = URL.createObjectURL(file);
      audio.src = objectUrl;
      audio.onloadedmetadata = () => {
        const dur = audio.duration;
        URL.revokeObjectURL(objectUrl);
        resolve(dur);
      };
      audio.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
    });
  };

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
        location,
        scamType,
        organization,
        ipAddress,
        notes,
        ...fieldOverrides,
      };
      const res = await api.updateScammer(scammer.id, payload);
      onUpdateScammer(res.scammer);
    } catch (err) {
      console.error('[ScammerDetailModal] Save scammer error:', err);
    }
  };

  const handlePhoneChange = (index: number, val: string) => {
    const updated = [...phoneList];
    updated[index] = val;
    setPhoneList(updated);
  };

  // Status change handler (Odoo Status Pipeline Chevron)
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
      console.error('[ScammerDetailModal] Quick call log error:', err);
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
      console.error('[ScammerDetailModal] Delete call error:', err);
    }
  };

  // P4: Add Receiver Info with explicit Mule or Victim tag button
  const handleAddReceiverInfo = async (tagType?: 'mule' | 'victim') => {
    if (!fraudDetails.trim()) return;

    // Append tag to holderName/Address for persistent display
    let formattedHolder = fraudHolder.trim();
    if (tagType === 'mule') {
      formattedHolder = formattedHolder ? `${formattedHolder} [TAG: MULE]` : '[TAG: MULE]';
    } else if (tagType === 'victim') {
      formattedHolder = formattedHolder ? `${formattedHolder} [TAG: VICTIM]` : '[TAG: VICTIM]';
    }

    try {
      const res = await api.addFraudAccount(scammer.id, {
        accountType: fraudType,
        accountDetails: fraudDetails.trim(),
        institution: fraudInstitution.trim() || undefined,
        holderName: formattedHolder || undefined,
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
      console.error('[ScammerDetailModal] Add receiver info error:', err);
    }
  };

  // Delete Fraud Account / Receiver Info
  const handleDeleteFraudAccount = async (accId: string) => {
    try {
      await api.deleteFraudAccount(scammer.id, accId);
      const updated = scammer.fraudAccounts.filter((a) => a.id !== accId);
      onUpdateScammer({
        ...scammer,
        fraudAccounts: updated,
      });
    } catch (err) {
      console.error('[ScammerDetailModal] Delete receiver info error:', err);
    }
  };

  // Process Evidence & Media File
  const processMediaFile = async (file: File) => {
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name);
    const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.name);

    if (!isAudio && !isImage) {
      setMediaError('Unsupported file type. Please select an image or audio file.');
      return;
    }

    const maxBytes = 3 * 1024 * 1024; // 3MB limit
    const userEmail = currentUser?.email || getStoredUser()?.email;
    const isExempt = userEmail?.toLowerCase().trim() === 'cookiescambait@gmail.com';

    if (file.size > maxBytes && !isExempt) {
      setMediaError(`File "${file.name}" exceeds the 3MB size limit.`);
      return;
    }

    if (isAudio && !isExempt) {
      try {
        const durationSeconds = await getAudioDuration(file);
        if (durationSeconds > 90) {
          setMediaError(`Audio file "${file.name}" is ${Math.round(durationSeconds)}s long. Call audio recordings are restricted to clips under 90 seconds (1.5 minutes).`);
          return;
        }
      } catch (err) {
        console.warn('[ScammerDetailModal] Could not inspect audio duration, proceeding with file read:', err);
      }
    }

    setMediaError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      if (!url) return;

      const newItem: EvidenceMediaItem = {
        id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        url,
        type: isImage ? 'image' : 'audio',
        fileType: file.type || (isImage ? 'image/jpeg' : 'audio/mp3'),
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      };

      setEvidenceMedia((prev) => [newItem, ...prev]);
    };
    reader.onerror = (err) => {
      console.error('[ScammerDetailModal] FileReader error:', err);
      setMediaError('Error reading file content.');
    };
    reader.readAsDataURL(file);
  };

  const handleMediaDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingMedia(true);
  };

  const handleMediaDragLeave = () => {
    setIsDraggingMedia(false);
  };

  const handleMediaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingMedia(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        processMediaFile(e.dataTransfer.files[i]);
      }
    }
  };

  const handleMediaPaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      for (let i = 0; i < e.clipboardData.files.length; i++) {
        processMediaFile(e.clipboardData.files[i]);
      }
    }
  };

  const handleDeleteMedia = (id: string) => {
    setEvidenceMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSaveMediaName = (id: string) => {
    if (!editingMediaName.trim()) return;
    setEvidenceMedia((prev) =>
      prev.map((m) => (m.id === id ? { ...m, name: editingMediaName.trim() } : m))
    );
    setEditingMediaId(null);
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

  // Helper to parse Mule/Victim tag from item
  const getReceiverTag = (holderName?: string | null, accountDetails?: string | null) => {
    const combined = `${holderName || ''} ${accountDetails || ''}`.toUpperCase();
    if (combined.includes('MULE')) return 'MULE';
    if (combined.includes('VICTIM')) return 'VICTIM';
    return null;
  };

  const cleanHolderName = (holderName?: string | null) => {
    if (!holderName) return '';
    return holderName.replace(/\[TAG:\s*(MULE|VICTIM)\]/gi, '').trim();
  };

  // Dynamic Call Log Stats Calculation & P6: Scammer Cost ($0.17 per minute)
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
  // P6: Make Scammer Cost .17 cents a minute of total wasted minutes
  const scammerCostDollars = Math.round(totalMinutes * 0.17);

  const formatDurationDisplay = (mins: number) => {
    if (!mins || mins <= 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  // Odoo Canonical Pipeline Stages
  const ODOO_STAGES: CanonicalStatus[] = [
    'New / Uncalled',
    'Currently Baiting',
    'Top Scams',
    'Reported / Down',
  ];

  const currentCanonical = toCanonicalStatus(status);

  // Render Top Banner (P1: Save ONLY when orange check mark button is clicked)
  const renderTopBanner = () => {
    const displayOrg = organization?.trim() || '';
    const displayScamType = scamType?.trim() || 'Tech / Refund';

    if (isEditingTopBanner) {
      return (
        <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 border-amber-500 bg-slate-950 shadow-lg text-amber-400 text-xs sm:text-sm font-extrabold animate-fadeIn">
          <Building className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-amber-400 font-extrabold text-sm">&quot;</span>
          <input
            type="text"
            value={editBannerOrg}
            onChange={(e) => setEditBannerOrg(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitTopBanner();
              if (e.key === 'Escape') handleCancelTopBanner();
            }}
            placeholder="Fake Org / Company"
            autoFocus
            className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs sm:text-sm text-amber-300 font-extrabold focus:outline-none focus:border-amber-400 w-32 sm:w-40 font-sans"
            title="Fake Organization name"
          />
          <span className="text-amber-400 font-extrabold text-sm">-</span>
          <select
            value={editBannerScamType}
            onChange={(e) => setEditBannerScamType(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs sm:text-sm text-amber-300 font-extrabold focus:outline-none focus:border-amber-400 cursor-pointer"
            title="Scam Type"
          >
            <option value="Tech / Refund">Tech / Refund</option>
            <option value="Crypto Investment">Crypto Investment</option>
            <option value="IRS / Govt">IRS / Govt</option>
            <option value="Lotto / Sweepstakes">Lotto / Sweepstakes</option>
            <option value="Spellcaster / Pet">Spellcaster / Pet</option>
            <option value="Other">Other</option>
          </select>
          <span className="text-amber-400 font-extrabold text-sm">&quot;</span>
          <button
            type="button"
            onClick={handleCommitTopBanner}
            className="p-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold ml-1 transition cursor-pointer"
            title="Click orange check mark to save changes"
          >
            <Check className="w-4 h-4 stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={handleCancelTopBanner}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold ml-0.5 transition cursor-pointer"
            title="Cancel editing"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={handleStartEditingTopBanner}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-amber-600/70 bg-amber-950/30 hover:bg-amber-950/60 hover:border-amber-400 text-amber-400 transition cursor-pointer shadow-sm group"
        title="Click to edit Organization and Scam Type (Click orange check mark to save)"
      >
        <Building className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-xs sm:text-sm font-extrabold tracking-tight text-amber-400 group-hover:text-amber-300">
          &quot;{displayOrg ? `${displayOrg} - ${displayScamType}` : displayScamType}&quot;
        </span>
        <Edit3 className="w-3.5 h-3.5 text-amber-400/50 group-hover:text-amber-300 ml-1 shrink-0 transition" />
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm text-slate-100 flex flex-col p-2 sm:p-4 gap-3 overflow-hidden antialiased font-sans">
      {/* ODOO TOP CONTROL BAR */}
      <header className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md">
        {/* Left Actions & Identity */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Pipeline</span>
          </button>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          {/* Quick Flag Toggle */}
          <button
            type="button"
            onClick={handleToggleFlag}
            title={flagged ? 'Flagged target (Click to unflag)' : 'Click to quick flag target'}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition cursor-pointer border ${
              flagged
                ? 'bg-rose-600/20 text-rose-400 border-rose-500/40 hover:bg-rose-600/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-slate-600'
            }`}
          >
            <Flag className={`w-4 h-4 ${flagged ? 'text-rose-400 fill-rose-400' : ''}`} />
          </button>

          {/* Priority Stars Rating */}
          <div
            className="flex items-center gap-0.5 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-700"
            title={`Priority Rating: ${priority} of 3. Click to adjust.`}
          >
            {[1, 2, 3].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => {
                  const newPriority = priority === star ? 0 : star;
                  setPriority(newPriority);
                  handleSaveScammerInfo({ priority: newPriority });
                }}
                className="text-base px-0.5 hover:scale-125 transition cursor-pointer"
              >
                <span className={star <= priority ? 'text-amber-400 font-extrabold' : 'text-slate-700'}>
                  ★
                </span>
              </button>
            ))}
          </div>

          {/* Target Header Name Display (Prioritizing Alias over Full Name) */}
          <div className="flex items-center gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-slate-400 uppercase">Target:</span>
                <input
                  type="text"
                  value={alias ? alias : fullName}
                  onChange={(e) => {
                    if (alias) {
                      setAlias(e.target.value);
                    } else {
                      setFullName(e.target.value);
                    }
                  }}
                  onBlur={() => handleSaveScammerInfo()}
                  placeholder="Target Alias / Name"
                  className="text-lg sm:text-xl font-extrabold text-amber-300 bg-transparent border-b border-transparent hover:border-amber-500/50 focus:border-amber-400 focus:outline-none tracking-tight max-w-[200px] sm:max-w-[280px]"
                  title="Primary Target Display Name (Prioritizing Alias)"
                />
              </div>

              {alias ? (
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Real Name:</span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onBlur={() => handleSaveScammerInfo()}
                    placeholder="Full Name"
                    className="text-xs sm:text-sm font-semibold text-slate-200 bg-transparent border-b border-slate-700 focus:border-rose-500 focus:outline-none w-28 sm:w-36"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">+ Alias:</span>
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    onBlur={() => handleSaveScammerInfo()}
                    placeholder="e.g. Willy Fin"
                    className="text-xs sm:text-sm font-semibold text-amber-300 bg-transparent border-b border-slate-700 focus:border-amber-400 focus:outline-none w-24 sm:w-32 font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Top Banner */}
        <div className="flex items-center justify-center my-1 sm:my-0">
          {renderTopBanner()}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {isEditingTotalTime ? (
            <div className="flex items-center gap-1 bg-slate-900 border-2 border-amber-500 rounded-lg px-2.5 py-1.5 shadow-lg animate-fadeIn text-xs sm:text-sm font-mono font-bold text-white">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <input
                type="number"
                min="0"
                value={editHoursVal}
                onChange={(e) => setEditHoursVal(e.target.value)}
                onBlur={handleCommitEditingTime}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitEditingTime();
                  if (e.key === 'Escape') setIsEditingTotalTime(false);
                }}
                autoFocus
                className="w-9 bg-slate-950 border border-slate-700 rounded text-center text-amber-300 font-bold px-0.5 py-0.5 focus:outline-none focus:border-amber-400"
                title="Hours"
              />
              <span className="text-xs text-slate-400">h</span>
              <input
                type="number"
                min="0"
                max="59"
                value={editMinsVal}
                onChange={(e) => setEditMinsVal(e.target.value)}
                onBlur={handleCommitEditingTime}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitEditingTime();
                  if (e.key === 'Escape') setIsEditingTotalTime(false);
                }}
                className="w-9 bg-slate-950 border border-slate-700 rounded text-center text-amber-300 font-bold px-0.5 py-0.5 focus:outline-none focus:border-amber-400"
                title="Minutes"
              />
              <span className="text-xs text-slate-400">m</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartEditingTime}
              className="flex items-center gap-2 text-xs sm:text-sm text-slate-300 bg-slate-950/90 hover:bg-slate-800 hover:border-amber-500/50 px-3 py-1.5 rounded-lg border border-slate-800 font-mono transition cursor-pointer"
              title="Click to quick edit total time wasted"
            >
              <Clock className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-extrabold">{todayMinutes}m Today</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-300 font-extrabold underline decoration-dotted">
                {totalMinutes}m Total
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => copyToClipboard(`${window.location.origin}/share/${scammer.id}`)}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 border bg-slate-800 text-slate-200 border-slate-700 hover:text-white"
          >
            <Copy className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">{copySuccess ? 'Copied!' : 'Share'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete scammer target ${scammer.fullName}?`)) {
                onDeleteScammer(scammer.id);
                onClose();
              }
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
            title="Delete Target Case"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ODOO STAGE RIBBON */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 overflow-x-auto shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-max">
          <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider mr-2 hidden md:inline">
            Stage:
          </span>
          {ODOO_STAGES.map((stg, idx) => {
            const isActive = currentCanonical === stg;
            return (
              <button
                key={stg}
                type="button"
                onClick={() => handleStatusChange(stg)}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer border ${
                  isActive
                    ? 'bg-[#714B67] text-white border-[#8f5e82] shadow-md shadow-[#714B67]/30 font-extrabold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <span>{stg}</span>
                {idx < ODOO_STAGES.length - 1 && (
                  <ChevronRight className="w-4 h-4 opacity-40 -mr-1" />
                )}
              </button>
            );
          })}
        </div>

        <div className="hidden xl:flex items-center">
          {renderTopBanner()}
        </div>
      </div>

      {/* MAIN WORKSPACE: HORIZONTAL 2-PANE ODOO LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 overflow-hidden min-h-0">
        {/* LEFT PANE (Col Span 7): Target Profile & Notebook Tabs */}
        <div className="lg:col-span-7 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Section 1: Target Profile & Intelligence (P2: Restructured Phone Fields) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3.5 shadow">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Target Profile &amp; Intelligence
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono font-bold">
                ID: {scammer.id.slice(0, 8)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs sm:text-sm">
              {/* Column 1: Phone Numbers & Communication Channels */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                    Primary Phone
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. +1 (800) 555-0100"
                      value={phoneList[0]}
                      onChange={(e) => handlePhoneChange(0, e.target.value)}
                      onBlur={() => handleSaveScammerInfo()}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-white font-mono font-semibold focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(phoneList[0])}
                      className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                      title="Copy phone"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Secondary Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +1 (800) 555-0102"
                      value={phoneList[1]}
                      onChange={(e) => handlePhoneChange(1, e.target.value)}
                      onBlur={() => handleSaveScammerInfo()}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white font-mono font-semibold focus:outline-none focus:border-slate-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Third Phone
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +1 (800) 555-0103"
                      value={phoneList[2]}
                      onChange={(e) => handlePhoneChange(2, e.target.value)}
                      onBlur={() => handleSaveScammerInfo()}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white font-mono font-semibold focus:outline-none focus:border-slate-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1 flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                      WhatsApp Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. +1 800 555 9988"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      onBlur={() => handleSaveScammerInfo()}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-emerald-300 font-mono font-semibold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Location / Region
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Kolkata, New Delhi"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      onBlur={() => handleSaveScammerInfo()}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* Column 2: Classification, Scammer Cost & IP */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Scam Type
                    </label>
                    <select
                      value={scamType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setScamType(val);
                        handleSaveScammerInfo({ scamType: val });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-amber-300 font-bold focus:outline-none focus:border-amber-400"
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
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Threat Level
                    </label>
                    <select
                      value={dangerLevel}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setDangerLevel(val);
                        handleSaveScammerInfo({ dangerLevel: val });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-slate-600"
                    >
                      <option value="low">Low Risk</option>
                      <option value="medium">Medium Risk</option>
                      <option value="high">High Threat</option>
                      <option value="critical">Critical Threat</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Fake Company / Org
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Geek Squad, Decoverse"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      onBlur={() => handleSaveScammerInfo()}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-slate-600"
                    />
                  </div>

                  {/* P6: Scammer Cost ($0.17/min) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                      Scammer Cost ($)
                    </label>
                    <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-emerald-400 font-mono font-extrabold flex items-center justify-between">
                      <span>${scammerCostDollars.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 font-normal">@ $0.17/m</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                    Logged Scammer IP
                  </label>
                  <input
                    type="text"
                    placeholder="Grabify or connection IP"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    onBlur={() => handleSaveScammerInfo()}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white font-mono font-semibold focus:outline-none focus:border-slate-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Notebook Tabs (P2 & P3: Default Operations Notes, P4: Receiver Info) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col flex-1 shadow overflow-hidden">
            {/* Tab Strip */}
            <div className="flex items-center gap-1 bg-slate-950 px-3 pt-2.5 border-b border-slate-800 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-bold rounded-t-lg transition flex items-center gap-1.5 border-t border-x cursor-pointer ${
                  activeTab === 'notes'
                    ? 'bg-slate-900 text-white border-slate-800 border-b-transparent'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Operations Notes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('receiver_info')}
                className={`px-3.5 py-2 text-xs sm:text-sm font-bold rounded-t-lg transition flex items-center gap-1.5 border-t border-x cursor-pointer ${
                  activeTab === 'receiver_info'
                    ? 'bg-slate-900 text-white border-slate-800 border-b-transparent'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <DollarSign className="w-4 h-4 text-rose-400" />
                <span>Receiver Info ({scammer.fraudAccounts.length})</span>
              </button>
            </div>

            {/* Tab 1: Operations Notes (Default P3) */}
            {activeTab === 'notes' && (
              <div className="p-4 flex flex-col flex-1 space-y-2">
                <div className="flex items-center justify-between text-slate-300 text-xs sm:text-sm font-bold">
                  <span>General Dossier &amp; Behavioral Notes:</span>
                  <span className="text-xs text-slate-400 font-mono">Autosaved on blur</span>
                </div>
                <textarea
                  rows={8}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  placeholder="Behavioral traits, accents, background call-center sounds, fake details and credit cards fed during bait sessions..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs sm:text-sm font-semibold text-slate-100 flex-1 min-h-[160px] leading-relaxed focus:outline-none focus:border-slate-700"
                />
              </div>
            )}

            {/* Tab 2: Receiver Info (P4) */}
            {activeTab === 'receiver_info' && (
              <div className="p-4 space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-slate-200 font-extrabold">
                    Reported Accounts, Mules &amp; Receiver Information
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddFraud(!showAddFraud)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer shadow"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{showAddFraud ? 'Cancel' : 'Add Receiver Info'}</span>
                  </button>
                </div>

                {showAddFraud && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleAddReceiverInfo();
                    }}
                    className="bg-slate-950 border border-rose-500/40 rounded-xl p-3.5 space-y-3 text-xs sm:text-sm animate-fadeIn"
                  >
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Receiver Type</label>
                        <select
                          value={fraudType}
                          onChange={(e) => setFraudType(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white font-semibold"
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
                        <label className="block text-xs font-bold text-slate-300 mb-1">Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. John Doe / Account Name"
                          value={fraudDetails}
                          onChange={(e) => setFraudDetails(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white font-semibold"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Phone Number / Email</label>
                        <input
                          type="text"
                          placeholder="e.g. +1 555-0199 or email@domain.com"
                          value={fraudInstitution}
                          onChange={(e) => setFraudInstitution(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Address</label>
                        <input
                          type="text"
                          placeholder="e.g. 123 Main St, New York, NY"
                          value={fraudHolder}
                          onChange={(e) => setFraudHolder(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm text-white font-semibold"
                        />
                      </div>
                    </div>

                    {/* P4: Red Mule Button & Green Victim Button */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowAddFraud(false)}
                        className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-400 hover:text-white mr-auto"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddReceiverInfo('mule')}
                        className="px-3.5 py-1.5 text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition shadow flex items-center gap-1 cursor-pointer"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>Save as Mule</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddReceiverInfo('victim')}
                        className="px-3.5 py-1.5 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition shadow flex items-center gap-1 cursor-pointer"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>Save as Victim</span>
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2.5 overflow-y-auto max-h-[260px]">
                  {scammer.fraudAccounts.length === 0 ? (
                    <div className="text-center py-6 bg-slate-950/50 rounded-lg border border-slate-800 text-slate-400 text-xs sm:text-sm p-4">
                      No receiver info logged yet. Click &quot;Add Receiver Info&quot; to log illicit accounts or victim details.
                    </div>
                  ) : (
                    scammer.fraudAccounts.map((acc) => {
                      const tag = getReceiverTag(acc.holderName, acc.accountDetails);
                      const displayAddress = cleanHolderName(acc.holderName);

                      return (
                        <div
                          key={acc.id}
                          className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex items-center justify-between gap-3 hover:border-slate-700 transition"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-extrabold uppercase px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                {formatAccountTypeLabel(acc.accountType)}
                              </span>

                              {/* P4 Tag Badge */}
                              {tag === 'MULE' && (
                                <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-rose-600 text-white shadow">
                                  Mule
                                </span>
                              )}
                              {tag === 'VICTIM' && (
                                <span className="text-xs font-black uppercase px-2 py-0.5 rounded bg-emerald-600 text-white shadow">
                                  Victim
                                </span>
                              )}

                              <span className="text-xs sm:text-sm text-white font-extrabold truncate">
                                Name: {acc.accountDetails}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-300 font-medium flex-wrap">
                              {acc.institution && (
                                <span>Phone/Email: <strong className="text-slate-100">{acc.institution}</strong></span>
                              )}
                              {displayAddress && (
                                <span>Address: <strong className="text-slate-100">{displayAddress}</strong></span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`${acc.accountDetails} ${acc.institution || ''} ${displayAddress}`)}
                              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                              title="Copy details"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFraudAccount(acc.id)}
                              className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE (Col Span 5): Effortless Communication & Evidence Vault (P5) */}
        <div className="lg:col-span-5 flex flex-col gap-3 overflow-y-auto">
          {/* Section 1: Chatter Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col shadow">
            {/* Chatter Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Effortless Communication ({totalCallsCount})
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCallLogger(!showCallLogger)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition shadow cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log Call</span>
                </button>
              </div>
            </div>

            {/* Horizontal Communication Stats Bar (P6: Scammer Cost) */}
            <div className="grid grid-cols-4 gap-2 bg-slate-950 border border-slate-800 rounded-lg p-2.5 mb-3 text-center">
              <div>
                <p className="text-xs text-slate-300 font-extrabold uppercase">Today</p>
                <p className="text-xs sm:text-sm font-black text-emerald-400 mt-0.5">
                  {formatDurationDisplay(todayMinutes)}
                </p>
              </div>
              <div
                onClick={handleStartEditingTime}
                className="cursor-pointer hover:bg-slate-900 rounded transition p-0.5"
                title="Click to quick edit time wasted"
              >
                <p className="text-xs text-slate-300 font-extrabold uppercase">Total Wasted</p>
                <p className="text-xs sm:text-sm font-black text-amber-300 mt-0.5 underline decoration-dotted">
                  {formatDurationDisplay(totalMinutes)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-300 font-extrabold uppercase">Sessions</p>
                <p className="text-xs sm:text-sm font-black text-sky-400 mt-0.5">{totalCallsCount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-300 font-extrabold uppercase">Scammer Cost</p>
                <p className="text-xs sm:text-sm font-black text-rose-400 mt-0.5">
                  ${scammerCostDollars.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Compact Call Logger Tray */}
            {showCallLogger && (
              <form
                onSubmit={handleQuickLogCall}
                className="bg-slate-950 border border-rose-500/30 rounded-xl p-3 mb-3 space-y-2.5 text-xs sm:text-sm animate-fadeIn"
              >
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-0.5">Hours</label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={loggerHours}
                      onChange={(e) => setLoggerHours(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs sm:text-sm text-white font-mono font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-0.5">Mins</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={loggerMins}
                      onChange={(e) => setLoggerMins(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs sm:text-sm text-white font-mono font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-0.5">Secs</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={loggerSecs}
                      onChange={(e) => setLoggerSecs(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs sm:text-sm text-white font-mono font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-0.5">Date</label>
                    <input
                      type="date"
                      value={loggerDate}
                      onChange={(e) => setLoggerDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-xs sm:text-sm text-white font-semibold cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Persona or notes (e.g. Grandma Gertrude, refund denied...)"
                    value={loggerNotes}
                    onChange={(e) => setLoggerNotes(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs sm:text-sm shrink-0 transition cursor-pointer"
                  >
                    Log Entry
                  </button>
                </div>
              </form>
            )}

            {/* Chronological Chatter Stream */}
            <div className="space-y-2.5 overflow-y-auto max-h-[220px] pr-1">
              {totalCallsCount === 0 ? (
                <div className="text-center py-6 bg-slate-950/50 rounded-xl border border-slate-800 text-slate-400 text-xs sm:text-sm p-4 flex flex-col items-center justify-center gap-2">
                  <Phone className="w-6 h-6 text-slate-600" />
                  <p className="font-semibold">No communication records yet.</p>
                </div>
              ) : (
                scammer.calls.map((call) => (
                  <div
                    key={call.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 hover:border-slate-700 transition shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-extrabold font-mono text-xs border border-rose-500/30">
                          📞 {call.durationMinutes}m duration
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          {new Date(call.date).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteCall(call.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {call.victimPersonaUsed && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold">
                        <UserIcon className="w-3.5 h-3.5" />
                        <span>Persona: {call.victimPersonaUsed}</span>
                      </div>
                    )}

                    {call.notes && (
                      <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800 font-medium">
                        {call.notes}
                      </p>
                    )}

                    {call.audioRecordingUrl && (
                      <div className="pt-1">
                        <AudioPlayerWidget
                          audioUrl={call.audioRecordingUrl}
                          audioName={call.audioRecordingName}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 2: Evidence Vault (P5: Moved under Effortless Communication) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  Evidence Vault ({evidenceMedia.length})
                </h3>
              </div>
            </div>

            {/* Drag, Drop & Paste Zone */}
            <div
              onDragOver={handleMediaDragOver}
              onDragLeave={handleMediaDragLeave}
              onDrop={handleMediaDrop}
              onPaste={handleMediaPaste}
              tabIndex={0}
              className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition focus:outline-none ${
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
                <p className="text-xs font-bold text-slate-200">
                  Drag &amp; drop images/audio, click to browse, or paste (Ctrl+V)
                </p>
                <p className="text-[11px] text-slate-400 font-semibold">
                  Images &amp; Audio • Max 3MB • Audio &lt; 90 seconds
                </p>
              </div>
            </div>

            {mediaError && (
              <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-800 text-xs text-rose-300 font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{mediaError}</span>
              </div>
            )}

            {/* Evidence Items */}
            <div className="space-y-2 overflow-y-auto max-h-[180px]">
              {evidenceMedia.length === 0 ? (
                <div className="text-center py-4 bg-slate-950/50 rounded-lg border border-slate-800 text-slate-400 text-xs p-3 font-medium">
                  No evidence uploaded. Drag &amp; drop files above.
                </div>
              ) : (
                evidenceMedia.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-2 hover:border-slate-700 transition"
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
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-white w-full font-semibold"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveMediaName(item.id)}
                              className="p-1 rounded bg-emerald-600 text-white text-xs font-bold"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className="text-xs font-bold text-slate-100 truncate cursor-pointer hover:text-sky-300"
                            onClick={() => {
                              if (item.type === 'image') setPreviewImage(item.url);
                            }}
                          >
                            {item.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono font-semibold">
                          {(item.sizeBytes / 1024).toFixed(0)}KB
                        </span>

                        {item.type === 'image' && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(item.url)}
                            className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditingMediaId(item.id);
                            setEditingMediaName(item.name);
                          }}
                          className="p-1 rounded bg-slate-800 text-slate-400 hover:text-amber-300"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteMedia(item.id)}
                          className="p-1 rounded bg-slate-800 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {item.type === 'image' ? (
                      <div
                        className="w-full h-20 bg-slate-900 rounded-lg overflow-hidden cursor-pointer flex items-center justify-center border border-slate-800 hover:border-sky-500/50 transition"
                        onClick={() => setPreviewImage(item.url)}
                      >
                        <img
                          src={item.url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="bg-slate-900 rounded-lg p-1.5 border border-slate-800">
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

      {/* Full Size Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-2">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-rose-600 transition z-10 cursor-pointer"
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
