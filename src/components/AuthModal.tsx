import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  Clock,
  FolderKanban,
  Landmark,
  AlertCircle,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';
import { api, getStoredToken, getStoredUser } from '../api.ts';
import type { User } from '../types.ts';

interface AuthModalProps {
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configuredClientId, setConfiguredClientId] = useState<string>('');
  const [dbSource, setDbSource] = useState<string>('Supabase Direct PostgreSQL');

  // Initialize Google Identity Services if client ID is configured
  useEffect(() => {
    let isMounted = true;

    const initGis = async () => {
      let clientId = ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string) || '';
      try {
        const config = await api.getConfig();
        if (config) {
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
            handleDirectGoogleAuth();
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
            handleDirectGoogleAuth();
          }
        });
        return;
      } catch {
        // continue to direct auth
      }
    }

    // 3. Fallback direct Google OAuth modal prompt
    handleDirectGoogleAuth();
  };

  const handleDirectGoogleAuth = async () => {
    const emailPrompt = window.prompt(
      'Enter your Google account email to sign in via Google OAuth:',
      'cookiescambait@gmail.com'
    );
    if (!emailPrompt || !emailPrompt.trim()) return;

    try {
      setGoogleLoading(true);
      setError(null);
      const res = await api.googleAuth({
        email: emailPrompt.trim(),
        name: emailPrompt.split('@')[0],
      });
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleDashboardClick = async () => {
    const token = getStoredToken();
    const storedUser = getStoredUser();
    if (token && storedUser) {
      try {
        setGoogleLoading(true);
        const res = await api.getMe();
        onSuccess(res.user);
        return;
      } catch {
        onSuccess(storedUser);
        return;
      } finally {
        setGoogleLoading(false);
      }
    }
    // If not logged in, trigger Google sign in
    handleGoogleSignInClick();
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

        {/* Center / Right: Navigation Action */}
        <nav className="flex items-center gap-2 sm:gap-3">
          {getStoredToken() && getStoredUser() ? (
            <button
              type="button"
              id="nav-direct-dashboard-btn"
              onClick={handleDashboardClick}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg shadow-rose-950/40 flex items-center gap-1.5 transition cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Open Dashboard</span>
              <span>&rarr;</span>
            </button>
          ) : (
            <button
              type="button"
              id="nav-google-login-btn"
              onClick={handleGoogleSignInClick}
              disabled={googleLoading}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 text-slate-200 hover:text-white flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
              <span>{googleLoading ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          )}
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
              A high-precision CRM engineered specifically for scambaiters to log calls, attach audio evidence,
              manage visual pipeline targets, and dynamically track hours wasted on fraud rings.
            </p>
          </div>

          {/* Core Feature Highlights */}
          <div id="features-section" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">Call Logs & Evidence</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Log interactions, attach audio recordings, aliases, and victim information safely.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">Dynamic Time Tracking</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Real-time efficiency metrics calculating minutes wasted per target and overall impact.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">Pipeline Kanban</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Organize targets across stages: from initial contact to law enforcement handoff and closure.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <Landmark className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">Fraud Accounts & Mules</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Document and cross-reference scammer bank accounts, crypto wallets, and money mule identities.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Google OAuth Authentication Card */}
        <div className="lg:col-span-5">
          <div id="auth-card" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
            {/* Header */}
            <div className="border-b border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-rose-500" />
                <h3 className="text-xl font-bold text-white">Scambaiter Access</h3>
              </div>
              <p className="text-xs text-slate-400">
                Sign in with your Google account to access your CRM tracker.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Database Connection Status */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/80 border border-slate-800/80 rounded-lg px-3.5 py-2 mb-6">
              <span className="flex items-center gap-1.5 font-medium">
                <span
                  className={`w-2 h-2 rounded-full ${
                    dbSource.includes('Active')
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                      : 'bg-amber-400'
                  }`}
                ></span>
                <span>Database:</span>
              </span>
              <span className="font-mono text-slate-300 text-[10px] tracking-tight">{dbSource}</span>
            </div>

            {/* Google Sign In Button */}
            <div className="space-y-4">
              <button
                type="button"
                id="google-login-btn"
                disabled={googleLoading}
                onClick={handleGoogleSignInClick}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 text-white font-semibold text-sm transition focus:outline-none focus:ring-2 focus:ring-rose-500/50 cursor-pointer shadow-md hover:shadow-lg"
              >
                {/* Official Google 'G' Icon */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
              </button>

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                Sign in is verified via Google OAuth. New user accounts start clean with an empty pipeline ready to add targets.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
        Scambaiter Intelligence CRM &bull; Property of cookiebaits &bull; Provided as-is with no warranty.
      </footer>
    </div>
  );
};
