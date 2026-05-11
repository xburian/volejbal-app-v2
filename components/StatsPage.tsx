import React, { useState, useMemo } from 'react';
import { SportEvent, User, UserStats, Badge, DuoStats, SportConfig, SportType, SPORT_EMOJI, LeaderboardEntry, PlayerFormTrend, NemesisData, EventHealthMetrics, ClutchData } from '../types';
import { useStatistics } from '../services/useStatistics';
import {
  ArrowLeft, Loader2, Trophy, Flame, Ghost, HelpCircle, Wallet,
  PartyPopper, TrendingUp, Calendar, Users, Target, BarChart3, Star, Swords, Zap, AlertCircle
} from 'lucide-react';

interface StatsPageProps {
  events: SportEvent[];
  currentUser: User;
  isLoading: boolean;
  onClose: () => void;
  sportConfigs?: SportConfig[];
}

const badgeIcons: Record<string, React.ReactNode> = {
  Flame: <Flame size={24} />,
  Ghost: <Ghost size={24} />,
  HelpCircle: <HelpCircle size={24} />,
  Wallet: <Wallet size={24} />,
  PartyPopper: <PartyPopper size={24} />,
  Star: <Star size={24} />,
  TrendingUp: <TrendingUp size={24} />,
  Zap: <Zap size={24} />,
  Calendar: <Calendar size={24} />,
};

const badgeColors: Record<string, string> = {
  ironman: 'bg-orange-50 border-orange-200 text-orange-600',
  ghost: 'bg-slate-50 border-slate-200 text-slate-500',
  maybeMaster: 'bg-yellow-50 border-yellow-200 text-yellow-600',
  quickPayer: 'bg-green-50 border-green-200 text-green-600',
  socialButterfly: 'bg-pink-50 border-pink-200 text-pink-600',
  luckyPlayer: 'bg-amber-50 border-amber-200 text-amber-600',
  comebackKing: 'bg-blue-50 border-blue-200 text-blue-600',
  clutchPlayer: 'bg-purple-50 border-purple-200 text-purple-600',
  consistent: 'bg-teal-50 border-teal-200 text-teal-600',
  weekdayWarrior: 'bg-indigo-50 border-indigo-200 text-indigo-600',
};

// ── Shared Components ──

