import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Mail,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  PhoneCall,
  Clock,
  Database,
  Server,
  Settings,
  Copy,
  Check,
  X,
  LogIn,
  UserPlus,
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
  const [configTesterUser, setConfigTesterUser] = useState<string>('cookiescambait@gmail.com');
  const [dbSource, setDbSource] = useState<string>('Default SQLite (prisma/scambaiter.db)');
  const [googleOAuthActive, setGoogleOAuthActive] = useState<boolean>(false);
  const [showDokployModal, setShowDokployModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Initialize Google Identity Services if client ID is configured
  useEffect(() => {
    let isMounted = true;

    const initGis = async () => {
      let clientId = ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string) || '';
      try {
        const config = await api.getConfig();
        if (config) {
          if (config.adminUser) setConfigAdminUser(config.adminUser);
          if (config.testerUser) setConfigTesterUser(config.testerUser);
          if (config.dbSource) setDbSource(config.dbSource);
          if (config.googleOAuthEnabled) setGoogleOAuthActive(true);
          if (config.googleClientId) {
            clientId = config.googleClientId;
            setConfiguredClientId(clientId);
            setGoogleOAuthActive(true);
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
      const emailToUse = customEmail || email || configTesterUser || 'cookiescambait@gmail.com';
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

  const handleFillAdmin = () => {
    setEmail(configAdminUser || 'sbadmin@cookiebaits');
    setPassword('sbAdmin2026!#');
    setError(null);
  };

  const handleFillTester = () => {
    setEmail(configTesterUser || 'cookiescambait@gmail.com');
    setPassword('scambaiter123');
    setError(null);
  };

  const dokployEnvSnippet = `# Dokploy Environment Settings for Scambaiter CRM
ADMIN_USER="${configAdminUser}"
ADMIN_PASS="sbAdmin2026!#"
TESTER_USER="${configTesterUser}"
TESTER_PASS="scambaiter123"
DB="file:./prisma/scambaiter.db"
GOOGLE_CLIENT_ID="${configuredClientId || 'your-google-oauth-client-id.apps.googleusercontent.com'}"
JWT_SECRET="super-secret-scambaiter-crm-token-2026"`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(dokployEnvSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Banner Header */}
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

        {/* Top Header Buttons with Themed Colors */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); }}
            className={`px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer ${
              mode === 'login'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-rose-950/50 ring-2 ring-rose-500/30'
                : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-500/50'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); }}
            className={`px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer ${
              mode === 'register'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-rose-950/50 ring-2 ring-rose-500/30'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/50'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Sign Up</span>
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1">
        {/* Left Column: CRM Feature Breakdown */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-amber-400 font-medium">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Gemini AI Telecom & Dossier Powered
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
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">Gemini AI Provider Scan</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                AI scanner instantly identifies telecom carriers, VoIP gateways, line types, and auto-generates scambait scripts.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">Dokploy & S3 Backup</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Prisma SQLite persistent storage with full automated migration scripts ready for Cloudflare S3 & Dokploy.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
            {/* Header Tabs with Themed Color Buttons */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {mode === 'login' ? 'Scambaiter Access' : 'Create Operator Account'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {mode === 'login' ? 'Enter credentials to open your pipeline' : 'Join and secure your scammer database'}
                </p>
              </div>

              {/* Colorful Tab Selector */}
              <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs gap-1">
                <button
                  type="button"
                  id="tab-login-btn"
                  onClick={() => { setMode('login'); setError(null); }}
                  className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    mode === 'login'
                      ? 'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-md shadow-rose-950/50'
                      : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Login</span>
                </button>
                <button
                  type="button"
                  id="tab-signup-btn"
                  onClick={() => { setMode('register'); setError(null); }}
                  className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    mode === 'register'
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md shadow-amber-950/50'
                      : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sign Up</span>
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
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between text-xs px-0.5">
                <span className="text-slate-400 font-medium">Google Authentication</span>
                {googleOAuthActive ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    OAuth Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono">
                    <AlertCircle className="w-3 h-3 text-amber-400" />
                    Ready &bull; Add Client ID
                  </span>
                )}
              </div>

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

            {/* Quick Fill & Dokploy Environment Helpers */}
            <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2.5 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Quick Login Credentials
                </span>
                <button
                  type="button"
                  id="open-dokploy-guide-btn"
                  onClick={() => setShowDokployModal(true)}
                  className="text-slate-400 hover:text-white flex items-center gap-1 transition text-xs"
                >
                  <Settings className="w-3.5 h-3.5 text-rose-400" />
                  Dokploy Settings
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  id="fill-admin-btn"
                  onClick={handleFillAdmin}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-200 text-left transition flex flex-col cursor-pointer"
                >
                  <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Admin</span>
                  <span className="text-xs truncate font-mono text-slate-300">{configAdminUser}</span>
                </button>

                <button
                  type="button"
                  id="fill-tester-btn"
                  onClick={handleFillTester}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-slate-200 text-left transition flex flex-col cursor-pointer"
                >
                  <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">Tester</span>
                  <span className="text-xs truncate font-mono text-slate-300">{configTesterUser}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Dokploy Environment Settings Modal */}
      {showDokployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-950/40">
                  <Server className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    Dokploy Environment Configuration
                  </h3>
                  <p className="text-xs text-slate-400">
                    Paste these parameters into Dokploy &gt; Your Application &gt; Environment
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDokployModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-semibold">Environment Variables Block</span>
                <button
                  type="button"
                  id="copy-dokploy-snippet-btn"
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied to Clipboard!' : 'Copy Config Block'}
                </button>
              </div>

              <div className="relative">
                <pre className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed">
                  {dokployEnvSnippet}
                </pre>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="font-semibold text-amber-400 block mb-1">ADMIN_USER & ADMIN_PASS</span>
                  <p className="text-slate-400">
                    Primary administrative credentials (changed to <code className="text-slate-200">sbadmin@cookiebaits</code>). Grants full CRM control, user creation, role assignment, and deletion powers.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="font-semibold text-rose-400 block mb-1">TESTER_USER & TESTER_PASS</span>
                  <p className="text-slate-400">
                    Dedicated testing/operator account (defaults to <code className="text-slate-200">cookiescambait@gmail.com</code>). Pre-seeded and synchronized on container startup.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="font-semibold text-blue-400 block mb-1">DB Parameter</span>
                  <p className="text-slate-400">
                    Path to the SQLite database file holding registered users & scammer records. In Dokploy, you can mount a persistent volume (e.g. <code className="text-slate-200">/data/crm.db</code>) and set <code className="text-slate-200">DB=file:/data/crm.db</code>.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="font-semibold text-emerald-400 block mb-1">GOOGLE_CLIENT_ID</span>
                  <p className="text-slate-400">
                    Your Google OAuth 2.0 Web Client ID from Google Cloud Console. Enables direct "Continue with Google" authentication for any team member.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDokployModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
        Scambaiter CRM Tracker &bull; Persistent DB Source: {dbSource} &bull; Dokploy, Traefik & Cloudflare S3 Ready
      </footer>
    </div>
  );
};
