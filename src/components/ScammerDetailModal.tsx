import React, { useState } from 'react';
import {
  X,
  Phone,
  Clock,
  Sparkles,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Upload,
  Plus,
  Trash2,
  Edit2,
  Check,
  Building,
  Globe,
  Radio,
  FileSpreadsheet,
  MessageSquare,
  DollarSign,
  Copy,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';
import { api } from '../api.ts';
import { AudioPlayerWidget } from './AudioPlayerWidget.tsx';
import { CallTimerWidget } from './CallTimerWidget.tsx';
import type { Scammer, CallLog, FraudAccount, PipelineStatus, CarrierIntel } from '../types.ts';

interface ScammerDetailModalProps {
  scammer: Scammer;
  isOpen: boolean;
  onClose: () => void;
  onUpdateScammer: (updated: Scammer) => void;
  onDeleteScammer: (id: string) => void;
}

export const ScammerDetailModal: React.FC<ScammerDetailModalProps> = ({
  scammer,
  isOpen,
  onClose,
  onUpdateScammer,
  onDeleteScammer,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'victim_info' | 'fraud_accounts' | 'ai_copilot'>('calls');

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
  const [callDuration, setCallDuration] = useState<number>(30);
  const [callPersona, setCallPersona] = useState('Grandma Gertrude');
  const [callNotes, setCallNotes] = useState('');
  const [callInfoGiven, setCallInfoGiven] = useState('');
  const [callOutcome, setCallOutcome] = useState('');
  const [audioFileName, setAudioFileName] = useState('');
  const [audioFileData, setAudioFileData] = useState('');

  // Editing existing call
  const [editingCallId, setEditingCallId] = useState<string | null>(null);
  const [editingDuration, setEditingDuration] = useState<number>(0);

  // Fraud account form
  const [showAddFraud, setShowAddFraud] = useState(false);
  const [fraudType, setFraudType] = useState('bank_account');
  const [fraudDetails, setFraudDetails] = useState('');
  const [fraudInstitution, setFraudInstitution] = useState('');
  const [fraudHolder, setFraudHolder] = useState('');

  // AI states
  const [carrierIntel, setCarrierIntel] = useState<CarrierIntel | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGeneratedScript, setAiGeneratedScript] = useState<string | null>(null);
  const [aiGeneratedTable, setAiGeneratedTable] = useState<string | null>(null);
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

  // Carrier scan with Gemini AI
  const handleLookupCarrier = async () => {
    setAiLoading(true);
    try {
      const res = await api.lookupCarrier(scammer.phoneNumber);
      setCarrierIntel(res.intel);
      if (res.intel.carrier) {
        const fullCarrier = `${res.intel.carrier} (${res.intel.lineType})`;
        setCarrier(fullCarrier);
        if (res.intel.location) setLocation(res.intel.location);
        await handleSaveScammerInfo({
          carrier: fullCarrier,
          location: res.intel.location || location,
        });
      }
    } catch (err) {
      console.error('AI carrier lookup error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // AI Copilot Actions
  const handleGenerateScript = async () => {
    setAiLoading(true);
    try {
      const res = await api.assistAI({
        action: 'generate_script',
        context: {
          scammerName: scammer.fullName,
          alias: scammer.alias,
          phone: scammer.phoneNumber,
          scamType,
          organization,
          persona: callPersona,
        },
      });
      if (res.counterScript) {
        setAiGeneratedScript(res.counterScript);
      }
    } catch (err) {
      console.error('AI script error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateTable = async () => {
    setAiLoading(true);
    try {
      const res = await api.assistAI({
        action: 'generate_table',
        context: {
          scammerName: scammer.fullName,
          alias: scammer.alias,
          phone: scammer.phoneNumber,
          scamType,
          organization,
          rawNotes: notes,
          victimInfoGiven: victimGivenInfo,
        },
      });
      if (res.generatedTableMarkdown) {
        setAiGeneratedTable(res.generatedTableMarkdown);
      }
    } catch (err) {
      console.error('AI table error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Audio File Upload Handler
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setAudioFileData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Add Call Log
  const handleAddCallLog = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const res = await api.addCall(scammer.id, {
        durationMinutes: callDuration,
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
    } catch (err) {
      console.error('Add call log error:', err);
    }
  };

  // Update Call Duration (Dynamic efficiency update!)
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
      // Recalculate today's time
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 overflow-y-auto flex flex-col min-h-screen w-full animate-fadeIn">
      {/* Top Header Navigation Bar */}
      <div className="sticky top-0 z-30 bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-4 sm:px-6 py-3.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Return Back Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="back-to-board-btn"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-2 border border-slate-700 shadow transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-amber-400" />
              <span>Back to Targets Board</span>
            </button>

            <div className="h-6 w-px bg-slate-800 hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                  flagged
                    ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                {flagged ? <ShieldAlert className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {scammer.fullName}
                  </h2>
                  {scammer.alias && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono border border-slate-700">
                      &quot;{scammer.alias}&quot;
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-400 mt-0.5">
                  <span className="font-mono text-slate-300">{scammer.phoneNumber}</span>
                  <span>&bull;</span>
                  <span className="text-amber-300 font-medium">{scamType}</span>
                  {organization && (
                    <>
                      <span>&bull;</span>
                      <span className="text-slate-300">{organization}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Time Counters & Flag/Close controls */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Today: {scammer.todayTimeSpent || 0}m
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-slate-300 font-mono font-bold">Total: {scammer.totalTimeSpent}m</span>
            </div>

            <button
              type="button"
              id="flag-scammer-btn"
              onClick={handleToggleFlag}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
                flagged
                  ? 'bg-rose-600/20 text-rose-300 border-rose-500/50 shadow-sm'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-750'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {flagged ? 'Flagged Fraudulent' : 'Flag Target'}
            </button>

            <button
              type="button"
              id="close-scammer-modal-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
              title="Close and return to board"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Full Page Workspace Container */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Live Call Stopwatch Bar */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl">
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
        <div className="flex border-b border-slate-800 bg-slate-900/60 rounded-2xl p-1.5 gap-2 overflow-x-auto text-xs border">
          <button
            type="button"
            onClick={() => setActiveTab('calls')}
            className={`py-2.5 px-4 font-bold rounded-xl transition whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'calls'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Call Logs & Recordings ({scammer.calls.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-4 font-bold rounded-xl transition whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Telecom & Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('victim_info')}
            className={`py-2.5 px-4 font-bold rounded-xl transition whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'victim_info'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Victim Given Info</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fraud_accounts')}
            className={`py-2.5 px-4 font-bold rounded-xl transition whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'fraud_accounts'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Fraud Accounts ({scammer.fraudAccounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai_copilot')}
            className={`py-2.5 px-4 font-bold rounded-xl transition whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'ai_copilot'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Gemini AI Copilot</span>
          </button>
        </div>

        {/* Page Content Panel */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 backdrop-blur-sm">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                  {/* Audio Upload Input */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Attach Call Audio Recording (.wav, .mp3)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition border border-slate-700">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose Audio File</span>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleAudioUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="text-xs text-slate-400 truncate">
                        {audioFileName || 'No recording chosen'}
                      </span>
                    </div>
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
                    <option value="New">1. New (Lead / Incoming)</option>
                    <option value="Qualified">2. Qualified (Active Session)</option>
                    <option value="Proposition">3. Proposition (Payment Pending)</option>
                    <option value="Won">4. Won (Neutralized / Reported)</option>
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

              {/* Carrier & Telecom with Gemini AI Scanner */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Radio className="w-4 h-4 text-amber-400" />
                    <span>Telecom & Carrier Intelligence</span>
                  </div>
                  <button
                    type="button"
                    id="scan-carrier-gemini-btn"
                    disabled={aiLoading}
                    onClick={handleLookupCarrier}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{aiLoading ? 'Scanning Carrier...' : 'Scan with Gemini AI'}</span>
                  </button>
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

                {carrierIntel && (
                  <div className="mt-2 p-3 bg-slate-900/90 rounded-lg border border-amber-500/30 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-amber-400 font-semibold">
                      <span>AI Carrier Scan Results</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">
                        Spoof Risk: {carrierIntel.spoofRisk}
                      </span>
                    </div>
                    <p className="text-slate-300">{carrierIntel.summary}</p>
                    <p className="text-slate-400 text-[11px]">
                      <strong className="text-slate-300">Recommended Action:</strong>{' '}
                      {carrierIntel.recommendedAction}
                    </p>
                  </div>
                )}
              </div>

              {/* Fake Organization & Remote IDs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Fake Organization
                  </label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    onBlur={() => handleSaveScammerInfo({ organization })}
                    placeholder="e.g. Geek Squad, FTC, PayPal"
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
                  <button
                    type="button"
                    onClick={handleGenerateTable}
                    disabled={aiLoading}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Generate Evidence Table</span>
                  </button>
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

              {aiGeneratedTable && (
                <div className="p-4 bg-slate-950 rounded-xl border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Generated Intelligence Table
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(aiGeneratedTable)}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copySuccess ? 'Copied!' : 'Copy Markdown'}
                    </button>
                  </div>
                  <pre className="text-xs text-slate-300 bg-slate-900 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
                    {aiGeneratedTable}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FRAUDULENT ACCOUNTS TRACKER */}
          {activeTab === 'fraud_accounts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-rose-400" />
                    Flagged Mule Accounts & Payment Drops
                  </h4>
                  <p className="text-xs text-slate-400">
                    Flag bank accounts, crypto wallets, and Zelle drops collected for reporting to
                    financial institutions and IC3.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddFraud(!showAddFraud)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showAddFraud ? 'Cancel' : 'Flag Account'}
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
                        <option value="gift_card">Gift Card Portal</option>
                        <option value="paypal">PayPal / CashApp Handle</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Institution / Network
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Chase Bank, Binance, Wells Fargo"
                        value={fraudInstitution}
                        onChange={(e) => setFraudInstitution(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Account Details (Address, Number, Routing)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Routing: 021000021, Acct: 9948102948"
                      value={fraudDetails}
                      onChange={(e) => setFraudDetails(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Mule / Account Holder Name
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
                      Save Fraud Account
                    </button>
                  </div>
                </form>
              )}

              {/* Accounts List */}
              <div className="space-y-2.5">
                {scammer.fraudAccounts.length === 0 ? (
                  <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
                    No fraud accounts flagged yet. When a scammer demands payment, add their mule
                    details here.
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
                            {acc.accountType.replace('_', ' ')}
                          </span>
                          {acc.institution && (
                            <span className="text-xs text-slate-300 font-semibold">
                              {acc.institution}
                            </span>
                          )}
                          {acc.reportedToBank && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                              Reported to Bank
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
                          title="Delete account"
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

          {/* TAB 5: GEMINI AI COPILOT */}
          {activeTab === 'ai_copilot' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Gemini AI Scambait Assistant</h4>
                    <p className="text-xs text-slate-400">
                      Generate stalling counter-scripts, pre-fill notes, and analyze call center tactics.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleGenerateScript}
                    disabled={aiLoading}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Generate Stalling Lines & Persona Dialogue</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateTable}
                    disabled={aiLoading}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span>Compile Intelligence Report Table</span>
                  </button>
                </div>
              </div>

              {aiGeneratedScript && (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-amber-400 font-bold">
                    <span>Generated Stalling Counter-Script</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(aiGeneratedScript)}
                      className="text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copySuccess ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed bg-slate-900/90 p-3 rounded-lg border border-slate-800/80">
                    {aiGeneratedScript}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
