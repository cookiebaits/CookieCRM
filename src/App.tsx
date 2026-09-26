import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { api, getStoredToken, getStoredUser, clearSession, setSession } from './api.ts';
import { AuthModal } from './components/AuthModal.tsx';
import { Navbar } from './components/Navbar.tsx';
import { PipelineBoard } from './components/PipelineBoard.tsx';
import { AnalyticsDashboard } from './components/AnalyticsDashboard.tsx';
import { QuickAddScammerModal } from './components/QuickAddScammerModal.tsx';
import { ScammerDetailModal } from './components/ScammerDetailModal.tsx';
import { AdminUserManagement } from './components/AdminUserManagement.tsx';
import { PublicScammerView } from './components/PublicScammerView.tsx';
import { TermsAndPrivacyModal } from './components/TermsAndPrivacyModal.tsx';
import type { User, Scammer, PipelineStatus, CanonicalStatus } from './types.ts';

function StandaloneTargetPage({
  targetId,
  currentUser,
  onUpdateScammer,
  onDeleteScammer,
}: {
  targetId: string;
  currentUser: User | null;
  onUpdateScammer: (scammer: Scammer) => void;
  onDeleteScammer: (id: string) => void;
}) {
  const [scammer, setScammer] = useState<Scammer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getScammer(targetId)
      .then((res) => {
        setScammer(res.scammer);
      })
      .catch((err: any) => {
        setError(err.message || 'Target not found');
      })
      .finally(() => setLoading(false));
  }, [targetId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3"></div>
        <span className="text-xs font-mono">Loading Scammer Target Dossier...</span>
      </div>
    );
  }

  if (error || !scammer) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
        <p className="text-sm text-slate-200 font-bold mb-1">Target Dossier Error</p>
        <p className="text-xs text-slate-400 max-w-sm mb-4">{error || 'Scammer record not found.'}</p>
        <button
          type="button"
          onClick={() => window.close()}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold"
        >
          Close Window
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 sm:p-6 max-w-[1800px] mx-auto">
      <ScammerDetailModal
        scammer={scammer}
        isOpen={true}
        isStandalone={true}
        onClose={() => window.close()}
        onUpdateScammer={(updated) => {
          setScammer(updated);
          onUpdateScammer(updated);
        }}
        onDeleteScammer={(id) => {
          onDeleteScammer(id);
          window.close();
        }}
        currentUser={currentUser}
      />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [activationNotice, setActivationNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // App data
  const [scammers, setScammers] = useState<Scammer[]>([]);
  const [loadingScammers, setLoadingScammers] = useState<boolean>(false);
  const [selectedScammer, setSelectedScammer] = useState<Scammer | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [quickAddStatus, setQuickAddStatus] = useState<CanonicalStatus>('New / Uncalled');

  // Terms & Privacy modal state
  const [showTermsModal, setShowTermsModal] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Views and filters
  const [activeView, setActiveView] = useState<'pipeline' | 'analytics' | 'users'>('pipeline');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [flaggedOnly, setFlaggedOnly] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Check for public share route (/share/:id or ?share=:id) or target route (/target/:id or ?target=:id)
  const [publicShareId, setPublicShareId] = useState<string | null>(() => {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/share/')) {
      return pathname.replace('/share/', '').trim();
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('share') || null;
  });

  const [targetDetailId] = useState<string | null>(() => {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/target/')) {
      return pathname.replace('/target/', '').trim();
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('target') || null;
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'admin_scambaiter';

  // Guard: If current view is 'users' but user is not admin, revert to pipeline
  useEffect(() => {
    if (activeView === 'users' && !isAdmin) {
      setActiveView('pipeline');
    }
  }, [activeView, isAdmin]);

  // Handle URL activation parameters on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const activateToken = urlParams.get('activateToken') || urlParams.get('token');
    const isActivated = urlParams.get('activated') === 'true';
    const activateError = urlParams.get('activateError');

    if (activateError) {
      window.history.replaceState({}, document.title, window.location.pathname);
      setActivationNotice({
        type: 'error',
        message: decodeURIComponent(activateError),
      });
      setAuthChecking(false);
      return;
    }

    if (isActivated && activateToken) {
      window.history.replaceState({}, document.title, window.location.pathname);
      localStorage.setItem('scambaiter_crm_token', activateToken);
      api
        .getMe()
        .then((res) => {
          setSession(activateToken, res.user);
          setUser(res.user);
          setActivationNotice({
            type: 'success',
            message: 'Your account has been activated successfully! Welcome aboard, Operator.',
          });
        })
        .catch(() => {
          // fallback
        })
        .finally(() => {
          setAuthChecking(false);
        });
      return;
    }

    if (activateToken && !getStoredToken()) {
      window.history.replaceState({}, document.title, window.location.pathname);
      api
        .activateAccount(activateToken)
        .then((res) => {
          setUser(res.user);
          setActivationNotice({
            type: 'success',
            message: 'Account successfully activated! Welcome to Scambaiter CRM.',
          });
        })
        .catch((err: any) => {
          setActivationNotice({
            type: 'error',
            message: err.message || 'Activation link is invalid or has expired.',
          });
        })
        .finally(() => {
          setAuthChecking(false);
        });
      return;
    }

    const token = getStoredToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }

    api
      .getMe()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  const fetchScammers = async () => {
    if (!user) return;
    try {
      setLoadingScammers(true);
      const res = await api.getScammers();
      setScammers(res.scammers);
    } catch (err) {
      console.error('Fetch scammers error:', err);
    } finally {
      setLoadingScammers(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchScammers();
    }
  }, [user]);

  const requireTermsAcceptance = (action: () => void) => {
    if (user && !user.hasAcceptedTerms) {
      setPendingAction(() => action);
      setShowTermsModal(true);
      return;
    }
    action();
  };

  const handleTermsAccepted = (updatedUser: User) => {
    setUser(updatedUser);
    setShowTermsModal(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleMovePipeline = async (scammerId: string, newStatus: PipelineStatus) => {
    setScammers((prev) =>
      prev.map((s) => (s.id === scammerId ? { ...s, status: newStatus } : s))
    );
    if (selectedScammer && selectedScammer.id === scammerId) {
      setSelectedScammer((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    try {
      const res = await api.updateScammer(scammerId, { status: newStatus });
      setScammers((prev) =>
        prev.map((s) => (s.id === scammerId ? res.scammer : s))
      );
      setRefreshTrigger((c) => c + 1);
    } catch (err) {
      console.error('Failed to update pipeline status:', err);
      fetchScammers();
    }
  };

  const handleUpdateScammer = (updated: Scammer) => {
    setScammers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelectedScammer((prev) => (prev && prev.id === updated.id ? updated : prev));
    setRefreshTrigger((c) => c + 1);
  };

  const handleDeleteScammer = (id: string) => {
    setScammers((prev) => prev.filter((s) => s.id !== id));
    if (selectedScammer && selectedScammer.id === id) {
      setSelectedScammer(null);
    }
    setRefreshTrigger((c) => c + 1);
  };

  const handleScammerCreated = (newScammer: Scammer) => {
    setScammers((prev) => [newScammer, ...prev]);
    setSelectedScammer(newScammer);
    setRefreshTrigger((c) => c + 1);
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setScammers([]);
    setSelectedScammer(null);
  };

  const filteredScammers = useMemo(() => {
    return scammers.filter((s) => {
      if (flaggedOnly && !s.flagged) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const matchName = s.fullName.toLowerCase().includes(q);
      const matchAlias = s.alias?.toLowerCase().includes(q) || false;
      const matchPhone = s.phoneNumber.toLowerCase().includes(q);
      const matchOrg = s.organization?.toLowerCase().includes(q) || false;
      const matchCarrier = s.carrier?.toLowerCase().includes(q) || false;

      return matchName || matchAlias || matchPhone || matchOrg || matchCarrier;
    });
  }, [scammers, searchQuery, flaggedOnly]);

  if (publicShareId) {
    return (
      <PublicScammerView
        scammerId={publicShareId}
        onGoHome={() => {
          window.history.replaceState({}, document.title, '/');
          setPublicShareId(null);
        }}
      />
    );
  }

  if (targetDetailId) {
    const foundScammer = scammers.find((s) => s.id === targetDetailId) || selectedScammer;
    if (foundScammer && foundScammer.id === targetDetailId) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 max-w-[1800px] mx-auto">
          <ScammerDetailModal
            scammer={foundScammer}
            isOpen={true}
            isStandalone={true}
            onClose={() => {
              window.close();
            }}
            onUpdateScammer={handleUpdateScammer}
            onDeleteScammer={(id) => {
              handleDeleteScammer(id);
              window.close();
            }}
            currentUser={user}
          />
        </div>
      );
    }
    return (
      <StandaloneTargetPage
        targetId={targetDetailId}
        currentUser={user}
        onUpdateScammer={handleUpdateScammer}
        onDeleteScammer={handleDeleteScammer}
      />
    );
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3"></div>
        <span className="text-xs font-mono">Initializing Scambaiter CRM Session...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthModal onSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Navbar with matching px-6 sm:px-10 lg:px-12 */}
      <Navbar
        user={user}
        activeView={activeView}
        onChangeView={(view) => {
          setActiveView(view);
          setSelectedScammer(null);
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        flaggedOnly={flaggedOnly}
        onToggleFlagged={() => setFlaggedOnly(!flaggedOnly)}
        onOpenQuickAdd={() =>
          requireTermsAcceptance(() => {
            setQuickAddStatus('New / Uncalled');
            setIsQuickAddOpen(true);
          })
        }
        onLogout={handleLogout}
      />

      {/* Activation Status Toast */}
      {activationNotice && (
        <div className="max-w-[1800px] w-full mx-auto px-6 sm:px-10 lg:px-12 pt-3">
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium shadow-lg transition ${
              activationNotice.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                : 'bg-rose-950/80 border-rose-800 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {activationNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{activationNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActivationNotice(null)}
              className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace aligned with Navbar (px-6 sm:px-10 lg:px-12) */}
      <main className="flex-1 max-w-[1800px] w-full mx-auto px-6 sm:px-10 lg:px-12 py-4 sm:py-5 lg:py-6">
        {activeView === 'pipeline' ? (
          <div className="space-y-4">
            <div className="md:hidden flex items-center gap-2">
              <input
                type="text"
                placeholder="Search scammers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            {loadingScammers ? (
              <div className="text-center py-24 text-slate-500 text-xs">
                <div className="w-6 h-6 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mx-auto mb-2"></div>
                Loading scammer cases...
              </div>
            ) : (
              <PipelineBoard
                scammers={filteredScammers}
                onSelectScammer={(s) => setSelectedScammer(s)}
                onMovePipeline={handleMovePipeline}
                onQuickAdd={(status) => {
                  requireTermsAcceptance(() => {
                    setQuickAddStatus(status || 'New / Uncalled');
                    setIsQuickAddOpen(true);
                  });
                }}
                onUpdateScammer={async (scammerId, data) => {
                  try {
                    const res = await api.updateScammer(scammerId, data);
                    handleUpdateScammer(res.scammer);
                  } catch (err) {
                    console.error('Failed to update scammer:', err);
                  }
                }}
                onBulkImportSuccess={(newScammers) => {
                  setScammers((prev) => [...newScammers, ...prev]);
                  setRefreshTrigger((c) => c + 1);
                }}
                onScammerCreated={handleScammerCreated}
              />
            )}
          </div>
        ) : activeView === 'analytics' ? (
          <AnalyticsDashboard onRefreshTrigger={refreshTrigger} />
        ) : (
          <AdminUserManagement currentUser={user} />
        )}
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
        Scambaiter Intelligence CRM is property of cookiebaits &bull; Provided as-is with no warranty or support.
      </footer>

      {/* Quick Add Scammer Modal */}
      <QuickAddScammerModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onCreated={handleScammerCreated}
        initialStatus={quickAddStatus}
      />

      {/* Terms of Use & Privacy Policy Acceptance Modal */}
      <TermsAndPrivacyModal
        isOpen={showTermsModal}
        onAccepted={handleTermsAccepted}
      />

      {/* Scammer Dossier & Call Log Modal */}
      {selectedScammer && (
        <ScammerDetailModal
          scammer={selectedScammer}
          isOpen={Boolean(selectedScammer)}
          onClose={() => setSelectedScammer(null)}
          onUpdateScammer={handleUpdateScammer}
          onDeleteScammer={handleDeleteScammer}
          currentUser={user}
        />
      )}
    </div>
  );
}
