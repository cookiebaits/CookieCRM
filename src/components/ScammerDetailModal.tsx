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
} from 'lucide-react';
import { api, getStoredUser } from '../api.ts';
import { AudioPlayerWidget } from './AudioPlayerWidget.tsx';
import { CallTimerWidget } from './CallTimerWidget.tsx';
import type { Scammer, PipelineStatus, User } from '../types.ts';

interface ScammerDetailModalProps {
  scammer: Scammer;
  isOpen: boolean;
  onClose: () => void;
  onUpdateScammer: (updated: Scammer) => void;
  onDeleteScammer: (id: string) => void;
  currentUser?: User | null;
}

export const ScammerDetailModal: React.FC<ScammerDetailModalProps> = ({
  scammer,
  isOpen,
  onClose,
  onUpdateScammer,
  onDeleteScammer,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'victim_info' | 'fraud_accounts'>('calls');

  // Edit fields
  const [status, setStatus] = useState<PipelineStatus>(scammer.status);
  const [flagged, setFlagged] = useState<boolean>(scammer.flagged);
  const [dangerLevel, setDangerLevel] = useState(scammer.dangerLevel);
  const [targetValue, setTargetValue] = useState<number>(scammer.targetValue || 0);
  const [priority, setPriority] = useState<number>(scammer.priority || 1);
  const [carrier, setCarrier] = useState(scammer.carrier || '');
  const [location, setLocation] = useState(scammer.location || '');
  const [scamType, setScamType] = useState(scammer.scamType);
  const [organization, setOrganization] = useState(scammer.organization || '');
  const [remoteAccessId, setRemoteAccessId] = useState(scammer.remoteAccessId || '');
  const [ipAddress, setIpAddress] = useState(scammer.ipAddress || '');
  const [victimGivenInfo, setVictimGivenInfo] = useState(scammer.victimGivenInfo || '');
  const [notes, setNotes] = useState(scammer.notes || '');

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

  // Fraud account form
  const [showAddFraud, setShowAddFraud] = useState(false);
  const [fraudType, setFraudType] = useState('bank_account');
  const [fraudDetails, setFraudDetails] = useState('');
  const [fraudInstitution, setFraudInstitution] = useState('');
  const [fraudHolder, setFraudHolder] = useState('');

  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  // Auto-save changes to scammer
  const handleSaveScammerInfo = async (fieldOverrides: Partial<Scammer> = {}) => {
    try {
      const payload: Partial<Scammer> = {
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
        victimGivenInfo,
        notes,
        ...fieldOverrides,
      };
      const res = await api.updateScammer(scammer.id, payload);
      onUpdateScammer(res.scammer);
    } catch (err) {
      console.error('Save scammer error:', err);
    }
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

  // Audio File Processing with Duration Enforcement
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

      // Update scammer state with new call
      const updatedCalls = [res.call, ...scammer.calls];
      const updatedScammer: Scammer = {
        ...scammer,
        calls: updatedCalls,
        totalTimeSpent: res.scammerTotalMinutes,
        todayTimeSpent: res.todayMinutes,
      };
      onUpdateScammer(updatedScammer);

      // Reset form
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

  // Add Fraud Account
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
    if (type === 'phone_website' || type === 'gift_card') return 'Phone Number / Website';
    return type.replace(/_/g, ' ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
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
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {scammer.fullName}
                </h2>
                {scammer.alias && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono border border-slate-700">
                    &quot;{scammer.alias}&quot;
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="font-mono text-slate-300">{scammer.phoneNumber}</span>
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

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(`${window.location.origin}/share/${scammer.id}`)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border bg-slate-800 text-slate-200 border-slate-700 hover:text-white hover:bg-slate-750"
              title="Copy shareable read-only public link"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>{copySuccess ? 'Link Copied!' : 'Share Public Link'}</span>
            </button>

            <button
              type="button"
              id="flag-scammer-btn"
              onClick={handleToggleFlag}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border ${
                flagged
                  ? 'bg-rose-600/20 text-rose-300 border-rose-500/50 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {flagged ? 'Flagged Fraudulent' : 'Flag Target'}
            </button>

            <button
              type="button"
              id="close-scammer-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Call Stopwatch Bar */}
        <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80">
          <CallTimerWidget
            scammerName={scammer.fullName}
            onLogCompletedCall={(minutes) => {
              setCallDuration(minutes);
              setShowAddCall(true);
              setActiveTab('calls');
            }}
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-5 gap-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('calls')}
            className={`py-3 px-3 font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'calls'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Call Logs & Audio Recordings ({scammer.calls.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Telecom & Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('victim_info')}
            className={`py-3 px-3 font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'victim_info'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Victim Given Info</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fraud_accounts')}
            className={`py-3 px-3 font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'fraud_accounts'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Flagged Accounts / Phone & Websites ({scammer.fraudAccounts.length})</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: CALL LOGS & RECORDINGS */}
          {activeTab === 'calls' && (
            <div className="space-y-4">
              {/* Dynamic Call Time Summary Banner */}
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

              {/* Add Call Button & Form */}
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-200">Call Log History</h4>
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
                  className="bg-slate-950 border border-rose-500/30 rounded-xl p-4 space-y-3"
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
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
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
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Victim Persona Used
                      </label>
                      <input
                        type="text"
                        id="input-call-persona"
                        placeholder="e.g. Grandma Gertrude, Arthur the Teacher"
                        value={callPersona}
                        onChange={(e) => setCallPersona(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Call Notes & Narrative
                    </label>
                    <textarea
                      rows={2}
                      id="input-call-notes"
                      placeholder="What happened during this call? What lies did the scammer tell?"
                      value={callNotes}
                      onChange={(e) => setCallNotes(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
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
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Call Outcome
                      </label>
                      <input
                        type="text"
                        id="input-call-outcome"
                        placeholder="e.g. Connected to VM, scammer hung up furious"
                        value={callOutcome}
                        onChange={(e) => setCallOutcome(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* Audio Upload Dropzone & Copy-Paste Target */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Attach Call Audio Recording (Click to upload, Drag &amp; Drop, or Copy/Paste)
                    </label>
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onPaste={handlePaste}
                      tabIndex={0}
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-rose-500/50 ${
                        isDraggingOver
                          ? 'border-rose-500 bg-rose-500/10'
                          : audioFileName
                          ? 'border-emerald-500/50 bg-emerald-950/20'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
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
                      <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                        <Upload className={`w-6 h-6 ${audioFileName ? 'text-emerald-400' : 'text-slate-400'}`} />
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
                              Limited to clips under 1.5 min (90 sec) &bull; Exception: cookiescambait@gmail.com
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
                  <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
                    No calls recorded yet. Use the Live Stopwatch above or click &quot;Log New Call&quot;.
                  </div>
                ) : (
                  scammer.calls.map((call) => (
                    <div
                      key={call.id}
                      className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                        <div className="flex items-center gap-3">
                          {/* Duration Badge with Inline Dynamic Editor */}
                          {editingCallId === call.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                value={editingDuration}
                                onChange={(e) => setEditingDuration(parseInt(e.target.value) || 0)}
                                className="w-16 bg-slate-900 border border-rose-500 rounded px-2 py-0.5 text-xs text-white"
                              />
                              <span className="text-xs text-slate-400">min</span>
                              <button
                                type="button"
                                onClick={() => handleSaveCallDuration(call.id)}
                                className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                                title="Save new duration"
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
                                title="Adjust duration (dynamically updates daily time)"
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
                        <div className="text-xs bg-slate-900/90 rounded-lg p-2 border border-slate-800 text-slate-400">
                          <span className="text-rose-400 font-semibold">Info Fed to Scammer:</span>{' '}
                          {call.infoGiven}
                        </div>
                      )}

                      {/* Embedded Audio Player if recording attached */}
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
          )}

          {/* TAB 2: TELECOM & PROFILE */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pipeline Stage */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Pipeline Stage
                  </label>
                  <select
                    value={status}
                    onChange={(e) => handleStatusChange(e.target.value as PipelineStatus)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="New / Uncalled">1. New / Uncalled</option>
                    <option value="Currently Baiting">2. Currently Baiting</option>
                    <option value="Top Scams">3. Top Scams</option>
                    <option value="Reported / Down">4. Reported / Down</option>
                    <option value="New Scammer">New Scammer (Legacy)</option>
                    <option value="Actively baiting">Actively baiting (Legacy)</option>
                    <option value="Payment Pending">Payment Pending (Legacy)</option>
                    <option value="Revealed / Reported">Revealed / Reported (Legacy)</option>
                  </select>
                </div>

                {/* Target Value in Dollars */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. 24000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Priority Rating */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Priority Rating
                  </label>
                  <div className="flex items-center gap-2 h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl">
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
                    <span className="text-[11px] text-slate-400 ml-2">
                      {priority === 1 ? 'Standard' : priority === 2 ? 'High Interest' : 'Top Priority'}
                    </span>
                  </div>
                </div>

                {/* Danger Level */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Scam Threat Level
                  </label>
                  <select
                    value={dangerLevel}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setDangerLevel(val);
                      handleSaveScammerInfo({ dangerLevel: val });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="low">Low Risk (Novice / Script kiddie)</option>
                    <option value="medium">Medium (Organized refund center)</option>
                    <option value="high">High (Aggressive remote extortion)</option>
                    <option value="critical">Critical (Financial drain / Wire fraud)</option>
                  </select>
                </div>
              </div>

              {/* Carrier & Telecom Info */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Radio className="w-4 h-4 text-amber-400" />
                    <span>Telecom & Carrier Details</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Carrier / VoIP Provider
                    </label>
                    <input
                      type="text"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      onBlur={() => handleSaveScammerInfo({ carrier })}
                      placeholder="e.g. Bandwidth.com, Onvoy LLC, Twilio"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Location / Route
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      onBlur={() => handleSaveScammerInfo({ location })}
                      placeholder="e.g. Kolkata / New Delhi call center gateway"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Scam Type, Fake Organization & Remote IDs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Scam Type
                  </label>
                  <select
                    value={scamType || 'Tech / Refund'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setScamType(val);
                      handleSaveScammerInfo({ scamType: val });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-medium focus:ring-2 focus:ring-emerald-500"
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
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Fake Organization
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    onBlur={() => handleSaveScammerInfo({ organization })}
                    placeholder="e.g. Deco Addict, Geek Squad"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Remote Access Session ID
                  </label>
                  <input
                    type="text"
                    value={remoteAccessId}
                    onChange={(e) => setRemoteAccessId(e.target.value)}
                    onBlur={() => handleSaveScammerInfo({ remoteAccessId })}
                    placeholder="AnyDesk or UltraViewer code"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Logged Scammer IP
                  </label>
                  <input
                    type="text"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    onBlur={() => handleSaveScammerInfo({ ipAddress })}
                    placeholder="Grabify or connection IP"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* General Dossier Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  General Dossier Notes
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => handleSaveScammerInfo({ notes })}
                  placeholder="Behavioral traits, background noise heard, scambait counter strategy..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white leading-relaxed"
                />
              </div>

              {/* Danger Zone: Delete */}
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
                  Delete Scammer Record
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: VICTIM GIVEN INFORMATION */}
          {activeTab === 'victim_info' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      Victim Given Information Tracker
                    </h4>
                    <p className="text-xs text-slate-400">
                      Record all fake data fed to the scammer (bait accounts, dummy SSNs, fake gift
                      cards, remote VM logins).
                    </p>
                  </div>
                </div>

                <textarea
                  rows={6}
                  value={victimGivenInfo}
                  onChange={(e) => setVictimGivenInfo(e.target.value)}
                  onBlur={() => handleSaveScammerInfo({ victimGivenInfo })}
                  placeholder="Example:
- Fake Bank: Metro Credit Union #8839-440192 (Name: Gertrude Higgins)
- Bogus SSN Fed: XXX-XX-9942
- Target Gift Cards Given: $500 code ending in 8819 (Declined)
- Remote VM IP: 192.168.1.50 (Fake honeypot desktop)"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* TAB 4: FLAGGER MULE ACCOUNTS / PHONE NUMBER & WEBSITES TRACKER */}
          {activeTab === 'fraud_accounts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-rose-400" />
                    Flagged Mule Accounts / Phone Number &amp; Websites ({scammer.fraudAccounts.length})
                  </h4>
                  <p className="text-xs text-slate-400">
                    Flag bank accounts, crypto wallets, phone numbers, websites, and Zelle drops collected for reporting to
                    financial institutions and IC3.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddFraud(!showAddFraud)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showAddFraud ? 'Cancel' : 'Flag Item'}
                </button>
              </div>

              {showAddFraud && (
                <form
                  onSubmit={handleAddFraudAccount}
                  className="bg-slate-950 border border-rose-500/30 rounded-xl p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Account Type
                      </label>
                      <select
                        value={fraudType}
                        onChange={(e) => setFraudType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="bank_account">Bank Account (Routing + Acct)</option>
                        <option value="crypto_wallet">Crypto Wallet (BTC, ETH, USDT)</option>
                        <option value="zelle">Zelle Recipient</option>
                        <option value="wire">Wire Transfer Details</option>
                        <option value="phone_website">Phone Number / Website</option>
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
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Details (Phone Number, URL, Acct Number, Address)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. +1 (800) 555-0199 or https://fake-tech-support.com"
                      value={fraudDetails}
                      onChange={(e) => setFraudDetails(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Mule / Account / Target Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Brandon M. (Money Mule)"
                      value={fraudHolder}
                      onChange={(e) => setFraudHolder(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
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
                      Save Flagged Item
                    </button>
                  </div>
                </form>
              )}

              {/* Accounts List */}
              <div className="space-y-2.5">
                {scammer.fraudAccounts.length === 0 ? (
                  <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
                    No items flagged yet. When a scammer provides account details, phone numbers, or websites, add them here.
                  </div>
                ) : (
                  scammer.fraudAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {formatAccountTypeLabel(acc.accountType)}
                          </span>
                          {acc.institution && (
                            <span className="text-xs text-slate-300 font-semibold">
                              {acc.institution}
                            </span>
                          )}
                          {acc.reportedToBank && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                              Reported
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-slate-200">{acc.accountDetails}</p>
                        {acc.holderName && (
                          <p className="text-[11px] text-slate-400">Holder: {acc.holderName}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
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
          )}
        </div>
      </div>
    </div>
  );
};
