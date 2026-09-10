import React, { useState } from 'react';
import { X, UserPlus, Sparkles, Phone, User, Tag, AlertCircle } from 'lucide-react';
import { api } from '../api.ts';
import type { Scammer } from '../types.ts';

interface QuickAddScammerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (scammer: Scammer) => void;
}

export const QuickAddScammerModal: React.FC<QuickAddScammerModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const [fullName, setFullName] = useState('');
  const [alias, setAlias] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [scanCarrierWithAI, setScanCarrierWithAI] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phoneNumber.trim()) {
      setError('Full Name and Phone Number are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create the scammer in the database
      const res = await api.createScammer({
        fullName: fullName.trim(),
        alias: alias.trim() || undefined,
        phoneNumber: phoneNumber.trim(),
        status: 'New Scammer',
      });

      let finalScammer = res.scammer;

      // 2. If Gemini AI scan is enabled, asynchronously look up the telecom carrier
      if (scanCarrierWithAI) {
        try {
          const aiRes = await api.lookupCarrier(phoneNumber.trim());
          if (aiRes.intel && aiRes.intel.carrier) {
            const updated = await api.updateScammer(finalScammer.id, {
              carrier: `${aiRes.intel.carrier} (${aiRes.intel.lineType})`,
              location: aiRes.intel.location,
              notes: `AI Intel: ${aiRes.intel.summary}`,
            });
            finalScammer = updated.scammer;
          }
        } catch (aiErr) {
          console.warn('Background AI carrier scan notification:', aiErr);
        }
      }

      onCreated(finalScammer);
      setFullName('');
      setAlias('');
      setPhoneNumber('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add scammer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Decorative ambient gradient */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-36 h-36 bg-rose-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add New Scammer</h3>
              <p className="text-xs text-slate-400">Add to triage pipeline with minimal fields</p>
            </div>
          </div>
          <button
            type="button"
            id="close-quick-add-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Full Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              id="input-scammer-fullname"
              required
              autoFocus
              placeholder="e.g. John Miller or Unknown Caller"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          {/* 2. Alias */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              Alias / Scammer Moniker
            </label>
            <input
              type="text"
              id="input-scammer-alias"
              placeholder="e.g. Officer Kevin Miller, David from Geek Squad"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          {/* 3. Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              Phone Number <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              id="input-scammer-phone"
              required
              placeholder="e.g. +1 (800) 419-7221 or 888-529-8834"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          {/* AI Carrier Check Toggle */}
          <div className="pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl hover:border-slate-700 transition">
              <input
                type="checkbox"
                id="toggle-ai-carrier-scan"
                checked={scanCarrierWithAI}
                onChange={(e) => setScanCarrierWithAI(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 bg-slate-900 border-slate-700 focus:ring-rose-500"
              />
              <div className="flex-1">
                <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Auto-scan carrier with Gemini AI
                </div>
                <div className="text-[11px] text-slate-400">
                  Detect VoIP providers (Bandwidth, Onvoy, Twilio) and area location
                </div>
              </div>
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              id="cancel-add-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-scammer-btn"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition shadow-lg shadow-rose-950/50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                  <span>Saving & Scanning...</span>
                </>
              ) : (
                <span>Add to Pipeline</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
