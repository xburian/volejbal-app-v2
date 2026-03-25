import React from 'react';
import { VolleyballEvent, User, UserStats, Badge } from '../types';
import { useStatistics } from '../services/useStatistics';
import {
  ArrowLeft, Loader2, Trophy, Flame, Ghost, HelpCircle, Wallet,
  PartyPopper, TrendingUp, Calendar, Users, CreditCard, MapPin, Target, BarChart3
} from 'lucide-react';

interface StatsPageProps {
  events: VolleyballEvent[];
  currentUser: User;
  isLoading: boolean;
  onClose: () => void;
}

const badgeIcons: Record<string, React.ReactNode> = {
  Flame: <Flame size={24} />,
  Ghost: <Ghost size={24} />,
  HelpCircle: <HelpCircle size={24} />,
  Wallet: <Wallet size={24} />,
  PartyPopper: <PartyPopper size={24} />,
};

const badgeColors: Record<string, string> = {
  ironman: 'bg-orange-50 border-orange-200 text-orange-600',
  ghost: 'bg-slate-50 border-slate-200 text-slate-500',
  maybeMaster: 'bg-yellow-50 border-yellow-200 text-yellow-600',
  quickPayer: 'bg-green-50 border-green-200 text-green-600',
  socialButterfly: 'bg-pink-50 border-pink-200 text-pink-600',
};

function Avatar({ name, photoUrl, size = 32 }: { name: string; photoUrl?: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

function PersonalStatsCard({ stats }: { stats: UserStats }) {
  const tiles = [
    { icon: <Calendar size={18} />, label: 'Odehráno', value: `${stats.eventsJoined}`, color: 'text-blue-600' },
    { icon: <Target size={18} />, label: 'Docházka', value: `${Math.round(stats.attendanceRate * 100)}%`, color: 'text-emerald-600' },
    { icon: <CreditCard size={18} />, label: 'Platby', value: `${Math.round(stats.paymentRate * 100)}%`, color: 'text-violet-600' },
    { icon: <Wallet size={18} />, label: 'Zaplaceno', value: `${stats.totalPaid} Kč`, color: 'text-green-600' },
    { icon: <TrendingUp size={18} />, label: 'Dluh', value: `${stats.totalOwed} Kč`, color: stats.totalOwed > 0 ? 'text-red-600' : 'text-slate-400' },
    { icon: <MapPin size={18} />, label: 'Oblíbené', value: stats.favoriteLocation || '–', color: 'text-amber-600' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Users size={18} className="text-blue-500" />
        Moje statistiky
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tiles.map(tile => (
          <div key={tile.label} className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1">
            <div className={`flex items-center gap-1.5 text-xs font-medium text-slate-500`}>
              <span className={tile.color}>{tile.icon}</span>
              {tile.label}
            </div>
            <div className={`text-lg font-bold ${tile.color} truncate`}>{tile.value}</div>
          </div>
        ))}
      </div>
      {stats.currentStreak > 1 && (
        <div className="mt-3 text-sm text-orange-600 font-medium flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-lg">
          <Flame size={14} />
          Aktuální série: {stats.currentStreak} událostí v řadě
        </div>
      )}
    </div>
  );
}

function BadgesRow({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Trophy size={18} className="text-yellow-500" />
        Ocenění
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {badges.map(badge => (
          <div
            key={badge.type}
            className={`flex-shrink-0 w-40 rounded-xl border-2 p-4 flex flex-col items-center text-center gap-2 ${badgeColors[badge.type] || 'bg-slate-50 border-slate-200'}`}
          >
            <div className="text-2xl">{badgeIcons[badge.iconName]}</div>
            <div className="font-bold text-sm">{badge.label}</div>
            <Avatar name={badge.userName} photoUrl={badge.photoUrl} size={28} />
            <div className="text-xs font-medium truncate max-w-full">{badge.userName}</div>
            <div className="text-xs opacity-75">{badge.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Leaderboard({ stats, title, icon, valueKey }: {
  stats: UserStats[];
  title: string;
  icon: React.ReactNode;
  valueKey: 'attendanceRate' | 'paymentRate';
}) {
  if (stats.length === 0) return null;
  const maxVal = Math.max(...stats.map(s => s[valueKey]), 0.01);

  const getBarColor = (value: number) => {
    if (valueKey === 'paymentRate') {
      if (value >= 0.8) return 'bg-green-500';
      if (value >= 0.5) return 'bg-yellow-500';
      return 'bg-red-400';
    }
    return 'bg-blue-500';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-2.5">
        {stats.slice(0, 10).map((s, i) => {
          const pct = Math.round(s[valueKey] * 100);
          const barWidth = s[valueKey] / maxVal * 100;
          return (
            <div key={s.userId} className={`flex items-center gap-3 p-2 rounded-lg ${i === 0 ? 'bg-yellow-50 ring-1 ring-yellow-200' : ''}`}>
              <span className={`w-6 text-right text-sm font-bold ${i === 0 ? 'text-yellow-600' : 'text-slate-400'}`}>
                {i === 0 ? '🏆' : `${i + 1}.`}
              </span>
              <Avatar name={s.name} photoUrl={s.photoUrl} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700 truncate">{s.name}</span>
                  <span className="text-sm font-bold text-slate-600 ml-2">{pct}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getBarColor(s[valueKey])}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const StatsPage: React.FC<StatsPageProps> = ({ events, currentUser, isLoading, onClose }) => {
  const { leaderboard, paymentRanking, personalStats, badges } = useStatistics(events, currentUser, false);

  const hasEnoughData = events.length >= 3;

  return (
    <div className="relative max-w-3xl mx-auto w-full">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center rounded-2xl">
          <Loader2 className="animate-spin text-blue-600" size={36} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 size={24} className="text-blue-600" />
          Statistiky
        </h2>
      </div>

      {!hasEnoughData ? (
        <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          <BarChart3 size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium">Zatím není dostatek dat</p>
          <p className="text-sm mt-1">Vytvořte více událostí pro zobrazení statistik.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Personal Stats */}
          {personalStats && <PersonalStatsCard stats={personalStats} />}

          {/* Badges */}
          <BadgesRow badges={badges} />

          {/* Leaderboards side by side on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Leaderboard
              stats={leaderboard}
              title="MVP Žebříček"
              icon={<Trophy size={18} className="text-yellow-500" />}
              valueKey="attendanceRate"
            />
            <Leaderboard
              stats={paymentRanking}
              title="Spolehlivost plateb"
              icon={<Wallet size={18} className="text-green-500" />}
              valueKey="paymentRate"
            />
          </div>


        </div>
      )}
    </div>
  );
};