function Avatar({ name, photoUrl, size = 32 }: { name: string; photoUrl?: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center" style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  );
}

function InsufficientData({ message }: { message: string }) {
  return (
    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400">
      <AlertCircle size={24} className="mx-auto mb-2 text-slate-300" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── SVG Sparkline (hand-rolled, no external dep) ──

function Sparkline({ results }: { results: boolean[] }) {
  if (results.length < 2) return null;
  const width = 120;
  const height = 30;
  const padding = 2;
  const step = (width - padding * 2) / (results.length - 1);

  // Running win rate as y value
  let wins = 0;
  const points = results.slice().reverse().map((won, i) => {
    if (won) wins++;
    const rate = wins / (i + 1);
    const x = padding + i * step;
    const y = height - padding - rate * (height - padding * 2);
    return { x, y, won };
  });

  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPoints = `${padding},${height - padding} ${linePoints} ${padding + (results.length - 1) * step},${height - padding}`;

  // Color: latest trend up = green, down = red, else blue
  const lastRate = points.length > 0 ? (height - padding - points[points.length - 1].y) / (height - padding * 2) : 0.5;
  const firstRate = points.length > 0 ? (height - padding - points[0].y) / (height - padding * 2) : 0.5;
  const trendColor = lastRate > firstRate + 0.05 ? '#22c55e' : lastRate < firstRate - 0.05 ? '#ef4444' : '#3b82f6';

  return (
    <svg width={width} height={height} className="inline-block">
      <polygon points={areaPoints} fill={trendColor} opacity={0.15} />
      <polyline points={linePoints} fill="none" stroke={trendColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={p.won ? '#22c55e' : '#ef4444'} />
      ))}
    </svg>
  );
}

// ── Section Cards ──

function LeaderboardCard({ entries, currentUserId }: { entries: LeaderboardEntry[]; currentUserId: string }) {
  if (entries.length === 0) return <InsufficientData message="Nedostatek dat pro žebříček (min. 3 události na hráče)" />;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Trophy size={18} className="text-yellow-500" />
        Žebříček
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-100">
              <th className="text-left py-2 pr-2">#</th>
              <th className="text-left py-2">Hráč</th>
              <th className="text-right py-2 px-2" title="Hodnocení síly hráče (start 1000). Roste s výhrami, klesá s prohrami. Výhra proti silnějšímu soupeři dá více bodů.">ELO</th>
              <th className="text-right py-2 px-2">Výhry</th>
              <th className="text-right py-2 px-2 hidden sm:table-cell">Zápasy</th>
              <th className="text-right py-2 pl-2 hidden sm:table-cell" title="Spolehlivost: 60% docházka + 40% platební morálka">Spolehl.</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.userId} className={`border-b border-slate-50 ${entry.userId === currentUserId ? 'bg-blue-50' : ''}`}>
                <td className="py-2 pr-2 font-bold text-slate-400">{entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `${entry.rank}.`}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={entry.name} photoUrl={entry.photoUrl} size={24} />
                    <span className={`font-medium truncate max-w-[120px] ${entry.userId === currentUserId ? 'text-blue-700' : 'text-slate-700'}`}>{entry.name}</span>
                  </div>
                </td>
                <td className="text-right py-2 px-2 font-bold text-slate-700">{entry.eloRating}</td>
                <td className="text-right py-2 px-2 text-slate-600">{Math.round(entry.winRate * 100)}%</td>
                <td className="text-right py-2 px-2 text-slate-500 hidden sm:table-cell">{entry.gamesPlayed}</td>
                <td className="text-right py-2 pl-2 text-slate-500 hidden sm:table-cell">{entry.reliabilityScore}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormCard({ formTrend }: { formTrend: PlayerFormTrend }) {
  const trendArrow = formTrend.trend === 'up' ? '↑' : formTrend.trend === 'down' ? '↓' : '→';
  const trendColor = formTrend.trend === 'up' ? 'text-green-600' : formTrend.trend === 'down' ? 'text-red-600' : 'text-slate-500';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <TrendingUp size={18} className="text-blue-500" />
        Moje forma
      </h3>
      <div className="flex items-center gap-4 flex-wrap">
        <Sparkline results={formTrend.recentResults} />
        <div className="flex gap-4">
          {formTrend.last5WinRate !== null && (
            <div className="text-center">
              <div className={`text-lg font-bold ${trendColor}`}>{Math.round(formTrend.last5WinRate * 100)}%</div>
              <div className="text-xs text-slate-500">Posledních 5</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-lg font-bold text-slate-700">{Math.round(formTrend.allTimeWinRate * 100)}%</div>
            <div className="text-xs text-slate-500">Celkově</div>
          </div>
          <div className={`text-2xl font-bold ${trendColor} flex items-center`}>{trendArrow}</div>
        </div>
      </div>
      {formTrend.recentResults.length > 0 && (
        <div className="mt-3 flex gap-1">
          {formTrend.recentResults.map((won, i) => (
            <div key={i} className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${won ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {won ? 'V' : 'P'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

function DayHeatmapCard({ heatmap }: { heatmap: number[] }) {
  const max = Math.max(...heatmap, 1);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Calendar size={18} className="text-indigo-500" />
        Denní rozložení
      </h3>
      <div className="space-y-2">
        {heatmap.map((count, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 w-6">{DAY_LABELS[i]}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${max > 0 ? (count / max) * 100 : 0}%`, opacity: count > 0 ? 0.4 + (count / max) * 0.6 : 0.1 }}
              />
            </div>
            <span className="text-xs font-medium text-slate-600 w-6 text-right">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NemesisCard({ nemesis }: { nemesis: NemesisData }) {
  if (!nemesis.nemesis && !nemesis.favorite) return <InsufficientData message="Nedostatek dat o soupeřích (min. 3 zápasy proti jednomu hráči)" />;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Swords size={18} className="text-red-500" />
        Soupeři
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {nemesis.favorite && (
          <div className="bg-green-50 rounded-xl p-3 border border-green-200">
            <div className="text-xs font-medium text-green-600 mb-2">Oblíbenec 😊</div>
            <div className="flex items-center gap-2">
              <Avatar name={nemesis.favorite.name} photoUrl={nemesis.favorite.photoUrl} size={28} />
              <div>
                <div className="text-sm font-medium text-slate-700">{nemesis.favorite.name}</div>
                <div className="text-xs text-slate-500">{Math.round(nemesis.favorite.winRate * 100)}% výher z {nemesis.favorite.gamesAgainst}</div>
              </div>
            </div>
          </div>
        )}
        {nemesis.nemesis && (
          <div className="bg-red-50 rounded-xl p-3 border border-red-200">
            <div className="text-xs font-medium text-red-600 mb-2">Nemesis 😈</div>
            <div className="flex items-center gap-2">
              <Avatar name={nemesis.nemesis.name} photoUrl={nemesis.nemesis.photoUrl} size={28} />
              <div>
                <div className="text-sm font-medium text-slate-700">{nemesis.nemesis.name}</div>
                <div className="text-xs text-slate-500">{Math.round(nemesis.nemesis.winRate * 100)}% výher z {nemesis.nemesis.gamesAgainst}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClutchCard({ clutchData }: { clutchData: ClutchData }) {
  if (clutchData.clutchWinRate === null) return <InsufficientData message="Nedostatek těsných setů pro clutch statistiku (min. 5 setů s rozdílem ≤3)" />;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Zap size={18} className="text-purple-500" />
        Clutch faktor
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-purple-50 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-purple-700">{Math.round(clutchData.clutchWinRate * 100)}%</div>
          <div className="text-xs text-slate-500">Těsné sety (≤3b)</div>
        </div>
        {clutchData.blowoutWinRate !== null && (
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-slate-700">{Math.round(clutchData.blowoutWinRate * 100)}%</div>
            <div className="text-xs text-slate-500">Jasné sety (&gt;3b)</div>
          </div>
        )}
      </div>
      <div className="mt-2 text-xs text-slate-400 text-center">{clutchData.clutchSetsPlayed} těsných setů odehráno</div>
    </div>
  );
}

function PersonalStatsCard({ stats, totalEventsCount }: { stats: UserStats; totalEventsCount: number }) {
  const attendanceVsAll = totalEventsCount > 0 ? Math.round((stats.eventsJoined / totalEventsCount) * 100) : 0;

  const tiles: { icon: React.ReactNode; label: string; value: string; color: string; tooltip: string }[] = [
    { icon: <Calendar size={18} />, label: 'Odehráno', value: `${stats.eventsJoined}`, color: 'text-blue-600', tooltip: 'Počet událostí, kterých jste se zúčastnili' },
    { icon: <Target size={18} />, label: 'Docházka', value: `${attendanceVsAll}%`, color: 'text-emerald-600', tooltip: `Účast na ${stats.eventsJoined} z ${totalEventsCount} všech událostí` },
    ...(stats.gamesPlayed > 0 ? [{ icon: <Trophy size={18} />, label: 'Výhry', value: `${stats.gamesWon}/${stats.gamesPlayed} (${Math.round(stats.winRate * 100)}%)`, color: 'text-indigo-600', tooltip: 'Počet vyhraných zápasů / celkem odehraných' }] : []),
    ...((stats.setsWon + stats.setsLost) > 0 ? [{ icon: <Swords size={18} />, label: 'Sety', value: `${stats.setsWon}:${stats.setsLost} (${Math.round(stats.setWinRate * 100)}%)`, color: 'text-purple-600', tooltip: 'Poměr vyhraných a prohraných setů' }] : []),
    ...(stats.eloRating ? [{ icon: <Star size={18} />, label: 'ELO', value: `${stats.eloRating}`, color: 'text-yellow-600', tooltip: 'Hodnocení síly hráče. Start 1000, roste s výhrami proti silným soupeřům.' }] : []),
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Users size={18} className="text-blue-500" />
        Přehled
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tiles.map(tile => (
          <div key={tile.label} className="bg-slate-50 rounded-xl p-3 flex flex-col gap-1" title={tile.tooltip}>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
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
          <div key={badge.type} className={`flex-shrink-0 w-40 rounded-xl border-2 p-4 flex flex-col items-center text-center gap-2 ${badgeColors[badge.type] || 'bg-slate-50 border-slate-200'}`}>
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

function BestDuos({ duos }: { duos: DuoStats[] }) {
  if (duos.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Swords size={18} className="text-indigo-500" />
        Nejlepší dvojice
      </h3>
      <div className="space-y-3">
        {duos.map((duo, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${i === 0 ? 'bg-yellow-50 ring-1 ring-yellow-200' : 'bg-slate-50'}`}>
            <span className={`w-6 text-right text-sm font-bold ${i === 0 ? 'text-yellow-600' : 'text-slate-400'}`}>
              {i === 0 ? '🏆' : `${i + 1}.`}
            </span>
            <div className="flex -space-x-2">
              <Avatar name={duo.players[0].name} photoUrl={duo.players[0].photoUrl} size={28} />
              <Avatar name={duo.players[1].name} photoUrl={duo.players[1].photoUrl} size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-700 truncate">{duo.players[0].name} & {duo.players[1].name}</div>
              <div className="text-xs text-slate-500">
                {duo.gamesWon} výher z {duo.gamesPlayed} zápasů ({Math.round(duo.winRate * 100)}%)
                {(duo.setsWon + duo.setsLost) > 0 && <span className="ml-1">· sety {duo.setsWon}:{duo.setsLost} ({Math.round(duo.setWinRate * 100)}%)</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventHealthCard({ health }: { health: EventHealthMetrics }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        <BarChart3 size={18} className="text-emerald-500" />
        Zdraví událostí
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-emerald-50 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-emerald-700">{Math.round(health.avgFillRate * 100)}%</div>
          <div className="text-xs text-slate-500">Průměrná naplněnost</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <div className="text-lg font-bold text-slate-700">{health.avgSetMargin}</div>
          <div className="text-xs text-slate-500">Průměrný rozdíl setů</div>
        </div>
      </div>
      {health.mostCompetitiveGames.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">Nejvyrovnanější zápasy</div>
          {health.mostCompetitiveGames.map((g) => (
            <div key={g.eventId} className="text-xs text-slate-600 py-1 border-b border-slate-50 last:border-0">
              <span className="font-medium">{g.eventTitle}</span> ({g.date}) — průměrný rozdíl {g.avgMargin.toFixed(1)} bodů
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Main Page ──

export const StatsPage: React.FC<StatsPageProps> = ({ events, currentUser, isLoading, onClose, sportConfigs = [] }) => {
  const [sportFilter, setSportFilter] = useState<SportType | null>(null);

  const filteredEvents = useMemo(
    () => sportFilter ? events.filter(e => (e.sportType ?? 'volejbal') === sportFilter) : events,
    [events, sportFilter]
  );

  const { personalStats, badges, duoStats, leaderboard, formTrend, nemesis, eventHealth, clutchData, dayHeatmap } = useStatistics(filteredEvents, currentUser, false, sportConfigs);

  const hasEnoughData = filteredEvents.length >= 3;

  const activeSports = useMemo(() => {
    const types = new Set(events.map(e => e.sportType ?? 'volejbal'));
    return sportConfigs.filter(c => types.has(c.type));
  }, [events, sportConfigs]);

  return (
    <div className="relative max-w-3xl mx-auto w-full">
      {isLoading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center rounded-2xl">
          <Loader2 className="animate-spin text-blue-600" size={36} />
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 size={24} className="text-blue-600" />
          Statistiky
        </h2>
      </div>

      {activeSports.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-6" data-testid="stats-sport-filter">
          <button onClick={() => setSportFilter(null)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${sportFilter === null ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
            Vše
          </button>
          {activeSports.map(config => (
            <button key={config.type} onClick={() => setSportFilter(sportFilter === config.type ? null : config.type)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-1 ${sportFilter === config.type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
              <span>{SPORT_EMOJI[config.type] ?? '🏅'}</span>
              {config.label}
            </button>
          ))}
        </div>
      )}

      {!hasEnoughData ? (
        <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          <BarChart3 size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium">Zatím není dostatek dat</p>
          <p className="text-sm mt-1">{sportFilter ? 'Pro tento sport nemáte dostatek událostí.' : 'Vytvořte více událostí pro zobrazení statistik.'}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Leaderboard */}
          <LeaderboardCard entries={leaderboard} currentUserId={currentUser.id} />

          {/* Form */}
          {formTrend && formTrend.recentResults.length >= 2 && <FormCard formTrend={formTrend} />}

          {/* Day Heatmap */}
          {dayHeatmap && <DayHeatmapCard heatmap={dayHeatmap} />}

          {/* Nemesis */}
          {nemesis && <NemesisCard nemesis={nemesis} />}

          {/* Clutch */}
          {clutchData && <ClutchCard clutchData={clutchData} />}

          {/* Personal Stats */}
          {personalStats && <PersonalStatsCard stats={personalStats} totalEventsCount={filteredEvents.length} />}


          {/* Badges */}
          <BadgesRow badges={badges} />

          {/* Duos */}
          <BestDuos duos={duoStats} />

          {/* Event Health */}
          {eventHealth && <EventHealthCard health={eventHealth} />}
        </div>
      )}
    </div>
  );
};
