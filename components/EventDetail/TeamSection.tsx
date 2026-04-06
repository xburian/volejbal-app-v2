import React from 'react';
import { SportEvent } from '../../types';
import { Shuffle, RefreshCw, Trophy, Pencil, Check, X } from 'lucide-react';
import { ScoreEditor } from './ScoreEditor';
import { GameHistory } from './GameHistory';

interface TeamSectionProps {
  event: SportEvent;
  canShuffleTeams: boolean;
  // Team management
  onShuffleTeams: () => void;
  onSetWinner: (idx: 0 | 1) => void;
  editingTeamNameIdx: 0 | 1 | null;
  tempTeamName: string;
  onTempTeamNameChange: (v: string) => void;
  onStartEditTeamName: (idx: 0 | 1) => void;
  onSaveTeamName: () => void;
  onCancelEditTeamName: () => void;
  // Score tracking
  setScores: [number, number][];
  isEditingScore: boolean;
  onAddSet: () => void;
  onRemoveSet: (idx: number) => void;
  onSetScoreChange: (setIdx: number, teamIdx: 0 | 1, value: number) => void;
  onSaveScore: () => void;
  onCancelScore: () => void;
  onStartEditScore: () => void;
}

export const TeamSection: React.FC<TeamSectionProps> = ({
  event,
  canShuffleTeams,
  onShuffleTeams,
  onSetWinner,
  editingTeamNameIdx,
  tempTeamName,
  onTempTeamNameChange,
  onStartEditTeamName,
  onSaveTeamName,
  onCancelEditTeamName,
  setScores,
  isEditingScore,
  onAddSet,
  onRemoveSet,
  onSetScoreChange,
  onSaveScore,
  onCancelScore,
  onStartEditScore,
}) => {
  if (!event.teams) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
          <Shuffle size={18} className="text-indigo-500" />
          Rozdělení do týmů
          {(event.gameHistory?.length || 0) > 0 && (
            <span className="text-xs font-normal text-slate-400">
              Hra {(event.gameHistory?.length || 0) + 1}
            </span>
          )}
        </h3>
        <button
          onClick={onShuffleTeams}
          disabled={!canShuffleTeams}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={14} />
          {event.winningTeam !== undefined ? 'Nová hra' : 'Zamíchat'}
        </button>
      </div>

      {/* Team cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {event.teams.map((team, teamIdx) => {
          const isWinner = event.winningTeam === teamIdx;
          const teamName = event.teamNames?.[teamIdx] ?? `Tým ${teamIdx + 1}`;
          const isEditingThisTeam = editingTeamNameIdx === teamIdx;
          return (
            <div key={teamIdx} className={`rounded-lg border-2 p-3 transition-all ${
              isWinner
                ? 'bg-green-50 border-green-400 ring-1 ring-green-200'
                : teamIdx === 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
            }`}>
              <h4 className={`text-sm font-bold mb-2 flex items-center gap-1.5 ${
                isWinner ? 'text-green-700' : teamIdx === 0 ? 'text-blue-700' : 'text-orange-700'
              }`}>
                {isWinner && <Trophy size={14} />}
                {isEditingThisTeam ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tempTeamName}
                      onChange={e => onTempTeamNameChange(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') onSaveTeamName(); if (e.key === 'Escape') onCancelEditTeamName(); }}
                      className="w-24 px-1.5 py-0.5 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-200 outline-none bg-white"
                      autoFocus
                      data-testid={`team-name-input-${teamIdx}`}
                    />
                    <button onClick={onSaveTeamName} className="text-green-600 hover:bg-green-50 p-0.5 rounded" data-testid={`team-name-save-${teamIdx}`}>
                      <Check size={12} />
                    </button>
                    <button onClick={onCancelEditTeamName} className="text-red-500 hover:bg-red-50 p-0.5 rounded" data-testid={`team-name-cancel-${teamIdx}`}>
                      <X size={12} />
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 group/teamname">
                    {teamName} ({team.length})
                    <button
                      onClick={() => onStartEditTeamName(teamIdx as 0 | 1)}
                      className="opacity-0 group-hover/teamname:opacity-100 text-slate-400 hover:text-blue-600 p-0.5 rounded transition-opacity"
                      title="Přejmenovat tým"
                      data-testid={`team-name-edit-${teamIdx}`}
                    >
                      <Pencil size={10} />
                    </button>
                  </span>
                )}
                {isWinner && !isEditingThisTeam && <span className="text-xs font-normal ml-1">— Výherce</span>}
              </h4>
              <div className="space-y-1.5">
                {team.map(p => (
                  <div key={p.userId} className="flex items-center gap-2">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt={p.name} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-slate-700">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Winner buttons */}
      {event.winningTeam === undefined && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {[0, 1].map(idx => {
            const btnTeamName = event.teamNames?.[idx] ?? `Tým ${idx + 1}`;
            return (
              <button
                key={idx}
                onClick={() => onSetWinner(idx as 0 | 1)}
                className="py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200"
                data-testid={`winner-btn-${idx}`}
              >
                <Trophy size={14} />
                {btnTeamName} vyhrál
              </button>
            );
          })}
        </div>
      )}

      {/* Score tracking */}
      <ScoreEditor
        event={event}
        setScores={setScores}
        isEditingScore={isEditingScore}
        onAddSet={onAddSet}
        onRemoveSet={onRemoveSet}
        onSetScoreChange={onSetScoreChange}
        onSaveScore={onSaveScore}
        onCancelScore={onCancelScore}
        onStartEditScore={onStartEditScore}
      />

      {/* Winner announcement */}
      {event.winningTeam !== undefined && (
        <div className="mt-3 text-center text-sm text-green-600 font-medium flex items-center justify-center gap-1.5">
          <Trophy size={14} />
          {event.teamNames?.[event.winningTeam] ?? `Tým ${event.winningTeam + 1}`} vyhrál! Klikněte „Nová hra" pro další kolo.
        </div>
      )}

      {/* Game History */}
      <GameHistory gameHistory={event.gameHistory || []} />
    </div>
  );
};

