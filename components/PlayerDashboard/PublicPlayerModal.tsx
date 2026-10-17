import React from 'react';
import { User, PlayerGamificationState, PLAYER_POSITIONS } from '../../types';
import { RANK_TIERS } from '../../services/gamificationEngine';
import { X, Sparkles, Flame, Award, Heart, Calendar } from 'lucide-react';

interface PublicPlayerModalProps {
  user: User;
  gamification: PlayerGamificationState;
  onClose: () => void;
}

export const PublicPlayerModal: React.FC<PublicPlayerModalProps> = ({
  user,
  gamification,
  onClose,
}) => {
  const tierConfig = RANK_TIERS[gamification.rankTier] || RANK_TIERS.bronze;
  const positionConfig = PLAYER_POSITIONS.find(p => p.type === user.preferredPosition) || PLAYER_POSITIONS[0];

  return (
    <div
      data-testid="public-player-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-2xl border border-white/15 p-6 animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
          title="Zavřít"
        >
          <X size={18} />
        </button>

        {/* Header: Tier & Position */}
        <div className="flex items-center gap-2 mb-4">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 border border-white/15 backdrop-blur-md flex items-center gap-1.5 shadow-xs">
            <span>{tierConfig.icon}</span>
            <span className="tracking-wide text-slate-200">{tierConfig.label} Divize</span>
          </span>

          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 border border-blue-400/30 text-blue-200 flex items-center gap-1">
            <span>{positionConfig.icon}</span>
            <span className="font-mono font-bold">{positionConfig.shortLabel}</span>
          </span>
        </div>

        {/* Avatar & Rank Ring */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className={`p-1 rounded-full bg-gradient-to-tr ${tierConfig.border} shadow-lg`}>
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="w-24 h-24 rounded-full object-cover border-2 border-slate-900"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center border-2 border-slate-900">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 inset-x-0 flex justify-center">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-white/30 shadow-md">
                LVL {gamification.currentLevel}
              </span>
            </div>
          </div>

          <h3 className="text-2xl font-black tracking-tight text-white mt-1">
            {user.name}
          </h3>

          <div className="flex items-center gap-1.5 text-sm font-bold text-amber-300 mt-0.5">
            <Sparkles size={14} className="text-amber-400" />
            <span>{gamification.rankTitle}</span>
          </div>

          <p className="text-xs text-slate-300 italic mt-2 px-4">
            „{user.playerMotto || 'Srdcem a rybičkou na palubovce! 🏐'}“
          </p>

          {/* Key Prestige Tiles */}
          <div className="grid grid-cols-2 gap-2.5 w-full mt-5">
            {/* Streak */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center text-center">
              <div className="flex items-center gap-1 text-orange-400 text-xs font-bold mb-0.5">
                <Flame size={14} />
                <span>Série</span>
              </div>
              <span className="text-lg font-black text-white">
                {gamification.currentAttendanceStreak} {gamification.currentAttendanceStreak === 1 ? 'zápas' : 'zápasů'}
              </span>
            </div>

            {/* Total Events */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center text-center">
              <div className="flex items-center gap-1 text-blue-400 text-xs font-bold mb-0.5">
                <Calendar size={14} />
                <span>Odehráno</span>
              </div>
              <span className="text-lg font-black text-white">
                {gamification.attributes.endurance > 50 ? Math.round(((gamification.attributes.endurance - 50) / 49) * 25) : 0}+ akcí
              </span>
            </div>
          </div>

          {/* Social Badges */}
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            {gamification.mvpAwardsCount > 0 && (
              <span className="px-2.5 py-1 rounded-xl bg-amber-400/15 border border-amber-400/25 text-amber-200 text-xs font-semibold flex items-center gap-1">
                <Award size={13} className="text-amber-400" />
                <span>{gamification.mvpAwardsCount}× Hvězda zápasu</span>
              </span>
            )}
            {gamification.kudosCount > 0 && (
              <span className="px-2.5 py-1 rounded-xl bg-rose-400/15 border border-rose-400/25 text-rose-200 text-xs font-semibold flex items-center gap-1">
                <Heart size={13} className="text-rose-400 fill-rose-400" />
                <span>{gamification.kudosCount} pochval</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
