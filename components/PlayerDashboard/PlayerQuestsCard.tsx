import React from 'react';
import { ActiveQuest } from '../../types';
import { Target, CheckCircle2, Clock, Sparkles } from 'lucide-react';

interface PlayerQuestsCardProps {
  quests: ActiveQuest[];
}

export const PlayerQuestsCard: React.FC<PlayerQuestsCardProps> = ({ quests }) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
          <Target size={18} className="text-blue-600" />
          Aktivní výzvy & Milníky
        </h3>
        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
          <Clock size={13} />
          Týdenní rotace
        </span>
      </div>

      <div className="space-y-3">
        {quests.map(quest => {
          const progressPercent = Math.min(100, Math.round((quest.progress / quest.goal) * 100));

          return (
            <div
              key={quest.id}
              className={`p-3.5 rounded-2xl border transition-all ${
                quest.isCompleted
                  ? 'bg-emerald-50/70 border-emerald-200/80'
                  : 'bg-slate-50/70 border-slate-200/80 hover:bg-white hover:shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-800 truncate">
                      {quest.title}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-200/60 text-slate-600">
                      {quest.type === 'weekly' ? 'Týdenní' : quest.type === 'monthly' ? 'Měsíční' : 'Milník'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {quest.description}
                  </p>
                </div>

                {/* Reward Badge */}
                <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100/70 border border-amber-200 text-amber-800 text-xs font-extrabold">
                  <Sparkles size={12} className="text-amber-600" />
                  <span>+{quest.xpReward} XP</span>
                </div>
              </div>

              {/* Progress Bar & Status */}
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 h-2 rounded-full bg-slate-200/70 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      quest.isCompleted
                        ? 'bg-emerald-500'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  {quest.isCompleted ? (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={14} className="stroke-[2.5]" />
                      Splněno
                    </span>
                  ) : (
                    <span>
                      {quest.progress} / {quest.goal}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
