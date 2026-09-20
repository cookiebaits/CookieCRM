import React, { useState } from 'react';
import { Shield, ScrollText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../api.ts';
import type { User } from '../types.ts';

interface TermsAndPrivacyModalProps {
  isOpen: boolean;
  onAccepted: (updatedUser: User) => void;
}

export const TermsAndPrivacyModal: React.FC<TermsAndPrivacyModalProps> = ({
  isOpen,
  onAccepted,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccept = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.acceptTerms();
      onAccepted(res.user);
    } catch (err: any) {
      setError(err.message || 'Failed to record terms acceptance.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              Terms of Use &amp; Privacy Policy Acceptance Required
            </h2>
            <p className="text-xs text-slate-400">
              Please review and accept our Privacy Policy and Website Terms of Use to continue adding target cases.
            </p>
          </div>
        </div>

        {/* Scrollable Policy Content */}
        <div className="p-5 overflow-y-auto flex-1 text-xs text-slate-300 space-y-6 font-sans leading-relaxed select-text bg-slate-950/40 custom-scrollbar">
          {/* PRIVACY POLICY */}
          <div className="space-y-3 border-b border-slate-800/80 pb-6">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <ScrollText className="w-4 h-4" />
              <h3>PRIVACY POLICY | RUINSCAMS.COM &amp; COOKIEBAITS &amp; IGNITE LLC</h3>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Effective Date: 04‑20, 2026</p>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-100">1. INTRODUCTION</h4>
              <p>
                Ruinscams.com &amp; Cookiebaits is a California Limited Liability Corporation (“Cookiebaits,” “Ruinscams.com” “Ignite, LLC “we,” “our,” “us”). We provide educational resources, tools, and presentations to end scamming through education.
              </p>
              <p className="text-slate-400">Contact Email: report@ruinscams.com</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-100">2. PERSONAL INFORMATION WE COLLECT</h4>
              <p>
                We collect Contact Information, Transaction and Payment Information, Usage and Device Data, Scam Report and Search Data, User-Uploaded Content, Support Communications, Educational Materials Downloads, and Children’s Information consistent with applicable laws.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-100">3. HOW WE COLLECT &amp; USE INFORMATION</h4>
              <p>
                Information is collected directly through newsletter signups, donations, scam search tools, and website interactions. We use personal information to operate scam identification tools, send updates, register presentation attendees, process donations, and enforce terms.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-100">4. SHARING AND DISCLOSURE</h4>
              <p>
                We do not sell personal information. Disclosures are limited to bound service providers, search/database integrations (Google, Brave, Bing, Better Business Bureau), and law enforcement or legal requirements.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-100">5. DATA SECURITY &amp; RETENTION</h4>
              <p>
                We maintain administrative, technical, and physical safeguards designed to protect personal information against unauthorized access, destruction, loss, or alteration.
              </p>
            </div>
          </div>

          {/* TERMS OF USE */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <ScrollText className="w-4 h-4" />
              <h3>WEBSITE TERMS OF USE</h3>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">Version 1.0 &bull; Last revised: 04-20, 2026</p>

            <div className="space-y-2">
              <p>
                The website located at ruinscams.com (the “Site”) is a copyrighted work belonging to IGNITE, LLC a California Limited Liability organization (“Company”, “us”, “our”, and “we”) which owns brands Cookieclip AI, Ruinscams.com &amp; Cookiebaits.
              </p>
              <p className="font-semibold text-rose-300">
                BY ACCESSING OR USING THE SITE AND CRM TOOL, YOU REPRESENT THAT YOU ARE AT LEAST 18 YEARS OLD AND AGREE TO BE BOUND BY THESE TERMS, INCLUDING THE BINDING ARBITRATION AGREEMENT IN SECTION 10.2.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-slate-100">USER CONTRIBUTED CONTENT &amp; LICENSE</h4>
              <p>
                When you upload photographs, screenshots, audio, or other content to our website or CRM (“User Contributed Content”), you grant Ignite a non-exclusive, royalty-free, perpetual license to use, display, reproduce, and distribute that content for educational and informational purposes in connection with our mission.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Accept Action */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          {error ? (
            <div className="text-xs text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 text-center sm:text-left">
              Acceptance is required once per account for new logins and addition actions.
            </p>
          )}

          <button
            type="button"
            onClick={handleAccept}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                <span>Recording Acceptance...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Accept Terms of Use &amp; Privacy Policy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
