import React, { useState, useEffect } from 'react';
import { Team } from '../types';
import * as storage from '../services/storage';
import { Trophy, Lock, Users, PlusCircle, ArrowRight, Loader2, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

interface TeamLoginScreenProps {
  onLoginTeam: (team: Team, accessToken: string, refreshToken: string) => void;
}

export const TeamLoginScreen: React.FC<TeamLoginScreenProps> = ({ onLoginTeam }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // New team form
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingTeams, setIsFetchingTeams] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsFetchingTeams(true);
      try {
        const list = await storage.getTeams();
        setTeams(list);
        if (list.length > 0) {
          // Prefer default team 'nahravame-si' if available, otherwise first team
          const defaultTeam = list.find(t => t.name.toLowerCase() === 'nahravame-si' || t.id === 'team-nahravame-si');
          setSelectedTeamId(defaultTeam ? defaultTeam.id : list[0].id);
        }
      } catch (_err: any) {
        setError('Nepodařilo se načíst seznam týmů.');
      } finally {
        setIsFetchingTeams(false);
      }
    };
    load();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedTeamId) {
      setError('Vyberte prosím tým.');
      return;
    }

    if (!password) {
      setError('Zadejte heslo týmu.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await storage.loginTeam(selectedTeamId, password);
      onLoginTeam(res.team, res.accessToken, res.refreshToken);
    } catch (err: any) {
      setError(err.message || 'Nesprávné heslo týmu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newTeamName.trim()) {
      setError('Zadejte název nového týmu.');
      return;
    }

    if (newPassword.length < 3) {
      setError('Heslo musí mít alespoň 3 znaky.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Zadaná hesla se neshodují.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await storage.createTeam(newTeamName.trim(), newPassword);
      onLoginTeam(res.team, res.accessToken, res.refreshToken);
    } catch (err: any) {
      setError(err.message || 'Chyba při vytváření týmu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 p-8 text-center text-white relative">
          <div className="inline-flex p-3 bg-white/10 backdrop-blur-md rounded-2xl mb-3 shadow-inner">
            <Trophy size={40} className="text-yellow-300" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Sport Plánovač</h1>
          <p className="text-blue-100 text-sm mt-1">Zabezpečený přístup k týmu</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-sm font-semibold">
          <button
            type="button"
            onClick={() => { setIsCreatingNew(false); setError(null); }}
            className={`flex-1 py-3 text-center transition-colors flex items-center justify-center gap-1.5 ${
              !isCreatingNew
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users size={16} />
            Vybrat tým
          </button>
          <button
            type="button"
            onClick={() => { setIsCreatingNew(true); setError(null); }}
            className={`flex-1 py-3 text-center transition-colors flex items-center justify-center gap-1.5 ${
              isCreatingNew
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <PlusCircle size={16} />
            Nový tým
          </button>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8">
          {error && (
            <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2.5 animate-shake">
              <AlertCircle size={18} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {!isCreatingNew ? (
            /* Login to Existing Team Form */
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Vyberte váš tým
                </label>
                {isFetchingTeams ? (
                  <div className="flex items-center gap-2 text-slate-400 p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                    <Loader2 size={16} className="animate-spin text-blue-600" />
                    Načítám týmy...
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedTeamId}
                      onChange={e => setSelectedTeamId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none cursor-pointer"
                    >
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>
                          🏐 {t.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      ▼
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Heslo týmu
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Zadejte heslo..."
                    className="w-full pl-10 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                data-testid="team-submit-btn"
                disabled={isLoading || isFetchingTeams}
                className="w-full mt-2 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Ověřuji heslo...
                  </>
                ) : (
                  <>
                    <span>Vstoupit do týmu</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Create New Team Form */
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Název nového týmu
                </label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  placeholder="např. Volejbal Brno, Tenisti..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Heslo pro členy týmu
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimálně 3 znaky..."
                    className="w-full px-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Potvrzení hesla
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Zadejte heslo znovu..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Vytvářím tým...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Vytvořit a vstoupit</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
            Aktivní relace zůstává přihlášená. Heslo stačí zadat jednou.
          </div>
        </div>
      </div>
    </div>
  );
};
