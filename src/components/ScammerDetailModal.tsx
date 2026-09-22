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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col p-2 sm:p-3 gap-2.5 overflow-hidden antialiased">
      {/* Navigation Top Header Bar */}
      <header className="bg-slate-900/90 border border-slate-800/90 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md">
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
              {flagged ? <ShieldAlert className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
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
            <span className="text-emerald-400 font-bold">{scammer.todayTimeSpent || 0}m Today</span>
            <span className="text-slate-600">|</span>
            <span>{scammer.totalTimeSpent}m Total</span>
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
            <AlertTriangle className="w-3.5 h-3.5" />
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
        {/* COLUMN 1 (Col Span 3): Stopwatch, Metrics & Receiver Accounts */}
        <div className="lg:col-span-3 flex flex-col gap-2.5">
          {/* Live Call Timer */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow">
            <CallTimerWidget
              scammerName={scammer.fullName}
              onLogCompletedCall={(minutes) => {
                setCallDuration(minutes);
                setShowAddCall(true);
              }}
            />
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <p className="text-[10px] text-slate-400 font-medium uppercase">Today</p>
              <p className="text-sm font-bold text-emerald-400 mt-0.5">{scammer.todayTimeSpent || 0}m</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <p className="text-[10px] text-slate-400 font-medium uppercase">Wasted</p>
              <p className="text-sm font-bold text-slate-100 mt-0.5">{scammer.totalTimeSpent}m</p>
            </div>
            <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <p className="text-[10px] text-slate-400 font-medium uppercase">Calls</p>
              <p className="text-sm font-bold text-amber-400 mt-0.5">{scammer.calls.length}</p>
            </div>
          </div>

          {/* Receiver Accounts & Reported Assets */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col flex-1 shadow">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
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
                className="bg-slate-950 border border-rose-500/40 rounded-xl p-2.5 mb-2.5 space-y-2 text-xs"
              >
                <div>
                  <label className="block text-[10px] font-medium text-slate-300 mb-0.5">Asset Type</label>
                  <select
                    value={fraudType}
                    onChange={(e) => setFraudType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
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
                  <label className="block text-[10px] font-medium text-slate-300 mb-0.5">Details (Account / Phone / URL)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +1 (800) 555-0199 or Chase 12345678"
                    value={fraudDetails}
                    onChange={(e) => setFraudDetails(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-300 mb-0.5">Institution</label>
                    <input
                      type="text"
                      placeholder="e.g. Chase Bank"
                      value={fraudInstitution}
                      onChange={(e) => setFraudInstitution(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-300 mb-0.5">Holder</label>
                    <input
                      type="text"
                      placeholder="e.g. Money Mule"
                      value={fraudHolder}
                      onChange={(e) => setFraudHolder(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
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
                    className="px-3 py-1 text-[11px] font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition"
                  >
                    Save Asset
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2 overflow-y-auto max-h-[300px] flex-1 pr-1">
              {scammer.fraudAccounts.length === 0 ? (
                <div className="text-center py-6 bg-slate-950/50 rounded-lg border border-slate-800/80 text-slate-400 text-[11px] p-3">
                  No receiver assets logged yet. Use &quot;Add Asset&quot; to track bank accounts, crypto wallets, websites, or reported phone numbers.
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
        </div>

        {/* COLUMN 2 (Col Span 5): Phone Numbers, WhatsApp & Case Dossier Profile */}
        <div className="lg:col-span-5 flex flex-col gap-2.5">
          {/* Phone Numbers & WhatsApp Intel */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2.5 shadow">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Phone Numbers &amp; WhatsApp Intel
                </h3>
              </div>
              <span className="text-[10px] text-slate-400">Up to 4 phones + 1 WhatsApp</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx}>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                    Phone #{idx + 1} {idx === 0 ? '(Primary)' : ''}
                  </label>
                  <input
                    type="text"
                    placeholder={`e.g. +1 (800) 555-010${idx + 1}`}
                    value={phoneList[idx]}
                    onChange={(e) => handlePhoneChange(idx, e.target.value)}
                    onBlur={() => handleSaveScammerInfo()}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5 flex items-center gap-1">
                  <MessageCircle className="w-3 h-3 text-emerald-400" />
                  WhatsApp Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +1 (800) 555-9988"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-emerald-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Carrier / VoIP</label>
                <input
                  type="text"
                  placeholder="e.g. Bandwidth.com"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Location Gateway</label>
                <input
                  type="text"
                  placeholder="e.g. Kolkata Call Center"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onBlur={() => handleSaveScammerInfo()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* Case Profile & Dossier Details */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col flex-1 space-y-2.5 shadow">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Case Profile &amp; Details
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Pipeline Stage</label>
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
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Target Deal / Fraud ($)</label>
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
                  placeholder="e.g. 24000"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Scam Type</label>
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
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Fake Organization</label>
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
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Priority Rating</label>
                <div className="flex items-center gap-1.5 h-7 px-2 bg-slate-950 border border-slate-800 rounded-lg">
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
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Scam Threat Level</label>
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
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Remote Access ID</label>
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
                <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Logged Scammer IP</label>
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
              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                General Operations Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => handleSaveScammerInfo()}
                placeholder="Behavioral traits, background noise heard, fake data fed during bait..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white flex-1 min-h-[50px] leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* COLUMN 3 (Col Span 4): Call Logs & Audio Recordings */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col shadow">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Call Logs &amp; Evidence ({scammer.calls.length})
              </h3>
            </div>
            <button
              type="button"
              id="toggle-add-call-btn"
              onClick={() => setShowAddCall(!showAddCall)}
              className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold flex items-center gap-1 transition shadow"
            >
              <Plus className="w-3 h-3" />
              {showAddCall ? 'Close' : 'Log Call'}
            </button>
          </div>

          {showAddCall && (
            <form
              onSubmit={handleAddCallLog}
              className="bg-slate-950 border border-rose-500/40 rounded-xl p-2.5 mb-2.5 space-y-2 text-xs"
            >
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="block text-[10px] font-medium text-slate-300 mb-0.5">Duration (m)</label>
                  <input
                    type="number"
                    min="1"
                    id="input-call-duration"
                    value={callDuration}
                    onChange={(e) => setCallDuration(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-300 mb-0.5">Date</label>
                  <input
                    type="date"
                    id="input-call-date"
                    value={callDate}
                    onChange={(e) => setCallDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-slate-300 mb-0.5">Persona</label>
                  <input
                    type="text"
                    id="input-call-persona"
                    placeholder="Grandma Gertrude"
                    value={callPersona}
                    onChange={(e) => setCallPersona(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-300 mb-0.5">Call Notes</label>
                <textarea
                  rows={2}
                  id="input-call-notes"
                  placeholder="What happened during this call?"
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[10px] font-medium text-slate-300 mb-0.5">Info Fed</label>
                  <input
                    type="text"
                    id="input-call-info-given"
                    placeholder="Fake Target card code"
                    value={callInfoGiven}
                    onChange={(e) => setCallInfoGiven(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-300 mb-0.5">Outcome</label>
                  <input
                    type="text"
                    id="input-call-outcome"
                    placeholder="Hung up furious"
                    value={callOutcome}
                    onChange={(e) => setCallOutcome(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>

              {/* Audio Dropzone */}
              <div className="space-y-1">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onPaste={handlePaste}
                  tabIndex={0}
                  className={`border border-dashed rounded-lg p-2 text-center cursor-pointer transition focus:outline-none ${
                    isDraggingOver
                      ? 'border-rose-500 bg-rose-500/10'
                      : audioFileName
                      ? 'border-emerald-500/50 bg-emerald-950/20'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700'
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
                  <div className="flex items-center justify-center gap-1.5 pointer-events-none">
                    <Upload className={`w-3.5 h-3.5 ${audioFileName ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="text-[11px] text-slate-300">
                      {audioFileName ? audioFileName : 'Attach Audio (< 90s)'}
                    </span>
                  </div>
                </div>
                {audioError && (
                  <p className="text-[10px] text-rose-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {audioError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddCall(false)}
                  className="px-2 py-1 text-[11px] text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="save-call-entry-btn"
                  className="px-3 py-1 text-[11px] font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition"
                >
                  Save Call
                </button>
              </div>
            </form>
          )}

          {/* Calls List */}
          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {scammer.calls.length === 0 ? (
              <div className="text-center py-8 bg-slate-950/50 rounded-lg border border-slate-800 text-slate-400 text-[11px] p-3">
                No call logs recorded yet. Click &quot;Log Call&quot; above to log conversations and audio clips.
              </div>
            ) : (
              scammer.calls.map((call) => (
                <div
                  key={call.id}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 space-y-1.5 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold font-mono text-[10px] border border-rose-500/30">
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

                  {call.infoGiven && (
                    <div className="text-[10px] bg-slate-900 rounded p-1.5 border border-slate-800 text-slate-400">
                      <span className="text-rose-400 font-semibold">Fed:</span> {call.infoGiven}
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
      </div>
    </div>
  );
};
