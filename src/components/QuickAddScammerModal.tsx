import React, { useState, useEffect } from 'react';
import { X, UserPlus, Sparkles, Phone, User, Tag, AlertCircle, DollarSign, Building, Star } from 'lucide-react';
import { api } from '../api.ts';
import type { Scammer, CanonicalStatus } from '../types.ts';

interface QuickAddScammerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (scammer: Scammer) => void;
  initialStatus?: CanonicalStatus;
}

export const QuickAddScammerModal: React.FC<QuickAddScammerModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  initialStatus = 'New',
}) => {
  const [fullName, setFullName] = useState('');
  const [alias, setAlias] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [status, setStatus] = useState<CanonicalStatus>(initialStatus);
  const [targetValue, setTargetValue] = useState<string>('5000');
  const [organization, setOrganization] = useState('');
  const [priority, setPriority] = useState<number>(2);
  const [scanCarrierWithAI, setScanCarrierWithAI] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus(initialStatus || 'New');
    }
  }, [isOpen, initialStatus]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phoneNumber.trim()) {
      setError('Case / Full Name and Phone Number are required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const numericVal = Math.max(0, Math.round(Number(targetValue) || 0));

      // 1. Create the scammer in the database
      const res = await api.createScammer({
        fullName: fullName.trim(),
        alias: alias.trim() || undefined,
        phoneNumber: phoneNumber.trim(),
        status,
        targetValue: numericVal,
        priority,
        organization: organization.trim() || undefined,
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
      setTargetValue('5000');
      setOrganization('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add scammer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden my-8">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create Pipeline Case</h3>
              <p className="text-xs text-slate-400">Add a new target or case into the CRM board</p>
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. Full Name / Title */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Case / Scammer Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              id="input-scammer-fullname"
              required
              autoFocus
              placeholder="e.g. Office Tech Support (Alex Watson) or David Miller"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* 2. Phone Number & Organization */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Phone Number <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                id="input-scammer-phone"
                required
                placeholder="e.g. +1 (888) 529-8834"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                Company / Organization
              </label>
              <input
                type="text"
                id="input-scammer-org"
                placeholder="e.g. Deco Addict, Geek Squad Renewal"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* 3. Stage & Target Deal Value */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Baiting Stage
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CanonicalStatus)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="New">1. New (Lead / Incoming)</option>
                <option value="Qualified">2. Qualified (Active Session)</option>
                <option value="Proposition">3. Proposition (Payment Pending)</option>
                <option value="Won">4. Won (Neutralized / Reported)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Target Fraud Amount ($)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                id="input-scammer-value"
                placeholder="e.g. 24000"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
              />
            </div>
          </div>

          {/* 4. Alias & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                Alias / Moniker
              </label>
              <input
                type="text"
                id="input-scammer-alias"
                placeholder="e.g. David from Support"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                Priority Rating
              </label>
              <div className="flex items-center gap-2 h-9 px-3 bg-slate-950 border border-slate-800 rounded-xl">
                {[1, 2, 3].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setPriority(star)}
                    className="text-lg transition hover:scale-125"
                  >
                    <span className={star <= priority ? 'text-amber-400' : 'text-slate-600'}>
                      ★
                    </span>
                  </button>
                ))}
                <span className="text-[11px] text-slate-400 ml-2">
                  {priority === 1 ? 'Standard' : priority === 2 ? 'High Interest' : 'Top Priority'}
                </span>
              </div>
            </div>
          </div>

          {/* AI Carrier Check Toggle */}
          <div className="pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl hover:border-slate-700 transition">
              <input
                type="checkbox"
                id="toggle-ai-carrier-scan"
                checked={scanCarrierWithAI}
                onChange={(e) => setScanCarrierWithAI(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
              />
              <div className="flex-1">
                <div className="font-medium text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Auto-scan carrier with Gemini AI
                </div>
                <div className="text-[11px] text-slate-400">
                  Detect VoIP providers (Bandwidth, Onvoy, Twilio) and area route
                </div>
              </div>
            </label>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800/80">
            <button
              type="button"
              id="cancel-add-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="save-scammer-btn"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl transition shadow-lg shadow-emerald-950/50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                  <span>Saving & Scanning...</span>
                </>
              ) : (
                <span>Save to {status}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
