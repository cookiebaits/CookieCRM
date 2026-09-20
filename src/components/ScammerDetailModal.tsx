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
  ExternalLink,
} from 'lucide-react';
import { api, getStoredUser } from '../api.ts';
import { AudioPlayerWidget } from './AudioPlayerWidget.tsx';
import { CallTimerWidget } from './CallTimerWidget.tsx';
import type { Scammer, PipelineStatus, User, FraudAccount } from '../types.ts';

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
  const initialPhones = Array.isArray(scammer.phoneNumbers) && scammer.phoneNumbers.length > 0
    ? scammer.phoneNumbers
    : [scammer.phoneNumber];

  const [phoneList, setPhoneList] = useState<string[]>(() => {
    const list = [...initialPhones];
    while (list.length < 4) list.push('');
    return list.slice(0, 4);
  });

  const [whatsappNumber, setWhatsappNumber] = useState(scammer.whatsappNumber || '');

  // Call log form
  const [showAddCall, setShowAddCall] = useState(false);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [callDate, setCallDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [callPersona, setCallPersona] = useState('Grandma Gertrude');
  const [callNotes, setCallNotes] = useState('');
  const [callInfoGiven, setCallInfoGiven] = useState('');
  const [callOutcome, setCallOutcome] = useState('');
  const [audioFileName, setAudioFileName] = useState('');
  const [audioFileData, setAudioFileData] = useState('');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Editing existing call
  const [editingCallId, setEditingCallId] = useState<string | null>(null);
  const [editingDuration, setEditingDuration] = useState<number>(0);

  // Receiver Accounts / Reported Assets form
  const [showAddFraud, setShowAddFraud] = useState(false);
  const [fraudType, setFraudType] = useState('bank_account');
  const [fraudDetails, setFraudDetails] = useState('');
  const [fraudInstitution, setFraudInstitution] = useState('');
  const [fraudHolder, setFraudHolder] = useState('');

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

  // Audio File Processing
  const processAudioFile = (file: File) => {
    if (!file.type.startsWith('audio/')) {
      setAudioError('Please select a valid audio file (.wav, .mp3, .m4a, .ogg, .webm).');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const audioObj = new Audio();
    audioObj.src = objectUrl;

    audioObj.onloadedmetadata = () => {
      const durationSec = audioObj.duration;
      URL.revokeObjectURL(objectUrl);

      const userEmail = (currentUser?.email || getStoredUser()?.email || '').toLowerCase().trim();
      const isAdminExempt = userEmail === 'cookiescambait@gmail.com';

      if (durationSec > 90 && !isAdminExempt) {
        setAudioError(
          `Audio recording is ${Math.round(durationSec)}s long (${(durationSec / 60).toFixed(
            1
          )} mins). Audio clips must be less than 1.5 minutes (90 seconds). Admin account cookiescambait@gmail.com is exempt.`
        );
        setAudioFileData('');
        setAudioFileName('');
        return;
      }

      setAudioError(null);
      setAudioFileName(file.name || 'recording.wav');

      const reader = new FileReader();
      reader.onload = () => {
        setAudioFileData(reader.result as string);
      };
      reader.readAsDataURL(file);
    };

    audioObj.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setAudioError(null);
      setAudioFileName(file.name || 'recording.wav');
      const reader = new FileReader();
      reader.onload = () => {
        setAudioFileData(reader.result as string);
      };
      reader.readAsDataURL(file);
    };
  };

  // Drag & drop handlers for audio
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('audio/')) {
          processAudioFile(files[i]);
          break;
        }
      }
    }
  };

  // Paste handler for clipboard audio
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('audio/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          processAudioFile(file);
          break;
        }
      }
    }
  };

  // Add Call Log
  const handleAddCallLog = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const res = await api.addCall(scammer.id, {
        durationMinutes: callDuration,
        date: callDate ? new Date(callDate).toISOString() : new Date().toISOString(),
        notes: callNotes,
        victimPersonaUsed: callPersona,
        infoGiven: callInfoGiven,
        outcome: callOutcome,
        audioRecordingName: audioFileName || (audioFileData ? 'recording.wav' : undefined),
        audioRecordingUrl: audioFileData || undefined,
      });

      const updatedCalls = [res.call, ...scammer.calls];
      const updatedScammer: Scammer = {
        ...scammer,
        calls: updatedCalls,
        totalTimeSpent: res.scammerTotalMinutes,
        todayTimeSpent: res.todayMinutes,
      };
      onUpdateScammer(updatedScammer);

      setShowAddCall(false);
      setCallNotes('');
      setCallInfoGiven('');
      setCallOutcome('');
      setAudioFileData('');
      setAudioFileName('');
      setAudioError(null);
      setCallDate(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error('Add call log error:', err);
    }
  };

  // Update Call Duration
  const handleSaveCallDuration = async (callId: string) => {
    try {
      const res = await api.updateCall(scammer.id, callId, {
        durationMinutes: editingDuration,
      });

      const updatedCalls = scammer.calls.map((c) => (c.id === callId ? res.call : c));
      const updatedScammer: Scammer = {
        ...scammer,
        calls: updatedCalls,
        totalTimeSpent: res.scammerTotalMinutes,
        todayTimeSpent: res.todayMinutes,
      };
      onUpdateScammer(updatedScammer);
      setEditingCallId(null);
    } catch (err) {
      console.error('Update call duration error:', err);
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

  const contentUI = (
    <div className="space-y-6">
      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
              Today&apos;s Time Spent
            </p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">
              {scammer.todayTimeSpent || 0} mins
            </p>
          </div>
          <Clock className="w-6 h-6 text-emerald-500/40" />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
              Total Time Wasted
            </p>
            <p className="text-xl font-bold text-slate-100 mt-0.5">
              {scammer.totalTimeSpent} mins{' '}
              <span className="text-xs font-normal text-slate-400">
                ({(scammer.totalTimeSpent / 60).toFixed(1)} hrs)
              </span>
            </p>
          </div>
          <Radio className="w-6 h-6 text-rose-500/40" />
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
              Interactions Logged
            </p>
            <p className="text-xl font-bold text-amber-400 mt-0.5">
              {scammer.calls.length} calls
            </p>
          </div>
          <MessageSquare className="w-6 h-6 text-amber-500/40" />
        </div>
      </div>

      {/* SECTION 1: PHONE NUMBERS & WHATSAPP INTEL */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Phone Numbers &amp; WhatsApp Intel
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Up to 4 phone numbers + 1 WhatsApp</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx}>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Phone Number #{idx + 1} {idx === 0 ? '(Primary)' : ''}
              </label>
              <input
                type="text"
                placeholder={`e.g. +1 (800) 555-010${idx + 1}`}
                value={phoneList[idx]}
                onChange={(e) => handlePhoneChange(idx, e.target.value)}
                onBlur={() => handleSaveScammerInfo()}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* WhatsApp Number */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              WhatsApp Number
            </label>
            <input
              type="text"
              placeholder="e.g. +1 (800) 555-9988"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              onBlur={() => handleSaveScammerInfo()}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Carrier / VoIP */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Carrier / VoIP Provider
            </label>
            <input
              type="text"
              placeholder="e.g. Bandwidth.com, Onvoy LLC, Twilio"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              onBlur={() => handleSaveScammerInfo()}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>

          {/* Location / Gateway */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Location / Route Gateway
            </label>
            <input
              type="text"
              placeholder="e.g. Kolkata / New Delhi call center"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={() => handleSaveScammerInfo()}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: CASE PROFILE & DOSSIER */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Case Profile &amp; Dossier Details
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Pipeline Stage */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Pipeline Stage
            </label>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as PipelineStatus)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 font-semibold"
            >
              <option value="New / Uncalled">1. New / Uncalled</option>
              <option value="Currently Baiting">2. Currently Baiting</option>
              <option value="Top Scams">3. Top Scams</option>
              <option value="Reported / Down">4. Reported / Down</option>
            </select>
          </div>

          {/* Target Value ($) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Target Deal / Fraud Amount ($)
            </label>
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
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. 24000"
            />
          </div>

          {/* Scam Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Scam Type
            </label>
            <select
              value={scamType}
              onChange={(e) => {
                const val = e.target.value;
                setScamType(val);
                handleSaveScammerInfo({ scamType: val });
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-medium"
            >
              <option value="Crypto Investment">Crypto Investment</option>
              <option value="IRS / Govt">IRS / Govt</option>
              <option value="Lotto / Sweepstakes">Lotto / Sweepstakes</option>
              <option value="Other">Other</option>
              <option value="Spellcaster / Pet">Spellcaster / Pet</option>
              <option value="Tech / Refund">Tech / Refund</option>
            </select>
          </div>

          {/* Fake Organization */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Fake Organization
            </label>
            <input
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              onBlur={() => handleSaveScammerInfo()}
              placeholder="e.g. Geek Squad, Deco Addict"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Priority Rating
            </label>
            <div className="flex items-center gap-2 h-9 px-3 bg-slate-900 border border-slate-800 rounded-xl">
              {[1, 2, 3].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    setPriority(star);
                    handleSaveScammerInfo({ priority: star });
                  }}
                  className="text-base transition hover:scale-125"
                >
                  <span className={star <= priority ? 'text-amber-400' : 'text-slate-700'}>
                    ★
                  </span>
                </button>
              ))}
              <span className="text-[11px] text-slate-400 ml-1">
                {priority === 1 ? 'Standard' : priority === 2 ? 'High Interest' : 'Top Priority'}
              </span>
            </div>
          </div>

          {/* Danger Level */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Scam Threat Level
            </label>
            <select
              value={dangerLevel}
              onChange={(e) => {
                const val = e.target.value as any;
                setDangerLevel(val);
                handleSaveScammerInfo({ dangerLevel: val });
              }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Threat</option>
              <option value="critical">Critical Threat</option>
            </select>
          </div>

          {/* Remote Access ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Remote Access Session ID
            </label>
            <input
              type="text"
              value={remoteAccessId}
              onChange={(e) => setRemoteAccessId(e.target.value)}
              onBlur={() => handleSaveScammerInfo()}
              placeholder="AnyDesk or UltraViewer"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>

          {/* Logged IP Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Logged Scammer IP
            </label>
            <input
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              onBlur={() => handleSaveScammerInfo()}
              placeholder="Grabify or connection IP"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            General Case &amp; Operations Notes
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => handleSaveScammerInfo()}
            placeholder="Behavioral traits, background noise heard, fake data fed during bait..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white leading-relaxed"
          />
        </div>
      </div>

      {/* SECTION 3: RECEIVER ACCOUNTS / REPORTED ASSETS */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Receiver Accounts / Reported Assets ({scammer.fraudAccounts.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAddFraud(!showAddFraud)}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            {showAddFraud ? 'Cancel' : 'Add Receiver Account / Asset'}
          </button>
        </div>

        {showAddFraud && (
          <form
            onSubmit={handleAddFraudAccount}
            className="bg-slate-900 border border-rose-500/40 rounded-xl p-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Asset / Account Type
                </label>
                <select
                  value={fraudType}
                  onChange={(e) => setFraudType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="bank_account">Bank Account (Routing + Acct)</option>
                  <option value="crypto_wallet">Crypto Wallet (BTC, ETH, USDT)</option>
                  <option value="zelle">Zelle Recipient</option>
                  <option value="wire">Wire Transfer Details</option>
                  <option value="phone_website">Phone Number / Website</option>
                  <option value="whatsapp">WhatsApp Contact</option>
                  <option value="paypal">PayPal / CashApp Handle</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Institution / Network / Domain
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chase Bank, Binance, scammerdomain.com"
                  value={fraudInstitution}
                  onChange={(e) => setFraudInstitution(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Details (Phone, URL, Acct Number, Crypto Address)
              </label>
              <input
                type="text"
                required
                placeholder="e.g. +1 (800) 555-0199 or https://fake-tech-support.com"
                value={fraudDetails}
                onChange={(e) => setFraudDetails(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Holder / Mule Name
              </label>
              <input
                type="text"
                placeholder="e.g. Brandon M. (Money Mule)"
                value={fraudHolder}
                onChange={(e) => setFraudHolder(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddFraud(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition"
              >
                Save Receiver Asset
              </button>
            </div>
          </form>
        )}

        {/* List of Receiver Accounts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {scammer.fraudAccounts.length === 0 ? (
            <div className="col-span-full text-center py-6 bg-slate-900/50 rounded-xl border border-slate-800 text-slate-400 text-xs">
              No receiver accounts or reported assets logged yet. Use the button above to log bank accounts, crypto wallets, websites, or victim phone numbers.
            </div>
          ) : (
            scammer.fraudAccounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                      {formatAccountTypeLabel(acc.accountType)}
                    </span>
                    {acc.institution && (
                      <span className="text-xs text-slate-300 font-semibold truncate">
                        {acc.institution}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-slate-100 truncate">{acc.accountDetails}</p>
                  {acc.holderName && (
                    <p className="text-[11px] text-slate-400 truncate">Holder: {acc.holderName}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(acc.accountDetails)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                    title="Copy details"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFraudAccount(acc.id)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-400"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 4: CALL LOGS & AUDIO RECORDINGS */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Call Logs &amp; Audio Recordings ({scammer.calls.length})
            </h3>
          </div>
          <button
            type="button"
            id="toggle-add-call-btn"
            onClick={() => setShowAddCall(!showAddCall)}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            {showAddCall ? 'Cancel Form' : 'Log New Call & Audio'}
          </button>
        </div>

        {showAddCall && (
          <form
            onSubmit={handleAddCallLog}
            className="bg-slate-900 border border-rose-500/40 rounded-xl p-4 space-y-3"
          >
            <div className="font-semibold text-xs text-rose-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              New Call Log Entry
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Call Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  id="input-call-duration"
                  value={callDuration}
                  onChange={(e) => setCallDuration(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Call Date
                </label>
                <input
                  type="date"
                  id="input-call-date"
                  value={callDate}
                  onChange={(e) => setCallDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Victim Persona Used
                </label>
                <input
                  type="text"
                  id="input-call-persona"
                  placeholder="e.g. Grandma Gertrude"
                  value={callPersona}
                  onChange={(e) => setCallPersona(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Call Notes &amp; Narrative
              </label>
              <textarea
                rows={2}
                id="input-call-notes"
                placeholder="What happened during this call?"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Victim Info Fed to Scammer
                </label>
                <input
                  type="text"
                  id="input-call-info-given"
                  placeholder="e.g. Fake routing number, bogus Target card code"
                  value={callInfoGiven}
                  onChange={(e) => setCallInfoGiven(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Call Outcome
                </label>
                <input
                  type="text"
                  id="input-call-outcome"
                  placeholder="e.g. Scammer hung up furious"
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {/* Audio Dropzone */}
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Attach Audio Recording (Upload, Drag &amp; Drop, or Copy/Paste)
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onPaste={handlePaste}
                tabIndex={0}
                className={`border-2 border-dashed rounded-xl p-3.5 text-center cursor-pointer transition focus:outline-none ${
                  isDraggingOver
                    ? 'border-rose-500 bg-rose-500/10'
                    : audioFileName
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                }`}
                onClick={() => {
                  const inputEl = document.getElementById('audio-file-input');
                  if (inputEl) inputEl.click();
                }}
              >
                <input
                  type="file"
                  id="audio-file-input"
                  accept="audio/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processAudioFile(file);
                  }}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
                  <Upload className={`w-5 h-5 ${audioFileName ? 'text-emerald-400' : 'text-slate-400'}`} />
                  {audioFileName ? (
                    <div className="text-xs text-emerald-400 font-semibold truncate max-w-full">
                      Selected: {audioFileName}
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-slate-300">
                        Click to upload, drag &amp; drop, or copy &amp; paste audio file
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Clips strictly under 1.5 min (90 sec)
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {audioError && (
                <p className="text-xs text-rose-400 font-medium mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {audioError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCall(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="save-call-entry-btn"
                className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition"
              >
                Save Call Log
              </button>
            </div>
          </form>
        )}

        {/* Calls List */}
        <div className="space-y-3">
          {scammer.calls.length === 0 ? (
            <div className="text-center py-6 bg-slate-900/50 rounded-xl border border-slate-800 text-slate-400 text-xs">
              No call logs recorded yet. Click &quot;Log New Call &amp; Audio&quot; above.
            </div>
          ) : (
            scammer.calls.map((call) => (
              <div
                key={call.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-3">
                    {editingCallId === call.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={editingDuration}
                          onChange={(e) => setEditingDuration(parseInt(e.target.value) || 0)}
                          className="w-16 bg-slate-950 border border-rose-500 rounded px-2 py-0.5 text-xs text-white"
                        />
                        <span className="text-xs text-slate-400">min</span>
                        <button
                          type="button"
                          onClick={() => handleSaveCallDuration(call.id)}
                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCallId(null)}
                          className="p-1 bg-slate-800 text-slate-400 rounded hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold font-mono text-xs border border-rose-500/30">
                          {call.durationMinutes} mins
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCallId(call.id);
                            setEditingDuration(call.durationMinutes);
                          }}
                          className="text-slate-500 hover:text-slate-300 p-1 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <span className="text-xs text-slate-400">
                      {new Date(call.date).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {call.victimPersonaUsed && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                        Persona: {call.victimPersonaUsed}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteCall(call.id)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Delete call"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {call.notes && (
                  <p className="text-xs text-slate-300 leading-relaxed">{call.notes}</p>
                )}

                {call.infoGiven && (
                  <div className="text-xs bg-slate-950 rounded-lg p-2 border border-slate-800 text-slate-400">
                    <span className="text-rose-400 font-semibold">Info Fed to Scammer:</span>{' '}
                    {call.infoGiven}
                  </div>
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

      {/* FOOTER & DELETE */}
      <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
        <span className="text-xs text-slate-500">
          Target record ID: <span className="font-mono">{scammer.id}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Are you sure you want to delete ${scammer.fullName}?`)) {
              onDeleteScammer(scammer.id);
              onClose();
            }
          }}
          className="text-xs text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete Scammer Target
        </button>
      </div>
    </div>
  );

  if (isStandalone) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-[1800px] w-full mx-auto shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                flagged
                  ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {flagged ? <ShieldAlert className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  className="text-lg sm:text-2xl font-black text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-rose-500 focus:outline-none tracking-tight"
                />
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  placeholder="Alias / Moniker"
                  className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-amber-400 font-mono border border-slate-700 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="font-mono text-slate-300">{phoneList[0] || scammer.phoneNumber}</span>
                <span>&bull;</span>
                <span className="text-slate-300">{organization || scamType}</span>
                <span>&bull;</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Today: {scammer.todayTimeSpent || 0}m
                </span>
                <span>(Total: {scammer.totalTimeSpent}m)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(`${window.location.origin}/share/${scammer.id}`)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border bg-slate-800 text-slate-200 border-slate-700 hover:text-white"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>{copySuccess ? 'Link Copied!' : 'Share Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFlag}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                flagged
                  ? 'bg-rose-600/20 text-rose-300 border-rose-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {flagged ? 'Flagged Fraudulent' : 'Flag Target'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              title="Close Window"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stopwatch */}
        <div className="px-5 py-3 bg-slate-950/60 border-b border-slate-800">
          <CallTimerWidget
            scammerName={scammer.fullName}
            onLogCompletedCall={(minutes) => {
              setCallDuration(minutes);
              setShowAddCall(true);
            }}
          />
        </div>

        <div className="p-6">{contentUI}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                flagged
                  ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {flagged ? <ShieldAlert className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  className="text-lg sm:text-xl font-bold text-white bg-transparent border-b border-transparent hover:border-slate-700 focus:border-rose-500 focus:outline-none tracking-tight"
                />
                {scammer.alias && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono border border-slate-700">
                    &quot;{scammer.alias}&quot;
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="font-mono text-slate-300">{phoneList[0] || scammer.phoneNumber}</span>
                <span>&bull;</span>
                <span className="text-slate-300">{organization || scamType}</span>
                <span>&bull;</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Today: {scammer.todayTimeSpent || 0}m
                </span>
                <span>(Total: {scammer.totalTimeSpent}m)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(`${window.location.origin}/share/${scammer.id}`)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border bg-slate-800 text-slate-200 border-slate-700 hover:text-white"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>{copySuccess ? 'Link Copied!' : 'Share Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFlag}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border ${
                flagged
                  ? 'bg-rose-600/20 text-rose-300 border-rose-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {flagged ? 'Flagged Fraudulent' : 'Flag Target'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stopwatch */}
        <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800">
          <CallTimerWidget
            scammerName={scammer.fullName}
            onLogCompletedCall={(minutes) => {
              setCallDuration(minutes);
              setShowAddCall(true);
            }}
          />
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1">{contentUI}</div>
      </div>
    </div>
  );
};
