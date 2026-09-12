import React, { useState, useEffect, useMemo } from 'react';
import { api, getStoredToken, getStoredUser, clearSession } from './api.ts';
import { AuthModal } from './components/AuthModal.tsx';
import { Navbar } from './components/Navbar.tsx';
import { PipelineBoard } from './components/PipelineBoard.tsx';
import { AnalyticsDashboard } from './components/AnalyticsDashboard.tsx';
import { QuickAddScammerModal } from './components/QuickAddScammerModal.tsx';
import { ScammerDetailModal } from './components/ScammerDetailModal.tsx';
import { AdminUserManagement } from './components/AdminUserManagement.tsx';
import type { User, Scammer, PipelineStatus, CanonicalStatus } from './types.ts';

export default function App() {
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // App data
  const [scammers, setScammers] = useState<Scammer[]>([]);
  const [loadingScammers, setLoadingScammers] = useState<boolean>(false);
  const [selectedScammer, setSelectedScammer] = useState<Scammer | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [quickAddStatus, setQuickAddStatus] = useState<CanonicalStatus>('New');

  // Views and filters
  const [activeView, setActiveView] = useState<'pipeline' | 'analytics' | 'users'>('pipeline');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [flaggedOnly, setFlaggedOnly] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Verify auth session on mount
  useEffect(() => {
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

  // Fetch scammers when user is authenticated
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

  // Handle pipeline drag & drop move
  const handleMovePipeline = async (scammerId: string, newStatus: PipelineStatus) => {
    // Optimistic UI update
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
      // Revert if error
      fetchScammers();
    }
  };

  // Scammer update callback (from modal)
  const handleUpdateScammer = (updated: Scammer) => {
    setScammers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setSelectedScammer(updated);
    setRefreshTrigger((c) => c + 1);
  };

  // Scammer delete callback
  const handleDeleteScammer = (id: string) => {
    setScammers((prev) => prev.filter((s) => s.id !== id));
    if (selectedScammer && selectedScammer.id === id) {
      setSelectedScammer(null);
    }
    setRefreshTrigger((c) => c + 1);
  };

  // New scammer added callback
  const handleScammerCreated = (newScammer: Scammer) => {
    setScammers((prev) => [newScammer, ...prev]);
    setSelectedScammer(newScammer);
    setRefreshTrigger((c) => c + 1);
  };

  // Logout handler
  const handleLogout = () => {
    clearSession();
    setUser(null);
    setScammers([]);
    setSelectedScammer(null);
  };

  // Filtered scammers
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

  // If loading auth
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3"></div>
        <span className="text-xs font-mono">Initializing Scambaiter CRM Session...</span>
      </div>
    );
  }

  // If not logged in, show Homepage & Auth Landing
  if (!user) {
    return <AuthModal onSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Navbar */}
      <Navbar
        user={user}
        activeView={activeView}
        onChangeView={setActiveView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        flaggedOnly={flaggedOnly}
        onToggleFlagged={() => setFlaggedOnly(!flaggedOnly)}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1800px] w-full mx-auto p-3 sm:p-5 lg:p-6">
        {activeView === 'pipeline' ? (
          <div className="space-y-4">
            {/* Header controls for mobile */}
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
                  setQuickAddStatus(status || 'New');
                  setIsQuickAddOpen(true);
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

      {/* Quick Add Scammer Modal */}
      <QuickAddScammerModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onCreated={handleScammerCreated}
        initialStatus={quickAddStatus}
      />

      {/* Scammer Dossier & Call Log Modal */}
      {selectedScammer && (
        <ScammerDetailModal
          scammer={selectedScammer}
          isOpen={Boolean(selectedScammer)}
          onClose={() => setSelectedScammer(null)}
          onUpdateScammer={handleUpdateScammer}
          onDeleteScammer={handleDeleteScammer}
        />
      )}
    </div>
  );
}
