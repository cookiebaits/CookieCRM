import React, { useState, useEffect } from 'react';
import {
  Phone,
  Clock,
  Shield,
  ShieldAlert,
  Radio,
  MessageSquare,
  DollarSign,
  Copy,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { api } from '../api.ts';
import { AudioPlayerWidget } from './AudioPlayerWidget.tsx';
import type { Scammer } from '../types.ts';

interface PublicScammerViewProps {
  scammerId: string;
  onGoHome?: () => void;
}

export const PublicScammerView: React.FC<PublicScammerViewProps> = ({
  scammerId,
  onGoHome,
}) => {
  const [scammer, setScammer] = useState<Scammer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'calls' | 'victim_info' | 'fraud_accounts'>('calls');
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    async function fetchPublicData() {
      try {
        setLoading(true);
        const res = await api.getPublicScammer(scammerId);
        setScammer(res.scammer);
      } catch (err: any) {
        setError(err.message || 'Failed to load target details or case does not exist.');
      } finally {
        setLoading(false);
      }
    }
    fetchPublicData();
  }, [scammerId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const formatAccountTypeLabel = (type: string) => {
    if (type === 'phone_website' || type === 'gift_card') return 'Phone Number / Website';
    return type.replace(/_/g, ' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-400">
        <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3"></div>
        <span className="text-xs font-mono">Loading Public Intelligence Record...</span>
      </div>
    );
  }

  if (error || !scammer) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-300">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-white">Record Unavailable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{error || 'This public record could not be found.'}</p>
          {onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition"
            >
              Return Home
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Read-Only Top Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 px-4 sm:px-6 py-3.5 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Scambaiter CRM" className="h-8 w-auto object-contain" />
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-semibold border border-slate-700 flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-400" />
              Public Read-Only Intelligence Report
            </span>
          </div>

          {onGoHome && (
            <button
              type="button"
              onClick={onGoHome}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
            >
              <span>Access Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Banner Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                scammer.flagged
                  ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {scammer.flagged ? <ShieldAlert className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">{scammer.fullName}</h1>
                {scammer.alias && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono border border-slate-700">
                    &quot;{scammer.alias}&quot;
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="font-mono text-slate-300">{scammer.phoneNumber}</span>
                <span>&bull;</span>
                <span className="text-slate-300">{scammer.organization || scammer.scamType}</span>
                <span>&bull;</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Total Bait Time: {scammer.totalTimeSpent} mins
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(window.location.href)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>{copySuccess ? 'Link Copied!' : 'Share Public Report'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="flex border-b border-slate-800 bg-slate-950 px-4 gap-2 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('calls')}
              className={`py-3.5 px-3 font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'calls'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Call Logs & Recordings ({scammer.calls.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-3.5 px-3 font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'overview'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Telecom & Intelligence Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('victim_info')}
              className={`py-3.5 px-3 font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
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
              className={`py-3.5 px-3 font-semibold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${
                activeTab === 'fraud_accounts'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Flagged Accounts / Phone & Websites ({scammer.fraudAccounts.length})</span>
            </button>
          </div>

          <div className="p-5">
            {/* TAB 1: CALL LOGS */}
            {activeTab === 'calls' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
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

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                        Interactions Recorded
                      </p>
                      <p className="text-xl font-bold text-amber-400 mt-0.5">
                        {scammer.calls.length} calls
                      </p>
                    </div>
                    <MessageSquare className="w-6 h-6 text-amber-500/40" />
                  </div>
                </div>

                <div className="space-y-3">
                  {scammer.calls.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      No public call logs available.
                    </div>
                  ) : (
                    scammer.calls.map((call) => (
                      <div
                        key={call.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-3">
                            <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold font-mono text-xs border border-rose-500/30">
                              {call.durationMinutes} mins
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(call.date).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {call.victimPersonaUsed && (
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                              Persona: {call.victimPersonaUsed}
                            </span>
                          )}
                        </div>

                        {call.notes && (
                          <p className="text-xs text-slate-300 leading-relaxed">{call.notes}</p>
                        )}

                        {call.infoGiven && (
                          <div className="text-xs bg-slate-900 rounded-lg p-2 border border-slate-800 text-slate-400">
                            <span className="text-rose-400 font-semibold">Info Fed:</span>{' '}
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
            )}

            {/* TAB 2: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <p className="text-slate-400 font-semibold">Pipeline Status</p>
                    <p className="text-sm font-bold text-slate-100">{scammer.status}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <p className="text-slate-400 font-semibold">Target Deal / Fraud Amount</p>
                    <p className="text-sm font-mono font-bold text-emerald-400">
                      ${scammer.targetValue ? scammer.targetValue.toLocaleString() : '0'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="font-bold text-slate-200">Telecom & Provider Details</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block mb-1">Carrier / Provider:</span>
                      <span className="text-slate-200 font-medium">{scammer.carrier || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-1">Location / Gateway:</span>
                      <span className="text-slate-200 font-medium">{scammer.location || 'Unknown'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <p className="text-slate-400 font-semibold">Dossier Summary Notes</p>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{scammer.notes || 'No public notes provided.'}</p>
                </div>
              </div>
            )}

            {/* TAB 3: VICTIM GIVEN INFO */}
            {activeTab === 'victim_info' && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Victim Given Information
                </h3>
                <p className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {scammer.victimGivenInfo || 'No victim information logged.'}
                </p>
              </div>
            )}

            {/* TAB 4: FRAUD ACCOUNTS */}
            {activeTab === 'fraud_accounts' && (
              <div className="space-y-3">
                {scammer.fraudAccounts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No flagged accounts or handles recorded.
                  </div>
                ) : (
                  scammer.fraudAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
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
                        </div>
                        <p className="text-xs font-mono text-slate-200">{acc.accountDetails}</p>
                        {acc.holderName && (
                          <p className="text-[11px] text-slate-400">Holder: {acc.holderName}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(acc.accountDetails)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                        title="Copy details"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-500">
        Scambaiter Intelligence CRM &bull; Public Details Share
      </footer>
    </div>
  );
};
