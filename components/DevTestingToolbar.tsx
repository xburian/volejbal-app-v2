import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, RotateCcw, ChevronDown, CheckCircle2, ShieldCheck } from 'lucide-react';
import * as storage from '../services/storage';

interface DevTestingToolbarProps {
  onTeamSwitch?: (team: any, accessToken: string, refreshToken: string) => void;
  onDataRefresh?: () => void;
}

interface MockStatus {
  isMock: boolean;
  teamsCount?: number;
  usersCount?: number;
  eventsCount?: number;
}

const PRESET_TEAMS = [
  { id: 'team-nahravame-si', name: 'nahravame-si', emoji: '🏐' },
  { id: 'team-brno', name: 'Volejbal Brno', emoji: '🏐' },
  { id: 'team-beach-praha', name: 'Beach Praha', emoji: '🏖️' },
];

export const DevTestingToolbar: React.FC<DevTestingToolbarProps> = ({
  onTeamSwitch,
  onDataRefresh,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<MockStatus | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/dev/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // In dev:vite-only mode or offline
      setStatus({ isMock: true, teamsCount: 3, usersCount: 16, eventsCount: 12 });
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSeed = async () => {
    setLoadingAction('seed');
    setActionMessage(null);
    try {
      const res = await fetch('/api/dev/seed', { method: 'POST' });
      if (res.ok) {
        setActionMessage('Data úspěšně přegenerována');
        await fetchStatus();
        if (onDataRefresh) {
          onDataRefresh();
        } else {
          window.location.reload();
        }
      } else {
        setActionMessage('Chyba při přegenerování dat');
      }
    } catch {
      setActionMessage('Chyba spojení s dev serverem');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleReset = async () => {
    setLoadingAction('reset');
    setActionMessage(null);
    try {
      const res = await fetch('/api/dev/reset', { method: 'POST' });
      if (res.ok) {
        setActionMessage('Databáze vyčištěna a obnovena');
        await fetchStatus();
        if (onDataRefresh) {
          onDataRefresh();
        } else {
          window.location.reload();
        }
      } else {
        setActionMessage('Chyba při resetu databáze');
      }
    } catch {
      setActionMessage('Chyba spojení s dev serverem');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleQuickLogin = async (teamId: string) => {
    setLoadingAction(`login-${teamId}`);
    setActionMessage(null);
    try {
      const res = await storage.loginTeam(teamId, '1234');
      if (onTeamSwitch) {
        onTeamSwitch(res.team, res.accessToken, res.refreshToken);
        setActionMessage(`Přihlášen tým: ${res.team.name}`);
      } else {
        storage.setSession(res.accessToken, res.refreshToken, res.team);
        window.location.reload();
      }
    } catch (err: any) {
      setActionMessage(`Chyba přihlášení: ${err.message || 'Chyba'}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // Only render in development mode
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 font-sans text-xs">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium px-3.5 py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 border border-amber-300/30"
          title="Otevřít Dev Nástroje (Mock Databáze)"
        >
          <Database size={15} className="animate-pulse" />
          <span>Dev DB</span>
          {status?.isMock && (
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          )}
        </button>
      ) : (
        <div className="w-80 bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="bg-slate-800/90 px-4 py-3 flex items-center justify-between border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-amber-400" />
              <span className="font-semibold text-slate-200 text-sm">Dev Mock DB</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${status?.isMock ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                {status?.isMock ? 'In-Memory Mock' : 'Upstash Cloud'}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-md transition-colors"
              title="Minimalizovat"
            >
              <ChevronDown size={18} />
            </button>
          </div>

          <div className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
            {/* Status counts */}
            {status?.isMock && (
              <div className="grid grid-cols-3 gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-700/40 text-center">
                <div>
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider">Týmy</div>
                  <div className="font-bold text-slate-200 text-sm">{status.teamsCount ?? 3}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider">Hráči</div>
                  <div className="font-bold text-slate-200 text-sm">{status.usersCount ?? 16}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider">Události</div>
                  <div className="font-bold text-slate-200 text-sm">{status.eventsCount ?? 12}</div>
                </div>
              </div>
            )}

            {/* Quick Team Switch */}
            <div>
              <div className="text-slate-400 text-[11px] font-medium mb-1.5 flex items-center justify-between">
                <span>Rychlé přihlášení týmu (heslo: 1234)</span>
                <ShieldCheck size={12} className="text-slate-500" />
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {PRESET_TEAMS.map((team) => (
                  <button
                    key={team.id}
                    disabled={loadingAction !== null}
                    onClick={() => handleQuickLogin(team.id)}
                    className="flex items-center justify-between px-3 py-2 bg-slate-800/70 hover:bg-slate-700/80 active:bg-slate-700 rounded-lg text-left transition-colors border border-slate-700/50 group"
                  >
                    <span className="font-medium text-slate-200 flex items-center gap-1.5">
                      <span>{team.emoji}</span>
                      <span>{team.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-amber-400 transition-colors">
                      {loadingAction === `login-${team.id}` ? 'Přihlašování...' : 'Přihlásit →'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mock Database Actions */}
            <div className="pt-1 border-t border-slate-700/50">
              <div className="text-slate-400 text-[11px] font-medium mb-1.5">Správa testovacích dat</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={loadingAction !== null}
                  onClick={handleSeed}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg font-medium transition-colors border border-amber-500/30 disabled:opacity-50"
                  title="Vygenerovat nová náhodná data (události, zápasy, docházka)"
                >
                  <RefreshCw size={13} className={loadingAction === 'seed' ? 'animate-spin' : ''} />
                  <span>{loadingAction === 'seed' ? 'Generuji...' : 'Re-seed dat'}</span>
                </button>

                <button
                  disabled={loadingAction !== null}
                  onClick={handleReset}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg font-medium transition-colors border border-rose-500/30 disabled:opacity-50"
                  title="Vyčistit a obnovit výchozí stav databáze"
                >
                  <RotateCcw size={13} className={loadingAction === 'reset' ? 'animate-spin' : ''} />
                  <span>{loadingAction === 'reset' ? 'Resetuji...' : 'Reset DB'}</span>
                </button>
              </div>
            </div>

            {/* Status feedback message */}
            {actionMessage && (
              <div className="p-2 bg-slate-800 rounded-lg border border-slate-700 text-[11px] text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                <span className="truncate">{actionMessage}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
