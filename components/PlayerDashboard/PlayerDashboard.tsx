import React, { useState, useMemo } from 'react';
import { User, SportEvent, PLAYER_POSITIONS, PlayerPosition } from '../../types';
import { computePlayerGamification } from '../../services/gamificationEngine';
import { PlayerHeroCard } from './PlayerHeroCard';
import { PlayerRadarChart } from './PlayerRadarChart';
import { PlayerQuestsCard } from './PlayerQuestsCard';
import { PlayerBadgesShowcase } from './PlayerBadgesShowcase';
import { Settings, X, Save, Sparkles } from 'lucide-react';

interface PlayerDashboardProps {
  currentUser: User;
  events: SportEvent[];
  allUsers?: User[];
  onOpenSettings: () => void;
  onUpdateUser?: (updated: Partial<User>) => Promise<void>;
  onClose?: () => void;
}

export const PlayerDashboard: React.FC<PlayerDashboardProps> = ({
  currentUser,
  events,
  allUsers = [],
  onOpenSettings,
  onUpdateUser,
  onClose,
}) => {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PlayerPosition>(currentUser.preferredPosition || 'allrounder');
  const [mottoText, setMottoText] = useState(currentUser.playerMotto || '');
  const [isSaving, setIsSaving] = useState(false);

  // Compute live gamification state
  const allUserIds = useMemo(() => allUsers.map(u => u.id), [allUsers]);
  const gamification = useMemo(() => {
    return computePlayerGamification(events, currentUser.id, currentUser, allUserIds);
  }, [events, currentUser, allUserIds]);

  const handleSaveProfile = async () => {
    if (!onUpdateUser) return;
    try {
      setIsSaving(true);
      await onUpdateUser({
        preferredPosition: selectedPosition,
        playerMotto: mottoText.trim() || undefined,
      });
      setIsEditingProfile(false);
    } catch (err) {
      console.error('Failed to update user profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div data-testid="player-dashboard" className="space-y-6 pb-20 max-w-4xl mx-auto">
      {/* Top Header with Quick Settings Link */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
            Můj hráčský profil
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Tvoje statistiky, herní karta a postup v partě
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 shadow-2xs text-xs active:scale-95 transition-all cursor-pointer"
              title="Zavřít profil"
              data-testid="player-dashboard-close"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 shadow-2xs font-semibold text-xs active:scale-95 transition-all cursor-pointer"
            title="Nastavení účtu a aplikace"
          >
            <Settings size={15} />
            <span className="hidden sm:inline">Nastavení</span>
          </button>
        </div>
      </div>

      {/* 1. FUT/RPG Hero Card */}
      <PlayerHeroCard
        currentUser={currentUser}
        gamification={gamification}
        onEditProfile={() => setIsEditingProfile(true)}
      />

      {/* 2. Grid: Radar Chart + Quests */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 5-Attribute Radar Chart */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-2">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Sparkles size={18} className="text-blue-600" />
                Herní atributy
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Soukromá analýza výkonnosti (škála 50–99)
              </p>
            </div>
          </div>

          <div className="my-auto py-2">
            <PlayerRadarChart attributes={gamification.attributes} size={280} />
          </div>
        </div>

        {/* Right: Active Quests */}
        <div className="lg:col-span-6 flex flex-col">
          <PlayerQuestsCard quests={gamification.activeQuests} />
        </div>
      </div>

      {/* 3. Badges Showcase (Síň slávy) */}
      <PlayerBadgesShowcase userBadges={[]} />

      {/* Profile Edit Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg text-slate-800">
                Upravit hráčskou identitu
              </h3>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Position Picker */}
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Preferovaná herní pozice
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PLAYER_POSITIONS.map(pos => {
                  const isSelected = selectedPosition === pos.type;
                  return (
                    <button
                      key={pos.type}
                      type="button"
                      onClick={() => setSelectedPosition(pos.type)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-base">{pos.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{pos.label}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">
                          {pos.shortLabel}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Motto Input */}
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Osobní volejbalové motto
              </label>
              <input
                type="text"
                value={mottoText}
                onChange={e => setMottoText(e.target.value)}
                maxLength={60}
                placeholder="např. Příjem je základ všeho! 🏐"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="text-[10px] text-slate-400 mt-1 block text-right">
                {mottoText.length} / 60 znaků
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Save size={15} />
                <span>{isSaving ? 'Ukládám...' : 'Uložit profil'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
