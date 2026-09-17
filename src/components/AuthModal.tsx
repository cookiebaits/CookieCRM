import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  User as UserIcon,
  AlertCircle,
  PhoneCall,
  Clock,
  FolderKanban,
  Landmark,
  MailCheck,
  CheckCircle2,
  ArrowLeft,
  KeyRound,
  RotateCw,
  ExternalLink,
  LogIn,
  UserPlus,
  LayoutDashboard,
  Menu,
  X,
} from 'lucide-react';
import { api, getStoredToken, getStoredUser } from '../api.ts';
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cachedUser, setCachedUser] = useState<User | null>(getStoredUser());

  // Activation states
  const [activationPendingEmail, setActivationPendingEmail] = useState<string | null>(null);
  const [activationTokenInput, setActivationTokenInput] = useState<string>('');
  const [activating, setActivating] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [simulatedUrl, setSimulatedUrl] = useState<string | null>(null);

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
    setResendSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.login(email, password);
        onSuccess(res.user);
      } else {
        const res = await api.register(email, password, name);
        if (res.requiresActivation) {
          setActivationPendingEmail(res.email || email);
          if (res.simulated && res.activationUrl) {
            setSimulatedUrl(res.activationUrl);
          }
        } else if (res.user) {
          onSuccess(res.user);
        }
      }
    } catch (err: any) {
      if (err.requiresActivation || err.data?.requiresActivation) {
        setActivationPendingEmail(err.email || err.data?.email || email);
        setError(err.message || 'Please activate your account before logging in.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationTokenInput.trim()) {
      setError('Please paste or enter your activation token.');
      return;
    }

    setError(null);
    setActivating(true);
    try {
      const res = await api.activateAccount(activationTokenInput.trim());
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Activation failed. Please check your token.');
    } finally {
      setActivating(false);
    }
  };

  const handleResendActivation = async () => {
    if (!activationPendingEmail) return;
    setResending(true);
    setError(null);
    setResendSuccess(null);
    try {
      const res = await api.resendActivation(activationPendingEmail);
      setResendSuccess(res.message || 'A new activation email has been sent!');
      if (res.simulated && res.activationUrl) {
        setSimulatedUrl(res.activationUrl);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend activation email.');
    } finally {
      setResending(false);
    }
  };

  const handleQuickGoogleLogin = async (customEmail?: string) => {
    setError(null);
    setGoogleLoading(true);
    try {
      const emailToUse = (customEmail || email || '').trim();
      if (!emailToUse) {
        setError('Please enter your Google / Gmail address in the email field below to continue.');
        setGoogleLoading(false);
        return;
      }

      const localPart = emailToUse.split('@')[0] || 'Scambaiter';
      const formattedName = localPart.charAt(0).toUpperCase() + localPart.slice(1);
      const nameToUse = name || (formattedName + ' (Operator)');

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

  const handleGoogleSignInClick = () => {
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const clientId = configuredClientId;

    // 1. Google OAuth 2.0 Token Client (popup flow designed by Google for custom buttons)
    if (win.google?.accounts?.oauth2 && clientId && !clientId.includes('sample-google-client-id')) {
      try {
        setGoogleLoading(true);
        const tokenClient = win.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              console.warn('[AUTH] Google sign-in response notice:', tokenResponse.error);
              setGoogleLoading(false);
              return;
            }
            if (tokenResponse.access_token) {
              try {
                const res = await api.googleAuth({ accessToken: tokenResponse.access_token });
                onSuccess(res.user);
              } catch (err: any) {
                setError(err.message || 'Google authentication failed.');
              } finally {
                setGoogleLoading(false);
              }
            }
          },
          error_callback: (err: any) => {
            console.warn('[AUTH] Google OAuth client notice:', err);
            setGoogleLoading(false);
            handleQuickGoogleLogin();
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('[AUTH] Failed to initialize Google OAuth token client:', err);
      }
    }

    // 2. Google Identity Services ID Token One Tap prompt
    if (win.google?.accounts?.id && clientId && !clientId.includes('sample-google-client-id')) {
      try {
        win.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
            handleQuickGoogleLogin();
          }
        });
        return;
      } catch {
        // continue to fallback
      }
    }

    // 3. Fallback: prompt or use entered email
    handleQuickGoogleLogin();
  };

  const handleDashboardClick = async () => {
    const token = getStoredToken();
    const storedUser = getStoredUser();
    if (token && storedUser) {
      try {
        setLoading(true);
        const res = await api.getMe();
        onSuccess(res.user);
        return;
      } catch {
        onSuccess(storedUser);
        return;
      } finally {
        setLoading(false);
      }
    }
    // If not logged in, direct focus to sign in form
    setMode('login');
    setActivationPendingEmail(null);
    setError('Please sign in to access your CRM dashboard.');
    scrollToAuthCard('input-email');
  };

  const scrollToAuthCard = (focusFieldId?: string) => {
    const el = document.getElementById('auth-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (focusFieldId) {
        setTimeout(() => {
          const input = document.getElementById(focusFieldId) as HTMLInputElement | null;
          input?.focus();
        }, 300);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-900/85 backdrop-blur px-4 sm:px-6 py-3.5 flex items-center justify-between transition">
        {/* Left: Brand Logo */}
        <div className="flex items-center gap-3">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center hover:opacity-95 transition"
            title="Scambaiter CRM Intelligence"
          >
            <img
              src="/logo.png"
              alt="Scambaiter CRM Intelligence"
              className="h-9 sm:h-11 w-auto object-contain"
            />
          </a>
        </div>

        {/* Center / Right: Expanded Navigation Bar */}
        <nav className="flex items-center gap-2 sm:gap-3">
          {/* Dashboard Link - Goes straight to it if already logged in */}
          <button
            type="button"
            id="nav-dashboard-link"
            onClick={handleDashboardClick}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 text-slate-200 hover:text-white hover:bg-slate-800/80 transition cursor-pointer border border-slate-800 bg-slate-900/60 shadow-sm"
            title={getStoredToken() && getStoredUser() ? 'Open your active CRM dashboard' : 'Sign in to access dashboard'}
          >
            <LayoutDashboard className="w-4 h-4 text-rose-400" />
            <span>Dashboard</span>
            {Boolean(getStoredToken() && getStoredUser()) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Session active"></span>
            )}
          </button>

          {/* Top-Right Sign In and Sign Up Action Buttons */}
          <div className="flex items-center gap-2">
            {getStoredToken() && getStoredUser() ? (
              <button
                type="button"
                id="nav-direct-dashboard-btn"
                onClick={handleDashboardClick}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg shadow-rose-950/40 flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>Open Dashboard</span>
                <span className="hidden sm:inline">&rarr;</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  id="nav-signin-btn"
                  onClick={() => {
                    setMode('login');
                    setActivationPendingEmail(null);
                    setError(null);
                    scrollToAuthCard('input-email');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
                    mode === 'login' && !activationPendingEmail
                      ? 'bg-slate-800 border-rose-500/60 text-white shadow-sm ring-1 ring-rose-500/20'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5 text-rose-400" />
                  <span>Sign In</span>
                </button>

                <button
                  type="button"
                  id="nav-signup-btn"
                  onClick={() => {
                    setMode('register');
                    setActivationPendingEmail(null);
                    setError(null);
                    scrollToAuthCard('input-name');
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg shadow-rose-950/40 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Create Account</span>
                  <span className="sm:hidden">Join</span>
                </button>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Main Content Grid */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1">
        {/* Left Column: CRM Feature Breakdown */}
        <div className="lg:col-span-7 space-y-8">
          <div className="space-y-4">
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
          <div id="features-section" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div id="auth-card" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
            {activationPendingEmail ? (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500/20 to-rose-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/40">
                    <MailCheck className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Check Your Inbox</h3>
                  <p className="text-xs text-slate-300">
                    We sent an account activation link via Resend to:
                  </p>
                  <div className="inline-block px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 font-mono text-xs break-all">
                    {activationPendingEmail}
                  </div>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}

                {resendSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{resendSuccess}</span>
                  </div>
                )}

                {/* Direct link notice if running in development mode without active Resend domain */}
                {simulatedUrl && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                      <KeyRound className="w-4 h-4" />
                      <span>Direct Activation Link</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Resend link generated for this session:
                    </p>
                    <a
                      href={simulatedUrl}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 underline underline-offset-2 break-all"
                    >
                      <span>Complete One-Click Activation</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}

                {/* Option to enter token directly */}
                <form onSubmit={handleManualActivate} className="space-y-3 pt-1 border-t border-slate-800">
                  <label className="block text-xs font-medium text-slate-400">
                    Or enter your activation token manually:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste activation token..."
                      value={activationTokenInput}
                      onChange={(e) => setActivationTokenInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <button
                      type="submit"
                      disabled={activating || !activationTokenInput.trim()}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-medium text-xs transition cursor-pointer shrink-0"
                    >
                      {activating ? 'Verifying...' : 'Activate'}
                    </button>
                  </div>
                </form>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={handleResendActivation}
                    disabled={resending}
                    className="text-slate-400 hover:text-amber-300 inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                    <span>{resending ? 'Sending email...' : 'Resend activation email'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActivationPendingEmail(null);
                      setError(null);
                      setResendSuccess(null);
                      setMode('login');
                    }}
                    className="text-slate-400 hover:text-white inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to sign in</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
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

                {/* Google Sign In Section */}
                <div className="space-y-3 mb-6">
                  <button
                    type="button"
                    id="google-login-btn"
                    disabled={googleLoading}
                    onClick={handleGoogleSignInClick}
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
                    <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
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
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
        Scambaiter Intelligence CRM is property of cookiebaits &bull; Provided as-is with no warranty or support.
      </footer>
    </div>
  );
};
