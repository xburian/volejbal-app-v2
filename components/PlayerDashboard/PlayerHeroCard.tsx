import React from 'react';
import { User, PlayerGamificationState, PLAYER_POSITIONS } from '../../types';
import { RANK_TIERS } from '../../services/gamificationEngine';
import { Flame, Sparkles, Award, Edit2, Shield, Heart } from 'lucide-react';

interface PlayerHeroCardProps {
  currentUser: User;
  gamification: PlayerGamificationState;
  onEditProfile?: () => void;
}

export const PlayerHeroCard: React.FC<PlayerHeroCardProps> = ({
  currentUser,
  gamification,
  onEditProfile,
}) => {
  const tierConfig = RANK_TIERS[gamification.rankTier] || RANK_TIERS.bronze;
  const positionConfig = PLAYER_POSITIONS.find(p => p.type === currentUser.preferredPosition) || PLAYER_POSITIONS[0];

  return (
    <div
      data-testid="player-hero-card"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-white/10 p-6 transition-all"
    >
      {/* Decorative background glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar: Tier Badge & Streak Flame */}
      <div className="flex items-center justify-between gap-3 relative z-10 mb-5">
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 border border-white/15 backdrop-blur-md flex items-center gap-1.5 shadow-xs">
            <span>{tierConfig.icon}</span>
            <span className="tracking-wide text-slate-200">{tierConfig.label} Divize</span>
          </span>

          {/* Position Tag */}
          <span
            className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 border border-blue-400/30 text-blue-200 flex items-center gap-1"
            title={positionConfig.label}
          >
            <span>{positionConfig.icon}</span>
            <span className="font-mono font-bold">{positionConfig.shortLabel}</span>
          </span>
        </div>

        {/* Attendance Streak */}
        <div className="flex items-center gap-1.5">
          {gamification.currentAttendanceStreak > 0 && (
            <div
              className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 border shadow-sm transition-transform ${
                gamification.isOnFire
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-400 animate-pulse'
                  : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
              }`}
            >
              <Flame size={15} className={gamification.isOnFire ? 'animate-bounce' : ''} />
              <span>{gamification.currentAttendanceStreak} {gamification.currentAttendanceStreak === 1 ? 'zápas' : gamification.currentAttendanceStreak < 5 ? 'zápasy' : 'zápasů'} v řadě</span>
              {gamification.isOnFire && (
                <span className="text-[10px] bg-black/30 px-1 py-0.2 rounded font-mono">+10% XP</span>
              )}
            </div>
          )}

          {onEditProfile && (
            <button
              onClick={onEditProfile}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white transition-all cursor-pointer"
              title="Upravit pozici a motto"
            >
              <Edit2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Main Avatar & Identity Section */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 relative z-10">
        {/* Avatar with Metallic Rank Ring */}
        <div className="relative shrink-0">
          <div className={`p-1 rounded-full bg-gradient-to-tr ${tierConfig.border} shadow-lg`}>
            {currentUser.photoUrl ? (
              <img
                src={currentUser.photoUrl}
                alt={currentUser.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-slate-900"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center border-2 border-slate-900">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {/* Level Pill overlaid on avatar */}
          <div className="absolute -bottom-2 inset-x-0 flex justify-center">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-white/30 shadow-md">
              LVL {gamification.currentLevel}
            </span>
          </div>
        </div>

        {/* Player Name, Rank Title and Motto */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white truncate">
            {currentUser.name}
          </h2>

          <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
            <Sparkles size={16} className="text-amber-400 shrink-0" />
            <span className="text-sm sm:text-base font-bold text-amber-300">
              {gamification.rankTitle}
            </span>
          </div>

          {/* Player Motto */}
          <p className="text-xs sm:text-sm text-slate-300 italic mt-2 line-clamp-2">
            „{currentUser.playerMotto || 'Příjem je základ všeho! 🏐'}“
          </p>

          {/* Social Badges Row: MVP & Kudos */}
          <div className="flex items-center justify-center sm:justify-start gap-3 mt-3">
            {gamification.mvpAwardsCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/15 border border-amber-400/25 text-amber-200 text-xs font-semibold">
                <Award size={14} className="text-amber-400" />
                <span>{gamification.mvpAwardsCount}× Hvězda zápasu</span>
              </div>
            )}
            {gamification.kudosCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-400/15 border border-rose-400/25 text-rose-200 text-xs font-semibold">
                <Heart size={14} className="text-rose-400 fill-rose-400" />
                <span>{gamification.kudosCount} pochval od party</span>
              </div>
            )}
            {gamification.streakShieldsAvailable > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-400/15 border border-cyan-400/25 text-cyan-200 text-xs font-semibold" title="Štít chrání sérii při omluvě předem">
                <Shield size={13} className="text-cyan-400" />
                <span>{gamification.streakShieldsAvailable} {gamification.streakShieldsAvailable === 1 ? 'štít' : 'štíty'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* XP Progress Bar Section */}
      <div className="mt-6 pt-5 border-t border-white/10 relative z-10">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
          <span>Postup do Levelu {gamification.currentLevel + 1}</span>
          <span className="font-mono text-white font-bold">
            {gamification.xpInCurrentLevel.toLocaleString('cs-CZ')} / {gamification.xpForNextLevel.toLocaleString('cs-CZ')} XP ({gamification.levelProgressPercent} %)
          </span>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full h-3 rounded-full bg-white/10 p-0.5 overflow-hidden backdrop-blur-sm border border-white/10 shadow-inner">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-400 transition-all duration-700 ease-out shadow-sm"
            style={{ width: `${Math.max(3, gamification.levelProgressPercent)}%` }}
          />
        </div>

        {/* Smart Hint */}
        <div className="flex items-center gap-2 mt-2.5 text-xs text-blue-200 font-medium">
          <span className="shrink-0">💡</span>
          <span className="truncate">{gamification.nextLevelHintText}</span>
        </div>
      </div>
    </div>
  );
};
