import React from 'react';
import { SportEvent } from '../../types';
import { Edit2, Check, X, Plus, Minus } from 'lucide-react';

interface ScoreEditorProps {
  event: SportEvent;
  setScores: [number, number][];
  isEditingScore: boolean;
  onAddSet: () => void;
  onRemoveSet: (idx: number) => void;
  onSetScoreChange: (setIdx: number, teamIdx: 0 | 1, value: number) => void;
  onSaveScore: () => void;
  onCancelScore: () => void;
  onStartEditScore: () => void;
}

export const ScoreEditor: React.FC<ScoreEditorProps> = ({
  event,
  setScores,
  isEditingScore,
  onAddSet,
  onRemoveSet,
  onSetScoreChange,
  onSaveScore,
  onCancelScore,
  onStartEditScore,
}) => (
  <div className="mt-3 bg-slate-50 rounded-lg border border-slate-200 p-3" data-testid="score-section">
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        Skóre setů
      </h4>
      {!isEditingScore ? (
        <button
          onClick={onStartEditScore}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
          data-testid="score-edit-btn"
        >
          <Edit2 size={12} />
          {event.score ? 'Upravit' : 'Zadat skóre'}
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={onSaveScore}
            className="text-xs text-green-600 hover:bg-green-50 px-2 py-1 rounded font-medium flex items-center gap-1 transition-colors"
            data-testid="score-save-btn"
          >
            <Check size={12} />
            Uložit
          </button>
          <button
            onClick={onCancelScore}
            className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded font-medium flex items-center gap-1 transition-colors"
            data-testid="score-cancel-btn"
          >
            <X size={12} />
          </button>
        </div>
      )}
    </div>

    {isEditingScore ? (
      <div className="space-y-2">
        <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] gap-2 items-center text-xs text-slate-500 font-medium">
          <span className="w-12"></span>
          <span className="text-center truncate">{event.teamNames?.[0] ?? 'Tým 1'}</span>
          <span></span>
          <span className="text-center truncate">{event.teamNames?.[1] ?? 'Tým 2'}</span>
          <span className="w-6"></span>
        </div>
        {setScores.map(([s0, s1], idx) => (
          <div key={idx} className="grid grid-cols-[auto_1fr_auto_1fr_auto] gap-2 items-center" data-testid={`score-set-${idx}`}>
            <span className="text-xs font-bold text-slate-400 w-12">Set {idx + 1}</span>
            <input
              type="number"
              min="0"
              value={s0}
              onChange={e => onSetScoreChange(idx, 0, Math.max(0, Number(e.target.value)))}
              className="w-full px-2 py-1.5 text-sm text-center border border-slate-300 rounded focus:ring-1 focus:ring-blue-300 outline-none"
              data-testid={`score-set-${idx}-team-0`}
            />
            <span className="text-xs text-slate-300 font-bold">:</span>
            <input
              type="number"
              min="0"
              value={s1}
              onChange={e => onSetScoreChange(idx, 1, Math.max(0, Number(e.target.value)))}
              className="w-full px-2 py-1.5 text-sm text-center border border-slate-300 rounded focus:ring-1 focus:ring-blue-300 outline-none"
              data-testid={`score-set-${idx}-team-1`}
            />
            <button
              onClick={() => onRemoveSet(idx)}
              className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors"
              title="Odebrat set"
              data-testid={`score-remove-set-${idx}`}
            >
              <Minus size={14} />
            </button>
          </div>
        ))}
        <button
          onClick={onAddSet}
          className="w-full py-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center justify-center gap-1 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          data-testid="score-add-set-btn"
        >
          <Plus size={12} />
          Přidat set
        </button>
      </div>
    ) : event.score && event.score.length > 0 ? (
      <div className="space-y-1.5">
        <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-xs text-slate-500 font-medium">
          <span className="w-12"></span>
          <span className="text-center truncate">{event.teamNames?.[0] ?? 'Tým 1'}</span>
          <span></span>
          <span className="text-center truncate">{event.teamNames?.[1] ?? 'Tým 2'}</span>
        </div>
        {event.score.map(([s0, s1], idx) => (
          <div key={idx} className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center" data-testid={`score-display-set-${idx}`}>
            <span className="text-xs font-bold text-slate-400 w-12">Set {idx + 1}</span>
            <span className={`text-sm text-center font-mono font-semibold ${s0 > s1 ? 'text-green-600' : 'text-slate-600'}`}>{s0}</span>
            <span className="text-xs text-slate-300 font-bold">:</span>
            <span className={`text-sm text-center font-mono font-semibold ${s1 > s0 ? 'text-green-600' : 'text-slate-600'}`}>{s1}</span>
          </div>
        ))}
        {(() => {
          const won0 = event.score!.filter(([a, b]) => a > b).length;
          const won1 = event.score!.filter(([a, b]) => b > a).length;
          return (
            <div className="pt-1.5 border-t border-slate-200 flex justify-center gap-2 text-xs font-semibold">
              <span className={won0 > won1 ? 'text-green-600' : 'text-slate-500'}>{won0}</span>
              <span className="text-slate-300">:</span>
              <span className={won1 > won0 ? 'text-green-600' : 'text-slate-500'}>{won1}</span>
              <span className="text-slate-400 font-normal ml-1">na sety</span>
            </div>
          );
        })()}
      </div>
    ) : (
      <p className="text-xs text-slate-400 italic text-center py-1">
        Zatím žádné skóre.
      </p>
    )}
  </div>
);

