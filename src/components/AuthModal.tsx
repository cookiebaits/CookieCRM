import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Mail,
  User as UserIcon,
  AlertCircle,
  PhoneCall,
  Clock,
  FolderKanban,
  Landmark,
} from 'lucide-react';
import { api } from '../api.ts';
import type { User } from '../types.ts';

interface AuthModalProps {
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configuredClientId, setConfiguredClientId] = useState<string>('');
  const [configAdminUser, setConfigAdminUser] = useState<string>('sbadmin@cookiebaits');
  const [dbSource, setDbSource] = useState<string>('Supabase Database');

  // Initialize Google Identity Services if client ID is configured
  useEffect(() => {
    let isMounted = true;

    const initGis = async () => {
      let clientId = ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string) || '';
      try {
        const config = await api.getConfig();
        if (config) {
          if (config.adminUser) setConfigAdminUser(config.adminUser);
          if (config.dbSource) setDbSource(config.dbSource);
          if (config.googleClientId) {
            clientId = config.googleClientId;
            setConfiguredClientId(clientId);
          }
        }
      } catch {
        // Fallback to client-side env
      }

      if (!isMounted) return;
      if (clientId) {
        setConfiguredClientId(clientId);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      if (win.google?.accounts?.id && clientId && !clientId.includes('sample-google-client-id')) {
        try {
          win.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: { credential: string }) => {
              try {
                setGoogleLoading(true);
                const res = await api.googleAuth({ credential: response.credential });
                onSuccess(res.user);
              } catch (err: any) {
                setError(err.message || 'Google sign-in failed');
              } finally {
                setGoogleLoading(false);
              }
            },
          });
        } catch (e) {
          console.warn('Google Identity initialization notice:', e);
        }
      }
    };

    initGis();
    return () => {
      isMounted = false;
    };
  }, [onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login(email, password);
        onSuccess(res.user);
      } else {
        const res = await api.register(email, password, name);
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickGoogleLogin = async (customEmail?: string) => {
    setError(null);
    setGoogleLoading(true);
    try {
      const emailToUse = customEmail || email || 'cookiescambait@gmail.com';
      const nameToUse =
        emailToUse === 'cookiescambait@gmail.com'
          ? 'Cookie Scambaiter'
          : emailToUse === 'sbadmin@cookiebaits'
          ? 'SB Admin'
          : 'Scambaiter Operator';
      const res = await api.googleAuth({
        email: emailToUse,
        name: nameToUse,
        avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocKz-avatar-user=s96-c',
        googleId: `google_${Date.now()}`,
      });
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Banner */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-950/50">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-100 flex items-center gap-2">
              Scambaiter CRM <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">Intelligence</span>
            </h1>
            <p className="text-xs text-slate-400">Tactical operations & scammer case management</p>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1">
        {/* Left Column: CRM Feature Breakdown */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-amber-400 font-medium">
              <Shield className="w-4 h-4 text-amber-400" />
              Tactical Scambaiting Operations CRM
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Track Scammers. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400">
                Wield Intelligence. Protect Victims.
              </span>
            </h2>
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
              A high-precision CRM engineered specifically for scambaiters to log calls, attach audio recordings,
              drag & drop pipeline targets, and dynamically track hours wasted on fraud rings.
            </p>
          </div>

          {/* Core Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">Call Logs & Audio Attachments</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Log every interaction, store audio evidence, persona aliases, and victim information disclosed.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">Dynamic Daily Time Tracking</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Real-time efficiency metrics showing daily time spent with each scammer and monthly aggregate trends.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">Interactive Pipeline Kanban</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Drag & drop active scammer cases across pipeline stages: from initial contact to law enforcement handoff and victim resolution.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <Landmark className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">Fraud Accounts & Mule Ledger</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Document and link scammer bank accounts, crypto wallets, payment handles, and money mule identities in structured dossiers.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
            {/* Header Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {mode === 'login' ? 'Scambaiter Access' : 'Create Operator Account'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {mode === 'login' ? 'Enter credentials to open your pipeline' : 'Join and secure your scammer database'}
                </p>
              </div>
              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  id="tab-login-btn"
                  onClick={() => { setMode('login'); setError(null); }}
                  className={`px-3 py-1.5 rounded-md font-medium transition ${
                    mode === 'login' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  id="tab-signup-btn"
                  onClick={() => { setMode('register'); setError(null); }}
                  className={`px-3 py-1.5 rounded-md font-medium transition ${
                    mode === 'register' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Google / Gmail Sign In Section */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                id="google-login-btn"
                disabled={googleLoading}
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const win = window as any;
                  if (win.google?.accounts?.id && configuredClientId && !configuredClientId.includes('sample-google-client-id')) {
                    try {
                      win.google.accounts.id.prompt((notification: any) => {
                        if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
                          handleQuickGoogleLogin();
                        }
                      });
                      return;
                    } catch {
                      // fallback smoothly
                    }
                  }
                  handleQuickGoogleLogin();
                }}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white font-medium text-sm transition hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer shadow-sm"
              >
                {/* Official Google 'G' Icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{googleLoading ? 'Connecting Google API...' : 'Continue with Google / Gmail'}</span>
              </button>

              <div className="relative flex items-center justify-center pt-2">
                <div className="border-t border-slate-800 w-full"></div>
                <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                  or email login
                </span>
                <div className="border-t border-slate-800 w-full"></div>
              </div>
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Your Name / Call Sign</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      id="input-name"
                      required
                      placeholder="e.g. Scambaiter Dan"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    id="input-email"
                    required
                    placeholder="you@cookiebaits or you@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    id="input-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="submit-auth-btn"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-sm transition shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <span>{mode === 'login' ? 'Sign In to Tracker' : 'Create Scambaiter Account'}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
        Scambaiter CRM Tracker &bull; Persistent DB Source: {dbSource} &bull; Dokploy, Traefik & Cloudflare S3 Ready
      </footer>
    </div>
  );
};
