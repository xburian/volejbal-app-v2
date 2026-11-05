import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  Users,
  Calendar,
  Zap,
  KeyRound,
  Search,
  LogOut,
  RefreshCw,
  Loader2,
  Clock,
  Activity,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { AdminUser, AdminOverviewData, TeamOverviewItem } from '@/types';
import { ResetTeamPasswordModal } from './ResetTeamPasswordModal';

interface AdminDashboardProps {
  adminUser: AdminUser;
  onLogout: () => void;
  onImpersonate: (teamId: string) => Promise<any>;
  onResetPassword: (teamId: string, newPassword: string) => Promise<any>;
  fetchOverview: () => Promise<AdminOverviewData>;
  onClose?: () => void;
}

type TeamStatusFilter = 'all' | 'active' | 'dormant' | 'inactive';

function getTeamHealth(item: TeamOverviewItem): {
  status: 'active' | 'dormant' | 'inactive';
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  const dateStr = item.lastActiveAt || item.createdAt;
  if (!dateStr) {
    return {
      status: 'inactive',
      label: 'Neaktivní',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      dotClass: 'bg-slate-400',
    };
  }

  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 14) {
    return {
      status: 'active',
      label: 'Aktivní',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500 animate-pulse',
    };
  }
  if (diffDays <= 45) {
    return {
      status: 'dormant',
      label: 'Spící',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      dotClass: 'bg-amber-500',
    };
  }
  return {
    status: 'inactive',
    label: 'Neaktivní',
    badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
    dotClass: 'bg-slate-400',
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Nikdy';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminUser,
  onLogout,
  onImpersonate,
  onResetPassword,
  fetchOverview,
  onClose,
}) => {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TeamStatusFilter>('all');
  const [selectedTeamForReset, setSelectedTeamForReset] = useState<TeamOverviewItem | null>(null);
  const [impersonatingTeamId, setImpersonatingTeamId] = useState<string | null>(null);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await fetchOverview();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se načíst data přehledu.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchOverview]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTeams = useMemo(() => {
    if (!data?.teams) return [];
    return data.teams.filter((team) => {
      const matchesSearch =
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.id.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      const health = getTeamHealth(team);
      return health.status === statusFilter;
    });
  }, [data, searchQuery, statusFilter]);

  const activeTeamsCount = useMemo(() => {
    if (!data?.teams) return 0;
    return data.teams.filter((t) => getTeamHealth(t).status === 'active').length;
  }, [data]);

  const handleImpersonateClick = async (teamId: string) => {
    setImpersonatingTeamId(teamId);
    try {
      await onImpersonate(teamId);
    } catch (err: any) {
      alert(err.message || 'Nepodařilo se přepnout do týmu.');
      setImpersonatingTeamId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" data-testid="admin-dashboard">
      {/* Top Navigation */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">Sport Plánovač</span>
                <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wider">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Centrální správa týmů</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-xs text-slate-400 font-medium">
              Přihlášen: <strong className="text-slate-200">{adminUser.username}</strong>
            </span>

            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Obnovit data"
              data-testid="admin-refresh-button"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-blue-400' : ''} />
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                Zpět do aplikace
              </button>
            )}

            <button
              onClick={onLogout}
              className="px-3 py-1.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 hover:border-rose-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              data-testid="admin-logout-button"
            >
              <LogOut size={14} />
              <span>Odhlásit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        {/* Error notification */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-sm flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button
              onClick={() => loadData(true)}
              className="text-xs font-bold underline hover:no-underline"
            >
              Zkusit znovu
            </button>
          </div>
        )}

        {/* System Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Celkem týmů</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5" data-testid="stat-total-teams">
                {isLoading ? '…' : data?.totalTeams ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aktivní týmy</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5" data-testid="stat-active-teams">
                {isLoading ? '…' : activeTeamsCount}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hráčů v týmech</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5" data-testid="stat-total-users">
                {isLoading ? '…' : data?.totalUsers ?? 0}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Naplánováno akcí</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5" data-testid="stat-total-events">
                {isLoading ? '…' : data?.totalEvents ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Controls Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat tým podle názvu nebo ID…"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              data-testid="team-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0" data-testid="status-filters">
            <Filter size={14} className="text-slate-400 mr-1 hidden sm:inline" />
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Vše ({data?.teams?.length ?? 0})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
              }`}
            >
              Aktivní ({activeTeamsCount})
            </button>
            <button
              onClick={() => setStatusFilter('dormant')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'dormant'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              Spící
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-slate-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              Neaktivní
            </button>
          </div>
        </div>

        {/* Teams List (Responsive Table on Desktop, Cards on Mobile) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-blue-600" />
              <p className="text-sm font-medium">Načítám přehled všech týmů…</p>
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <p className="text-base font-semibold text-slate-600">Žádné týmy nenalezeny</p>
              <p className="text-xs text-slate-400">
                {searchQuery ? 'Zkuste změnit vyhledávací dotaz nebo filtr.' : 'V databázi zatím nejsou žádné týmy.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse" data-testid="teams-table">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-6">Tým</th>
                      <th className="py-3 px-4">Stav</th>
                      <th className="py-3 px-4 text-center">Členové</th>
                      <th className="py-3 px-4 text-center">Události</th>
                      <th className="py-3 px-4">Aktivita</th>
                      <th className="py-3 px-4">Vytvořeno</th>
                      <th className="py-3 px-6 text-right">Akce správce</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredTeams.map((team) => {
                      const health = getTeamHealth(team);
                      const isThisImpersonating = impersonatingTeamId === team.id;

                      return (
                        <tr
                          key={team.id}
                          className="hover:bg-slate-50/70 transition-colors group"
                          data-testid={`team-row-${team.id}`}
                        >
                          <td className="py-4 px-6 font-semibold text-slate-900">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200">
                                {team.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="leading-tight">{team.name}</div>
                                <div className="text-[11px] font-mono text-slate-400">{team.id}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${health.badgeClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${health.dotClass}`} />
                              <span>{health.label}</span>
                            </span>
                          </td>

                          <td className="py-4 px-4 text-center font-medium text-slate-700">
                            <span className="inline-flex items-center gap-1">
                              <Users size={14} className="text-slate-400" />
                              <span>{team.userCount}</span>
                            </span>
                          </td>

                          <td className="py-4 px-4 text-center font-medium text-slate-700">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={14} className="text-slate-400" />
                              <span>{team.eventCount}</span>
                            </span>
                          </td>

                          <td className="py-4 px-4 text-xs text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <Clock size={13} className="text-slate-400" />
                              <span>{formatDate(team.lastActiveAt)}</span>
                            </div>
                          </td>

                          <td className="py-4 px-4 text-xs text-slate-400">
                            {formatDate(team.createdAt)}
                          </td>

                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedTeamForReset(team)}
                                className="p-2 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                                title="Resetovat heslo týmu"
                                data-testid={`reset-pwd-btn-${team.id}`}
                              >
                                <KeyRound size={16} />
                              </button>

                              <button
                                onClick={() => handleImpersonateClick(team.id)}
                                disabled={isThisImpersonating}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 py-1.5 rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                                data-testid={`impersonate-btn-${team.id}`}
                              >
                                {isThisImpersonating ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin" />
                                    <span>Vstupuji…</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap size={13} />
                                    <span>Vstoupit bez hesla</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Stream */}
              <div className="md:hidden divide-y divide-slate-100" data-testid="teams-mobile-list">
                {filteredTeams.map((team) => {
                  const health = getTeamHealth(team);
                  const isThisImpersonating = impersonatingTeamId === team.id;

                  return (
                    <div key={team.id} className="p-4 space-y-3" data-testid={`mobile-team-card-${team.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center border border-blue-200 shrink-0">
                            {team.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-base leading-tight">{team.name}</h4>
                            <p className="text-[11px] font-mono text-slate-400">{team.id}</p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${health.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${health.dotClass}`} />
                          <span>{health.label}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                        <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-slate-400" />
                          <span>{team.userCount} hráčů</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-slate-400" />
                          <span>{team.eventCount} zápasů</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Clock size={13} className="text-slate-400" />
                          <span>Aktivita: {formatDate(team.lastActiveAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <span>Vznik: {formatDate(team.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleImpersonateClick(team.id)}
                          disabled={isThisImpersonating}
                          className="flex-1 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                          {isThisImpersonating ? (
                            <>
                              <Loader2 size={15} className="animate-spin" />
                              <span>Vstupuji do týmu…</span>
                            </>
                          ) : (
                            <>
                              <Zap size={15} />
                              <span>Vstoupit bez hesla</span>
                              <ArrowRight size={14} />
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => setSelectedTeamForReset(team)}
                          className="min-h-[44px] min-w-[44px] border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                          title="Resetovat heslo týmu"
                          aria-label="Resetovat heslo týmu"
                        >
                          <KeyRound size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Reset Password Modal */}
      <ResetTeamPasswordModal
        isOpen={!!selectedTeamForReset}
        team={selectedTeamForReset}
        onClose={() => setSelectedTeamForReset(null)}
        onReset={onResetPassword}
      />
    </div>
  );
};
